/**
 * Mesh topology utilities — adjacency maps, loop detection, connectivity queries.
 * All functions are pure and operate on ItemVertex[] / ItemFace[] arrays.
 */

import { ItemVertex, ItemFace } from '@/types/items'

// ── Edge key helper ─────────────────────────────────────────

/** Canonical edge string "min-max" for deduplication */
export function edgeKeyStr(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/** Parse an edge key back to [min, max] */
export function parseEdgeKey(key: string): [number, number] {
  const [a, b] = key.split('-').map(Number)
  return [a, b]
}

// ── Adjacency data structure ────────────────────────────────

export interface AdjacencyData {
  /** vertex index → set of face indices that use it */
  vertexToFaces: Map<number, Set<number>>
  /** vertex index → set of connected vertex indices */
  vertexToVertices: Map<number, Set<number>>
  /** edge key "a-b" → set of face indices sharing that edge */
  edgeToFaces: Map<string, Set<number>>
  /** face index → set of neighbor face indices (share an edge) */
  faceToFaces: Map<number, Set<number>>
  /** All unique edge keys */
  edgeKeys: Set<string>
}

/** Build full adjacency maps from mesh data */
export function buildAdjacency(vertices: ItemVertex[], faces: ItemFace[]): AdjacencyData {
  const vertexToFaces = new Map<number, Set<number>>()
  const vertexToVertices = new Map<number, Set<number>>()
  const edgeToFaces = new Map<string, Set<number>>()
  const faceToFaces = new Map<number, Set<number>>()
  const edgeKeys = new Set<string>()

  // Initialize vertex maps
  for (let vi = 0; vi < vertices.length; vi++) {
    vertexToFaces.set(vi, new Set())
    vertexToVertices.set(vi, new Set())
  }

  // Initialize face maps
  for (let fi = 0; fi < faces.length; fi++) {
    faceToFaces.set(fi, new Set())
  }

  // Build adjacency from faces
  for (let fi = 0; fi < faces.length; fi++) {
    const idx = faces[fi].vertexIndices
    for (let i = 0; i < idx.length; i++) {
      const a = idx[i]
      const b = idx[(i + 1) % idx.length]

      // Vertex → face
      vertexToFaces.get(a)?.add(fi)

      // Vertex → vertex
      vertexToVertices.get(a)?.add(b)
      vertexToVertices.get(b)?.add(a)

      // Edge → face
      const ek = edgeKeyStr(a, b)
      edgeKeys.add(ek)
      if (!edgeToFaces.has(ek)) {
        edgeToFaces.set(ek, new Set())
      }
      edgeToFaces.get(ek)!.add(fi)
    }
    // Last vertex → face (already covered in loop but ensure)
  }

  // Build face → face from shared edges
  for (const [, faceSet] of edgeToFaces) {
    const faceArr = Array.from(faceSet)
    for (let i = 0; i < faceArr.length; i++) {
      for (let j = i + 1; j < faceArr.length; j++) {
        faceToFaces.get(faceArr[i])?.add(faceArr[j])
        faceToFaces.get(faceArr[j])?.add(faceArr[i])
      }
    }
  }

  return { vertexToFaces, vertexToVertices, edgeToFaces, faceToFaces, edgeKeys }
}

// ── Edge loop detection ─────────────────────────────────────

/**
 * Find an edge loop starting from a given edge.
 * Walks along edges where each connecting vertex has exactly 4 edges (quad mesh)
 * or follows the "cross-edge" in a quad face.
 * Returns ordered edge keys forming the loop.
 */
export function findEdgeLoop(
  startEdgeKey: string,
  faces: ItemFace[],
  adjacency: AdjacencyData
): string[] {
  const [startA, startB] = parseEdgeKey(startEdgeKey)
  const loop: string[] = [startEdgeKey]
  const visited = new Set<string>([startEdgeKey])

  // Walk in both directions from the start edge
  for (const startVertex of [startB, startA]) {
    let currentEdge = startEdgeKey
    let currentVertex = startVertex

    while (true) {
      // Find the next edge by crossing through a quad face
      const nextEdge = findCrossEdge(currentEdge, currentVertex, faces, adjacency)
      if (!nextEdge || visited.has(nextEdge)) break

      visited.add(nextEdge)
      const [na, nb] = parseEdgeKey(nextEdge)

      if (startVertex === startB) {
        loop.push(nextEdge)
      } else {
        loop.unshift(nextEdge)
      }

      // Move to the vertex on the other side
      currentVertex = na === currentVertex ? nb : na
      currentEdge = nextEdge
    }
  }

  return loop
}

/**
 * Given an edge and a vertex on it, find the "cross edge" on the opposite side
 * of the adjacent quad face (the edge parallel to the current one).
 */
function findCrossEdge(
  edgeKey: string,
  vertex: number,
  faces: ItemFace[],
  adjacency: AdjacencyData
): string | null {
  const facesOnEdge = adjacency.edgeToFaces.get(edgeKey)
  if (!facesOnEdge) return null

  const [ea, eb] = parseEdgeKey(edgeKey)

  for (const fi of facesOnEdge) {
    const idx = faces[fi].vertexIndices
    if (idx.length !== 4) continue // Only works with quads

    // Find position of the vertex in the face
    const pos = idx.indexOf(vertex)
    if (pos === -1) continue

    // The cross edge is the one opposite to the current vertex in the quad
    // In a quad [0,1,2,3], if vertex is at pos, the opposite edge connects
    // the vertices at (pos+1)%4 and (pos+2)%4
    const crossA = idx[(pos + 1) % 4]
    const crossB = idx[(pos + 2) % 4]

    const crossKey = edgeKeyStr(crossA, crossB)
    if (crossKey !== edgeKey) {
      return crossKey
    }
  }

  return null
}

/**
 * Find a face loop starting from a given face and direction edge.
 * Walks through quads perpendicular to the given edge direction.
 */
export function findFaceLoop(
  startFace: number,
  startEdgeKey: string,
  faces: ItemFace[],
  adjacency: AdjacencyData
): number[] {
  const loop: number[] = [startFace]
  const visited = new Set<number>([startFace])

  // Walk in both directions
  for (const direction of [1, -1]) {
    let currentFace = startFace
    let currentEdge = startEdgeKey

    while (true) {
      const idx = faces[currentFace].vertexIndices
      if (idx.length !== 4) break

      // Find the edge opposite to currentEdge in this quad
      const [ea, eb] = parseEdgeKey(currentEdge)
      const posA = idx.indexOf(ea)
      const posB = idx.indexOf(eb)
      if (posA === -1 || posB === -1) break

      // Opposite edge: vertices not in current edge
      const otherVerts = idx.filter((v) => v !== ea && v !== eb)
      if (otherVerts.length !== 2) break

      const oppositeEdge = edgeKeyStr(otherVerts[0], otherVerts[1])

      // Cross to the face on the other side of the opposite edge
      const neighborFaces = adjacency.edgeToFaces.get(oppositeEdge)
      if (!neighborFaces) break

      let nextFace = -1
      for (const fi of neighborFaces) {
        if (fi !== currentFace && !visited.has(fi)) {
          nextFace = fi
          break
        }
      }
      if (nextFace === -1) break

      visited.add(nextFace)
      if (direction === 1) {
        loop.push(nextFace)
      } else {
        loop.unshift(nextFace)
      }

      currentFace = nextFace
      currentEdge = oppositeEdge
    }
  }

  return loop
}

// ── Connectivity queries ────────────────────────────────────

/** Flood-fill to find all vertices connected to startVertex via edges */
export function findLinkedVertices(
  startVertex: number,
  adjacency: AdjacencyData
): Set<number> {
  const linked = new Set<number>()
  const queue = [startVertex]
  linked.add(startVertex)

  while (queue.length > 0) {
    const current = queue.pop()!
    const neighbors = adjacency.vertexToVertices.get(current)
    if (!neighbors) continue
    for (const n of neighbors) {
      if (!linked.has(n)) {
        linked.add(n)
        queue.push(n)
      }
    }
  }

  return linked
}

/** Grow selection: add all vertices adjacent to current selection */
export function growSelection(
  selected: Set<number>,
  adjacency: AdjacencyData
): Set<number> {
  const grown = new Set(selected)
  for (const vi of selected) {
    const neighbors = adjacency.vertexToVertices.get(vi)
    if (neighbors) {
      for (const n of neighbors) {
        grown.add(n)
      }
    }
  }
  return grown
}

/** Shrink selection: remove vertices on the boundary of the selection */
export function shrinkSelection(
  selected: Set<number>,
  adjacency: AdjacencyData
): Set<number> {
  const shrunk = new Set(selected)
  for (const vi of selected) {
    const neighbors = adjacency.vertexToVertices.get(vi)
    if (!neighbors) {
      shrunk.delete(vi)
      continue
    }
    // If any neighbor is NOT in the selection, this vertex is on the boundary
    for (const n of neighbors) {
      if (!selected.has(n)) {
        shrunk.delete(vi)
        break
      }
    }
  }
  return shrunk
}

/** Find all face indices connected to a set of vertices */
export function findFacesFromVertices(
  vertexSet: Set<number>,
  adjacency: AdjacencyData
): Set<number> {
  const faceSet = new Set<number>()
  for (const vi of vertexSet) {
    const faces = adjacency.vertexToFaces.get(vi)
    if (faces) {
      for (const fi of faces) faceSet.add(fi)
    }
  }
  return faceSet
}

/** Get all vertex indices referenced by a set of edge keys */
export function getVerticesFromEdges(edgeKeys: string[]): Set<number> {
  const verts = new Set<number>()
  for (const ek of edgeKeys) {
    const [a, b] = parseEdgeKey(ek)
    verts.add(a)
    verts.add(b)
  }
  return verts
}

/** Get all vertex indices referenced by a set of face indices */
export function getVerticesFromFaces(
  faceIndices: number[],
  faces: ItemFace[]
): Set<number> {
  const verts = new Set<number>()
  for (const fi of faceIndices) {
    const face = faces[fi]
    if (face) {
      for (const vi of face.vertexIndices) verts.add(vi)
    }
  }
  return verts
}
