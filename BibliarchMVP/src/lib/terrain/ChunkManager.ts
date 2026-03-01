import {
  Mesh,
  VertexData,
  Vector3,
  TransformNode,
  Scene,
  Frustum,
  Matrix,
  VertexBuffer,
  type Camera,
} from '@babylonjs/core'
import {
  TerrainData,
  TerrainMaterialId,
  terrainIndex,
  isInBounds,
  isPointInPolygon,
  type BorderVertex,
} from '@/types/world'
import { getMaterialColor } from './materials'
import { createToonTerrainMaterial } from '@/lib/shaders/toonMaterial'

const CHUNK_SIZE = 64

/**
 * Manages terrain rendering as a grid of chunks.
 * Each chunk is an updatable Babylon.js mesh with vertex colors.
 */
export class ChunkManager {
  private chunks: Map<string, Mesh> = new Map()
  private dirtyChunks: Set<string> = new Set()
  private parent: TransformNode
  private chunkSize: number
  private terrain: TerrainData | null = null
  private currentSize: number = 0
  private currentSizeZ: number = 0
  private scene: Scene
  private polygonBoundary: BorderVertex[] | null = null

  constructor(scene: Scene) {
    this.scene = scene
    this.parent = new TransformNode('terrain-chunks', scene)
    this.chunkSize = CHUNK_SIZE
  }

  getParent(): TransformNode {
    return this.parent
  }

  getChunkMeshes(): Mesh[] {
    return Array.from(this.chunks.values())
  }

  setPolygonBoundary(boundary: BorderVertex[] | null): void {
    this.polygonBoundary = boundary
    // Mark all chunks dirty so they re-render with the new mask
    if (this.terrain) {
      const numChunksX = Math.ceil(this.terrain.size / this.chunkSize)
      const numChunksZ = Math.ceil(this.terrain.sizeZ / this.chunkSize)
      for (let cz = 0; cz < numChunksZ; cz++) {
        for (let cx = 0; cx < numChunksX; cx++) {
          this.dirtyChunks.add(`${cx}_${cz}`)
        }
      }
      this.rebuildDirty()
    }
  }

  setTerrain(terrain: TerrainData): void {
    const oldSize = this.currentSize
    const oldSizeZ = this.currentSizeZ
    this.terrain = terrain

    const numChunksX = Math.ceil(terrain.size / this.chunkSize)
    const numChunksZ = Math.ceil(terrain.sizeZ / this.chunkSize)
    const expectedChunks = numChunksX * numChunksZ

    if (oldSize === terrain.size && oldSizeZ === terrain.sizeZ && this.chunks.size === expectedChunks) {
      for (const [key, mesh] of this.chunks) {
        const [cx, cz] = key.split('_').map(Number)
        this.updateChunkGeometry(mesh, cx, cz, terrain)
      }
      return
    }

    this.dispose()
    this.currentSize = terrain.size
    this.currentSizeZ = terrain.sizeZ

    for (let cz = 0; cz < numChunksZ; cz++) {
      for (let cx = 0; cx < numChunksX; cx++) {
        const key = `${cx}_${cz}`
        const mesh = this.createChunkMesh(cx, cz, terrain)
        this.chunks.set(key, mesh)
      }
    }
  }

  markDirty(cellX: number, cellZ: number, radius: number): void {
    const cs = this.chunkSize
    const minCx = Math.floor(Math.max(0, cellX - radius) / cs)
    const maxCx = Math.floor(Math.min((this.terrain?.size ?? 0) - 1, cellX + radius) / cs)
    const minCz = Math.floor(Math.max(0, cellZ - radius) / cs)
    const maxCz = Math.floor(Math.min((this.terrain?.sizeZ ?? 0) - 1, cellZ + radius) / cs)

    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        this.dirtyChunks.add(`${cx}_${cz}`)
      }
    }
  }

  rebuildDirty(): void {
    if (!this.terrain) return
    for (const key of this.dirtyChunks) {
      const mesh = this.chunks.get(key)
      if (mesh) {
        const [cx, cz] = key.split('_').map(Number)
        this.updateChunkGeometry(mesh, cx, cz, this.terrain)
      }
    }
    this.dirtyChunks.clear()
  }

  cullChunks(camera: Camera): void {
    const planes = Frustum.GetPlanes(camera.getTransformationMatrix())

    for (const [, mesh] of this.chunks) {
      const bb = mesh.getBoundingInfo().boundingBox
      mesh.setEnabled(bb.isInFrustum(planes))
    }
  }

  updateLightDirection(direction: Vector3): void {
    this.chunks.forEach(mesh => {
      const mat = mesh.material as any
      if (mat && mat.setVector3) {
        mat.setVector3('uLightDirection', direction)
      }
    })
  }

  dispose(): void {
    for (const mesh of this.chunks.values()) {
      mesh.dispose()
    }
    this.chunks.clear()
    this.dirtyChunks.clear()
    this.currentSize = 0
    this.currentSizeZ = 0
  }

  // ── Private ────────────────────────────────────────────────

  private createChunkMesh(cx: number, cz: number, terrain: TerrainData): Mesh {
    const cs = this.chunkSize
    const startX = cx * cs
    const startZ = cz * cs
    const cellsX = Math.min(cs, terrain.size - startX)
    const cellsZ = Math.min(cs, terrain.sizeZ - startZ)

    const mesh = new Mesh(`chunk_${cx}_${cz}`, this.scene)
    mesh.parent = this.parent

    const vertexData = this.buildChunkVertexData(startX, startZ, cellsX, cellsZ, terrain)
    vertexData.applyToMesh(mesh, true) // updatable = true

    const material = createToonTerrainMaterial(this.scene, {
      steps: 4,
      ambient: 0.35,
    })
    mesh.material = material

    mesh.metadata = {
      isTerrainChunk: true,
      chunkX: cx,
      chunkZ: cz,
    }

    return mesh
  }

  private updateChunkGeometry(mesh: Mesh, cx: number, cz: number, terrain: TerrainData): void {
    const cs = this.chunkSize
    const startX = cx * cs
    const startZ = cz * cs
    const cellsX = Math.min(cs, terrain.size - startX)
    const cellsZ = Math.min(cs, terrain.sizeZ - startZ)

    const vertsX = cellsX + 1
    const vertsZ = cellsZ + 1
    const vertCount = vertsX * vertsZ

    const posData = mesh.getVerticesData(VertexBuffer.PositionKind)
    if (!posData || posData.length / 3 !== vertCount) {
      // Size changed — full rebuild
      const vertexData = this.buildChunkVertexData(startX, startZ, cellsX, cellsZ, terrain)
      vertexData.applyToMesh(mesh, true)
      return
    }

    const positions = new Float32Array(vertCount * 3)
    const colors = new Float32Array(vertCount * 4) // Babylon uses RGBA
    const normals = new Float32Array(vertCount * 3)

    this.fillPositionsAndColors(positions, colors, startX, startZ, vertsX, vertsZ, terrain)

    // Get indices for normal computation
    const indices = mesh.getIndices()
    if (indices) {
      this.computeNormals(positions, indices as Uint32Array, normals, vertCount)
    }

    mesh.updateVerticesData(VertexBuffer.PositionKind, positions)
    mesh.updateVerticesData(VertexBuffer.ColorKind, colors)
    mesh.updateVerticesData(VertexBuffer.NormalKind, normals)
    mesh.refreshBoundingInfo()
  }

  private fillPositionsAndColors(
    positions: Float32Array,
    colors: Float32Array,
    startX: number,
    startZ: number,
    vertsX: number,
    vertsZ: number,
    terrain: TerrainData
  ): void {
    const cellSize = terrain.cellSize
    for (let vz = 0; vz < vertsZ; vz++) {
      for (let vx = 0; vx < vertsX; vx++) {
        const vi = vz * vertsX + vx

        const gx = Math.min(startX + vx, terrain.size - 1)
        const gz = Math.min(startZ + vz, terrain.sizeZ - 1)

        const wx = gx * cellSize
        const wz = gz * cellSize
        const height = terrain.heights[terrainIndex(gx, gz, terrain.size)]
        const wy = height * terrain.maxHeight

        positions[vi * 3] = wx
        positions[vi * 3 + 1] = wy
        positions[vi * 3 + 2] = wz

        const matId = terrain.materials[terrainIndex(gx, gz, terrain.size)] as TerrainMaterialId
        const rgb = getMaterialColor(matId)
        let r = rgb[0], g = rgb[1], b = rgb[2]

        if (height < terrain.seaLevel) {
          const depth = Math.min((terrain.seaLevel - height) / terrain.seaLevel, 1)
          const tint = 1 - depth * 0.45
          r = r * tint * 0.7
          g = g * tint * 0.85
          b = Math.min(1, b * tint + depth * 0.15)
        }

        // Dim cells outside polygon boundary
        if (this.polygonBoundary && this.polygonBoundary.length >= 3) {
          if (!isPointInPolygon(wx, wz, this.polygonBoundary)) {
            r *= 0.3
            g *= 0.3
            b *= 0.3
          }
        }

        // Babylon.js uses RGBA vertex colors (4 components)
        colors[vi * 4] = r
        colors[vi * 4 + 1] = g
        colors[vi * 4 + 2] = b
        colors[vi * 4 + 3] = 1
      }
    }
  }

  private buildChunkVertexData(
    startX: number,
    startZ: number,
    cellsX: number,
    cellsZ: number,
    terrain: TerrainData,
    _lodStep: number = 1
  ): VertexData {
    const vertsX = cellsX + 1
    const vertsZ = cellsZ + 1
    const vertCount = vertsX * vertsZ

    const positions = new Float32Array(vertCount * 3)
    const colors = new Float32Array(vertCount * 4) // RGBA
    const normals = new Float32Array(vertCount * 3)

    this.fillPositionsAndColors(positions, colors, startX, startZ, vertsX, vertsZ, terrain)

    // Build index buffer
    const cellCountX = vertsX - 1
    const cellCountZ = vertsZ - 1
    const indexCount = cellCountX * cellCountZ * 6
    const indices = new Uint32Array(indexCount)
    let idx = 0

    for (let cz = 0; cz < cellCountZ; cz++) {
      for (let cx = 0; cx < cellCountX; cx++) {
        const tl = cz * vertsX + cx
        const tr = tl + 1
        const bl = (cz + 1) * vertsX + cx
        const br = bl + 1

        // Babylon.js uses clockwise winding (opposite of Three.js)
        indices[idx++] = tl
        indices[idx++] = tr
        indices[idx++] = bl
        indices[idx++] = tr
        indices[idx++] = br
        indices[idx++] = bl
      }
    }

    this.computeNormals(positions, indices, normals, vertCount)

    const vertexData = new VertexData()
    vertexData.positions = positions
    vertexData.normals = normals
    vertexData.colors = colors
    vertexData.indices = indices

    return vertexData
  }

  private computeNormals(
    positions: Float32Array,
    indices: Uint32Array | number[],
    normals: Float32Array,
    vertCount: number
  ): void {
    normals.fill(0)

    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]
      const b = indices[i + 1]
      const c = indices[i + 2]

      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2]
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2]
      const cx2 = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2]

      const abx = bx - ax, aby = by - ay, abz = bz - az
      const acx = cx2 - ax, acy = cy - ay, acz = cz - az

      const nx = aby * acz - abz * acy
      const ny = abz * acx - abx * acz
      const nz = abx * acy - aby * acx

      normals[a * 3] += nx; normals[a * 3 + 1] += ny; normals[a * 3 + 2] += nz
      normals[b * 3] += nx; normals[b * 3 + 1] += ny; normals[b * 3 + 2] += nz
      normals[c * 3] += nx; normals[c * 3 + 1] += ny; normals[c * 3 + 2] += nz
    }

    for (let i = 0; i < vertCount; i++) {
      const x = normals[i * 3], y = normals[i * 3 + 1], z = normals[i * 3 + 2]
      const len = Math.sqrt(x * x + y * y + z * z) || 1
      normals[i * 3] = x / len
      normals[i * 3 + 1] = y / len
      normals[i * 3 + 2] = z / len
    }
  }
}

export function worldToGrid(
  point: Vector3,
  terrain: TerrainData
): { x: number; z: number } | null {
  const gx = Math.round(point.x / terrain.cellSize)
  const gz = Math.round(point.z / terrain.cellSize)
  if (!isInBounds(gx, gz, terrain.size, terrain.sizeZ)) return null
  return { x: gx, z: gz }
}
