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
// WORLD LOCATIONS (camera bookmarks for scene backdrops)
// ============================================================

export interface WorldLocation {
  id: string
  name: string
  cameraPosition: [number, number, number]
  cameraRotation: [number, number, number]  // Euler XYZ in radians
  thumbnail?: string  // Base64 encoded image data
  createdAt: Date
}

export interface SerializedWorldLocation {
  id: string
  name: string
  cameraPosition: [number, number, number]
  cameraRotation: [number, number, number]
  thumbnail?: string
  createdAt: string
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
  locations: WorldLocation[]  // Camera bookmarks for scene backdrops
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
  locations?: SerializedWorldLocation[]  // Camera bookmarks for scene backdrops
  createdAt: string
  updatedAt: string
}

// ============================================================
// POLYGON BORDERS (World/Country Level)
// ============================================================

export interface BorderVertex { x: number; z: number }

export interface PolygonBorder {
  id: string
  name: string
  vertices: BorderVertex[]
  color: string
  style: 'solid' | 'dashed' | 'dotted'
  fillOpacity: number
  linkedChildId?: string
}

// ============================================================
// CITY LOT SYSTEM
// ============================================================

export type LotZoning = 'residential' | 'commercial' | 'industrial' | 'park' | 'special'

export interface CityLot {
  id: string
  name: string
  zoning: LotZoning
  startX: number; startZ: number
  width: number; depth: number
  color?: string
  linkedBuildingId?: string
  metadata?: Record<string, unknown>
}

export const LOT_ZONING_COLORS: Record<LotZoning, string> = {
  residential: '#4CAF50',
  commercial: '#2196F3',
  industrial: '#FF9800',
  park: '#8BC34A',
  special: '#9C27B0',
}

// ============================================================
// ROAD NETWORK (City Level)
// ============================================================

export type RoadType = 'highway' | 'main' | 'street' | 'alley' | 'footpath'

export interface RoadWaypoint { x: number; z: number }

export interface RoadSegment {
  id: string
  name?: string
  type: RoadType
  waypoints: RoadWaypoint[]
  width: number
  lanes: number
  oneWay: boolean
  hasSidewalk: boolean
  sidewalkWidth: number
  hasMedian: boolean
}

export interface RoadIntersection {
  id: string
  position: { x: number; z: number }
  connectedSegmentIds: string[]
  type: 'stop' | 'signal' | 'roundabout' | 'yield' | 'uncontrolled'
}

export interface RoadNetwork {
  segments: RoadSegment[]
  intersections: RoadIntersection[]
}

export const ROAD_TYPE_DEFAULTS: Record<RoadType, { width: number; lanes: number; hasSidewalk: boolean; sidewalkWidth: number }> = {
  highway:  { width: 20, lanes: 4, hasSidewalk: false, sidewalkWidth: 0 },
  main:     { width: 14, lanes: 2, hasSidewalk: true,  sidewalkWidth: 2 },
  street:   { width: 10, lanes: 2, hasSidewalk: true,  sidewalkWidth: 1.5 },
  alley:    { width: 5,  lanes: 1, hasSidewalk: false, sidewalkWidth: 0 },
  footpath: { width: 2,  lanes: 0, hasSidewalk: false, sidewalkWidth: 0 },
}

// ============================================================
// BUILDING INTERIOR (Building Level)
// ============================================================

export interface WallSegment {
  id: string
  startX: number; startZ: number
  endX: number; endZ: number
  height: number
  thickness: number
  material: string
  exteriorMaterial?: string
}

export type WallOpeningType = 'door' | 'window' | 'arch'

export interface WallOpening {
  id: string
  wallId: string
  type: WallOpeningType
  position: number
  width: number
  height: number
  sillHeight: number
}

export interface FloorTile {
  x: number; z: number
  material: string
}

export interface DetectedRoom {
  id: string
  name: string
  floorLevel: number
  cellIndices: number[]
  roomType?: 'bedroom' | 'kitchen' | 'bathroom' | 'living' | 'hallway' | 'closet' | 'custom'
}

export interface BuildingFloor {
  level: number
  floorHeight: number
  ceilingHeight: number
  walls: WallSegment[]
  openings: WallOpening[]
  floorTiles: FloorTile[]
  rooms: DetectedRoom[]
}

export interface FurniturePlacement {
  id: string
  itemType: string
  position: [number, number, number]
  rotation: number
  floorLevel: number
  roomId?: string
  wallId?: string
}

export interface BuildingData {
  gridSize: number
  gridCellSize: number
  floors: BuildingFloor[]
  furniture: FurniturePlacement[]
  activeFloor: number
  /** World-space Y offset — matches terrain height at the lot's position */
  baseElevation: number
}

// ============================================================
// HIERARCHICAL WORLD BUILDING
// ============================================================

export type WorldLevel = 'world' | 'country' | 'city' | 'building'

export interface EnvironmentSettings {
  sunAngle: number
  sunElevation: number
  skyColor: string
  waterColor: string
  fogEnabled: boolean
  weatherType: 'clear' | 'rain' | 'snow' | 'fog' | 'cloudy'
}

export interface LevelBounds {
  startX: number   // parent grid coords
  startZ: number
  width: number    // in parent grid cells
  depth: number
}

/**
 * A single node in the hierarchical world tree.
 * Each node has its own terrain, objects, and children.
 */
export interface WorldNode {
  id: string
  parentId: string | null
  level: WorldLevel
  name: string
  terrain: TerrainData
  objects: WorldObject[]
  boundsInParent: LevelBounds | null  // null for root
  childIds: string[]
  cartographyData?: CartographyData
  locations: WorldLocation[]
  parentThumbnail?: string  // cached mini-render of this node in parent
  polygonBorders?: PolygonBorder[]
  lots?: CityLot[]
  roadNetwork?: RoadNetwork
  buildingData?: BuildingData
  environment?: EnvironmentSettings
  polygonBoundary?: BorderVertex[]  // child local coords of parent border polygon
  parentBoundsSnapshot?: { heights: number[]; materials: number[] }
  createdAt: Date
  updatedAt: Date
}

export interface SerializedWorldNode {
  id: string
  parentId: string | null
  level: WorldLevel
  name: string
  terrain: SerializedTerrainData
  objects: WorldObject[]
  boundsInParent: LevelBounds | null
  childIds: string[]
  cartographyData?: CartographyData
  locations?: SerializedWorldLocation[]
  parentThumbnail?: string
  polygonBorders?: PolygonBorder[]
  lots?: CityLot[]
  roadNetwork?: RoadNetwork
  buildingData?: BuildingData
  environment?: EnvironmentSettings
  polygonBoundary?: BorderVertex[]
  parentBoundsSnapshot?: { heights: number[]; materials: number[] }
  createdAt: string
  updatedAt: string
}

/**
 * Top-level hierarchical world container.
 * All nodes stored in a flat map for O(1) lookup.
 */
export interface HierarchicalWorld {
  id: string
  storyId: string
  name: string
  version: 2
  rootNodeId: string
  nodes: Record<string, WorldNode>
  createdAt: Date
  updatedAt: Date
}

export interface SerializedHierarchicalWorld {
  id: string
  storyId: string
  name: string
  version: 2
  rootNodeId: string
  nodes: Record<string, SerializedWorldNode>
  createdAt: string
  updatedAt: string
}

/** Serialize a WorldNode */
export function serializeWorldNode(node: WorldNode): SerializedWorldNode {
  return {
    id: node.id,
    parentId: node.parentId,
    level: node.level,
    name: node.name,
    terrain: serializeTerrainData(node.terrain),
    objects: node.objects,
    boundsInParent: node.boundsInParent,
    childIds: node.childIds,
    cartographyData: node.cartographyData,
    locations: node.locations?.map(serializeWorldLocation),
    parentThumbnail: node.parentThumbnail,
    polygonBorders: node.polygonBorders,
    lots: node.lots,
    roadNetwork: node.roadNetwork,
    buildingData: node.buildingData,
    createdAt: node.createdAt instanceof Date ? node.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: node.updatedAt instanceof Date ? node.updatedAt.toISOString() : new Date().toISOString(),
  }
}

/** Deserialize a WorldNode */
export function deserializeWorldNode(data: SerializedWorldNode): WorldNode {
  return {
    id: data.id,
    parentId: data.parentId,
    level: data.level,
    name: data.name,
    terrain: deserializeTerrainData(data.terrain),
    objects: Array.isArray(data.objects) ? data.objects : [],
    boundsInParent: data.boundsInParent,
    childIds: data.childIds || [],
    cartographyData: data.cartographyData,
    locations: Array.isArray(data.locations) ? data.locations.map(deserializeWorldLocation) : [],
    parentThumbnail: data.parentThumbnail,
    polygonBorders: data.polygonBorders,
    lots: data.lots,
    roadNetwork: data.roadNetwork,
    buildingData: data.buildingData,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  }
}

/** Serialize a HierarchicalWorld */
export function serializeHierarchicalWorld(hw: HierarchicalWorld): SerializedHierarchicalWorld {
  const nodes: Record<string, SerializedWorldNode> = {}
  for (const [key, node] of Object.entries(hw.nodes)) {
    nodes[key] = serializeWorldNode(node)
  }
  return {
    id: hw.id,
    storyId: hw.storyId,
    name: hw.name,
    version: 2,
    rootNodeId: hw.rootNodeId,
    nodes,
    createdAt: hw.createdAt instanceof Date ? hw.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: hw.updatedAt instanceof Date ? hw.updatedAt.toISOString() : new Date().toISOString(),
  }
}

/** Deserialize a HierarchicalWorld */
export function deserializeHierarchicalWorld(data: SerializedHierarchicalWorld): HierarchicalWorld {
  const nodes: Record<string, WorldNode> = {}
  for (const [key, nodeData] of Object.entries(data.nodes)) {
    nodes[key] = deserializeWorldNode(nodeData)
  }
  return {
    id: data.id,
    storyId: data.storyId,
    name: data.name,
    version: 2,
    rootNodeId: data.rootNodeId,
    nodes,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  }
}

/**
 * Migrate a legacy flat World into a HierarchicalWorld with a single root node.
 */
export function migrateLegacyWorld(world: World): HierarchicalWorld {
  const rootNodeId = world.id + '-root'

  const rootNode: WorldNode = {
    id: rootNodeId,
    parentId: null,
    level: 'world',
    name: world.name,
    terrain: world.terrain,
    objects: world.objects,
    boundsInParent: null,
    childIds: [],
    cartographyData: world.cartographyData,
    locations: world.locations || [],
    createdAt: world.createdAt,
    updatedAt: world.updatedAt,
  }

  return {
    id: world.id,
    storyId: world.storyId,
    name: world.name,
    version: 2,
    rootNodeId,
    nodes: { [rootNodeId]: rootNode },
    createdAt: world.createdAt,
    updatedAt: world.updatedAt,
  }
}

/** Create a new empty WorldNode */
export function createWorldNode(
  parentId: string | null,
  level: WorldLevel,
  name: string,
  bounds: LevelBounds | null,
  sizeX: number = 128,
  sizeZ: number = 128,
): WorldNode {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    parentId,
    level,
    name,
    terrain: createTerrain(sizeX, sizeZ),
    objects: [],
    boundsInParent: bounds,
    childIds: [],
    locations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** Create a new empty HierarchicalWorld */
export function createHierarchicalWorld(
  storyId: string,
  name: string,
  sizeX: number = 1024,
  sizeZ: number = 1024,
): HierarchicalWorld {
  const rootNode = createWorldNode(null, 'world', name, null, sizeX, sizeZ)
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    storyId,
    name,
    version: 2,
    rootNodeId: rootNode.id,
    nodes: { [rootNode.id]: rootNode },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** Tool restrictions per level */
export const LEVEL_TOOLS: Record<WorldLevel, EditorTool[]> = {
  world:    ['sculpt', 'paint-material', 'place-object', 'select', 'delete', 'cartography', 'draw-border'],
  country:  ['sculpt', 'paint-material', 'place-object', 'select', 'delete', 'draw-border'],
  city:     ['sculpt', 'paint-material', 'place-object', 'select', 'delete', 'draw-border', 'draw-lot', 'draw-road'],
  building: ['select', 'delete', 'place-wall', 'place-door', 'paint-floor', 'place-furniture'],
}

/** Object category filters per level */
export const LEVEL_OBJECT_CATEGORIES: Record<WorldLevel, string[]> = {
  world:    ['decoration'],
  country:  ['building', 'decoration', 'vegetation'],
  city:     ['building', 'decoration', 'prop', 'vegetation'],
  building: ['decoration', 'prop'],
}

/** Get the child level for a given level */
export function getChildLevel(level: WorldLevel): WorldLevel | null {
  const childMap: Record<WorldLevel, WorldLevel | null> = {
    world: 'country',
    country: 'city',
    city: 'building',
    building: null,
  }
  return childMap[level]
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
  | 'define-region'
  | 'draw-border'
  | 'draw-lot'
  | 'draw-road'
  | 'place-wall'
  | 'place-door'
  | 'paint-floor'
  | 'place-furniture'

export type TransformMode = 'translate' | 'rotate' | 'scale'

// ============================================================
// SERIALIZATION HELPERS
// ============================================================

/** Convert TerrainData to a JSON-serializable form (for JSON export/share) */
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

/**
 * IDB-native terrain serialization — stores typed arrays directly.
 * IndexedDB uses structured clone which handles Float32Array/Uint8Array natively,
 * avoiding the memory-doubling of Array.from().
 */
export interface IDBTerrainData {
  size: number
  sizeZ: number
  cellSize: number
  heights: Float32Array
  materials: Uint8Array
  seaLevel: number
  maxHeight: number
}

export function serializeTerrainForIDB(terrain: TerrainData): IDBTerrainData {
  return {
    size: terrain.size,
    sizeZ: terrain.sizeZ,
    cellSize: terrain.cellSize,
    heights: terrain.heights,
    materials: terrain.materials,
    seaLevel: terrain.seaLevel,
    maxHeight: terrain.maxHeight,
  }
}

export function deserializeTerrainFromIDB(data: IDBTerrainData): TerrainData {
  return {
    size: data.size,
    sizeZ: data.sizeZ ?? data.size,
    cellSize: data.cellSize || 1,
    heights: data.heights instanceof Float32Array ? data.heights : new Float32Array(data.heights),
    materials: data.materials instanceof Uint8Array ? data.materials : new Uint8Array(data.materials),
    seaLevel: data.seaLevel ?? 0.2,
    maxHeight: data.maxHeight || 200,
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

/** Serialize a WorldLocation to JSON form */
export function serializeWorldLocation(loc: WorldLocation): SerializedWorldLocation {
  return {
    id: loc.id,
    name: loc.name,
    cameraPosition: loc.cameraPosition,
    cameraRotation: loc.cameraRotation,
    thumbnail: loc.thumbnail,
    createdAt: loc.createdAt instanceof Date ? loc.createdAt.toISOString() : new Date().toISOString(),
  }
}

/** Deserialize a WorldLocation from JSON form */
export function deserializeWorldLocation(data: SerializedWorldLocation): WorldLocation {
  return {
    id: data.id,
    name: data.name,
    cameraPosition: data.cameraPosition,
    cameraRotation: data.cameraRotation,
    thumbnail: data.thumbnail,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
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
    locations: world.locations?.map(serializeWorldLocation),
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
    locations: Array.isArray(data.locations) ? data.locations.map(deserializeWorldLocation) : [],
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
  const heights = new Float32Array(totalCells)
  // Start heights just above sea level so terrain is visible as land
  heights.fill(0.22)
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
    locations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** Create a new WorldLocation */
export function createWorldLocation(
  name: string,
  cameraPosition: [number, number, number],
  cameraRotation: [number, number, number],
  thumbnail?: string
): WorldLocation {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    cameraPosition,
    cameraRotation,
    thumbnail,
    createdAt: new Date(),
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

/** Point-in-polygon test using ray-casting algorithm */
export function isPointInPolygon(px: number, pz: number, polygon: BorderVertex[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z
    const xj = polygon[j].x, zj = polygon[j].z
    if ((zi > pz) !== (zj > pz) && px < (xj - xi) * (pz - zi) / (zj - zi) + xi) {
      inside = !inside
    }
  }
  return inside
}
