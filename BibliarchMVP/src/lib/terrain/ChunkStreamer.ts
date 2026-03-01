import * as THREE from 'three'
import { TerrainData } from '@/types/world'
import { ChunkManager } from './ChunkManager'
import { TerrainQuadtree, LODSelection } from './TerrainQuadtree'

/**
 * Ring-based chunk streaming system.
 *
 * Manages which chunks are loaded into GPU memory based on camera distance.
 * Works with the TerrainQuadtree to determine what LOD each chunk should be.
 *
 * Ring system:
 * | Ring       | Distance | Content                              |
 * |------------|----------|--------------------------------------|
 * | Immediate  | 0-128m   | Full LOD 0 terrain + all objects     |
 * | Near       | 128-512m | LOD 1-2 terrain, instanced objects   |
 * | Far        | 512-2km  | LOD 3-4 terrain, billboard impostors |
 * | Unloaded   | 2km+     | Nothing                              |
 */

export type StreamingRing = 'immediate' | 'near' | 'far' | 'unloaded'

export const RING_DISTANCES = {
  immediate: 128,
  near: 512,
  far: 2000,
} as const

interface StreamedChunk {
  key: string
  cx: number
  cz: number
  lodStep: number
  ring: StreamingRing
  lastAccess: number
}

export class ChunkStreamer {
  private quadtree: TerrainQuadtree
  private loadedChunks: Map<string, StreamedChunk> = new Map()
  private terrain: TerrainData | null = null
  private maxLoadedChunks: number = 512  // Safety limit

  constructor() {
    this.quadtree = new TerrainQuadtree()
  }

  /** Initialize or rebuild the quadtree for new terrain dimensions */
  setTerrain(terrain: TerrainData): void {
    this.terrain = terrain
    this.quadtree.build(terrain.size, terrain.sizeZ, terrain.cellSize, terrain.maxHeight)
  }

  /**
   * Update streaming based on camera position.
   * Returns the LOD selections that should be rendered this frame.
   */
  update(cameraPos: THREE.Vector3): LODSelection[] {
    if (!this.terrain) return []

    // Query the quadtree for visible chunks at appropriate LOD levels
    const selections = this.quadtree.selectLOD(cameraPos)

    // Track which chunks are active this frame
    const activeKeys = new Set<string>()
    const now = performance.now()

    for (const sel of selections) {
      const key = `${sel.cx}_${sel.cz}_${sel.lodStep}`
      activeKeys.add(key)

      if (!this.loadedChunks.has(key)) {
        const dist = cameraPos.distanceTo(new THREE.Vector3(
          sel.cx * this.terrain.cellSize + sel.size * this.terrain.cellSize / 2,
          0,
          sel.cz * this.terrain.cellSize + sel.size * this.terrain.cellSize / 2
        ))

        this.loadedChunks.set(key, {
          key,
          cx: sel.cx,
          cz: sel.cz,
          lodStep: sel.lodStep,
          ring: this.classifyRing(dist),
          lastAccess: now,
        })
      } else {
        this.loadedChunks.get(key)!.lastAccess = now
      }
    }

    // Evict chunks that haven't been accessed recently (unloaded ring)
    if (this.loadedChunks.size > this.maxLoadedChunks) {
      const sorted = Array.from(this.loadedChunks.entries())
        .filter(([k]) => !activeKeys.has(k))
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess)

      const toEvict = this.loadedChunks.size - this.maxLoadedChunks
      for (let i = 0; i < Math.min(toEvict, sorted.length); i++) {
        this.loadedChunks.delete(sorted[i][0])
      }
    }

    return selections
  }

  /** Get the streaming ring classification for a distance */
  classifyRing(distance: number): StreamingRing {
    if (distance < RING_DISTANCES.immediate) return 'immediate'
    if (distance < RING_DISTANCES.near) return 'near'
    if (distance < RING_DISTANCES.far) return 'far'
    return 'unloaded'
  }

  /** Get the current number of loaded chunks */
  getLoadedCount(): number {
    return this.loadedChunks.size
  }

  dispose(): void {
    this.loadedChunks.clear()
    this.terrain = null
  }
}
