/**
 * Utility functions for vertex/face mesh editing in the Custom Item editor.
 *
 * - Preset shape generators (cube, sphere, cylinder, plane)
 * - Face normal computation
 * - Extrude face along normal
 * - Triangulate quads for BufferGeometry rendering
 */

import { ItemVertex, ItemFace } from '@/types/items'

// ============================================================
// PRESET SHAPES
// ============================================================

export interface MeshData {
  vertices: ItemVertex[]
  faces: ItemFace[]
}

/** Generate a unit cube centered at origin */
export function createCubePreset(color: string = '#888888'): MeshData {
  const s = 0.5
  const vertices: ItemVertex[] = [
    { position: [-s, -s, -s] }, // 0: back-bottom-left
    { position: [ s, -s, -s] }, // 1: back-bottom-right
    { position: [ s,  s, -s] }, // 2: back-top-right
    { position: [-s,  s, -s] }, // 3: back-top-left
    { position: [-s, -s,  s] }, // 4: front-bottom-left
    { position: [ s, -s,  s] }, // 5: front-bottom-right
    { position: [ s,  s,  s] }, // 6: front-top-right
    { position: [-s,  s,  s] }, // 7: front-top-left
  ]

  const faces: ItemFace[] = [
    { vertexIndices: [0, 1, 2, 3], color }, // back
    { vertexIndices: [5, 4, 7, 6], color }, // front
    { vertexIndices: [4, 0, 3, 7], color }, // left
    { vertexIndices: [1, 5, 6, 2], color }, // right
    { vertexIndices: [3, 2, 6, 7], color }, // top
    { vertexIndices: [4, 5, 1, 0], color }, // bottom
  ]

  return { vertices, faces }
}

/** Generate a UV sphere */
export function createSpherePreset(
  color: string = '#888888',
  segments: number = 8,
  rings: number = 6
): MeshData {
  const vertices: ItemVertex[] = []
  const faces: ItemFace[] = []
  const radius = 0.5

  // Generate vertices
  for (let ring = 0; ring <= rings; ring++) {
    const phi = (Math.PI * ring) / rings
    for (let seg = 0; seg <= segments; seg++) {
      const theta = (2 * Math.PI * seg) / segments
      vertices.push({
        position: [
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        ],
      })
    }
  }

  // Generate faces (quads)
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const a = ring * (segments + 1) + seg
      const b = a + 1
      const c = a + segments + 1
      const d = c + 1

      if (ring === 0) {
        // Triangle at top pole
        faces.push({ vertexIndices: [a, d, c], color })
      } else if (ring === rings - 1) {
        // Triangle at bottom pole
        faces.push({ vertexIndices: [a, b, d], color })
      } else {
        faces.push({ vertexIndices: [a, b, d, c], color })
      }
    }
  }

  return { vertices, faces }
}

/** Generate a cylinder */
export function createCylinderPreset(
  color: string = '#888888',
  segments: number = 8
): MeshData {
  const vertices: ItemVertex[] = []
  const faces: ItemFace[] = []
  const radius = 0.5
  const halfH = 0.5

  // Bottom center
  const bottomCenter = vertices.length
  vertices.push({ position: [0, -halfH, 0] })

  // Bottom ring
  const bottomStart = vertices.length
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    vertices.push({
      position: [radius * Math.cos(angle), -halfH, radius * Math.sin(angle)],
    })
  }

  // Top center
  const topCenter = vertices.length
  vertices.push({ position: [0, halfH, 0] })

  // Top ring
  const topStart = vertices.length
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    vertices.push({
      position: [radius * Math.cos(angle), halfH, radius * Math.sin(angle)],
    })
  }

  // Bottom cap (triangles)
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    faces.push({ vertexIndices: [bottomCenter, bottomStart + next, bottomStart + i], color })
  }

  // Top cap (triangles)
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    faces.push({ vertexIndices: [topCenter, topStart + i, topStart + next], color })
  }

  // Side quads
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    faces.push({
      vertexIndices: [bottomStart + i, bottomStart + next, topStart + next, topStart + i],
      color,
    })
  }

  return { vertices, faces }
}

/** Generate a flat plane */
export function createPlanePreset(color: string = '#888888'): MeshData {
  const s = 0.5
  const vertices: ItemVertex[] = [
    { position: [-s, 0, -s] },
    { position: [ s, 0, -s] },
    { position: [ s, 0,  s] },
    { position: [-s, 0,  s] },
  ]
  const faces: ItemFace[] = [
    { vertexIndices: [0, 1, 2, 3], color },
  ]
  return { vertices, faces }
}

// ============================================================
// FACE NORMAL COMPUTATION
// ============================================================

export function computeFaceNormal(
  vertices: ItemVertex[],
  face: ItemFace
): [number, number, number] {
  const idx = face.vertexIndices
  if (idx.length < 3) return [0, 1, 0]

  const a = vertices[idx[0]].position
  const b = vertices[idx[1]].position
  const c = vertices[idx[2]].position

  // Edge vectors
  const ab: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ac: [number, number, number] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]

  // Cross product
  const nx = ab[1] * ac[2] - ab[2] * ac[1]
  const ny = ab[2] * ac[0] - ab[0] * ac[2]
  const nz = ab[0] * ac[1] - ab[1] * ac[0]

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (len < 1e-8) return [0, 1, 0]

  return [nx / len, ny / len, nz / len]
}

/** Compute center of a face */
export function computeFaceCenter(
  vertices: ItemVertex[],
  face: ItemFace
): [number, number, number] {
  let cx = 0, cy = 0, cz = 0
  for (const idx of face.vertexIndices) {
    cx += vertices[idx].position[0]
    cy += vertices[idx].position[1]
    cz += vertices[idx].position[2]
  }
  const n = face.vertexIndices.length
  return [cx / n, cy / n, cz / n]
}

// ============================================================
// EXTRUDE FACE
// ============================================================

/**
 * Extrude a face along its normal by `distance`.
 * Creates new vertices and side faces, replaces the original face with the new top.
 * Returns updated mesh data (immutable - new arrays).
 */
export function extrudeFace(
  vertices: ItemVertex[],
  faces: ItemFace[],
  faceIndex: number,
  distance: number
): MeshData {
  const face = faces[faceIndex]
  if (!face) return { vertices, faces }

  const normal = computeFaceNormal(vertices, face)
  const offset: [number, number, number] = [
    normal[0] * distance,
    normal[1] * distance,
    normal[2] * distance,
  ]

  const newVertices = [...vertices]
  const newFaces = [...faces]

  // Create new vertices offset along normal
  const newIndices: number[] = []
  for (const origIdx of face.vertexIndices) {
    const pos = vertices[origIdx].position
    const newIdx = newVertices.length
    newVertices.push({
      position: [pos[0] + offset[0], pos[1] + offset[1], pos[2] + offset[2]],
    })
    newIndices.push(newIdx)
  }

  // Replace original face with the top face (using new vertices)
  newFaces[faceIndex] = {
    vertexIndices: [...newIndices],
    color: face.color,
  }

  // Create side faces connecting original and new vertices
  const count = face.vertexIndices.length
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count
    newFaces.push({
      vertexIndices: [
        face.vertexIndices[i],
        face.vertexIndices[next],
        newIndices[next],
        newIndices[i],
      ],
      color: face.color,
    })
  }

  return { vertices: newVertices, faces: newFaces }
}

// ============================================================
// TRIANGULATION (for BufferGeometry rendering)
// ============================================================

export interface TriangleData {
  positions: Float32Array  // xyz per vertex
  colors: Float32Array     // rgb per vertex
  indices: Uint32Array
}

/** Parse a hex color string (#rrggbb or #rgb) into [r, g, b] in 0-1 range */
function parseHexColor(hex: string | undefined): [number, number, number] {
  if (!hex || hex[0] !== '#') return [0.5, 0.5, 0.5]
  const h = hex.slice(1)
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16) / 255,
      parseInt(h[1] + h[1], 16) / 255,
      parseInt(h[2] + h[2], 16) / 255,
    ]
  }
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [
    Number.isFinite(r) ? r : 0.5,
    Number.isFinite(g) ? g : 0.5,
    Number.isFinite(b) ? b : 0.5,
  ]
}

/** Convert quads + triangles into indexed triangle data for Three.js */
export function triangulateMesh(vertices: ItemVertex[], faces: ItemFace[]): TriangleData {
  const triPositions: number[] = []
  const triColors: number[] = []
  const triIndices: number[] = []

  let vertIdx = 0
  for (const face of faces) {
    const [r, g, b] = parseHexColor(face.color)

    const baseIdx = vertIdx
    let validFace = true
    for (const vi of face.vertexIndices) {
      const vert = vertices[vi]
      if (!vert || !vert.position) {
        validFace = false
        break
      }
      const pos = vert.position
      const x = Number.isFinite(pos[0]) ? pos[0] : 0
      const y = Number.isFinite(pos[1]) ? pos[1] : 0
      const z = Number.isFinite(pos[2]) ? pos[2] : 0
      triPositions.push(x, y, z)
      triColors.push(r, g, b)
      vertIdx++
    }

    if (!validFace) {
      // Roll back any vertices we already pushed for this face
      const pushed = vertIdx - baseIdx
      triPositions.splice(triPositions.length - pushed * 3, pushed * 3)
      triColors.splice(triColors.length - pushed * 3, pushed * 3)
      vertIdx = baseIdx
      continue
    }

    // Fan triangulation
    for (let i = 1; i < face.vertexIndices.length - 1; i++) {
      triIndices.push(baseIdx, baseIdx + i, baseIdx + i + 1)
    }
  }

  return {
    positions: new Float32Array(triPositions),
    colors: new Float32Array(triColors),
    indices: new Uint32Array(triIndices),
  }
}

// ============================================================
// VERTEX MERGING
// ============================================================

/** Merge vertex at `fromIdx` into `toIdx`, updating all face references */
export function mergeVertices(
  vertices: ItemVertex[],
  faces: ItemFace[],
  fromIdx: number,
  toIdx: number
): MeshData {
  if (fromIdx === toIdx) return { vertices, faces }

  // Update face indices
  const newFaces = faces.map((f) => ({
    ...f,
    vertexIndices: f.vertexIndices.map((i) => (i === fromIdx ? toIdx : i)),
  }))
    // Remove degenerate faces (faces where same vertex appears twice)
    .filter((f) => new Set(f.vertexIndices).size >= 3)

  // Remove the merged vertex and adjust indices
  const newVertices = vertices.filter((_, i) => i !== fromIdx)
  const adjustedFaces = newFaces.map((f) => ({
    ...f,
    vertexIndices: f.vertexIndices.map((i) => (i > fromIdx ? i - 1 : i)),
  }))

  return { vertices: newVertices, faces: adjustedFaces }
}

/** Delete vertices at given indices and remove connected faces */
export function deleteVertices(
  vertices: ItemVertex[],
  faces: ItemFace[],
  deleteIndices: number[]
): MeshData {
  const deleteSet = new Set(deleteIndices)

  // Remove faces that reference any deleted vertex
  const survivingFaces = faces.filter(
    (f) => !f.vertexIndices.some((i) => deleteSet.has(i))
  )

  // Build index remapping
  const indexMap = new Map<number, number>()
  let newIdx = 0
  for (let i = 0; i < vertices.length; i++) {
    if (!deleteSet.has(i)) {
      indexMap.set(i, newIdx++)
    }
  }

  const newVertices = vertices.filter((_, i) => !deleteSet.has(i))
  const newFaces = survivingFaces.map((f) => ({
    ...f,
    vertexIndices: f.vertexIndices.map((i) => indexMap.get(i)!),
  }))

  return { vertices: newVertices, faces: newFaces }
}

/** Delete faces at given indices */
export function deleteFaces(
  faces: ItemFace[],
  deleteIndices: number[]
): ItemFace[] {
  const deleteSet = new Set(deleteIndices)
  return faces.filter((_, i) => !deleteSet.has(i))
}

// ============================================================
// EDGE HELPERS
// ============================================================

export interface Edge {
  a: number  // vertex index
  b: number  // vertex index
  faceIndices: number[]
}

/** Extract unique edges from face data */
export function extractEdges(faces: ItemFace[]): Edge[] {
  const edgeMap = new Map<string, Edge>()

  for (let fi = 0; fi < faces.length; fi++) {
    const idx = faces[fi].vertexIndices
    for (let i = 0; i < idx.length; i++) {
      const a = idx[i]
      const b = idx[(i + 1) % idx.length]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { a: Math.min(a, b), b: Math.max(a, b), faceIndices: [] })
      }
      edgeMap.get(key)!.faceIndices.push(fi)
    }
  }

  return Array.from(edgeMap.values())
}

// ============================================================
// VERTEX → BUFFER INDEX MAP (for fast-path transforms)
// ============================================================

/**
 * Build a map from logical vertex index to BufferGeometry position indices.
 * triangulateMesh duplicates vertices per-face, so one logical vertex can appear
 * at multiple buffer positions. This map enables fast-path updates during
 * G/R/S transforms without full mesh rebuild.
 */
export function buildVertexToBufferMap(
  faces: ItemFace[]
): Map<number, number[]> {
  const map = new Map<number, number[]>()
  let bufIdx = 0

  for (const face of faces) {
    for (const vi of face.vertexIndices) {
      if (!map.has(vi)) map.set(vi, [])
      map.get(vi)!.push(bufIdx)
      bufIdx++
    }
  }

  return map
}
