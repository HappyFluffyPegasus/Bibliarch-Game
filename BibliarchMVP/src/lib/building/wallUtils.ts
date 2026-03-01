import { WallSegment, WallOpening, DetectedRoom, BuildingData, BuildingFloor } from '@/types/world'

/** Snap a world-space point to the building grid */
export function snapToWallGrid(x: number, z: number, gridSize: number, cellSize: number): { x: number; z: number } {
  // Snap to half-cell precision
  const halfCell = cellSize / 2
  return {
    x: Math.round(x / halfCell) * halfCell,
    z: Math.round(z / halfCell) * halfCell,
  }
}

/** Detect rooms via flood fill on a 2D grid */
export function detectRooms(walls: WallSegment[], gridSize: number, cellSize: number): DetectedRoom[] {
  // Build a boolean grid marking wall-occupied cells
  const grid = new Uint8Array(gridSize * gridSize) // 0 = empty, 1 = wall

  for (const wall of walls) {
    rasterizeWallOnGrid(wall, grid, gridSize, cellSize)
  }

  // Flood fill from each unvisited non-wall cell
  const visited = new Uint8Array(gridSize * gridSize)
  const rooms: DetectedRoom[] = []
  let roomCounter = 0

  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = z * gridSize + x
      if (visited[idx] || grid[idx]) continue

      // Flood fill
      const cells: number[] = []
      let touchesBoundary = false
      const stack: number[] = [idx]

      while (stack.length > 0) {
        const ci = stack.pop()!
        if (visited[ci]) continue
        visited[ci] = 1

        if (grid[ci]) continue // wall cell
        cells.push(ci)

        const cx = ci % gridSize
        const cz = Math.floor(ci / gridSize)

        // Check if touching grid boundary (= exterior)
        if (cx === 0 || cx === gridSize - 1 || cz === 0 || cz === gridSize - 1) {
          touchesBoundary = true
        }

        // Neighbors (4-connected)
        if (cx > 0) stack.push(ci - 1)
        if (cx < gridSize - 1) stack.push(ci + 1)
        if (cz > 0) stack.push(ci - gridSize)
        if (cz < gridSize - 1) stack.push(ci + gridSize)
      }

      // Discard exterior regions (touching boundary)
      if (touchesBoundary || cells.length === 0) continue

      roomCounter++
      rooms.push({
        id: `room-${roomCounter}`,
        name: `Room ${roomCounter}`,
        floorLevel: 0,
        cellIndices: cells,
      })
    }
  }

  return rooms
}

/** Rasterize a wall segment onto the boolean grid */
function rasterizeWallOnGrid(
  wall: WallSegment,
  grid: Uint8Array,
  gridSize: number,
  cellSize: number
): void {
  // Convert wall coordinates to grid cells and mark them
  const x0 = wall.startX / cellSize
  const z0 = wall.startZ / cellSize
  const x1 = wall.endX / cellSize
  const z1 = wall.endZ / cellSize

  // Bresenham-like line rasterization with thickness
  const dx = x1 - x0
  const dz = z1 - z0
  const len = Math.hypot(dx, dz)
  if (len < 0.01) return

  const steps = Math.ceil(len * 2) // oversample
  const thickness = Math.max(1, Math.ceil(wall.thickness / cellSize))

  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const wx = x0 + dx * t
    const wz = z0 + dz * t

    // Normal perpendicular to wall direction
    const nx = -dz / len
    const nz = dx / len

    for (let w = -thickness; w <= thickness; w++) {
      const gx = Math.round(wx + nx * w * 0.5)
      const gz = Math.round(wz + nz * w * 0.5)
      if (gx >= 0 && gx < gridSize && gz >= 0 && gz < gridSize) {
        grid[gz * gridSize + gx] = 1
      }
    }
  }
}

/** Split a wall into segments with gaps where openings are */
export function splitWallAtOpening(wall: WallSegment, opening: WallOpening): WallSegment[] {
  const wallLen = wallLength(wall)
  const openStart = opening.position - (opening.width / 2) / wallLen
  const openEnd = opening.position + (opening.width / 2) / wallLen

  const clampedStart = Math.max(0, openStart)
  const clampedEnd = Math.min(1, openEnd)

  const dx = wall.endX - wall.startX
  const dz = wall.endZ - wall.startZ

  const segments: WallSegment[] = []

  // Before opening
  if (clampedStart > 0.01) {
    segments.push({
      ...wall,
      id: `${wall.id}-pre`,
      endX: wall.startX + dx * clampedStart,
      endZ: wall.startZ + dz * clampedStart,
    })
  }

  // After opening
  if (clampedEnd < 0.99) {
    segments.push({
      ...wall,
      id: `${wall.id}-post`,
      startX: wall.startX + dx * clampedEnd,
      startZ: wall.startZ + dz * clampedEnd,
    })
  }

  return segments
}

/** Find a wall at a given point */
export function findWallAtPoint(
  walls: WallSegment[],
  x: number,
  z: number,
  tolerance: number
): WallSegment | null {
  for (const wall of walls) {
    const dist = pointToSegmentDistance(
      x, z,
      wall.startX, wall.startZ,
      wall.endX, wall.endZ
    )
    if (dist <= tolerance + wall.thickness / 2) {
      return wall
    }
  }
  return null
}

/** Distance from point to line segment */
function pointToSegmentDistance(
  px: number, pz: number,
  x0: number, z0: number,
  x1: number, z1: number
): number {
  const dx = x1 - x0
  const dz = z1 - z0
  const lenSq = dx * dx + dz * dz

  if (lenSq < 1e-10) return Math.hypot(px - x0, pz - z0)

  let t = ((px - x0) * dx + (pz - z0) * dz) / lenSq
  t = Math.max(0, Math.min(1, t))

  const cx = x0 + t * dx
  const cz = z0 + t * dz
  return Math.hypot(px - cx, pz - cz)
}

/** Compute the length of a wall */
export function wallLength(wall: WallSegment): number {
  return Math.hypot(wall.endX - wall.startX, wall.endZ - wall.startZ)
}

/** Create a default BuildingData */
export function createBuildingData(gridSize: number = 32, cellSize: number = 0.5): BuildingData {
  return {
    gridSize,
    gridCellSize: cellSize,
    floors: [{
      level: 0,
      floorHeight: 0,
      ceilingHeight: 3,
      walls: [],
      openings: [],
      floorTiles: [],
      rooms: [],
    }],
    furniture: [],
    activeFloor: 0,
  }
}

/** Get room centroid in world coordinates */
export function getRoomCentroid(room: DetectedRoom, gridSize: number, cellSize: number): { x: number; z: number } {
  if (room.cellIndices.length === 0) return { x: 0, z: 0 }

  let sumX = 0
  let sumZ = 0
  for (const idx of room.cellIndices) {
    const x = (idx % gridSize) * cellSize + cellSize / 2
    const z = Math.floor(idx / gridSize) * cellSize + cellSize / 2
    sumX += x
    sumZ += z
  }
  return {
    x: sumX / room.cellIndices.length,
    z: sumZ / room.cellIndices.length,
  }
}
