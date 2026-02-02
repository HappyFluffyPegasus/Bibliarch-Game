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

type UndoCommand =
  | TerrainSculptCommand
  | TerrainPaintCommand
  | ObjectPlaceCommand
  | ObjectDeleteCommand
  | ObjectTransformCommand

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

  // Status
  setCursorWorldPosition: (pos) => set({ cursorWorldPosition: pos }),
  setCursorGridPosition: (pos) => set({ cursorGridPosition: pos }),
  setFps: (fps) => set({ fps }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
}))
