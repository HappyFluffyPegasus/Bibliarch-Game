import * as THREE from 'three'
import {
  TerrainData,
  TerrainMaterialId,
  terrainIndex,
  isInBounds,
} from '@/types/world'
import { getMaterialColor } from './materials'
import { createToonTerrainMaterial } from '@/lib/shaders/toonMaterial'

const CHUNK_SIZE = 64

/**
 * Manages terrain rendering as a grid of chunks.
 * Each chunk is a 32x32 cell mesh with vertex colors for materials.
 */
export class ChunkManager {
  private chunks: Map<string, THREE.Mesh> = new Map()
  private dirtyChunks: Set<string> = new Set()
  private group: THREE.Group
  private chunkSize: number
  private terrain: TerrainData | null = null
  private currentSize: number = 0
  private currentSizeZ: number = 0

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'terrain-chunks'
    this.chunkSize = CHUNK_SIZE
  }

  /** Get the Three.js group containing all chunk meshes */
  getGroup(): THREE.Group {
    return this.group
  }

  /** Get all chunk meshes for raycasting */
  getChunkMeshes(): THREE.Mesh[] {
    return Array.from(this.chunks.values())
  }

  /** Update terrain — reuses existing mesh/material objects when grid layout is unchanged */
  setTerrain(terrain: TerrainData): void {
    const oldSize = this.currentSize
    const oldSizeZ = this.currentSizeZ
    this.terrain = terrain

    const numChunksX = Math.ceil(terrain.size / this.chunkSize)
    const numChunksZ = Math.ceil(terrain.sizeZ / this.chunkSize)
    const expectedChunks = numChunksX * numChunksZ

    // Same grid layout with all chunks present: reuse objects, just rebuild geometry
    if (oldSize === terrain.size && oldSizeZ === terrain.sizeZ && this.chunks.size === expectedChunks) {
      for (const [key, mesh] of this.chunks) {
        const [cx, cz] = key.split('_').map(Number)
        this.updateChunkGeometry(mesh, cx, cz, terrain)
      }
      return
    }

    // Different size or missing chunks: full rebuild
    this.dispose()
    this.currentSize = terrain.size
    this.currentSizeZ = terrain.sizeZ

    for (let cz = 0; cz < numChunksZ; cz++) {
      for (let cx = 0; cx < numChunksX; cx++) {
        const key = `${cx}_${cz}`
        const mesh = this.createChunkMesh(cx, cz, terrain)
        this.chunks.set(key, mesh)
        this.group.add(mesh)
      }
    }
  }

  /** Mark a region of cells as needing rebuild (after sculpt/paint) */
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

  /** Rebuild only dirty chunks. Call after brush strokes. */
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

  /** Dispose all GPU resources */
  dispose(): void {
    for (const mesh of this.chunks.values()) {
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
      this.group.remove(mesh)
    }
    this.chunks.clear()
    this.dirtyChunks.clear()
    this.currentSize = 0
    this.currentSizeZ = 0
  }

  // ── Private ────────────────────────────────────────────────

  private createChunkMesh(cx: number, cz: number, terrain: TerrainData): THREE.Mesh {
    const cs = this.chunkSize
    const startX = cx * cs
    const startZ = cz * cs
    const cellsX = Math.min(cs, terrain.size - startX)
    const cellsZ = Math.min(cs, terrain.sizeZ - startZ)

    const geometry = this.buildChunkGeometry(startX, startZ, cellsX, cellsZ, terrain)

    const material = createToonTerrainMaterial({
      steps: 4,
      ambient: 0.35,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.isTerrainChunk = true
    mesh.userData.chunkX = cx
    mesh.userData.chunkZ = cz

    return mesh
  }

  private updateChunkGeometry(mesh: THREE.Mesh, cx: number, cz: number, terrain: TerrainData): void {
    const cs = this.chunkSize
    const startX = cx * cs
    const startZ = cz * cs
    const cellsX = Math.min(cs, terrain.size - startX)
    const cellsZ = Math.min(cs, terrain.sizeZ - startZ)

    // Dispose old geometry
    mesh.geometry.dispose()
    // Create new
    mesh.geometry = this.buildChunkGeometry(startX, startZ, cellsX, cellsZ, terrain)
  }

  /**
   * Build BufferGeometry for a chunk section.
   * Vertices are in world space so chunks tile seamlessly.
   */
  private buildChunkGeometry(
    startX: number,
    startZ: number,
    cellsX: number,
    cellsZ: number,
    terrain: TerrainData
  ): THREE.BufferGeometry {
    const vertsX = cellsX + 1
    const vertsZ = cellsZ + 1
    const vertCount = vertsX * vertsZ
    const cellSize = terrain.cellSize

    // Attribute arrays
    const positions = new Float32Array(vertCount * 3)
    const colors = new Float32Array(vertCount * 3)
    const normals = new Float32Array(vertCount * 3)

    // Fill positions and colors
    for (let vz = 0; vz < vertsZ; vz++) {
      for (let vx = 0; vx < vertsX; vx++) {
        const vi = vz * vertsX + vx

        // Grid coordinates (clamped to terrain bounds)
        const gx = Math.min(startX + vx, terrain.size - 1)
        const gz = Math.min(startZ + vz, terrain.sizeZ - 1)

        // World position
        const wx = gx * cellSize
        const wz = gz * cellSize
        const height = terrain.heights[terrainIndex(gx, gz, terrain.size)]
        const wy = height * terrain.maxHeight

        positions[vi * 3] = wx
        positions[vi * 3 + 1] = wy
        positions[vi * 3 + 2] = wz

        // Vertex color from material
        const matId = terrain.materials[terrainIndex(gx, gz, terrain.size)] as TerrainMaterialId
        const rgb = getMaterialColor(matId)
        let r = rgb[0], g = rgb[1], b = rgb[2]

        if (height < terrain.seaLevel) {
          // How far below sea level (0 = at sea level, 1 = at 0 height)
          const depth = Math.min((terrain.seaLevel - height) / terrain.seaLevel, 1)
          const tint = 1 - depth * 0.45   // darken up to 45%
          r = r * tint * 0.7               // reduce red
          g = g * tint * 0.85              // slightly reduce green
          b = Math.min(1, b * tint + depth * 0.15)  // push toward blue
        }

        colors[vi * 3] = r
        colors[vi * 3 + 1] = g
        colors[vi * 3 + 2] = b
      }
    }

    // Build index buffer (two triangles per cell)
    const indexCount = cellsX * cellsZ * 6
    const indices = new Uint32Array(indexCount)
    let idx = 0

    for (let cz = 0; cz < cellsZ; cz++) {
      for (let cx = 0; cx < cellsX; cx++) {
        const tl = cz * vertsX + cx
        const tr = tl + 1
        const bl = (cz + 1) * vertsX + cx
        const br = bl + 1

        // Triangle 1
        indices[idx++] = tl
        indices[idx++] = bl
        indices[idx++] = tr
        // Triangle 2
        indices[idx++] = tr
        indices[idx++] = bl
        indices[idx++] = br
      }
    }

    // Compute normals
    this.computeNormals(positions, indices, normals, vertCount)

    // Assemble geometry
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    return geometry
  }

  /** Compute smooth normals for the mesh */
  private computeNormals(
    positions: Float32Array,
    indices: Uint32Array,
    normals: Float32Array,
    vertCount: number
  ): void {
    // Zero out
    normals.fill(0)

    const vA = new THREE.Vector3()
    const vB = new THREE.Vector3()
    const vC = new THREE.Vector3()
    const ab = new THREE.Vector3()
    const ac = new THREE.Vector3()
    const faceNormal = new THREE.Vector3()

    // Accumulate face normals
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]
      const b = indices[i + 1]
      const c = indices[i + 2]

      vA.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2])
      vB.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2])
      vC.set(positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2])

      ab.subVectors(vB, vA)
      ac.subVectors(vC, vA)
      faceNormal.crossVectors(ab, ac)

      normals[a * 3] += faceNormal.x
      normals[a * 3 + 1] += faceNormal.y
      normals[a * 3 + 2] += faceNormal.z
      normals[b * 3] += faceNormal.x
      normals[b * 3 + 1] += faceNormal.y
      normals[b * 3 + 2] += faceNormal.z
      normals[c * 3] += faceNormal.x
      normals[c * 3 + 1] += faceNormal.y
      normals[c * 3 + 2] += faceNormal.z
    }

    // Normalize
    const n = new THREE.Vector3()
    for (let i = 0; i < vertCount; i++) {
      n.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
      n.normalize()
      normals[i * 3] = n.x
      normals[i * 3 + 1] = n.y
      normals[i * 3 + 2] = n.z
    }
  }
}

/**
 * Convert a world-space raycaster hit point to terrain grid coordinates.
 */
export function worldToGrid(
  point: THREE.Vector3,
  terrain: TerrainData
): { x: number; z: number } | null {
  const gx = Math.round(point.x / terrain.cellSize)
  const gz = Math.round(point.z / terrain.cellSize)
  if (!isInBounds(gx, gz, terrain.size, terrain.sizeZ)) return null
  return { x: gx, z: gz }
}
