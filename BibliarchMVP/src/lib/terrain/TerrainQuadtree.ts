import { Vector3, BoundingBox } from '@babylonjs/core'

/**
 * CDLOD-style quadtree for terrain LOD selection.
 */

export const LOD_STEPS = [1, 2, 4, 8, 16] as const
export const LOD_COUNT = LOD_STEPS.length

export const LOD_RANGES = [100, 200, 400, 800, Infinity] as const

export interface QuadNode {
  cx: number
  cz: number
  size: number
  level: number
  boundsMin: Vector3
  boundsMax: Vector3
  children: QuadNode[] | null
  centerWorld: Vector3
}

export interface LODSelection {
  cx: number
  cz: number
  size: number
  lodStep: number
  morphFactor: number
}

export class TerrainQuadtree {
  private root: QuadNode | null = null
  private gridSizeX: number = 0
  private gridSizeZ: number = 0
  private cellSize: number = 1
  private maxHeight: number = 200

  build(gridSizeX: number, gridSizeZ: number, cellSize: number, maxHeight: number): void {
    this.gridSizeX = gridSizeX
    this.gridSizeZ = gridSizeZ
    this.cellSize = cellSize
    this.maxHeight = maxHeight

    const maxDim = Math.max(gridSizeX, gridSizeZ)
    const rootSize = nextPow2(maxDim)
    const maxLevel = Math.min(Math.floor(Math.log2(rootSize / 64)), LOD_COUNT - 1)

    this.root = this.buildNode(0, 0, rootSize, maxLevel)
  }

  selectLOD(cameraPos: Vector3): LODSelection[] {
    if (!this.root) return []
    const selections: LODSelection[] = []
    this.traverse(this.root, cameraPos, selections)
    return selections
  }

  private buildNode(cx: number, cz: number, size: number, level: number): QuadNode {
    const cs = this.cellSize
    const minX = cx * cs
    const minZ = cz * cs
    const maxX = Math.min(cx + size, this.gridSizeX) * cs
    const maxZ = Math.min(cz + size, this.gridSizeZ) * cs

    const boundsMin = new Vector3(minX, 0, minZ)
    const boundsMax = new Vector3(maxX, this.maxHeight, maxZ)

    const centerWorld = new Vector3(
      (minX + maxX) / 2,
      0,
      (minZ + maxZ) / 2
    )

    let children: QuadNode[] | null = null

    if (level > 0 && size > 64) {
      const half = size / 2
      children = [
        this.buildNode(cx, cz, half, level - 1),
        this.buildNode(cx + half, cz, half, level - 1),
        this.buildNode(cx, cz + half, half, level - 1),
        this.buildNode(cx + half, cz + half, half, level - 1),
      ]
    }

    return { cx, cz, size, level, boundsMin, boundsMax, children, centerWorld }
  }

  private traverse(node: QuadNode, cameraPos: Vector3, out: LODSelection[]): void {
    if (node.cx >= this.gridSizeX || node.cz >= this.gridSizeZ) return

    const dist = Vector3.Distance(cameraPos, node.centerWorld)
    const lodRange = LOD_RANGES[node.level]

    if (node.children && dist < lodRange) {
      for (const child of node.children) {
        this.traverse(child, cameraPos, out)
      }
      return
    }

    const lodStep = LOD_STEPS[Math.min(node.level, LOD_COUNT - 1)]

    const morphStart = lodRange * 0.7
    const morphEnd = lodRange
    const morphFactor = dist < morphStart ? 0 :
      dist > morphEnd ? 1 :
      (dist - morphStart) / (morphEnd - morphStart)

    const clippedSizeX = Math.min(node.size, this.gridSizeX - node.cx)
    const clippedSizeZ = Math.min(node.size, this.gridSizeZ - node.cz)
    if (clippedSizeX <= 0 || clippedSizeZ <= 0) return

    out.push({
      cx: node.cx,
      cz: node.cz,
      size: node.size,
      lodStep,
      morphFactor,
    })
  }
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}
