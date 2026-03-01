import * as THREE from 'three'

/**
 * CDLOD-style quadtree for terrain LOD selection.
 *
 * Subdivides the terrain grid into a hierarchy of nodes.
 * Each frame, traverses from root and selects the appropriate LOD level
 * per node based on camera distance, producing a set of leaf nodes to render.
 */

// LOD level → vertex sampling step (every Nth cell)
export const LOD_STEPS = [1, 2, 4, 8, 16] as const
export const LOD_COUNT = LOD_STEPS.length

// Camera distance thresholds per LOD level (in world units)
export const LOD_RANGES = [100, 200, 400, 800, Infinity] as const

export interface QuadNode {
  cx: number          // chunk X in grid coords (top-left cell X)
  cz: number          // chunk Z in grid coords (top-left cell Z)
  size: number        // number of cells this node covers (always power of 2)
  level: number       // 0 = finest, 4 = coarsest
  bounds: THREE.Box3
  children: QuadNode[] | null  // null = leaf node
  centerWorld: THREE.Vector3   // center in world space (for distance checks)
}

export interface LODSelection {
  cx: number
  cz: number
  size: number
  lodStep: number      // vertex sampling step
  morphFactor: number  // 0-1 for smooth LOD transitions
}

export class TerrainQuadtree {
  private root: QuadNode | null = null
  private gridSizeX: number = 0
  private gridSizeZ: number = 0
  private cellSize: number = 1
  private maxHeight: number = 200

  /**
   * Build the quadtree for a given terrain size.
   * Call once when terrain dimensions change.
   */
  build(gridSizeX: number, gridSizeZ: number, cellSize: number, maxHeight: number): void {
    this.gridSizeX = gridSizeX
    this.gridSizeZ = gridSizeZ
    this.cellSize = cellSize
    this.maxHeight = maxHeight

    // The quadtree root covers the entire terrain.
    // We use the max of X/Z rounded up to next power of 2 for the tree structure,
    // but the actual terrain data bounds clip to real size.
    const maxDim = Math.max(gridSizeX, gridSizeZ)
    const rootSize = nextPow2(maxDim)
    const maxLevel = Math.min(Math.floor(Math.log2(rootSize / 64)), LOD_COUNT - 1)

    this.root = this.buildNode(0, 0, rootSize, maxLevel)
  }

  /**
   * Select which chunks to render and at what LOD.
   * Call every frame with the current camera position.
   */
  selectLOD(cameraPos: THREE.Vector3): LODSelection[] {
    if (!this.root) return []
    const selections: LODSelection[] = []
    this.traverse(this.root, cameraPos, selections)
    return selections
  }

  // ── Private ──────────────────────────────────────────────

  private buildNode(cx: number, cz: number, size: number, level: number): QuadNode {
    const cs = this.cellSize
    const minX = cx * cs
    const minZ = cz * cs
    const maxX = Math.min(cx + size, this.gridSizeX) * cs
    const maxZ = Math.min(cz + size, this.gridSizeZ) * cs

    const bounds = new THREE.Box3(
      new THREE.Vector3(minX, 0, minZ),
      new THREE.Vector3(maxX, this.maxHeight, maxZ)
    )

    const centerWorld = new THREE.Vector3(
      (minX + maxX) / 2,
      0,
      (minZ + maxZ) / 2
    )

    let children: QuadNode[] | null = null

    // Subdivide if we haven't reached the finest level and the node is large enough
    if (level > 0 && size > 64) {
      const half = size / 2
      children = [
        this.buildNode(cx, cz, half, level - 1),
        this.buildNode(cx + half, cz, half, level - 1),
        this.buildNode(cx, cz + half, half, level - 1),
        this.buildNode(cx + half, cz + half, half, level - 1),
      ]
    }

    return { cx, cz, size, level, bounds, children, centerWorld }
  }

  private traverse(node: QuadNode, cameraPos: THREE.Vector3, out: LODSelection[]): void {
    // Skip nodes entirely outside the actual terrain
    if (node.cx >= this.gridSizeX || node.cz >= this.gridSizeZ) return

    const dist = cameraPos.distanceTo(node.centerWorld)
    const lodRange = LOD_RANGES[node.level]

    // If camera is close enough and we can subdivide, recurse into children
    if (node.children && dist < lodRange) {
      for (const child of node.children) {
        this.traverse(child, cameraPos, out)
      }
      return
    }

    // This node is a leaf (or camera is far enough) — render it at this LOD
    const lodStep = LOD_STEPS[Math.min(node.level, LOD_COUNT - 1)]

    // Morph factor for smooth transitions (avoid popping)
    const morphStart = lodRange * 0.7
    const morphEnd = lodRange
    const morphFactor = dist < morphStart ? 0 :
      dist > morphEnd ? 1 :
      (dist - morphStart) / (morphEnd - morphStart)

    // Clip to actual terrain bounds
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
