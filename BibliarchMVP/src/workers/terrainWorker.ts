/**
 * Web Worker for offloading terrain generation and chunk building from the main thread.
 *
 * Messages:
 * - 'buildChunk': Build vertex buffers for a terrain chunk at a given LOD
 * - 'generateCartography': Generate terrain from cartography data (heavy operation)
 *
 * All typed arrays are transferred via Transferable for zero-copy.
 */

// Material colors (mirrored from materials.ts to avoid import issues in worker)
const MATERIAL_COLORS: Record<number, [number, number, number]> = {
  1: [0.43, 0.65, 0.27],  // Grass
  2: [0.83, 0.77, 0.52],  // Sand
  3: [0.55, 0.55, 0.55],  // Rock
  4: [0.95, 0.95, 0.97],  // Snow
  5: [0.55, 0.40, 0.26],  // Dirt
  6: [0.40, 0.33, 0.22],  // Mud
  7: [0.75, 0.85, 0.92],  // Ice
  8: [0.60, 0.58, 0.55],  // Gravel
  9: [0.72, 0.53, 0.35],  // Clay
  10: [0.58, 0.55, 0.30], // DeadGrass
  11: [0.70, 0.70, 0.70], // Concrete
  12: [0.30, 0.30, 0.30], // Asphalt
  13: [0.65, 0.60, 0.50], // Cobblestone
  14: [0.70, 0.35, 0.25], // Brick
  15: [0.60, 0.45, 0.28], // WoodPlanks
  16: [0.55, 0.75, 0.85], // Crystal
  17: [0.85, 0.30, 0.10], // Lava
  18: [0.35, 0.15, 0.40], // Corrupted
  19: [0.40, 0.70, 0.90], // MagicGlow
  20: [0.10, 0.05, 0.15], // Void
}

function getMaterialColor(id: number): [number, number, number] {
  return MATERIAL_COLORS[id] ?? [0.43, 0.65, 0.27]
}

interface BuildChunkMsg {
  type: 'buildChunk'
  id: number // request ID for matching response
  startX: number
  startZ: number
  cellsX: number
  cellsZ: number
  lodStep: number
  terrainSize: number
  terrainSizeZ: number
  cellSize: number
  maxHeight: number
  seaLevel: number
  heights: Float32Array
  materials: Uint8Array
}

interface ChunkResult {
  type: 'chunkReady'
  id: number
  positions: Float32Array
  colors: Float32Array
  normals: Float32Array
  indices: Uint32Array
  vertCount: number
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data
  switch (msg.type) {
    case 'buildChunk':
      handleBuildChunk(msg as BuildChunkMsg)
      break
  }
}

function handleBuildChunk(msg: BuildChunkMsg): void {
  const { startX, startZ, cellsX, cellsZ, lodStep, terrainSize, cellSize, maxHeight, seaLevel, heights, materials } = msg

  const vertsX = Math.floor(cellsX / lodStep) + 1
  const vertsZ = Math.floor(cellsZ / lodStep) + 1
  const vertCount = vertsX * vertsZ

  const positions = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  const normals = new Float32Array(vertCount * 3)

  // Fill positions and colors
  for (let vz = 0; vz < vertsZ; vz++) {
    for (let vx = 0; vx < vertsX; vx++) {
      const vi = vz * vertsX + vx
      const gx = Math.min(startX + vx * lodStep, terrainSize - 1)
      const gz = Math.min(startZ + vz * lodStep, msg.terrainSizeZ - 1)
      const idx = gz * terrainSize + gx

      const height = heights[idx]
      positions[vi * 3] = gx * cellSize
      positions[vi * 3 + 1] = height * maxHeight
      positions[vi * 3 + 2] = gz * cellSize

      const matId = materials[idx]
      const rgb = getMaterialColor(matId)
      let r = rgb[0], g = rgb[1], b = rgb[2]

      if (height < seaLevel) {
        const depth = Math.min((seaLevel - height) / seaLevel, 1)
        const tint = 1 - depth * 0.45
        r = r * tint * 0.7
        g = g * tint * 0.85
        b = Math.min(1, b * tint + depth * 0.15)
      }

      colors[vi * 3] = r
      colors[vi * 3 + 1] = g
      colors[vi * 3 + 2] = b
    }
  }

  // Build indices
  const cellCountX = vertsX - 1
  const cellCountZ = vertsZ - 1
  const indexCount = cellCountX * cellCountZ * 6
  const indices = new Uint32Array(indexCount)
  let ii = 0

  for (let cz = 0; cz < cellCountZ; cz++) {
    for (let cx = 0; cx < cellCountX; cx++) {
      const tl = cz * vertsX + cx
      const tr = tl + 1
      const bl = (cz + 1) * vertsX + cx
      const br = bl + 1
      indices[ii++] = tl
      indices[ii++] = bl
      indices[ii++] = tr
      indices[ii++] = tr
      indices[ii++] = bl
      indices[ii++] = br
    }
  }

  // Compute normals
  normals.fill(0)
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2]

    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2]
    const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2]
    const cx2 = positions[c * 3], cy = positions[c * 3 + 1], cz2 = positions[c * 3 + 2]

    const abx = bx - ax, aby = by - ay, abz = bz - az
    const acx = cx2 - ax, acy = cy - ay, acz = cz2 - az

    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx

    normals[a * 3] += nx; normals[a * 3 + 1] += ny; normals[a * 3 + 2] += nz
    normals[b * 3] += nx; normals[b * 3 + 1] += ny; normals[b * 3 + 2] += nz
    normals[c * 3] += nx; normals[c * 3 + 1] += ny; normals[c * 3 + 2] += nz
  }

  for (let i = 0; i < vertCount; i++) {
    const x = normals[i * 3], y = normals[i * 3 + 1], z = normals[i * 3 + 2]
    const len = Math.sqrt(x * x + y * y + z * z)
    if (len > 0) {
      normals[i * 3] = x / len
      normals[i * 3 + 1] = y / len
      normals[i * 3 + 2] = z / len
    }
  }

  const result: ChunkResult = {
    type: 'chunkReady',
    id: msg.id,
    positions,
    colors,
    normals,
    indices,
    vertCount,
  }

  // Transfer typed arrays (zero-copy)
  ;(self as unknown as Worker).postMessage(result, [
    positions.buffer,
    colors.buffer,
    normals.buffer,
    indices.buffer,
  ])
}
