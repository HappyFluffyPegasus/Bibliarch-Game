/**
 * Complex mesh operations — all pure functions returning new MeshData.
 * Used by useItemTransform for interactive extrude, inset, bevel, loop cut, etc.
 */

import { ItemVertex, ItemFace } from '@/types/items'
import { computeFaceNormal, computeFaceCenter, type MeshData } from '@/utils/itemMeshUtils'
import {
  buildAdjacency,
  edgeKeyStr,
  parseEdgeKey,
  type AdjacencyData,
} from './meshTopology'

// ── Inset Face ──────────────────────────────────────────────

/**
 * Inset a face by `amount` (0-1 range, fraction toward center).
 * Creates an inner face + connecting quads between inner and outer edges.
 */
export function insetFace(
  vertices: ItemVertex[],
  faces: ItemFace[],
  faceIndex: number,
  amount: number
): MeshData {
  const face = faces[faceIndex]
  if (!face || face.vertexIndices.length < 3) return { vertices, faces }

  const center = computeFaceCenter(vertices, face)
  const t = Math.max(0, Math.min(1, amount))

  const newVertices = [...vertices]
  const newFaces = [...faces]

  // Create inner vertices (lerp toward center)
  const innerIndices: number[] = []
  for (const vi of face.vertexIndices) {
    const pos = vertices[vi].position
    const newIdx = newVertices.length
    newVertices.push({
      position: [
        pos[0] + (center[0] - pos[0]) * t,
        pos[1] + (center[1] - pos[1]) * t,
        pos[2] + (center[2] - pos[2]) * t,
      ],
    })
    innerIndices.push(newIdx)
  }

  // Replace original face with the inner face
  newFaces[faceIndex] = {
    vertexIndices: [...innerIndices],
    color: face.color,
  }

  // Create connecting quads between outer and inner edges
  const count = face.vertexIndices.length
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count
    newFaces.push({
      vertexIndices: [
        face.vertexIndices[i],
        face.vertexIndices[next],
        innerIndices[next],
        innerIndices[i],
      ],
      color: face.color,
    })
  }

  return { vertices: newVertices, faces: newFaces }
}

// ── Bevel Edges ─────────────────────────────────────────────

/**
 * Bevel selected edges by splitting each edge vertex into two offset vertices.
 * `width` controls the offset distance, `segments` for subdivision (1 = flat bevel).
 */
export function bevelEdges(
  vertices: ItemVertex[],
  faces: ItemFace[],
  selectedEdgeKeys: string[],
  width: number,
  segments: number = 1
): MeshData {
  if (selectedEdgeKeys.length === 0) return { vertices, faces }

  const newVertices = [...vertices]
  const newFaces: ItemFace[] = []

  // Track which vertices need splitting and their replacements per edge
  const edgeSet = new Set(selectedEdgeKeys)
  // For each original vertex on a beveled edge, map to its split vertices
  const vertexSplits = new Map<number, Map<string, number>>()

  // Create split vertices for each edge
  for (const ek of selectedEdgeKeys) {
    const [a, b] = parseEdgeKey(ek)
    const posA = vertices[a].position
    const posB = vertices[b].position

    // Direction from a to b
    const dx = posB[0] - posA[0]
    const dy = posB[1] - posA[1]
    const dz = posB[2] - posA[2]
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (len < 1e-8) continue

    const nx = dx / len
    const ny = dy / len
    const nz = dz / len
    const w = Math.min(width, len * 0.4) // Cap at 40% of edge length

    // Split vertex a: create new vertex offset toward b
    const splitA = newVertices.length
    newVertices.push({
      position: [posA[0] + nx * w, posA[1] + ny * w, posA[2] + nz * w],
    })
    if (!vertexSplits.has(a)) vertexSplits.set(a, new Map())
    vertexSplits.get(a)!.set(ek, splitA)

    // Split vertex b: create new vertex offset toward a
    const splitB = newVertices.length
    newVertices.push({
      position: [posB[0] - nx * w, posB[1] - ny * w, posB[2] - nz * w],
    })
    if (!vertexSplits.has(b)) vertexSplits.set(b, new Map())
    vertexSplits.get(b)!.set(ek, splitB)

    // Add the bevel face between original and split vertices
    newFaces.push({
      vertexIndices: [a, splitA, splitB, b],
      color: '#888888',
    })
  }

  // Rebuild existing faces, replacing vertices that were split
  for (const face of faces) {
    const newIdx: number[] = []
    for (let i = 0; i < face.vertexIndices.length; i++) {
      const vi = face.vertexIndices[i]
      const nextVi = face.vertexIndices[(i + 1) % face.vertexIndices.length]
      const prevVi = face.vertexIndices[(i - 1 + face.vertexIndices.length) % face.vertexIndices.length]

      const splits = vertexSplits.get(vi)
      if (splits) {
        // Check which edge connections this face uses
        const ekNext = edgeKeyStr(vi, nextVi)
        const ekPrev = edgeKeyStr(vi, prevVi)

        if (splits.has(ekPrev)) {
          newIdx.push(splits.get(ekPrev)!)
        } else if (splits.has(ekNext)) {
          newIdx.push(splits.get(ekNext)!)
        } else {
          newIdx.push(vi)
        }
      } else {
        newIdx.push(vi)
      }
    }
    newFaces.push({ vertexIndices: newIdx, color: face.color })
  }

  return { vertices: newVertices, faces: newFaces }
}

// ── Loop Cut ────────────────────────────────────────────────

/**
 * Insert edge loop(s) across a ring of quad faces.
 * `edgeIndex` identifies which edge to cut across.
 * `position` is 0-1 interpolation along the edge.
 * `cuts` is how many parallel loops to insert.
 */
export function loopCut(
  vertices: ItemVertex[],
  faces: ItemFace[],
  faceRing: number[],
  edgeKeysPerFace: string[][],
  position: number = 0.5,
  cuts: number = 1
): MeshData {
  if (faceRing.length === 0) return { vertices, faces }

  let currentVertices = [...vertices]
  let currentFaces = [...faces]

  for (let cut = 0; cut < cuts; cut++) {
    const t = cuts === 1 ? position : (cut + 1) / (cuts + 1)
    const result = insertSingleLoopCut(currentVertices, currentFaces, faceRing, edgeKeysPerFace, t)
    currentVertices = result.vertices
    currentFaces = result.faces
    // After first cut, face indices shift — for simplicity, only support 1 cut precisely
    if (cuts > 1) break
  }

  return { vertices: currentVertices, faces: currentFaces }
}

function insertSingleLoopCut(
  vertices: ItemVertex[],
  faces: ItemFace[],
  faceRing: number[],
  edgeKeysPerFace: string[][],
  t: number
): MeshData {
  const newVertices = [...vertices]
  const newFaces = [...faces]
  const midpointMap = new Map<string, number>()

  // Create midpoints for each edge being cut
  for (const edges of edgeKeysPerFace) {
    for (const ek of edges) {
      if (midpointMap.has(ek)) continue
      const [a, b] = parseEdgeKey(ek)
      const posA = vertices[a].position
      const posB = vertices[b].position
      const midIdx = newVertices.length
      newVertices.push({
        position: [
          posA[0] + (posB[0] - posA[0]) * t,
          posA[1] + (posB[1] - posA[1]) * t,
          posA[2] + (posB[2] - posA[2]) * t,
        ],
      })
      midpointMap.set(ek, midIdx)
    }
  }

  // Split each face in the ring into two quads
  const facesToRemove = new Set(faceRing)
  const keptFaces = newFaces.filter((_, i) => !facesToRemove.has(i))

  for (let ri = 0; ri < faceRing.length; ri++) {
    const fi = faceRing[ri]
    const face = faces[fi]
    if (!face || face.vertexIndices.length !== 4) continue

    const edges = edgeKeysPerFace[ri]
    if (!edges || edges.length !== 2) continue

    const idx = face.vertexIndices
    const [ek0, ek1] = edges
    const mid0 = midpointMap.get(ek0)
    const mid1 = midpointMap.get(ek1)
    if (mid0 === undefined || mid1 === undefined) continue

    const [e0a, e0b] = parseEdgeKey(ek0)
    const [e1a, e1b] = parseEdgeKey(ek1)

    // Find which side of the quad each edge is on
    const pos0 = idx.indexOf(e0a)
    const pos0b = idx.indexOf(e0b)

    // Determine split: edges should be on opposite sides
    // First half: from edge0 midpoint going one direction, second half the other
    let half1: number[], half2: number[]

    if (Math.abs(pos0 - pos0b) === 1 || Math.abs(pos0 - pos0b) === 3) {
      // Adjacent vertices form this edge
      const edgeStart = Math.min(pos0, pos0b)
      if (edgeStart === 0 && Math.max(pos0, pos0b) === 3) {
        // Edge wraps around [3,0]
        half1 = [mid0, idx[0], idx[1], mid1]
        half2 = [mid1, idx[2], idx[3], mid0]
      } else if (edgeStart === 0) {
        half1 = [mid0, idx[1], idx[2], mid1]
        half2 = [mid1, idx[3], idx[0], mid0]
      } else if (edgeStart === 1) {
        half1 = [idx[0], mid0, mid1, idx[3]]
        half2 = [mid0, idx[2], idx[3], mid1]
      } else {
        half1 = [idx[0], idx[1], mid0, mid1]
        half2 = [mid1, mid0, idx[3], idx[0]]
      }
    } else {
      // Fallback: simple split
      half1 = [idx[0], idx[1], mid0, mid1]
      half2 = [mid1, mid0, idx[2], idx[3]]
    }

    keptFaces.push({ vertexIndices: half1, color: face.color })
    keptFaces.push({ vertexIndices: half2, color: face.color })
  }

  return { vertices: newVertices, faces: keptFaces }
}

// ── Knife Cut ───────────────────────────────────────────────

/**
 * Split faces along a polyline of cut points on the mesh surface.
 * Each cutPoint has a faceIndex and a 3D position on that face.
 */
export interface KnifeCutPoint {
  faceIndex: number
  position: [number, number, number]
}

export function knifeCut(
  vertices: ItemVertex[],
  faces: ItemFace[],
  cutPoints: KnifeCutPoint[]
): MeshData {
  if (cutPoints.length < 2) return { vertices, faces }

  const newVertices = [...vertices]
  const newFaces = [...faces]
  const facesToRemove = new Set<number>()

  // For each consecutive pair of cut points on the same face, split that face
  for (let i = 0; i < cutPoints.length - 1; i++) {
    const cp1 = cutPoints[i]
    const cp2 = cutPoints[i + 1]

    if (cp1.faceIndex !== cp2.faceIndex) continue

    const face = newFaces[cp1.faceIndex]
    if (!face) continue

    // Add cut vertices
    const v1Idx = newVertices.length
    newVertices.push({ position: [...cp1.position] })
    const v2Idx = newVertices.length
    newVertices.push({ position: [...cp2.position] })

    // Split the face into two faces along the cut line
    // Simple approach: find nearest edges and split
    const idx = face.vertexIndices
    const nearestEdge1 = findNearestEdge(cp1.position, idx, newVertices)
    const nearestEdge2 = findNearestEdge(cp2.position, idx, newVertices)

    if (nearestEdge1 !== nearestEdge2) {
      // Create two new faces split along the cut
      const face1Verts: number[] = []
      const face2Verts: number[] = []
      let inFirst = true

      for (let j = 0; j < idx.length; j++) {
        if (inFirst) face1Verts.push(idx[j])
        else face2Verts.push(idx[j])

        if (j === nearestEdge1) {
          face1Verts.push(v1Idx)
          face1Verts.push(v2Idx)
          inFirst = false
          face2Verts.push(v2Idx)
          face2Verts.push(v1Idx)
        } else if (j === nearestEdge2) {
          face2Verts.push(v2Idx)
          face2Verts.push(v1Idx)
          inFirst = true
          face1Verts.push(v1Idx)
          face1Verts.push(v2Idx)
        }
      }

      facesToRemove.add(cp1.faceIndex)
      if (face1Verts.length >= 3) {
        newFaces.push({ vertexIndices: face1Verts, color: face.color })
      }
      if (face2Verts.length >= 3) {
        newFaces.push({ vertexIndices: face2Verts, color: face.color })
      }
    }
  }

  const finalFaces = newFaces.filter((_, i) => !facesToRemove.has(i))
  return { vertices: newVertices, faces: finalFaces }
}

function findNearestEdge(
  point: [number, number, number],
  faceIndices: number[],
  vertices: ItemVertex[]
): number {
  let bestEdge = 0
  let bestDist = Infinity

  for (let i = 0; i < faceIndices.length; i++) {
    const a = vertices[faceIndices[i]].position
    const b = vertices[faceIndices[(i + 1) % faceIndices.length]].position

    // Distance from point to edge midpoint
    const mx = (a[0] + b[0]) / 2
    const my = (a[1] + b[1]) / 2
    const mz = (a[2] + b[2]) / 2
    const dx = point[0] - mx
    const dy = point[1] - my
    const dz = point[2] - mz
    const dist = dx * dx + dy * dy + dz * dz

    if (dist < bestDist) {
      bestDist = dist
      bestEdge = i
    }
  }

  return bestEdge
}

// ── Dissolve Operations ─────────────────────────────────────

/** Dissolve edges: merge the two faces on each side of selected edges */
export function dissolveEdges(
  vertices: ItemVertex[],
  faces: ItemFace[],
  edgeKeysToDissolve: string[]
): MeshData {
  const adjacency = buildAdjacency(vertices, faces)
  const facesToMerge = new Map<number, Set<number>>() // face → faces to merge with

  for (const ek of edgeKeysToDissolve) {
    const facesOnEdge = adjacency.edgeToFaces.get(ek)
    if (!facesOnEdge || facesOnEdge.size !== 2) continue

    const [f1, f2] = Array.from(facesOnEdge)
    if (!facesToMerge.has(f1)) facesToMerge.set(f1, new Set())
    if (!facesToMerge.has(f2)) facesToMerge.set(f2, new Set())
    facesToMerge.get(f1)!.add(f2)
    facesToMerge.get(f2)!.add(f1)
  }

  // Build merged face groups using union-find
  const visited = new Set<number>()
  const mergedFaces: ItemFace[] = []
  const removedFaces = new Set<number>()

  for (const [fi, mergeWith] of facesToMerge) {
    if (visited.has(fi)) continue

    // Collect all faces in this merge group
    const group = new Set<number>()
    const queue = [fi]
    while (queue.length > 0) {
      const current = queue.pop()!
      if (group.has(current)) continue
      group.add(current)
      const neighbors = facesToMerge.get(current)
      if (neighbors) {
        for (const n of neighbors) {
          if (!group.has(n)) queue.push(n)
        }
      }
    }

    // Merge all faces in group into one by collecting unique vertices
    const allVerts = new Set<number>()
    for (const gfi of group) {
      visited.add(gfi)
      removedFaces.add(gfi)
      for (const vi of faces[gfi].vertexIndices) allVerts.add(vi)
    }

    // Use the color from the first face
    const firstFace = faces[fi]
    mergedFaces.push({
      vertexIndices: Array.from(allVerts),
      color: firstFace.color,
    })
  }

  const remainingFaces = faces.filter((_, i) => !removedFaces.has(i))
  return { vertices: [...vertices], faces: [...remainingFaces, ...mergedFaces] }
}

/** Dissolve vertices: remove vertices, merging connected faces */
export function dissolveVertices(
  vertices: ItemVertex[],
  faces: ItemFace[],
  vertexIndicesToDissolve: number[]
): MeshData {
  const adjacency = buildAdjacency(vertices, faces)
  const newFaces = [...faces]
  const facesToRemove = new Set<number>()

  for (const vi of vertexIndicesToDissolve) {
    const connectedFaces = adjacency.vertexToFaces.get(vi)
    if (!connectedFaces || connectedFaces.size === 0) continue

    // Collect all vertices from connected faces, excluding the dissolved vertex
    const allVerts = new Set<number>()
    let color = '#888888'
    for (const fi of connectedFaces) {
      facesToRemove.add(fi)
      const face = faces[fi]
      if (face) {
        color = face.color
        for (const fvi of face.vertexIndices) {
          if (fvi !== vi) allVerts.add(fvi)
        }
      }
    }

    if (allVerts.size >= 3) {
      newFaces.push({ vertexIndices: Array.from(allVerts), color })
    }
  }

  // Remove dissolved faces and add merged ones
  const remainingFaces = newFaces.filter((_, i) => !facesToRemove.has(i))

  // Remove dissolved vertices and remap indices
  const deleteSet = new Set(vertexIndicesToDissolve)
  const indexMap = new Map<number, number>()
  let newIdx = 0
  for (let i = 0; i < vertices.length; i++) {
    if (!deleteSet.has(i)) indexMap.set(i, newIdx++)
  }

  const finalVertices = vertices.filter((_, i) => !deleteSet.has(i))
  const finalFaces = remainingFaces.map((f) => ({
    ...f,
    vertexIndices: f.vertexIndices
      .filter((i) => indexMap.has(i))
      .map((i) => indexMap.get(i)!),
  })).filter((f) => f.vertexIndices.length >= 3)

  return { vertices: finalVertices, faces: finalFaces }
}

/** Dissolve faces: remove faces, optionally cleaning up orphan vertices */
export function dissolveFaces(
  vertices: ItemVertex[],
  faces: ItemFace[],
  faceIndicesToDissolve: number[]
): MeshData {
  const deleteSet = new Set(faceIndicesToDissolve)
  const newFaces = faces.filter((_, i) => !deleteSet.has(i))

  // Find orphan vertices (not referenced by any remaining face)
  const usedVerts = new Set<number>()
  for (const f of newFaces) {
    for (const vi of f.vertexIndices) usedVerts.add(vi)
  }

  const indexMap = new Map<number, number>()
  let newIdx = 0
  const finalVertices: ItemVertex[] = []
  for (let i = 0; i < vertices.length; i++) {
    if (usedVerts.has(i)) {
      indexMap.set(i, newIdx++)
      finalVertices.push(vertices[i])
    }
  }

  const finalFaces = newFaces.map((f) => ({
    ...f,
    vertexIndices: f.vertexIndices.map((i) => indexMap.get(i)!),
  }))

  return { vertices: finalVertices, faces: finalFaces }
}

// ── Bridge Edge Loops ───────────────────────────────────────

/**
 * Connect two parallel edge loops with quad faces.
 * loop1 and loop2 are ordered arrays of vertex indices.
 */
export function bridgeEdgeLoops(
  vertices: ItemVertex[],
  faces: ItemFace[],
  loop1: number[],
  loop2: number[]
): MeshData {
  if (loop1.length !== loop2.length || loop1.length < 2) return { vertices, faces }

  const newFaces = [...faces]
  const count = loop1.length

  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count
    newFaces.push({
      vertexIndices: [loop1[i], loop1[next], loop2[next], loop2[i]],
      color: '#888888',
    })
  }

  return { vertices: [...vertices], faces: newFaces }
}

// ── Duplicate Selection ─────────────────────────────────────

/**
 * Deep-copy selected vertices and faces with proper index remapping.
 */
export function duplicateSelection(
  vertices: ItemVertex[],
  faces: ItemFace[],
  selectedVertices: Set<number>,
  selectedFaces: Set<number>
): MeshData {
  const newVertices = [...vertices]
  const newFaces = [...faces]
  const indexMap = new Map<number, number>()

  // Duplicate vertices
  for (const vi of selectedVertices) {
    const newIdx = newVertices.length
    newVertices.push({ position: [...vertices[vi].position] })
    indexMap.set(vi, newIdx)
  }

  // Duplicate faces with remapped indices
  for (const fi of selectedFaces) {
    const face = faces[fi]
    if (!face) continue
    const remapped = face.vertexIndices.map((vi) => indexMap.get(vi) ?? vi)
    newFaces.push({ vertexIndices: remapped, color: face.color })
  }

  return { vertices: newVertices, faces: newFaces }
}

// ── Separate Selection ──────────────────────────────────────

/**
 * Split mesh into two: selected and remaining.
 */
export function separateSelection(
  vertices: ItemVertex[],
  faces: ItemFace[],
  selectedVertices: Set<number>,
  selectedFaces: Set<number>
): { main: MeshData; separated: MeshData } {
  const mainFaces = faces.filter((_, i) => !selectedFaces.has(i))
  const sepFaces = faces.filter((_, i) => selectedFaces.has(i))

  // Remap main mesh
  const mainUsedVerts = new Set<number>()
  for (const f of mainFaces) for (const vi of f.vertexIndices) mainUsedVerts.add(vi)

  const mainMap = new Map<number, number>()
  let mi = 0
  const mainVertices: ItemVertex[] = []
  for (let i = 0; i < vertices.length; i++) {
    if (mainUsedVerts.has(i)) {
      mainMap.set(i, mi++)
      mainVertices.push({ position: [...vertices[i].position] })
    }
  }
  const remappedMainFaces = mainFaces.map((f) => ({
    ...f,
    vertexIndices: f.vertexIndices.map((vi) => mainMap.get(vi)!),
  }))

  // Remap separated mesh
  const sepUsedVerts = new Set<number>()
  for (const f of sepFaces) for (const vi of f.vertexIndices) sepUsedVerts.add(vi)

  const sepMap = new Map<number, number>()
  let si = 0
  const sepVertices: ItemVertex[] = []
  for (let i = 0; i < vertices.length; i++) {
    if (sepUsedVerts.has(i)) {
      sepMap.set(i, si++)
      sepVertices.push({ position: [...vertices[i].position] })
    }
  }
  const remappedSepFaces = sepFaces.map((f) => ({
    ...f,
    vertexIndices: f.vertexIndices.map((vi) => sepMap.get(vi)!),
  }))

  return {
    main: { vertices: mainVertices, faces: remappedMainFaces },
    separated: { vertices: sepVertices, faces: remappedSepFaces },
  }
}

// ── Subdivide ───────────────────────────────────────────────

/**
 * Catmull-Clark-style subdivision of selected faces.
 * Each quad becomes 4 quads, each triangle becomes 3 quads.
 */
export function subdivide(
  vertices: ItemVertex[],
  faces: ItemFace[],
  faceIndices: number[]
): MeshData {
  const newVertices = [...vertices]
  const newFaces: ItemFace[] = []
  const facesToSubdivide = new Set(faceIndices)
  const edgeMidpoints = new Map<string, number>()

  const getOrCreateMidpoint = (a: number, b: number): number => {
    const key = edgeKeyStr(a, b)
    if (edgeMidpoints.has(key)) return edgeMidpoints.get(key)!

    const posA = newVertices[a].position
    const posB = newVertices[b].position
    const midIdx = newVertices.length
    newVertices.push({
      position: [
        (posA[0] + posB[0]) / 2,
        (posA[1] + posB[1]) / 2,
        (posA[2] + posB[2]) / 2,
      ],
    })
    edgeMidpoints.set(key, midIdx)
    return midIdx
  }

  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi]

    if (!facesToSubdivide.has(fi)) {
      newFaces.push(face)
      continue
    }

    const idx = face.vertexIndices

    if (idx.length === 4) {
      // Quad subdivision: create center + 4 edge midpoints → 4 quads
      const center = newVertices.length
      const cx = idx.reduce((s, vi) => s + newVertices[vi].position[0], 0) / 4
      const cy = idx.reduce((s, vi) => s + newVertices[vi].position[1], 0) / 4
      const cz = idx.reduce((s, vi) => s + newVertices[vi].position[2], 0) / 4
      newVertices.push({ position: [cx, cy, cz] })

      const mids = [
        getOrCreateMidpoint(idx[0], idx[1]),
        getOrCreateMidpoint(idx[1], idx[2]),
        getOrCreateMidpoint(idx[2], idx[3]),
        getOrCreateMidpoint(idx[3], idx[0]),
      ]

      newFaces.push({ vertexIndices: [idx[0], mids[0], center, mids[3]], color: face.color })
      newFaces.push({ vertexIndices: [idx[1], mids[1], center, mids[0]], color: face.color })
      newFaces.push({ vertexIndices: [idx[2], mids[2], center, mids[1]], color: face.color })
      newFaces.push({ vertexIndices: [idx[3], mids[3], center, mids[2]], color: face.color })
    } else if (idx.length === 3) {
      // Triangle subdivision: 3 edge midpoints → 4 triangles
      const mids = [
        getOrCreateMidpoint(idx[0], idx[1]),
        getOrCreateMidpoint(idx[1], idx[2]),
        getOrCreateMidpoint(idx[2], idx[0]),
      ]

      newFaces.push({ vertexIndices: [idx[0], mids[0], mids[2]], color: face.color })
      newFaces.push({ vertexIndices: [mids[0], idx[1], mids[1]], color: face.color })
      newFaces.push({ vertexIndices: [mids[2], mids[1], idx[2]], color: face.color })
      newFaces.push({ vertexIndices: [mids[0], mids[1], mids[2]], color: face.color })
    } else {
      // N-gon: fan subdivide from center
      const center = newVertices.length
      const cx = idx.reduce((s, vi) => s + newVertices[vi].position[0], 0) / idx.length
      const cy = idx.reduce((s, vi) => s + newVertices[vi].position[1], 0) / idx.length
      const cz = idx.reduce((s, vi) => s + newVertices[vi].position[2], 0) / idx.length
      newVertices.push({ position: [cx, cy, cz] })

      for (let i = 0; i < idx.length; i++) {
        const next = (i + 1) % idx.length
        newFaces.push({ vertexIndices: [idx[i], idx[next], center], color: face.color })
      }
    }
  }

  return { vertices: newVertices, faces: newFaces }
}

// ── Recalculate Normals ─────────────────────────────────────

/**
 * Ensure consistent outward-facing winding order.
 * Uses the face with the highest-Y centroid as reference for "outward = up".
 */
export function recalculateNormals(
  vertices: ItemVertex[],
  faces: ItemFace[]
): MeshData {
  if (faces.length === 0) return { vertices, faces }

  const adjacency = buildAdjacency(vertices, faces)
  const newFaces = faces.map((f) => ({ ...f, vertexIndices: [...f.vertexIndices] }))

  // Find the face with the highest centroid Y — assume its normal should point up
  let topFace = 0
  let topY = -Infinity
  for (let fi = 0; fi < faces.length; fi++) {
    const center = computeFaceCenter(vertices, faces[fi])
    if (center[1] > topY) {
      topY = center[1]
      topFace = fi
    }
  }

  // Ensure top face normal points upward
  const topNormal = computeFaceNormal(vertices, newFaces[topFace])
  if (topNormal[1] < 0) {
    newFaces[topFace].vertexIndices.reverse()
  }

  // BFS from top face, ensuring consistent winding with neighbors
  const visited = new Set<number>([topFace])
  const queue = [topFace]

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = adjacency.faceToFaces.get(current)
    if (!neighbors) continue

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)

      // Find shared edge between current and neighbor
      const currentIdx = newFaces[current].vertexIndices
      const neighborIdx = newFaces[neighbor].vertexIndices

      // Check winding consistency: shared edge should go in opposite directions
      for (let i = 0; i < currentIdx.length; i++) {
        const a = currentIdx[i]
        const b = currentIdx[(i + 1) % currentIdx.length]

        const ni = neighborIdx.indexOf(a)
        if (ni === -1) continue
        const ni2 = neighborIdx.indexOf(b)
        if (ni2 === -1) continue

        // In consistent winding, if current has edge A→B,
        // neighbor should have B→A (reverse order)
        const neighborNext = (ni + 1) % neighborIdx.length
        if (neighborIdx[neighborNext] === b) {
          // Same direction — flip neighbor
          newFaces[neighbor].vertexIndices.reverse()
        }
        break
      }

      queue.push(neighbor)
    }
  }

  return { vertices: [...vertices], faces: newFaces }
}
