/**
 * O(1) spatial hash for fast 2D queries on world objects.
 *
 * Divides the world into a grid of cells, each containing a set of object IDs.
 * Supports insert, remove, and radius/rect queries in O(1) per cell.
 *
 * Used for:
 * - Raycasting (only test objects near the mouse ray)
 * - Chunk streaming (which objects to load for a chunk)
 * - Frustum culling (which objects are in view)
 */

export class SpatialHash {
  private cellSize: number
  private grid: Map<number, Set<string>> = new Map()
  private objectCells: Map<string, number[]> = new Map()  // objectId → [hash1, hash2, ...]

  constructor(cellSize: number = 32) {
    this.cellSize = cellSize
  }

  /** Hash world coordinates into a single integer key */
  private hash(x: number, z: number): number {
    const cx = Math.floor(x / this.cellSize)
    const cz = Math.floor(z / this.cellSize)
    // Large primes for spatial hashing (Teschner et al.)
    return ((cx * 73856093) ^ (cz * 19349663)) | 0
  }

  /** Insert an object at a world position */
  insert(id: string, x: number, z: number): void {
    const h = this.hash(x, z)
    let cell = this.grid.get(h)
    if (!cell) {
      cell = new Set()
      this.grid.set(h, cell)
    }
    cell.add(id)

    const cells = this.objectCells.get(id) || []
    cells.push(h)
    this.objectCells.set(id, cells)
  }

  /** Remove an object from the hash */
  remove(id: string): void {
    const cells = this.objectCells.get(id)
    if (!cells) return

    for (const h of cells) {
      const cell = this.grid.get(h)
      if (cell) {
        cell.delete(id)
        if (cell.size === 0) this.grid.delete(h)
      }
    }
    this.objectCells.delete(id)
  }

  /** Update an object's position (remove + re-insert) */
  update(id: string, x: number, z: number): void {
    this.remove(id)
    this.insert(id, x, z)
  }

  /** Query all objects within a radius of a point */
  queryRadius(x: number, z: number, radius: number): string[] {
    const results: string[] = []
    const seen = new Set<string>()

    const minCx = Math.floor((x - radius) / this.cellSize)
    const maxCx = Math.floor((x + radius) / this.cellSize)
    const minCz = Math.floor((z - radius) / this.cellSize)
    const maxCz = Math.floor((z + radius) / this.cellSize)

    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const h = ((cx * 73856093) ^ (cz * 19349663)) | 0
        const cell = this.grid.get(h)
        if (cell) {
          for (const id of cell) {
            if (!seen.has(id)) {
              seen.add(id)
              results.push(id)
            }
          }
        }
      }
    }

    return results
  }

  /** Query all objects within a rectangular region */
  queryRect(minX: number, minZ: number, maxX: number, maxZ: number): string[] {
    const results: string[] = []
    const seen = new Set<string>()

    const minCx = Math.floor(minX / this.cellSize)
    const maxCx = Math.floor(maxX / this.cellSize)
    const minCz = Math.floor(minZ / this.cellSize)
    const maxCz = Math.floor(maxZ / this.cellSize)

    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const h = ((cx * 73856093) ^ (cz * 19349663)) | 0
        const cell = this.grid.get(h)
        if (cell) {
          for (const id of cell) {
            if (!seen.has(id)) {
              seen.add(id)
              results.push(id)
            }
          }
        }
      }
    }

    return results
  }

  /** Get the total number of tracked objects */
  get size(): number {
    return this.objectCells.size
  }

  /** Clear all data */
  clear(): void {
    this.grid.clear()
    this.objectCells.clear()
  }

  dispose(): void {
    this.clear()
  }
}
