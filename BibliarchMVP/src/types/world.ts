// ============================================================
// TERRAIN MATERIAL SYSTEM
// ============================================================

/** Material IDs for terrain cells - 25 types across 3 categories */
export enum TerrainMaterialId {
  // Natural (1-10)
  Grass = 1,
  Sand = 2,
  Rock = 3,
  Snow = 4,
  Dirt = 5,
  Mud = 6,
  Ice = 7,
  Gravel = 8,
  Clay = 9,
  DeadGrass = 10,

  // Urban (11-15)
  Concrete = 11,
  Asphalt = 12,
  Cobblestone = 13,
  Brick = 14,
  WoodPlanks = 15,

  // Fantasy (16-20)
  Crystal = 16,
  Lava = 17,
  Corrupted = 18,
  MagicGlow = 19,
  Void = 20,
}

/** Static definition for a terrain material type */
export interface TerrainMaterial {
  id: TerrainMaterialId
  name: string
  color: [number, number, number] // RGB 0-1 for shaders
  roughness: number
  category: 'natural' | 'urban' | 'fantasy'
  hasGrass: boolean
  grassDensity: number // 0-1
  grassColor?: [number, number, number]
}

// ============================================================
// TERRAIN DATA
// ============================================================

/** Terrain grid size — any positive integer (no preset restrictions) */
export type TerrainSize = number

/**
 * Core terrain data stored as flat arrays for performance.
 * heights: Float32Array of size*sizeZ (values 0-1 normalized)
 * materials: Uint8Array of size*sizeZ (TerrainMaterialId values)
 * size = grid width (X), sizeZ = grid depth (Z).
 *
 * For localStorage serialization, these convert to regular number arrays.
 */
export interface TerrainData {
  size: number      // Grid width (X cells)
  sizeZ: number     // Grid depth (Z cells)
  cellSize: number  // World units per cell (default 1)
  heights: Float32Array  // size*sizeZ, values 0-1
  materials: Uint8Array  // size*sizeZ, TerrainMaterialId values
  seaLevel: number  // 0-1 normalized height
  maxHeight: number // World-space max height (default 200)
}

/**
 * Serializable version of TerrainData for localStorage/JSON.
 * Typed arrays converted to regular number arrays.
 */
export interface SerializedTerrainData {
  size: number
  sizeZ?: number    // Optional for backward compat with old saves (defaults to size)
  cellSize: number
  heights: number[]
  materials: number[]
  seaLevel: number
  maxHeight: number
}

// ============================================================
// WORLD OBJECTS (buildings, decorations, props)
// ============================================================

export type WorldObjectCategory = 'building' | 'decoration' | 'prop' | 'vegetation'

export interface WorldObject {
  id: string
  type: string // Key into object catalog
  category: WorldObjectCategory
  position: [number, number, number]
  rotation: [number, number, number] // Euler XYZ in radians
  scale: [number, number, number]
  color: string // Hex color
  locked: boolean
  visible: boolean
  name?: string // Optional user label
  metadata?: Record<string, unknown>
}

// ============================================================
// CARTOGRAPHY (2D map editor data)
// ============================================================

export type CartographyRegionType =
  | 'ocean'
  | 'shallows'
  | 'beach'
  | 'plains'
  | 'hills'
  | 'mountains'
  | 'forest'
  | 'desert'
  | 'tundra'
  | 'swamp'

export type CartographyPathType = 'coastline' | 'river' | 'ridge' | 'road'

export interface CartographyRegion {
  type: CartographyRegionType
  cells: number[] // Flat array indices into cartography grid
}

export interface CartographyPathPoint {
  x: number
  z: number
}

export interface CartographyPath {
  id: string
  type: CartographyPathType
  points: CartographyPathPoint[]
  width: number
  controlPoints?: CartographyPathPoint[] // Bezier handles
}

export interface CartographyGenerationSettings {
  noiseScale: number
  noiseOctaves: number
  heightMultiplier: number
  smoothingPasses: number
}

export interface CartographyData {
  gridSizeX: number // Width of the 2D map grid
  gridSizeZ: number // Depth of the 2D map grid
  regions: CartographyRegion[]
  paths: CartographyPath[]
  settings: CartographyGenerationSettings
}

// ============================================================
// WORLD (top-level container)
// ============================================================

export interface World {
  id: string
  storyId: string
  name: string
  terrain: TerrainData
  objects: WorldObject[]
  cartographyData?: CartographyData
  createdAt: Date
  updatedAt: Date
}

/**
 * Serializable version for localStorage/JSON persistence.
 */
export interface SerializedWorld {
  id: string
  storyId: string
  name: string
  terrain: SerializedTerrainData
  objects: WorldObject[]
  cartographyData?: CartographyData
  createdAt: string
  updatedAt: string
}

// ============================================================
// BRUSH & EDITOR TYPES
// ============================================================

export type TerrainBrushType =
  | 'raise'
  | 'lower'
  | 'smooth'
  | 'flatten'
  | 'noise'
  | 'plateau'
  | 'erode'

export type MaterialBrushType = 'paint' | 'fill' | 'auto-paint'

export type FalloffType = 'linear' | 'smooth' | 'constant'

export interface BrushSettings {
  type: TerrainBrushType
  size: number // 1-64 cells radius
  strength: number // 0.05-1.0
  falloff: FalloffType
}

export interface MaterialBrushSettings {
  type: MaterialBrushType
  size: number
  materialId: TerrainMaterialId
  falloff: FalloffType
}

export type EditorTool =
  | 'select'
  | 'sculpt'
  | 'paint-material'
  | 'place-object'
  | 'delete'
  | 'cartography'

export type TransformMode = 'translate' | 'rotate' | 'scale'

// ============================================================
// SERIALIZATION HELPERS
// ============================================================

/** Convert TerrainData to a JSON-serializable form */
export function serializeTerrainData(terrain: TerrainData): SerializedTerrainData {
  return {
    size: terrain.size,
    sizeZ: terrain.sizeZ,
    cellSize: terrain.cellSize,
    heights: Array.from(terrain.heights),
    materials: Array.from(terrain.materials),
    seaLevel: terrain.seaLevel,
    maxHeight: terrain.maxHeight,
  }
}

/** Restore TerrainData from serialized form (handles missing/old data) */
export function deserializeTerrainData(data: SerializedTerrainData): TerrainData {
  // Validate required fields exist and are correct types
  const size = typeof data.size === 'number' && data.size > 0 ? data.size : 256
  const sizeZ = typeof data.sizeZ === 'number' && data.sizeZ > 0 ? data.sizeZ : size
  const totalCells = size * sizeZ

  let heights: Float32Array
  if (data.heights && Array.isArray(data.heights) && data.heights.length === totalCells) {
    heights = new Float32Array(data.heights)
  } else {
    // Invalid or missing heights - create flat terrain
    heights = new Float32Array(totalCells)
  }

  let materials: Uint8Array
  if (data.materials && Array.isArray(data.materials) && data.materials.length === totalCells) {
    materials = new Uint8Array(data.materials)
  } else {
    // Missing materials - fill with Grass
    materials = new Uint8Array(totalCells)
    materials.fill(TerrainMaterialId.Grass)
  }

  // Ensure no NaN values in heights
  for (let i = 0; i < heights.length; i++) {
    if (!Number.isFinite(heights[i])) heights[i] = 0
  }

  return {
    size,
    sizeZ,
    cellSize: typeof data.cellSize === 'number' && data.cellSize > 0 ? data.cellSize : 1,
    heights,
    materials,
    seaLevel: typeof data.seaLevel === 'number' && Number.isFinite(data.seaLevel) ? data.seaLevel : 0.2,
    maxHeight: typeof data.maxHeight === 'number' && data.maxHeight > 0 ? data.maxHeight : 200,
  }
}

/** Convert World to serializable form */
export function serializeWorld(world: World): SerializedWorld {
  return {
    id: world.id,
    storyId: world.storyId,
    name: world.name,
    terrain: serializeTerrainData(world.terrain),
    objects: world.objects,
    cartographyData: world.cartographyData,
    createdAt: world.createdAt instanceof Date ? world.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: world.updatedAt instanceof Date ? world.updatedAt.toISOString() : new Date().toISOString(),
  }
}

/** Restore World from serialized form (handles old/missing data gracefully) */
export function deserializeWorld(data: SerializedWorld): World {
  return {
    id: data.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    storyId: data.storyId || '',
    name: data.name || 'My World',
    terrain: data.terrain ? deserializeTerrainData(data.terrain) : createTerrain(256, 256),
    objects: Array.isArray(data.objects) ? data.objects : [],
    cartographyData: data.cartographyData,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  }
}

// ============================================================
// FACTORY HELPERS
// ============================================================

/** Create a blank terrain with default values */
export function createTerrain(sizeX: number = 256, sizeZ: number = 256): TerrainData {
  const totalCells = sizeX * sizeZ
  const heights = new Float32Array(totalCells) // All zeros
  const materials = new Uint8Array(totalCells)
  // Default material: Grass
  materials.fill(TerrainMaterialId.Grass)

  return {
    size: sizeX,
    sizeZ,
    cellSize: 1,
    heights,
    materials,
    seaLevel: 0.2,
    maxHeight: 200,
  }
}

/** Create a new empty World */
export function createWorld(storyId: string, name: string, sizeX: number = 256, sizeZ: number = 256): World {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    storyId,
    name,
    terrain: createTerrain(sizeX, sizeZ),
    objects: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// ============================================================
// UTILITY: Terrain coordinate helpers
// ============================================================

/** Get the flat array index for grid coordinates */
export function terrainIndex(x: number, z: number, size: number): number {
  return z * size + x
}

/** Get grid coordinates from flat array index */
export function terrainCoords(index: number, size: number): { x: number; z: number } {
  return {
    x: index % size,
    z: Math.floor(index / size),
  }
}

/** Check if grid coordinates are within bounds */
export function isInBounds(x: number, z: number, sizeX: number, sizeZ: number): boolean {
  return x >= 0 && x < sizeX && z >= 0 && z < sizeZ
}

/** Get height at grid coordinates */
export function getHeight(terrain: TerrainData, x: number, z: number): number {
  if (!isInBounds(x, z, terrain.size, terrain.sizeZ)) return 0
  return terrain.heights[terrainIndex(x, z, terrain.size)]
}

/** Get material at grid coordinates */
export function getMaterial(terrain: TerrainData, x: number, z: number): TerrainMaterialId {
  if (!isInBounds(x, z, terrain.size, terrain.sizeZ)) return TerrainMaterialId.Grass
  return terrain.materials[terrainIndex(x, z, terrain.size)]
}

/** Check if a cell is underwater */
export function isUnderwater(terrain: TerrainData, x: number, z: number): boolean {
  return getHeight(terrain, x, z) < terrain.seaLevel
}
