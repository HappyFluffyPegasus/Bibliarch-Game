import { Vector3 } from '@babylonjs/core'
import { TerrainData } from '@/types/world'
import { TerrainQuadtree, LODSelection } from './TerrainQuadtree'

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
  private maxLoadedChunks: number = 512

  constructor() {
    this.quadtree = new TerrainQuadtree()
  }

  setTerrain(terrain: TerrainData): void {
    this.terrain = terrain
    this.quadtree.build(terrain.size, terrain.sizeZ, terrain.cellSize, terrain.maxHeight)
  }

  update(cameraPos: Vector3): LODSelection[] {
    if (!this.terrain) return []

    const selections = this.quadtree.selectLOD(cameraPos)
    const activeKeys = new Set<string>()
    const now = performance.now()

    for (const sel of selections) {
      const key = `${sel.cx}_${sel.cz}_${sel.lodStep}`
      activeKeys.add(key)

      if (!this.loadedChunks.has(key)) {
        const dist = Vector3.Distance(cameraPos, new Vector3(
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

  classifyRing(distance: number): StreamingRing {
    if (distance < RING_DISTANCES.immediate) return 'immediate'
    if (distance < RING_DISTANCES.near) return 'near'
    if (distance < RING_DISTANCES.far) return 'far'
    return 'unloaded'
  }

  getLoadedCount(): number {
    return this.loadedChunks.size
  }

  dispose(): void {
    this.loadedChunks.clear()
    this.terrain = null
  }
}
