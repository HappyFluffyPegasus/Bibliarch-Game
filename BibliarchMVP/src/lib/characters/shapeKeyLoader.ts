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
  eval_deltas?: Record<string, [number, number, number]>  // post-modifier deltas (for subdivision meshes)
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
  const normalize = (s: string) => s.toLowerCase().replace(/_/g, ' ')

  // Collect all mesh nodes that have shape key data
  const meshNodes: { node: THREE.Mesh; meshData: MeshShapeKeyData; meshName: string }[] = []
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return
    const meshName = node.name
    let meshData = data.meshes[meshName]
    if (!meshData) {
      const normalizedName = normalize(meshName)
      const key = Object.keys(data.meshes).find(k => normalize(k) === normalizedName)
      if (key) meshData = data.meshes[key]
    }
    if (meshData) meshNodes.push({ node, meshData, meshName })
  })

  // ── Pass 1: Process Body with clean base_deltas ──
  // Store Body's morph target buffers so clothing can copy from them
  let bodyPositionAttr: THREE.BufferAttribute | null = null
  let bodyMorphBuffers: Map<string, Float32Array> = new Map()

  const bodyEntry = meshNodes.find(e => e.meshName === 'Body')
  if (bodyEntry) {
    const { node, meshData, meshName } = bodyEntry
    const geometry = node.geometry
    const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    if (positionAttr) {
      bodyPositionAttr = positionAttr
      const threeVertexCount = positionAttr.count

      const evalPositions = meshData.eval_positions || meshData.basis_positions
      const basePositions = meshData.base_positions
      const hasMirror = meshData.has_mirror ?? false
      const mirrorAxis = meshData.mirror_axis ?? 0

      if (evalPositions && basePositions) {
        const toThree = detectTransform(positionAttr, evalPositions, meshName)
        if (toThree) {
          const threeHash = buildThreePositionHash(positionAttr, 6)

          // Build base→three mapping with mirror
          const baseToThree = new Map<number, number[]>()
          const baseMirrorToThree = new Map<number, number[]>()
          let directMatches = 0
          let mirrorMatches = 0

          for (let bi = 0; bi < basePositions.length; bi++) {
            const [bx, by, bz] = basePositions[bi]
            const [tx, ty, tz] = toThree(bx, by, bz)
            const key = `${tx.toFixed(6)},${ty.toFixed(6)},${tz.toFixed(6)}`
            const matches = threeHash.get(key)
            if (matches && matches.length > 0) {
              baseToThree.set(bi, [...matches])
              directMatches += matches.length
            }

            if (hasMirror) {
              const mirrored: [number, number, number] = [bx, by, bz]
              mirrored[mirrorAxis] = -mirrored[mirrorAxis]
              const [mx, my, mz] = toThree(mirrored[0], mirrored[1], mirrored[2])
              const mkey = `${mx.toFixed(6)},${my.toFixed(6)},${mz.toFixed(6)}`
              const mmatches = threeHash.get(mkey)
              if (mmatches && mmatches.length > 0) {
                const directSet = new Set(baseToThree.get(bi) || [])
                const mirrorOnly = mmatches.filter(ti => !directSet.has(ti))
                if (mirrorOnly.length > 0) {
                  baseMirrorToThree.set(bi, mirrorOnly)
                  mirrorMatches += mirrorOnly.length
                }
              }
            }
          }

          console.log(`[ShapeKeys] "Body": base→three: ${directMatches} direct, ${mirrorMatches} mirror (${basePositions.length} base verts, ${threeVertexCount} three verts)`)

          // Create morph targets for Body
          if (!geometry.morphAttributes.position) geometry.morphAttributes.position = []
          const existingCount = (geometry.morphAttributes.position as THREE.BufferAttribute[]).length
          if (!node.morphTargetDictionary) node.morphTargetDictionary = {}
          if (!node.morphTargetInfluences) node.morphTargetInfluences = []

          const shapeKeyNames = Object.keys(meshData.shape_keys)
          console.log(`[ShapeKeys] Applying ${shapeKeyNames.length} shape keys to "Body" (base_deltas)`)

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

              const directIndices = baseToThree.get(baseIdx)
              if (directIndices) {
                for (const ti of directIndices) {
                  deltaArray[ti * 3] = dx
                  deltaArray[ti * 3 + 1] = dy
                  deltaArray[ti * 3 + 2] = dz
                }
              }

              const mirrorIndices = baseMirrorToThree.get(baseIdx)
              if (mirrorIndices) {
                const md: [number, number, number] = [dx, dy, dz]
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

            // Store for clothing to copy
            bodyMorphBuffers.set(keyName, deltaArray)

            results.push({ meshName, targetName: keyName, index: morphIndex })
          })

          geometry.morphTargetsRelative = true
        }
      }
    }
  }

  // ── Pass 2: Process non-Body meshes ──
  // For meshes where base matching fails (solidify etc.), copy from nearest Body vertex
  // Build Body position hash for nearest-vertex lookup
  let bodyPosHash: Map<string, number[]> | null = null
  if (bodyPositionAttr) {
    bodyPosHash = buildThreePositionHash(bodyPositionAttr, 4)
  }

  for (const entry of meshNodes) {
    if (entry.meshName === 'Body') continue
    const { node, meshData, meshName } = entry
    const geometry = node.geometry
    const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    if (!positionAttr) continue
    const threeVertexCount = positionAttr.count

    const evalPositions = meshData.eval_positions || meshData.basis_positions
    const basePositions = meshData.base_positions
    const hasMirror = meshData.has_mirror ?? false
    const mirrorAxis = meshData.mirror_axis ?? 0

    if (!evalPositions || evalPositions.length === 0) continue

    const toThree = detectTransform(positionAttr, evalPositions, meshName)
    if (!toThree) continue

    const threeHash = buildThreePositionHash(positionAttr, 6)

    // Try base position matching first
    let directMatches = 0
    let mirrorMatches = 0
    const baseToThree = new Map<number, number[]>()
    const baseMirrorToThree = new Map<number, number[]>()

    if (basePositions && basePositions.length > 0) {
      for (let bi = 0; bi < basePositions.length; bi++) {
        const [bx, by, bz] = basePositions[bi]
        const [tx, ty, tz] = toThree(bx, by, bz)
        const key = `${tx.toFixed(6)},${ty.toFixed(6)},${tz.toFixed(6)}`
        const matches = threeHash.get(key)
        if (matches && matches.length > 0) {
          baseToThree.set(bi, [...matches])
          directMatches += matches.length
        }

        if (hasMirror) {
          const mirrored: [number, number, number] = [bx, by, bz]
          mirrored[mirrorAxis] = -mirrored[mirrorAxis]
          const [mx, my, mz] = toThree(mirrored[0], mirrored[1], mirrored[2])
          const mkey = `${mx.toFixed(6)},${my.toFixed(6)},${mz.toFixed(6)}`
          const mmatches = threeHash.get(mkey)
          if (mmatches && mmatches.length > 0) {
            const directSet = new Set(baseToThree.get(bi) || [])
            const mirrorOnly = mmatches.filter(ti => !directSet.has(ti))
            if (mirrorOnly.length > 0) {
              baseMirrorToThree.set(bi, mirrorOnly)
              mirrorMatches += mirrorOnly.length
            }
          }
        }
      }
    }

    const baseMatchRate = threeVertexCount > 0 ? directMatches / threeVertexCount : 0
    console.log(`[ShapeKeys] "${meshName}": base→three: ${directMatches} direct, ${mirrorMatches} mirror (rate=${(baseMatchRate * 100).toFixed(1)}%)`)

    // If base matching is good, use base_deltas (same as Body approach)
    const useBodyCopy = baseMatchRate < 0.3 && bodyPositionAttr && bodyMorphBuffers.size > 0

    if (useBodyCopy) {
      console.log(`[ShapeKeys] "${meshName}": copying morph deltas from nearest Body vertex`)

      // Map each clothing vertex → nearest Body vertex index
      const clothingToBody = new Int32Array(threeVertexCount).fill(-1)
      let mapped = 0

      for (let ci = 0; ci < threeVertexCount; ci++) {
        const cx = positionAttr.getX(ci)
        const cy = positionAttr.getY(ci)
        const cz = positionAttr.getZ(ci)

        // Try hash lookup at decreasing precision
        let found = false
        if (bodyPosHash) {
          const key = `${cx.toFixed(4)},${cy.toFixed(4)},${cz.toFixed(4)}`
          const bodyIndices = bodyPosHash.get(key)
          if (bodyIndices && bodyIndices.length > 0) {
            clothingToBody[ci] = bodyIndices[0]
            mapped++
            found = true
          }
        }

        // Fallback: brute force nearest Body vertex
        if (!found && bodyPositionAttr) {
          let bestDist = Infinity
          let bestIdx = -1
          for (let bi = 0; bi < bodyPositionAttr.count; bi++) {
            const dx = cx - bodyPositionAttr.getX(bi)
            const dy = cy - bodyPositionAttr.getY(bi)
            const dz = cz - bodyPositionAttr.getZ(bi)
            const d = dx * dx + dy * dy + dz * dz
            if (d < bestDist) {
              bestDist = d
              bestIdx = bi
            }
          }
          if (bestIdx >= 0 && bestDist < 0.01) {  // Max distance threshold
            clothingToBody[ci] = bestIdx
            mapped++
          }
        }
      }

      console.log(`[ShapeKeys] "${meshName}": ${mapped}/${threeVertexCount} verts mapped to Body`)

      // Create morph targets by copying Body deltas
      if (!geometry.morphAttributes.position) geometry.morphAttributes.position = []
      const existingCount = (geometry.morphAttributes.position as THREE.BufferAttribute[]).length
      if (!node.morphTargetDictionary) node.morphTargetDictionary = {}
      if (!node.morphTargetInfluences) node.morphTargetInfluences = []

      let addedCount = 0
      bodyMorphBuffers.forEach((bodyDeltas, keyName) => {
        if (node.morphTargetDictionary![keyName] !== undefined) return
        const morphIndex = existingCount + addedCount
        addedCount++

        const deltaArray = new Float32Array(threeVertexCount * 3)
        for (let ci = 0; ci < threeVertexCount; ci++) {
          const bi = clothingToBody[ci]
          if (bi >= 0) {
            deltaArray[ci * 3] = bodyDeltas[bi * 3]
            deltaArray[ci * 3 + 1] = bodyDeltas[bi * 3 + 1]
            deltaArray[ci * 3 + 2] = bodyDeltas[bi * 3 + 2]
          }
        }

        const morphAttr = new THREE.Float32BufferAttribute(deltaArray, 3)
        morphAttr.name = keyName
        ;(geometry.morphAttributes.position as THREE.Float32BufferAttribute[]).push(morphAttr)
        node.morphTargetDictionary![keyName] = morphIndex
        node.morphTargetInfluences![morphIndex] = 0
        results.push({ meshName, targetName: keyName, index: morphIndex })
      })

      geometry.morphTargetsRelative = true

    } else {
      // Good base match rate — use base_deltas directly (same as Body)
      if (!geometry.morphAttributes.position) geometry.morphAttributes.position = []
      const existingCount = (geometry.morphAttributes.position as THREE.BufferAttribute[]).length
      if (!node.morphTargetDictionary) node.morphTargetDictionary = {}
      if (!node.morphTargetInfluences) node.morphTargetInfluences = []

      const shapeKeyNames = Object.keys(meshData.shape_keys)
      console.log(`[ShapeKeys] Applying ${shapeKeyNames.length} shape keys to "${meshName}" (base_deltas)`)

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

          const directIndices = baseToThree.get(baseIdx)
          if (directIndices) {
            for (const ti of directIndices) {
              deltaArray[ti * 3] = dx
              deltaArray[ti * 3 + 1] = dy
              deltaArray[ti * 3 + 2] = dz
            }
          }

          const mirrorIndices = baseMirrorToThree.get(baseIdx)
          if (mirrorIndices) {
            const md: [number, number, number] = [dx, dy, dz]
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
    }
  }

  if (results.length > 0) {
    console.log(`[ShapeKeys] Total morph targets applied: ${results.length}`)
  }
  return results
}
