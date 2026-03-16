import { create } from 'zustand'
import {
  EditorTool,
  BrushSettings,
  MaterialBrushSettings,
  TransformMode,
  TerrainMaterialId,
  TerrainBrushType,
  FalloffType,
  CartographyRegionType,
  WorldLevel,
  LotZoning,
  RoadType,
  RoadWaypoint,
  WorldObject,
} from '@/types/world'

// ============================================================
// UNDO/REDO COMMAND TYPES
// ============================================================

interface TerrainSculptCommand {
  type: 'terrain-sculpt'
  cells: { index: number; oldHeight: number; newHeight: number }[]
}

interface TerrainPaintCommand {
  type: 'terrain-paint'
  cells: { index: number; oldMaterial: number; newMaterial: number }[]
}

interface ObjectPlaceCommand {
  type: 'object-place'
  objectId: string
  objectSnapshot?: string // Set during undo for redo support
}

interface ObjectDeleteCommand {
  type: 'object-delete'
  objectSnapshot: string // JSON serialized WorldObject
}

interface ObjectTransformCommand {
  type: 'object-transform'
  objectId: string
  oldPosition: [number, number, number]
  oldRotation: [number, number, number]
  oldScale: [number, number, number]
  newPosition: [number, number, number]
  newRotation: [number, number, number]
  newScale: [number, number, number]
}

interface TerrainBulkCommand {
  type: 'terrain-bulk'
  oldHeights: Float32Array
  oldMaterials: Uint8Array
  newHeights: Float32Array
  newMaterials: Uint8Array
}

interface ObjectDuplicateCommand {
  type: 'object-duplicate'
  objectIds: string[]
  objectSnapshots?: string // Set during undo for redo support
}

interface ObjectPropertyCommand {
  type: 'object-property'
  objectId: string
  oldProps: Partial<WorldObject>
  newProps: Partial<WorldObject>
}

interface BorderCreateCommand {
  type: 'border-create'
  borderId: string
  borderSnapshot?: string // Set during undo for redo support
}

interface BorderDeleteCommand {
  type: 'border-delete'
  borderSnapshot: string
}

interface WallPlaceCommand {
  type: 'wall-place'
  wallId: string
  floorLevel: number
  wallSnapshot?: string // Set during undo for redo support
}

interface WallDeleteCommand {
  type: 'wall-delete'
  wallSnapshot: string
  floorLevel: number
}

interface OpeningPlaceCommand {
  type: 'opening-place'
  openingId: string
  floorLevel: number
  openingSnapshot?: string // Set during undo for redo support
}

interface FurniturePlaceCommand {
  type: 'furniture-place'
  furnitureId: string
  furnitureSnapshot?: string // Set during undo for redo support
}

type UndoCommand =
  | TerrainSculptCommand
  | TerrainPaintCommand
  | TerrainBulkCommand
  | ObjectPlaceCommand
  | ObjectDeleteCommand
  | ObjectTransformCommand
  | ObjectDuplicateCommand
  | ObjectPropertyCommand
  | BorderCreateCommand
  | BorderDeleteCommand
  | WallPlaceCommand
  | WallDeleteCommand
  | OpeningPlaceCommand
  | FurniturePlaceCommand

// ============================================================
// DOCK PANEL TYPES
// ============================================================

export type DockPanelId = 'explorer' | 'toolbox' | 'properties' | 'locations' | 'output'

export type DockSide = 'left' | 'right' | 'bottom'

export interface DockPanelState {
  side: DockSide
  visible: boolean
  collapsed: boolean
  order: number
}

const DEFAULT_PANELS: Record<DockPanelId, DockPanelState> = {
  explorer:   { side: 'left',  visible: true,  collapsed: false, order: 0 },
  toolbox:    { side: 'left',  visible: false, collapsed: false, order: 1 },
  locations:  { side: 'left',  visible: false, collapsed: false, order: 2 },
  properties: { side: 'right', visible: true,  collapsed: false, order: 0 },
  output:     { side: 'bottom', visible: false, collapsed: true,  order: 0 },
}

// ============================================================
// STORE STATE
// ============================================================

interface WorldBuilderState {
  // Active tool
  activeTool: EditorTool

  // Sculpt brush settings
  sculptBrush: BrushSettings

  // Material paint settings
  materialBrush: MaterialBrushSettings

  // Object placement
  selectedObjectType: string | null // Object catalog key
  transformMode: TransformMode
  snapToGrid: boolean
  gridSize: number // World units
  rotationSnap: number // Degrees (0 = no snap)

  // Selection
  selectedObjectIds: string[]

  // Viewport settings
  showGrid: boolean
  showWireframe: boolean
  showGrass: boolean
  showWater: boolean
  showMiniMap: boolean

  // Undo/redo
  undoStack: UndoCommand[]
  redoStack: UndoCommand[]
  maxUndoSteps: number

  // Cartography
  cartographyBiome: CartographyRegionType
  cartographyBrushSize: number

  // Camera
  cameraMode: 'orbit' | 'first-person'
  firstPersonSubMode: 'walk' | 'fly'
  firstPersonSpeed: number

  // Hierarchy navigation
  activeNodeId: string | null
  navigationStack: string[]  // breadcrumb history of node IDs
  currentLevel: WorldLevel

  // Border drawing (world/country)
  borderDrawMode: 'idle' | 'drawing'
  borderVertices: { x: number; z: number }[]
  borderStyle: 'solid' | 'dashed' | 'dotted'
  borderColor: string
  showBorders: boolean

  // Lot system (city)
  lotZoning: LotZoning
  lotCorner1: { x: number; z: number } | null
  showLots: boolean

  // Road system (city)
  roadType: RoadType
  roadDrawMode: 'idle' | 'drawing'
  roadWaypoints: RoadWaypoint[]
  showRoads: boolean

  // Building system
  wallDrawMode: 'idle' | 'drawing'
  wallStartPoint: { x: number; z: number } | null
  wallHeight: number
  wallMaterial: string
  activeFloor: number
  selectedFurnitureType: string | null
  floorMaterial: string
  showWalls: boolean
  showRoomLabels: boolean
  floorVisibility: 'active-only' | 'transparent' | 'all'

  // Dock panels
  panels: Record<DockPanelId, DockPanelState>
  leftDockWidth: number
  rightDockWidth: number
  bottomDockHeight: number
  isPlaytesting: boolean

  // Status
  cursorWorldPosition: [number, number, number] | null
  cursorGridPosition: { x: number; z: number } | null
  fps: number
  isDirty: boolean // Has unsaved changes

  // ── Actions ──────────────────────────────────────────────

  // Tool selection
  setActiveTool: (tool: EditorTool) => void

  // Sculpt brush
  setSculptBrushType: (type: TerrainBrushType) => void
  setSculptBrushSize: (size: number) => void
  setSculptBrushStrength: (strength: number) => void
  setSculptBrushFalloff: (falloff: FalloffType) => void

  // Material paint
  setMaterialBrushMaterial: (materialId: TerrainMaterialId) => void
  setMaterialBrushSize: (size: number) => void
  setMaterialBrushType: (type: MaterialBrushSettings['type']) => void

  // Object placement
  setSelectedObjectType: (type: string | null) => void
  setTransformMode: (mode: TransformMode) => void
  setSnapToGrid: (snap: boolean) => void
  setGridSize: (size: number) => void
  setRotationSnap: (degrees: number) => void

  // Cartography
  setCartographyBiome: (biome: CartographyRegionType) => void
  setCartographyBrushSize: (size: number) => void

  // Selection
  selectObject: (id: string) => void
  addToSelection: (id: string) => void
  removeFromSelection: (id: string) => void
  clearSelection: () => void
  setSelection: (ids: string[]) => void

  // Camera
  setCameraMode: (mode: 'orbit' | 'first-person') => void
  setFirstPersonSubMode: (mode: 'walk' | 'fly') => void
  setFirstPersonSpeed: (speed: number) => void

  // Viewport
  setShowGrid: (show: boolean) => void
  setShowWireframe: (show: boolean) => void
  setShowGrass: (show: boolean) => void
  setShowWater: (show: boolean) => void
  setShowMiniMap: (show: boolean) => void

  // Undo/redo
  pushUndo: (command: UndoCommand) => void
  undo: () => UndoCommand | null
  redo: () => UndoCommand | null
  clearHistory: () => void

  // Hierarchy navigation
  setActiveNodeId: (id: string | null) => void
  enterNode: (nodeId: string, level: WorldLevel) => void
  exitToParent: () => void
  resetNavigation: (rootNodeId: string) => void

  // Border drawing
  setBorderDrawMode: (mode: 'idle' | 'drawing') => void
  addBorderVertex: (v: { x: number; z: number }) => void
  clearBorderVertices: () => void
  setBorderStyle: (style: 'solid' | 'dashed' | 'dotted') => void
  setBorderColor: (color: string) => void
  setShowBorders: (show: boolean) => void

  // Lot system
  setLotZoning: (zoning: LotZoning) => void
  setLotCorner1: (corner: { x: number; z: number } | null) => void
  setShowLots: (show: boolean) => void

  // Road system
  setRoadType: (type: RoadType) => void
  setRoadDrawMode: (mode: 'idle' | 'drawing') => void
  addRoadWaypoint: (w: RoadWaypoint) => void
  clearRoadWaypoints: () => void
  setShowRoads: (show: boolean) => void

  // Building system
  setWallDrawMode: (mode: 'idle' | 'drawing') => void
  setWallStartPoint: (point: { x: number; z: number } | null) => void
  setWallHeight: (height: number) => void
  setWallMaterial: (material: string) => void
  setActiveFloor: (floor: number) => void
  setSelectedFurnitureType: (type: string | null) => void
  setFloorMaterial: (material: string) => void
  setShowWalls: (show: boolean) => void
  setShowRoomLabels: (show: boolean) => void
  setFloorVisibility: (mode: 'active-only' | 'transparent' | 'all') => void

  // Dock panels
  setPanelVisible: (id: DockPanelId, visible: boolean) => void
  setPanelCollapsed: (id: DockPanelId, collapsed: boolean) => void
  setLeftDockWidth: (w: number) => void
  setRightDockWidth: (w: number) => void
  setBottomDockHeight: (h: number) => void
  setPlaytesting: (playing: boolean) => void
  resetPanelLayout: () => void
  movePanelToSide: (id: DockPanelId, side: DockSide) => void

  // Status
  setCursorWorldPosition: (pos: [number, number, number] | null) => void
  setCursorGridPosition: (pos: { x: number; z: number } | null) => void
  setFps: (fps: number) => void
  setIsDirty: (dirty: boolean) => void
}

// ============================================================
// STORE
// ============================================================

export const useWorldBuilderStore = create<WorldBuilderState>()((set, get) => ({
  // ── Default State ────────────────────────────────────────

  activeTool: 'sculpt',

  sculptBrush: {
    type: 'raise',
    size: 8,
    strength: 0.5,
    falloff: 'smooth',
  },

  materialBrush: {
    type: 'paint',
    size: 8,
    materialId: TerrainMaterialId.Grass,
    falloff: 'smooth',
  },

  selectedObjectType: null,
  transformMode: 'translate',
  snapToGrid: true,
  gridSize: 1,
  rotationSnap: 15,

  cartographyBiome: 'plains' as CartographyRegionType,
  cartographyBrushSize: 3,

  selectedObjectIds: [],

  showGrid: true,
  showWireframe: false,
  showGrass: true,
  showWater: true,
  showMiniMap: true,

  undoStack: [],
  redoStack: [],
  maxUndoSteps: 50,

  cameraMode: 'orbit',
  firstPersonSubMode: 'walk',
  firstPersonSpeed: 1.0,

  activeNodeId: null,
  navigationStack: [],
  currentLevel: 'world',

  // Border drawing
  borderDrawMode: 'idle',
  borderVertices: [],
  borderStyle: 'solid',
  borderColor: '#ff6b35',
  showBorders: true,

  // Lot system
  lotZoning: 'residential',
  lotCorner1: null,
  showLots: true,

  // Road system
  roadType: 'street',
  roadDrawMode: 'idle',
  roadWaypoints: [],
  showRoads: true,

  // Building system
  wallDrawMode: 'idle',
  wallStartPoint: null,
  wallHeight: 3,
  wallMaterial: 'drywall',
  activeFloor: 0,
  selectedFurnitureType: null,
  floorMaterial: 'wood',
  showWalls: true,
  showRoomLabels: true,
  floorVisibility: 'transparent',

  panels: structuredClone(DEFAULT_PANELS),
  leftDockWidth: 260,
  rightDockWidth: 260,
  bottomDockHeight: 200,
  isPlaytesting: false,

  cursorWorldPosition: null,
  cursorGridPosition: null,
  fps: 0,
  isDirty: false,

  // ── Actions ──────────────────────────────────────────────

  setActiveTool: (tool) => set({ activeTool: tool }),

  // Sculpt brush
  setSculptBrushType: (type) =>
    set((s) => ({ sculptBrush: { ...s.sculptBrush, type } })),
  setSculptBrushSize: (size) =>
    set((s) => ({ sculptBrush: { ...s.sculptBrush, size: Math.max(1, Math.min(64, size)) } })),
  setSculptBrushStrength: (strength) =>
    set((s) => ({ sculptBrush: { ...s.sculptBrush, strength: Math.max(0.05, Math.min(1, strength)) } })),
  setSculptBrushFalloff: (falloff) =>
    set((s) => ({ sculptBrush: { ...s.sculptBrush, falloff } })),

  // Material paint
  setMaterialBrushMaterial: (materialId) =>
    set((s) => ({ materialBrush: { ...s.materialBrush, materialId } })),
  setMaterialBrushSize: (size) =>
    set((s) => ({ materialBrush: { ...s.materialBrush, size: Math.max(1, Math.min(64, size)) } })),
  setMaterialBrushType: (type) =>
    set((s) => ({ materialBrush: { ...s.materialBrush, type } })),

  // Cartography
  setCartographyBiome: (biome) => set({ cartographyBiome: biome }),
  setCartographyBrushSize: (size) =>
    set({ cartographyBrushSize: Math.max(1, Math.min(16, size)) }),

  // Object placement
  setSelectedObjectType: (type) => set({ selectedObjectType: type }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridSize: (size) => set({ gridSize: Math.max(0.25, size) }),
  setRotationSnap: (degrees) => set({ rotationSnap: degrees }),

  // Selection
  selectObject: (id) => set({ selectedObjectIds: [id] }),
  addToSelection: (id) =>
    set((s) => ({
      selectedObjectIds: s.selectedObjectIds.includes(id)
        ? s.selectedObjectIds
        : [...s.selectedObjectIds, id],
    })),
  removeFromSelection: (id) =>
    set((s) => ({
      selectedObjectIds: s.selectedObjectIds.filter((oid) => oid !== id),
    })),
  clearSelection: () => set({ selectedObjectIds: [] }),
  setSelection: (ids) => set({ selectedObjectIds: ids }),

  // Camera
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setFirstPersonSubMode: (mode) => set({ firstPersonSubMode: mode }),
  setFirstPersonSpeed: (speed) => set({ firstPersonSpeed: Math.max(0.1, Math.min(10, speed)) }),

  // Viewport
  setShowGrid: (show) => set({ showGrid: show }),
  setShowWireframe: (show) => set({ showWireframe: show }),
  setShowGrass: (show) => set({ showGrass: show }),
  setShowWater: (show) => set({ showWater: show }),
  setShowMiniMap: (show) => set({ showMiniMap: show }),

  // Undo/redo
  pushUndo: (command) =>
    set((s) => {
      const stack = [...s.undoStack, command]
      if (stack.length > s.maxUndoSteps) {
        stack.shift()
      }
      return { undoStack: stack, redoStack: [], isDirty: true }
    }),

  undo: () => {
    const state = get()
    if (state.undoStack.length === 0) return null
    const command = state.undoStack[state.undoStack.length - 1]
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, command],
    })
    return command
  },

  redo: () => {
    const state = get()
    if (state.redoStack.length === 0) return null
    const command = state.redoStack[state.redoStack.length - 1]
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, command],
    })
    return command
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),

  // Hierarchy navigation
  setActiveNodeId: (id) => set({ activeNodeId: id }),

  enterNode: (nodeId, level) =>
    set((s) => ({
      activeNodeId: nodeId,
      currentLevel: level,
      navigationStack: s.activeNodeId
        ? [...s.navigationStack, s.activeNodeId]
        : s.navigationStack,
      selectedObjectIds: [],
    })),

  exitToParent: () =>
    set((s) => {
      if (s.navigationStack.length === 0) return {}
      const parentId = s.navigationStack[s.navigationStack.length - 1]
      const levelOrder: WorldLevel[] = ['world', 'country', 'city', 'building', 'interior']
      const currentIdx = levelOrder.indexOf(s.currentLevel)
      const parentLevel = currentIdx > 0 ? levelOrder[currentIdx - 1] : 'world'
      return {
        activeNodeId: parentId,
        currentLevel: parentLevel,
        navigationStack: s.navigationStack.slice(0, -1),
        selectedObjectIds: [],
      }
    }),

  resetNavigation: (rootNodeId) =>
    set({
      activeNodeId: rootNodeId,
      navigationStack: [],
      currentLevel: 'world',
      selectedObjectIds: [],
    }),

  // Border drawing
  setBorderDrawMode: (mode) => set({ borderDrawMode: mode }),
  addBorderVertex: (v) => set((s) => ({ borderVertices: [...s.borderVertices, v] })),
  clearBorderVertices: () => set({ borderVertices: [], borderDrawMode: 'idle' }),
  setBorderStyle: (style) => set({ borderStyle: style }),
  setBorderColor: (color) => set({ borderColor: color }),
  setShowBorders: (show) => set({ showBorders: show }),

  // Lot system
  setLotZoning: (zoning) => set({ lotZoning: zoning }),
  setLotCorner1: (corner) => set({ lotCorner1: corner }),
  setShowLots: (show) => set({ showLots: show }),

  // Road system
  setRoadType: (type) => set({ roadType: type }),
  setRoadDrawMode: (mode) => set({ roadDrawMode: mode }),
  addRoadWaypoint: (w) => set((s) => ({ roadWaypoints: [...s.roadWaypoints, w] })),
  clearRoadWaypoints: () => set({ roadWaypoints: [], roadDrawMode: 'idle' }),
  setShowRoads: (show) => set({ showRoads: show }),

  // Building system
  setWallDrawMode: (mode) => set({ wallDrawMode: mode }),
  setWallStartPoint: (point) => set({ wallStartPoint: point }),
  setWallHeight: (height) => set({ wallHeight: Math.max(2, Math.min(5, height)) }),
  setWallMaterial: (material) => set({ wallMaterial: material }),
  setActiveFloor: (floor) => set({ activeFloor: floor }),
  setSelectedFurnitureType: (type) => set({ selectedFurnitureType: type }),
  setFloorMaterial: (material) => set({ floorMaterial: material }),
  setShowWalls: (show) => set({ showWalls: show }),
  setShowRoomLabels: (show) => set({ showRoomLabels: show }),
  setFloorVisibility: (mode) => set({ floorVisibility: mode }),

  // Dock panels
  setPanelVisible: (id, visible) =>
    set((s) => ({ panels: { ...s.panels, [id]: { ...s.panels[id], visible } } })),
  setPanelCollapsed: (id, collapsed) =>
    set((s) => ({ panels: { ...s.panels, [id]: { ...s.panels[id], collapsed } } })),
  setLeftDockWidth: (w) => set({ leftDockWidth: Math.max(200, Math.min(500, w)) }),
  setRightDockWidth: (w) => set({ rightDockWidth: Math.max(200, Math.min(500, w)) }),
  setBottomDockHeight: (h) => set({ bottomDockHeight: Math.max(100, Math.min(400, h)) }),
  setPlaytesting: (playing) => set({ isPlaytesting: playing }),
  resetPanelLayout: () => set({ panels: structuredClone(DEFAULT_PANELS), leftDockWidth: 260, rightDockWidth: 260, bottomDockHeight: 200 }),
  movePanelToSide: (id, side) =>
    set((s) => {
      const panelsOnSide = Object.values(s.panels).filter(p => p.side === side)
      return {
        panels: {
          ...s.panels,
          [id]: { ...s.panels[id], side, visible: true, order: panelsOnSide.length },
        },
      }
    }),

  // Status
  setCursorWorldPosition: (pos) => set({ cursorWorldPosition: pos }),
  setCursorGridPosition: (pos) => set({ cursorGridPosition: pos }),
  setFps: (fps) => set({ fps }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
}))
