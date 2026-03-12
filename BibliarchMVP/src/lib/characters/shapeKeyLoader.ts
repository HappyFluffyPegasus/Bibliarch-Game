/**
 * Shape Key Loader for Bibliarch
 *
 * Loads shape key deltas exported from Blender's key_blocks (raw shape key data,
 * before modifiers) and applies them as morph targets to Three.js meshes.
 *
 * Handles mirror modifier: base mesh vertices (right side) are matched to FBX
 * vertices directly. Mirrored (left side) FBX vertices are detected by checking
 * for a mirror-flipped base position, and get mirrored deltas.
 */

import * as THREE from 'three'

interface ShapeKeyDelta {
  min: number
  max: number
  deltas: Record<string, [number, number, number]>
}

interface MeshShapeKeyData {
  mesh_name: string
  vertex_count: number
  base_positions?: [number, number, number][]   // pre-modifier base mesh positions
  eval_positions?: [number, number, number][]   // post-modifier evaluated positions (for FBX matching)
  basis_positions?: [number, number, number][]  // v2 compat
  has_mirror?: boolean
  mirror_axis?: number  // 0=X, 1=Y, 2=Z
  shape_keys: Record<string, ShapeKeyDelta>
}

interface ShapeKeyExport {
  version: number
  generator: string
  meshes: Record<string, MeshShapeKeyData>
}

let shapeKeyDataCache: ShapeKeyExport | null = null
let loadingPromise: Promise<ShapeKeyExport | null> | null = null

export async function loadShapeKeyData(path: string = '/models/shape_keys.json'): Promise<ShapeKeyExport | null> {
  if (shapeKeyDataCache) return shapeKeyDataCache
  if (loadingPromise) return loadingPromise

  loadingPromise = fetch(path)
    .then(res => {
      if (!res.ok) return null
      return res.json()
    })
    .then((data: ShapeKeyExport | null) => {
      if (data) {
        shapeKeyDataCache = data
        const meshCount = Object.keys(data.meshes).length
        const totalKeys = Object.values(data.meshes)
          .reduce((sum, m) => sum + Object.keys(m.shape_keys).length, 0)
        console.log(`[ShapeKeys] Loaded ${totalKeys} shape keys for ${meshCount} mesh(es) (v${data.version})`)
      }
      return data
    })
    .catch(err => {
      console.warn('[ShapeKeys] Failed to load shape key data:', err)
      return null
    })

  return loadingPromise
}

/**
 * Auto-detect coordinate transform between Blender positions and Three.js FBX positions.
 */
function detectTransform(
  threePositions: THREE.BufferAttribute,
  blenderPositions: [number, number, number][],
  meshName: string
): ((bx: number, by: number, bz: number) => [number, number, number]) | null {
  type AxisMap = (x: number, y: number, z: number) => [number, number, number]
  const axisMaps: AxisMap[] = [
    (x, y, z) => [x, y, z],
    (x, y, z) => [x, z, -y],
    (x, y, z) => [x, -z, y],
    (x, y, z) => [-x, z, y],
  ]
  const scales = [1, 100, 0.01]

  const sampleCount = Math.min(20, threePositions.count)
  const step = Math.max(1, Math.floor(threePositions.count / sampleCount))
  const samples: [number, number, number][] = []
  for (let i = 0; i < threePositions.count && samples.length < sampleCount; i += step) {
    samples.push([threePositions.getX(i), threePositions.getY(i), threePositions.getZ(i)])
  }

  let bestFn: AxisMap = axisMaps[0]
  let bestScore = Infinity

  for (const scale of scales) {
    for (const axisMap of axisMaps) {
      let totalDist = 0
      for (const [tx, ty, tz] of samples) {
        let minDist = Infinity
        for (const bp of blenderPositions) {
          const [cx, cy, cz] = axisMap(bp[0] * scale, bp[1] * scale, bp[2] * scale)
          const d = (tx - cx) ** 2 + (ty - cy) ** 2 + (tz - cz) ** 2
          if (d < minDist) minDist = d
        }
        totalDist += minDist
      }
      if (totalDist < bestScore) {
        bestScore = totalDist
        const s = scale
        const fn = axisMap
        bestFn = (x, y, z) => fn(x * s, y * s, z * s)
      }
      if (totalDist < 0.001) break
    }
    if (bestScore < 0.001) break
  }

  const avgDist = Math.sqrt(bestScore / samples.length)
  console.log(`[ShapeKeys] "${meshName}": transform avgDist=${avgDist.toFixed(6)}`)
  if (avgDist > 1.0) {
    console.warn(`[ShapeKeys] "${meshName}": transform detection failed (avgDist=${avgDist.toFixed(4)})`)
    return null
  }

  return bestFn
}

/**
 * Build a hash map from position string to list of Three.js vertex indices.
 */
function buildThreePositionHash(
  positions: THREE.BufferAttribute,
  decimals: number
): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (let i = 0; i < positions.count; i++) {
    const key = `${positions.getX(i).toFixed(decimals)},${positions.getY(i).toFixed(decimals)},${positions.getZ(i).toFixed(decimals)}`
    const arr = map.get(key)
    if (arr) arr.push(i)
    else map.set(key, [i])
  }
  return map
}

export function applyShapeKeysToModel(
  root: THREE.Object3D,
  data: ShapeKeyExport
): { meshName: string; targetName: string; index: number }[] {
  const results: { meshName: string; targetName: string; index: number }[] = []

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return

    const meshName = node.name
    let meshData = data.meshes[meshName]
    if (!meshData) {
      const lowerName = meshName.toLowerCase()
      const key = Object.keys(data.meshes).find(k => k.toLowerCase() === lowerName)
      if (key) meshData = data.meshes[key]
    }
    if (!meshData) return

    const geometry = node.geometry
    const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    if (!positionAttr) return
    const threeVertexCount = positionAttr.count

    // v3: use eval_positions for FBX matching, base_positions + deltas for shape keys
    // v2 compat: use basis_positions
    const evalPositions = meshData.eval_positions || meshData.basis_positions
    const basePositions = meshData.base_positions
    const hasMirror = meshData.has_mirror ?? false
    const mirrorAxis = meshData.mirror_axis ?? 0

    if (!evalPositions || evalPositions.length === 0) {
      console.warn(`[ShapeKeys] "${meshName}": no position data, skipping`)
      return
    }

    // Detect coordinate transform (Blender space → Three.js FBX space)
    const toThree = detectTransform(positionAttr, evalPositions, meshName)
    if (!toThree) return

    // Build hash of Three.js vertex positions for fast lookup
    const threeHash = buildThreePositionHash(positionAttr, 6)

    // If v3 format with base_positions: map base mesh verts → Three.js verts
    // and handle mirror by also checking flipped positions
    if (basePositions && basePositions.length > 0) {
      // Map: baseIdx → [threeIdx, ...]
      const baseToThree = new Map<number, number[]>()
      // Map: baseIdx → [threeIdx, ...] for mirrored vertices
      const baseMirrorToThree = new Map<number, number[]>()

      let directMatches = 0
      let mirrorMatches = 0

      for (let bi = 0; bi < basePositions.length; bi++) {
        const [bx, by, bz] = basePositions[bi]
        const [tx, ty, tz] = toThree(bx, by, bz)

        // Try exact match at multiple precisions
        for (const dec of [6, 5, 4]) {
          const key = `${tx.toFixed(dec)},${ty.toFixed(dec)},${tz.toFixed(dec)}`
          // Need to rebuild hash at this precision if not 6
          // For simplicity, just use the position attribute directly for lower precisions
          if (dec === 6) {
            const matches = threeHash.get(key)
            if (matches && matches.length > 0) {
              baseToThree.set(bi, [...matches])
              directMatches += matches.length
              break
            }
          } else {
            // Fallback: scan (only needed if 6-decimal match fails)
            const found: number[] = []
            for (let ti = 0; ti < threeVertexCount; ti++) {
              if (
                positionAttr.getX(ti).toFixed(dec) === tx.toFixed(dec) &&
                positionAttr.getY(ti).toFixed(dec) === ty.toFixed(dec) &&
                positionAttr.getZ(ti).toFixed(dec) === tz.toFixed(dec)
              ) {
                found.push(ti)
              }
            }
            if (found.length > 0) {
              baseToThree.set(bi, found)
              directMatches += found.length
              break
            }
          }
        }

        // If mirror: also find Three.js vertices at the mirrored position
        if (hasMirror) {
          const mirrored: [number, number, number] = [bx, by, bz]
          mirrored[mirrorAxis] = -mirrored[mirrorAxis]
          const [mx, my, mz] = toThree(mirrored[0], mirrored[1], mirrored[2])

          for (const dec of [6, 5, 4]) {
            const key = `${mx.toFixed(dec)},${my.toFixed(dec)},${mz.toFixed(dec)}`
            if (dec === 6) {
              const matches = threeHash.get(key)
              if (matches && matches.length > 0) {
                // Filter out vertices already matched directly
                const directSet = new Set(baseToThree.get(bi) || [])
                const mirrorOnly = matches.filter(ti => !directSet.has(ti))
                if (mirrorOnly.length > 0) {
                  baseMirrorToThree.set(bi, mirrorOnly)
                  mirrorMatches += mirrorOnly.length
                }
                break
              }
            }
          }
        }
      }

      console.log(`[ShapeKeys] "${meshName}": base→three: ${directMatches} direct, ${mirrorMatches} mirror (${basePositions.length} base verts, ${threeVertexCount} three verts)`)

      // Apply shape keys using base mesh mapping
      if (!geometry.morphAttributes.position) {
        geometry.morphAttributes.position = []
      }
      const existingCount = (geometry.morphAttributes.position as THREE.BufferAttribute[]).length
      if (!node.morphTargetDictionary) node.morphTargetDictionary = {}
      if (!node.morphTargetInfluences) node.morphTargetInfluences = []

      const shapeKeyNames = Object.keys(meshData.shape_keys)
      console.log(`[ShapeKeys] Applying ${shapeKeyNames.length} shape keys to "${meshName}"`)

      let addedCount = 0
      shapeKeyNames.forEach((keyName) => {
        if (node.morphTargetDictionary![keyName] !== undefined) return

        const keyData = meshData.shape_keys[keyName]
        const morphIndex = existingCount + addedCount
        addedCount++

        const deltaArray = new Float32Array(threeVertexCount * 3)

        Object.entries(keyData.deltas).forEach(([baseIdxStr, delta]) => {
          const baseIdx = parseInt(baseIdxStr, 10)
          const [dx, dy, dz] = toThree(delta[0], delta[1], delta[2])

          // Apply to directly matched Three.js vertices
          const directIndices = baseToThree.get(baseIdx)
          if (directIndices) {
            for (const ti of directIndices) {
              deltaArray[ti * 3] = dx
              deltaArray[ti * 3 + 1] = dy
              deltaArray[ti * 3 + 2] = dz
            }
          }

          // Apply mirrored delta to mirror-matched Three.js vertices
          const mirrorIndices = baseMirrorToThree.get(baseIdx)
          if (mirrorIndices) {
            // Mirror the delta on the mirror axis
            const md: [number, number, number] = [dx, dy, dz]
            // The toThree transform was already applied to the delta.
            // We need to flip the component that corresponds to the mirror axis
            // in Three.js space. Since transform is identity (detected), the
            // mirror axis maps directly.
            md[mirrorAxis] = -md[mirrorAxis]

            for (const ti of mirrorIndices) {
              deltaArray[ti * 3] = md[0]
              deltaArray[ti * 3 + 1] = md[1]
              deltaArray[ti * 3 + 2] = md[2]
            }
          }
        })

        const morphAttr = new THREE.Float32BufferAttribute(deltaArray, 3)
        morphAttr.name = keyName
        ;(geometry.morphAttributes.position as THREE.Float32BufferAttribute[]).push(morphAttr)

        node.morphTargetDictionary![keyName] = morphIndex
        node.morphTargetInfluences![morphIndex] = 0

        results.push({ meshName, targetName: keyName, index: morphIndex })
      })

      geometry.morphTargetsRelative = true

    } else {
      // v2 fallback: use eval_positions with hash matching (old approach)
      console.warn(`[ShapeKeys] "${meshName}": no base_positions, using eval_positions fallback`)

      const evalToThree = new Map<number, number[]>()
      let matched = 0
      for (let ei = 0; ei < evalPositions.length; ei++) {
        const [tx, ty, tz] = toThree(evalPositions[ei][0], evalPositions[ei][1], evalPositions[ei][2])
        const key = `${tx.toFixed(6)},${ty.toFixed(6)},${tz.toFixed(6)}`
        const threeIndices = threeHash.get(key)
        if (threeIndices) {
          evalToThree.set(ei, [...threeIndices])
          matched += threeIndices.length
        }
      }

      if (!geometry.morphAttributes.position) {
        geometry.morphAttributes.position = []
      }
      const existingCount = (geometry.morphAttributes.position as THREE.BufferAttribute[]).length
      if (!node.morphTargetDictionary) node.morphTargetDictionary = {}
      if (!node.morphTargetInfluences) node.morphTargetInfluences = []

      let addedCount = 0
      Object.keys(meshData.shape_keys).forEach((keyName) => {
        if (node.morphTargetDictionary![keyName] !== undefined) return
        const keyData = meshData.shape_keys[keyName]
        const morphIndex = existingCount + addedCount
        addedCount++

        const deltaArray = new Float32Array(threeVertexCount * 3)
        const MAX_DELTA_SQ = 0.1 * 0.1

        Object.entries(keyData.deltas).forEach(([idxStr, delta]) => {
          const magSq = delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2
          if (magSq > MAX_DELTA_SQ) return
          const idx = parseInt(idxStr, 10)
          const threeIndices = evalToThree.get(idx)
          if (threeIndices) {
            const [dx, dy, dz] = toThree(delta[0], delta[1], delta[2])
            for (const ti of threeIndices) {
              deltaArray[ti * 3] = dx
              deltaArray[ti * 3 + 1] = dy
              deltaArray[ti * 3 + 2] = dz
            }
          }
        })

        const morphAttr = new THREE.Float32BufferAttribute(deltaArray, 3)
        morphAttr.name = keyName
        ;(geometry.morphAttributes.position as THREE.Float32BufferAttribute[]).push(morphAttr)
        node.morphTargetDictionary![keyName] = morphIndex
        node.morphTargetInfluences![morphIndex] = 0
        results.push({ meshName, targetName: keyName, index: morphIndex })
      })

      geometry.morphTargetsRelative = true
    }

    // Don't call updateMorphTargets() — it overwrites our dictionary
  })

  if (results.length > 0) {
    console.log(`[ShapeKeys] Total morph targets applied: ${results.length}`)
  }
  return results
}
