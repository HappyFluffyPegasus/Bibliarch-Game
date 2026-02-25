"use client"

import { useParams } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import {
  Globe,
  Mountain,
  Paintbrush,
  MousePointer,
  Trash2,
  Package,
  Map as MapIcon,
  Save,
  RotateCcw,
  Grid3x3,
  Waves,
  Upload,
  Minus,
  Scaling,
  Eye,
  User,
  Link,
  Unlink,
  Droplets,
  Undo2,
  Redo2,
  Lock,
  Unlock as UnlockIcon,
  EyeOff,
  Copy,
  Download,
  Sun,
  MapPin,
  Camera,
  X,
  SquareDashedBottom,
  Pentagon,
  LayoutGrid,
  Route,
  Square,
  DoorOpen,
  PaintBucket,
  Armchair,
  ChevronUp,
  ChevronDown,
  Plus,
  LogIn,
  Flag,
  Building2,
  Home,
  Cloud,
  CloudRain,
  Snowflake,
  CloudFog,
  MonitorUp,
  Box,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  TerrainData,
  TerrainMaterialId,
  EditorTool,
  BrushSettings,
  MaterialBrushSettings,
  createTerrain,
  createWorld,
  createWorldLocation,
  terrainIndex,
  isInBounds,
  serializeWorld,
  deserializeWorld,
  World,
  WorldObject,
  WorldLocation,
  SerializedWorld,
  CartographyGenerationSettings,
  HierarchicalWorld,
  WorldNode,
  WorldLevel,
  LevelBounds,
  createHierarchicalWorld,
  createWorldNode,
  migrateLegacyWorld,
  serializeHierarchicalWorld,
  deserializeHierarchicalWorld,
  serializeWorldNode,
  deserializeWorldNode,
  getChildLevel,
  LEVEL_TOOLS,
  LEVEL_OBJECT_CATEGORIES,
  PolygonBorder,
  CityLot,
  LotZoning,
  LOT_ZONING_COLORS,
  RoadNetwork,
  RoadSegment,
  RoadIntersection,
  RoadType,
  ROAD_TYPE_DEFAULTS,
  RoadWaypoint,
  BuildingData,
  WallSegment,
  WallOpening,
  FloorTile,
  DetectedRoom,
  BuildingFloor,
  FurniturePlacement,
} from "@/types/world"
import { TERRAIN_MATERIALS, getMaterialsByCategory } from "@/lib/terrain/materials"
import { OBJECT_CATALOG, getCatalogEntry, getCatalogByCategory, registerCustomItem, unregisterCustomItem } from "@/lib/terrain/objectCatalog"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
import DockPanel from "@/components/world/DockPanel"
import DockColumn from "@/components/world/DockColumn"
import DockResizeHandle from "@/components/world/DockResizeHandle"
import { useStoryStore } from "@/stores/storyStore"
import MiniMap from "@/components/world/MiniMap"
import ExplorerTree from "@/components/world/ExplorerTree"
import LevelBreadcrumb, { buildBreadcrumbSegments } from "@/components/world/LevelBreadcrumb"
import { initChildTerrainFromParent, blendChildIntoParent, blendWithFeather } from "@/lib/terrain/terrainBlend"
import {
  saveHierarchyMeta,
  loadHierarchyMeta,
  saveNodeData,
  loadNodeData,
  deleteNodeData,
} from "@/services/worldStorage"
import CartographyEditor from "@/components/world/CartographyEditor"
import CartographyPanel from "@/components/world/CartographyPanel"
import {
  createCartographyGrid,
  generateTerrainFromCartography,
  cartographyGridFromHeights,
  biomeFromIndex,
  indexFromBiome,
  BIOME_LABELS,
  BIOME_COLORS,
} from "@/lib/terrain/cartography"
import { loadHeightmapFromFile } from "@/lib/terrain/heightmapLoader"
import { idbGet, idbSet } from "@/services/worldStorage"
import type { WorldViewport3DProps } from "@/components/world/WorldViewport3D"
import { snapToRoadEndpoint, computeIntersections, autoMaterialPaint } from "@/lib/city/roadUtils"
import { snapToWallGrid, detectRooms, findWallAtPoint, createBuildingData } from "@/lib/building/wallUtils"
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, getFurnitureByCategory, type FurnitureCategory } from "@/lib/building/furnitureCatalog"

// Dynamic import for Three.js component
const WorldViewport3D = dynamic<WorldViewport3DProps>(
  () => import("@/components/world/WorldViewport3D"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-800/80 shadow-lg shadow-sky-500/30 flex items-center justify-center">
            <Globe className="w-7 h-7 text-sky-500 animate-pulse" />
          </div>
          <p className="text-slate-400">Loading 3D World...</p>
        </div>
      </div>
    ),
  }
)

// ── Brush application logic ──────────────────────────────────

function applySculptBrush(terrain: TerrainData, cx: number, cz: number, brush: BrushSettings): void {
  const radius = brush.size
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const gx = cx + dx
      const gz = cz + dz
      if (!isInBounds(gx, gz, terrain.size, terrain.sizeZ)) continue

      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > radius) continue

      const normalized = dist / radius
      let influence = 0
      if (brush.falloff === 'constant') influence = 1
      else if (brush.falloff === 'linear') influence = 1 - normalized
      else if (brush.falloff === 'smooth') influence = Math.cos(normalized * Math.PI / 2)

      const idx = terrainIndex(gx, gz, terrain.size)
      const delta = brush.strength * 0.02 * influence

      switch (brush.type) {
        case 'raise':
          terrain.heights[idx] = Math.min(1, terrain.heights[idx] + delta)
          break
        case 'lower':
          terrain.heights[idx] = Math.max(0, terrain.heights[idx] - delta)
          break
        case 'smooth': {
          let sum = 0
          let count = 0
          for (let nz = -1; nz <= 1; nz++) {
            for (let nx = -1; nx <= 1; nx++) {
              const ngx = gx + nx
              const ngz = gz + nz
              if (isInBounds(ngx, ngz, terrain.size, terrain.sizeZ)) {
                sum += terrain.heights[terrainIndex(ngx, ngz, terrain.size)]
                count++
              }
            }
          }
          const avg = sum / count
          terrain.heights[idx] += (avg - terrain.heights[idx]) * influence * brush.strength
          break
        }
        case 'flatten': {
          const targetHeight = terrain.heights[terrainIndex(cx, cz, terrain.size)]
          terrain.heights[idx] += (targetHeight - terrain.heights[idx]) * influence * brush.strength
          break
        }
        case 'noise': {
          const noise = (Math.random() * 2 - 1) * 0.05 * brush.strength * influence
          terrain.heights[idx] = Math.max(0, Math.min(1, terrain.heights[idx] + noise))
          break
        }
        case 'plateau': {
          const target = terrain.heights[terrainIndex(cx, cz, terrain.size)]
          if (terrain.heights[idx] < target) {
            terrain.heights[idx] += delta
            if (terrain.heights[idx] > target) terrain.heights[idx] = target
          }
          break
        }
        case 'erode': {
          let lowestH = terrain.heights[idx]
          let lowestIdx = idx
          for (let nz = -1; nz <= 1; nz++) {
            for (let nx = -1; nx <= 1; nx++) {
              if (nx === 0 && nz === 0) continue
              const ngx = gx + nx
              const ngz = gz + nz
              if (isInBounds(ngx, ngz, terrain.size, terrain.sizeZ)) {
                const nIdx = terrainIndex(ngx, ngz, terrain.size)
                if (terrain.heights[nIdx] < lowestH) {
                  lowestH = terrain.heights[nIdx]
                  lowestIdx = nIdx
                }
              }
            }
          }
          if (lowestIdx !== idx) {
            const transfer = (terrain.heights[idx] - lowestH) * 0.1 * influence * brush.strength
            terrain.heights[idx] -= transfer
            terrain.heights[lowestIdx] += transfer * 0.8
          }
          break
        }
      }
    }
  }
}

function applyMaterialBrush(terrain: TerrainData, cx: number, cz: number, brush: MaterialBrushSettings): void {
  if (brush.type === 'fill') {
    const targetMat = terrain.materials[terrainIndex(cx, cz, terrain.size)]
    if (targetMat === brush.materialId) return
    const stack: { x: number; z: number }[] = [{ x: cx, z: cz }]
    const visited = new Set<string>()
    while (stack.length > 0) {
      const { x, z } = stack.pop()!
      const key = `${x}_${z}`
      if (visited.has(key)) continue
      visited.add(key)
      if (!isInBounds(x, z, terrain.size, terrain.sizeZ)) continue
      const idx = terrainIndex(x, z, terrain.size)
      if (terrain.materials[idx] !== targetMat) continue
      terrain.materials[idx] = brush.materialId
      stack.push({ x: x + 1, z }, { x: x - 1, z }, { x, z: z + 1 }, { x, z: z - 1 })
    }
    return
  }

  if (brush.type === 'auto-paint') {
    for (let i = 0; i < terrain.heights.length; i++) {
      const h = terrain.heights[i]
      if (h < terrain.seaLevel) {
        terrain.materials[i] = TerrainMaterialId.Sand
      } else if (h < terrain.seaLevel + 0.15) {
        terrain.materials[i] = TerrainMaterialId.Grass
      } else if (h < 0.6) {
        terrain.materials[i] = TerrainMaterialId.Grass
      } else if (h < 0.8) {
        terrain.materials[i] = TerrainMaterialId.Rock
      } else {
        terrain.materials[i] = TerrainMaterialId.Snow
      }
    }
    return
  }

  const radius = brush.size
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const gx = cx + dx
      const gz = cz + dz
      if (!isInBounds(gx, gz, terrain.size, terrain.sizeZ)) continue
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > radius) continue
      terrain.materials[terrainIndex(gx, gz, terrain.size)] = brush.materialId
    }
  }
}

const EMPTY_CUSTOM_ITEMS: import('@/types/items').CustomItem[] = []

// ── Main Page Component ──────────────────────────────────────

export function WorldPage() {
  const params = useParams()
  const storyId = params.id as string

  // World data
  const [world, setWorld] = useState<World | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editorPhase, setEditorPhase] = useState<'setup' | 'cartography' | 'editor'>('setup')
  const terrainRef = useRef<TerrainData | null>(null)

  // Undo/redo: capture terrain state at stroke start
  const strokeStartHeightsRef = useRef<Float32Array | null>(null)
  const strokeStartMaterialsRef = useRef<Uint8Array | null>(null)

  // Camera position for minimap player indicator (refs to avoid page re-renders)
  const cameraPosRef = useRef<[number, number, number] | null>(null)
  const cameraYawRef = useRef(0)
  const [cameraTick, setCameraTick] = useState(0)

  // Lighting
  const [sunAngle, setSunAngle] = useState(160)
  const [sunElevation, setSunElevation] = useState(45)

  // Cartography state
  const [cartographyGrid, setCartographyGrid] = useState<Uint8Array | null>(null)
  const [cartographySettings, setCartographySettings] = useState<CartographyGenerationSettings>({
    noiseScale: 8,
    noiseOctaves: 4,
    heightMultiplier: 2.0,
    smoothingPasses: 3,
  })
  const heightmapInputRef = useRef<HTMLInputElement>(null)

  // Scale dialog state
  const [showScaleDialog, setShowScaleDialog] = useState(false)
  const [scaleVertical, setScaleVertical] = useState(1.0)
  const [scaleHorizontal, setScaleHorizontal] = useState(1.0)
  const [scaleUniform, setScaleUniform] = useState(true)

  // Location saving state
  const [showSaveLocationDialog, setShowSaveLocationDialog] = useState(false)
  const [newLocationName, setNewLocationName] = useState("")
  const [showEnvironment, setShowEnvironment] = useState(false)
  const [ribbonTab, setRibbonTab] = useState<'home' | 'terrain' | 'build' | 'environment' | 'view'>('home')
  const [toolboxSearch, setToolboxSearch] = useState("")

  // Editor store
  const activeTool = useWorldBuilderStore((s) => s.activeTool)
  const setActiveTool = useWorldBuilderStore((s) => s.setActiveTool)
  const sculptBrush = useWorldBuilderStore((s) => s.sculptBrush)
  const materialBrush = useWorldBuilderStore((s) => s.materialBrush)
  const showGrid = useWorldBuilderStore((s) => s.showGrid)
  const setShowGrid = useWorldBuilderStore((s) => s.setShowGrid)
  const showWater = useWorldBuilderStore((s) => s.showWater)
  const setShowWater = useWorldBuilderStore((s) => s.setShowWater)

  const showMiniMap = useWorldBuilderStore((s) => s.showMiniMap)
  const setShowMiniMap = useWorldBuilderStore((s) => s.setShowMiniMap)
  const cursorGridPos = useWorldBuilderStore((s) => s.cursorGridPosition)
  const setCursorWorldPosition = useWorldBuilderStore((s) => s.setCursorWorldPosition)
  const setCursorGridPosition = useWorldBuilderStore((s) => s.setCursorGridPosition)
  const fps = useWorldBuilderStore((s) => s.fps)
  const setFps = useWorldBuilderStore((s) => s.setFps)
  const setSculptBrushType = useWorldBuilderStore((s) => s.setSculptBrushType)
  const setSculptBrushSize = useWorldBuilderStore((s) => s.setSculptBrushSize)
  const setSculptBrushStrength = useWorldBuilderStore((s) => s.setSculptBrushStrength)
  const setSculptBrushFalloff = useWorldBuilderStore((s) => s.setSculptBrushFalloff)
  const setMaterialBrushMaterial = useWorldBuilderStore((s) => s.setMaterialBrushMaterial)
  const setMaterialBrushSize = useWorldBuilderStore((s) => s.setMaterialBrushSize)
  const selectedObjectType = useWorldBuilderStore((s) => s.selectedObjectType)
  const setSelectedObjectType = useWorldBuilderStore((s) => s.setSelectedObjectType)
  const selectedObjectIds = useWorldBuilderStore((s) => s.selectedObjectIds)
  const selectObject = useWorldBuilderStore((s) => s.selectObject)
  const addToSelection = useWorldBuilderStore((s) => s.addToSelection)
  const clearSelection = useWorldBuilderStore((s) => s.clearSelection)
  const cameraMode = useWorldBuilderStore((s) => s.cameraMode)
  const setCameraMode = useWorldBuilderStore((s) => s.setCameraMode)
  const firstPersonSubMode = useWorldBuilderStore((s) => s.firstPersonSubMode)
  const setFirstPersonSubMode = useWorldBuilderStore((s) => s.setFirstPersonSubMode)
  const firstPersonSpeed = useWorldBuilderStore((s) => s.firstPersonSpeed)
  const setFirstPersonSpeed = useWorldBuilderStore((s) => s.setFirstPersonSpeed)
  const cartographyBiome = useWorldBuilderStore((s) => s.cartographyBiome)
  const setCartographyBiome = useWorldBuilderStore((s) => s.setCartographyBiome)
  const cartographyBrushSize = useWorldBuilderStore((s) => s.cartographyBrushSize)
  const setCartographyBrushSize = useWorldBuilderStore((s) => s.setCartographyBrushSize)
  const undoStack = useWorldBuilderStore((s) => s.undoStack)
  const redoStack = useWorldBuilderStore((s) => s.redoStack)
  const pushUndo = useWorldBuilderStore((s) => s.pushUndo)
  const storeUndo = useWorldBuilderStore((s) => s.undo)
  const storeRedo = useWorldBuilderStore((s) => s.redo)

  // Hierarchy navigation store
  const activeNodeId = useWorldBuilderStore((s) => s.activeNodeId)
  const navigationStack = useWorldBuilderStore((s) => s.navigationStack)
  const currentLevel = useWorldBuilderStore((s) => s.currentLevel)
  const enterNode = useWorldBuilderStore((s) => s.enterNode)
  const exitToParent = useWorldBuilderStore((s) => s.exitToParent)
  const resetNavigation = useWorldBuilderStore((s) => s.resetNavigation)

  // Border drawing store
  const borderDrawMode = useWorldBuilderStore((s) => s.borderDrawMode)
  const setBorderDrawMode = useWorldBuilderStore((s) => s.setBorderDrawMode)
  const borderVertices = useWorldBuilderStore((s) => s.borderVertices)
  const addBorderVertex = useWorldBuilderStore((s) => s.addBorderVertex)
  const clearBorderVertices = useWorldBuilderStore((s) => s.clearBorderVertices)
  const borderStyle = useWorldBuilderStore((s) => s.borderStyle)
  const setBorderStyle = useWorldBuilderStore((s) => s.setBorderStyle)
  const borderColor = useWorldBuilderStore((s) => s.borderColor)
  const setBorderColor = useWorldBuilderStore((s) => s.setBorderColor)
  const showBorders = useWorldBuilderStore((s) => s.showBorders)
  const setShowBorders = useWorldBuilderStore((s) => s.setShowBorders)

  // Lot system store
  const lotZoning = useWorldBuilderStore((s) => s.lotZoning)
  const setLotZoning = useWorldBuilderStore((s) => s.setLotZoning)
  const lotCorner1 = useWorldBuilderStore((s) => s.lotCorner1)
  const setLotCorner1 = useWorldBuilderStore((s) => s.setLotCorner1)
  const showLots = useWorldBuilderStore((s) => s.showLots)

  // Road system store
  const roadType = useWorldBuilderStore((s) => s.roadType)
  const setRoadType = useWorldBuilderStore((s) => s.setRoadType)
  const roadDrawMode = useWorldBuilderStore((s) => s.roadDrawMode)
  const setRoadDrawMode = useWorldBuilderStore((s) => s.setRoadDrawMode)
  const roadWaypoints = useWorldBuilderStore((s) => s.roadWaypoints)
  const addRoadWaypoint = useWorldBuilderStore((s) => s.addRoadWaypoint)
  const clearRoadWaypoints = useWorldBuilderStore((s) => s.clearRoadWaypoints)
  const showRoads = useWorldBuilderStore((s) => s.showRoads)
  const setShowRoads = useWorldBuilderStore((s) => s.setShowRoads)
  const setShowLots = useWorldBuilderStore((s) => s.setShowLots)
  const showWireframe = useWorldBuilderStore((s) => s.showWireframe)
  const setShowWireframe = useWorldBuilderStore((s) => s.setShowWireframe)

  // Building system store
  const wallDrawMode = useWorldBuilderStore((s) => s.wallDrawMode)
  const setWallDrawMode = useWorldBuilderStore((s) => s.setWallDrawMode)
  const wallStartPoint = useWorldBuilderStore((s) => s.wallStartPoint)
  const setWallStartPoint = useWorldBuilderStore((s) => s.setWallStartPoint)
  const wallHeight = useWorldBuilderStore((s) => s.wallHeight)
  const setWallHeight = useWorldBuilderStore((s) => s.setWallHeight)
  const wallMat = useWorldBuilderStore((s) => s.wallMaterial)
  const setWallMat = useWorldBuilderStore((s) => s.setWallMaterial)
  const activeFloor = useWorldBuilderStore((s) => s.activeFloor)
  const setActiveFloor = useWorldBuilderStore((s) => s.setActiveFloor)
  const selectedFurnitureType = useWorldBuilderStore((s) => s.selectedFurnitureType)
  const setSelectedFurnitureType = useWorldBuilderStore((s) => s.setSelectedFurnitureType)
  const floorMaterial = useWorldBuilderStore((s) => s.floorMaterial)
  const setFloorMaterial = useWorldBuilderStore((s) => s.setFloorMaterial)

  // Dock panels
  const panels = useWorldBuilderStore((s) => s.panels)
  const setPanelVisible = useWorldBuilderStore((s) => s.setPanelVisible)
  const leftDockWidth = useWorldBuilderStore((s) => s.leftDockWidth)
  const setLeftDockWidth = useWorldBuilderStore((s) => s.setLeftDockWidth)
  const rightDockWidth = useWorldBuilderStore((s) => s.rightDockWidth)
  const setRightDockWidth = useWorldBuilderStore((s) => s.setRightDockWidth)
  const isPlaytesting = useWorldBuilderStore((s) => s.isPlaytesting)
  const setPlaytesting = useWorldBuilderStore((s) => s.setPlaytesting)

  // Border name dialog state
  const [showBorderNameDialog, setShowBorderNameDialog] = useState(false)
  const [newBorderName, setNewBorderName] = useState("")
  const [furnitureCategory, setFurnitureCategory] = useState<FurnitureCategory>('seating')

  // Hierarchical world state
  const [hierarchicalWorld, setHierarchicalWorld] = useState<HierarchicalWorld | null>(null)
  const hwRef = useRef<HierarchicalWorld | null>(null)
  useEffect(() => { hwRef.current = hierarchicalWorld }, [hierarchicalWorld])

  // Region definition dialog state
  const [showRegionDialog, setShowRegionDialog] = useState(false)
  const [regionBounds, setRegionBounds] = useState<LevelBounds | null>(null)
  const [regionName, setRegionName] = useState("")
  const [regionCorner1, setRegionCorner1] = useState<{ x: number; z: number } | null>(null)

  // Auto-switch ribbon tab when active tool changes
  useEffect(() => {
    const terrainTools: EditorTool[] = ['sculpt', 'paint-material', 'cartography']
    const buildTools: EditorTool[] = ['place-object', 'draw-border', 'draw-lot', 'draw-road', 'place-wall', 'place-door', 'paint-floor', 'place-furniture']
    if (terrainTools.includes(activeTool)) setRibbonTab('terrain')
    else if (buildTools.includes(activeTool)) setRibbonTab('build')
    // select/delete stay on current tab
  }, [activeTool])

  // Load world on mount
  useEffect(() => {
    const initCartography = (w: World) => {
      if (w.cartographyData) {
        // Support old saves that have gridSize instead of gridSizeX/gridSizeZ
        const gsx = (w.cartographyData as any).gridSizeX ?? (w.cartographyData as any).gridSize ?? w.terrain.size
        const gsz = (w.cartographyData as any).gridSizeZ ?? (w.cartographyData as any).gridSize ?? w.terrain.sizeZ
        const grid = createCartographyGrid(gsx, gsz, 'plains')
        for (const region of w.cartographyData.regions) {
          const biomeIdx = indexFromBiome(region.type)
          for (const cellIdx of region.cells) {
            if (cellIdx >= 0 && cellIdx < grid.length) {
              grid[cellIdx] = biomeIdx
            }
          }
        }
        setCartographyGrid(grid)
        setCartographySettings(w.cartographyData.settings)
      } else {
        setCartographyGrid(createCartographyGrid(w.terrain.size, w.terrain.sizeZ, 'plains'))
      }
    }

    const applyWorld = (w: World, existingHW?: HierarchicalWorld) => {
      setWorld(w)
      terrainRef.current = w.terrain
      initCartography(w)
      // If terrain has any non-zero heights, go straight to editor
      const hasExistingTerrain = w.terrain.heights.some((h: number) => h > 0)
      setEditorPhase(hasExistingTerrain ? 'editor' : 'setup')

      // Initialize hierarchical world
      const hw = existingHW || migrateLegacyWorld(w)
      setHierarchicalWorld(hw)
      resetNavigation(hw.rootNodeId)
    }

    const loadFromParsed = (parsed: SerializedWorld) => {
      const isOldFormat = parsed.terrain && Array.isArray((parsed.terrain as any)?.heights?.[0])
      if (isOldFormat) {
        console.log("Migrating from old world format, creating new world")
        applyWorld(createWorld(storyId, "My World", 256, 256))
      } else {
        applyWorld(deserializeWorld(parsed))
      }
    }

    const loadWorld = async () => {
      // Try loading hierarchical world first
      try {
        const hwMeta = await loadHierarchyMeta(storyId)
        if (hwMeta && hwMeta.version === 2) {
          const hw = deserializeHierarchicalWorld(hwMeta)
          // Load the root node's full terrain data
          const rootData = await loadNodeData(storyId, hw.rootNodeId)
          if (rootData) {
            const rootNode = deserializeWorldNode(rootData)
            hw.nodes[hw.rootNodeId] = rootNode
          }
          const rootNode = hw.nodes[hw.rootNodeId]
          if (rootNode) {
            // Create a flat World view of the root node for the existing editor
            const flatWorld: World = {
              id: hw.id,
              storyId: hw.storyId,
              name: hw.name,
              terrain: rootNode.terrain,
              objects: rootNode.objects,
              cartographyData: rootNode.cartographyData,
              locations: rootNode.locations,
              createdAt: hw.createdAt,
              updatedAt: hw.updatedAt,
            }
            applyWorld(flatWorld, hw)
            return
          }
        }
      } catch (e) {
        console.warn("Hierarchical world load failed, trying legacy:", e)
      }

      try {
        // Try legacy IndexedDB
        const idbData = await idbGet<SerializedWorld>(`bibliarch-world-${storyId}`)
        if (idbData) {
          loadFromParsed(idbData)
          return
        }
      } catch (e) {
        console.warn("IndexedDB load failed, trying localStorage:", e)
      }

      // Fall back to localStorage (migrate old data)
      const saved = localStorage.getItem(`bibliarch-world-${storyId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          loadFromParsed(parsed as SerializedWorld)
          // Migrate to IndexedDB and remove from localStorage
          idbSet(`bibliarch-world-${storyId}`, parsed).then(() => {
            localStorage.removeItem(`bibliarch-world-${storyId}`)
          }).catch(() => {})
          return
        } catch (e) {
          console.error("Failed to load world:", e)
        }
      }

      // No saved data — create fresh world
      applyWorld(createWorld(storyId, "My World", 256, 256))
    }

    loadWorld()
  }, [storyId])

  // Register custom items in the object catalog so they appear in the dropdown
  const customItems = useStoryStore((s) => s.customItems[storyId] ?? EMPTY_CUSTOM_ITEMS)
  useEffect(() => {
    for (const item of customItems) {
      registerCustomItem(item)
    }
    return () => {
      for (const item of customItems) {
        unregisterCustomItem(item.id)
      }
    }
  }, [customItems])

  // Build cartography data for serialization
  const buildCartographyData = useCallback(() => {
    if (!cartographyGrid || !world) return undefined
    const gridSizeX = world.terrain.size
    const gridSizeZ = world.terrain.sizeZ
    const regionMap = new Map<number, number[]>()
    for (let i = 0; i < cartographyGrid.length; i++) {
      const biomeIdx = cartographyGrid[i]
      if (!regionMap.has(biomeIdx)) regionMap.set(biomeIdx, [])
      regionMap.get(biomeIdx)!.push(i)
    }
    const regions = Array.from(regionMap.entries()).map(([idx, cells]) => ({
      type: biomeFromIndex(idx),
      cells,
    }))
    return {
      gridSizeX,
      gridSizeZ,
      regions,
      paths: [],
      settings: cartographySettings,
    }
  }, [cartographyGrid, cartographySettings, world])

  // Persist to IndexedDB
  const persistWorld = useCallback(async (w: World) => {
    const worldToSave = { ...w, cartographyData: buildCartographyData() }
    const serialized = serializeWorld(worldToSave)
    await idbSet(`bibliarch-world-${storyId}`, serialized)

    // Also save hierarchical world data if available
    const hw = hwRef.current
    if (hw) {
      // Update the active node with current world data
      const nodeId = activeNodeId || hw.rootNodeId
      const node = hw.nodes[nodeId]
      if (node) {
        node.terrain = w.terrain
        node.objects = w.objects
        node.cartographyData = buildCartographyData()
        node.locations = w.locations || []
        node.updatedAt = new Date()

        // Save node data
        const serializedNode = serializeWorldNode(node)
        await saveNodeData(storyId, serializedNode)

        // Save hierarchy metadata
        hw.updatedAt = new Date()
        const serializedHW = serializeHierarchicalWorld(hw)
        await saveHierarchyMeta(storyId, serializedHW)
      }
    }
  }, [storyId, buildCartographyData, activeNodeId])

  // Auto-save
  useEffect(() => {
    if (!hasUnsavedChanges || !world) return
    const timeout = setTimeout(() => {
      persistWorld(world).then(() => {
        setHasUnsavedChanges(false)
      }).catch((err) => {
        console.error("Auto-save failed:", err)
      })
    }, 2000)
    return () => clearTimeout(timeout)
  }, [hasUnsavedChanges, world, persistWorld])

  // Manual save
  const handleSave = useCallback(() => {
    if (!world) return
    persistWorld(world).then(() => {
      setHasUnsavedChanges(false)
    }).catch((err) => {
      console.error("Save failed:", err)
    })
  }, [world, persistWorld])

  // ── Hierarchy Navigation ────────────────────────────────────

  /** Navigate into a child node */
  const handleEnterNode = useCallback(async (nodeId: string) => {
    const hw = hwRef.current
    if (!hw || !world) return

    // Save current node first
    await persistWorld(world)

    const targetNode = hw.nodes[nodeId]
    if (!targetNode) return

    // Load full node terrain data from IDB
    const nodeData = await loadNodeData(storyId, nodeId)
    if (nodeData) {
      const fullNode = deserializeWorldNode(nodeData)
      hw.nodes[nodeId] = fullNode
      setHierarchicalWorld({ ...hw })
    }

    const node = hw.nodes[nodeId]
    // Create flat World view of this node
    const nodeWorld: World = {
      id: hw.id,
      storyId: hw.storyId,
      name: node.name,
      terrain: node.terrain,
      objects: node.objects,
      cartographyData: node.cartographyData,
      locations: node.locations,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    }

    setWorld(nodeWorld)
    terrainRef.current = nodeWorld.terrain
    enterNode(nodeId, node.level)
    setHasUnsavedChanges(false)
  }, [world, storyId, persistWorld, enterNode])

  /** Navigate back to parent node */
  const handleExitToParent = useCallback(async () => {
    const hw = hwRef.current
    if (!hw || !world || navigationStack.length === 0) return

    // Save current node first
    await persistWorld(world)

    // Blend child terrain back into parent
    if (activeNodeId) {
      const currentNode = hw.nodes[activeNodeId]
      const parentId = navigationStack[navigationStack.length - 1]
      const parentNode = hw.nodes[parentId]
      if (currentNode && parentNode && currentNode.boundsInParent) {
        blendChildIntoParent(parentNode.terrain, currentNode.terrain, currentNode.boundsInParent)
        blendWithFeather(parentNode.terrain, currentNode.boundsInParent)
      }
    }

    const parentId = navigationStack[navigationStack.length - 1]
    // Load parent node
    const parentData = await loadNodeData(storyId, parentId)
    if (parentData) {
      const parentNode = deserializeWorldNode(parentData)
      hw.nodes[parentId] = parentNode
    }

    const parentNode = hw.nodes[parentId]
    if (!parentNode) return

    const parentWorld: World = {
      id: hw.id,
      storyId: hw.storyId,
      name: parentNode.name,
      terrain: parentNode.terrain,
      objects: parentNode.objects,
      cartographyData: parentNode.cartographyData,
      locations: parentNode.locations,
      createdAt: parentNode.createdAt,
      updatedAt: parentNode.updatedAt,
    }

    setWorld(parentWorld)
    terrainRef.current = parentWorld.terrain
    exitToParent()
    setHasUnsavedChanges(false)
  }, [world, storyId, activeNodeId, navigationStack, persistWorld, exitToParent])

  /** Handle breadcrumb navigation */
  const handleBreadcrumbNavigate = useCallback(async (targetNodeId: string) => {
    if (targetNodeId === activeNodeId) return
    // Navigate up through parents until we reach the target
    // For now, just go to parent repeatedly
    const hw = hwRef.current
    if (!hw) return

    // Simple approach: if target is in the navigation stack, pop back to it
    const stackIdx = navigationStack.indexOf(targetNodeId)
    if (stackIdx >= 0) {
      // Pop back to that level
      const popsNeeded = navigationStack.length - stackIdx
      for (let i = 0; i < popsNeeded; i++) {
        await handleExitToParent()
      }
    }
  }, [activeNodeId, navigationStack, handleExitToParent])

  /** Create a child region from defined bounds */
  const handleCreateRegion = useCallback(async () => {
    const hw = hwRef.current
    if (!hw || !regionBounds || !regionName.trim() || !activeNodeId) return

    const parentNode = hw.nodes[activeNodeId]
    if (!parentNode) return

    const childLevel = getChildLevel(parentNode.level)
    if (!childLevel) return

    // Determine child terrain size (4x parent resolution in bounds)
    const childSizeX = regionBounds.width * 4
    const childSizeZ = regionBounds.depth * 4

    // Create child node
    const childNode = createWorldNode(
      activeNodeId,
      childLevel,
      regionName.trim(),
      regionBounds,
      childSizeX,
      childSizeZ
    )

    // Initialize child terrain from parent
    childNode.terrain = initChildTerrainFromParent(
      parentNode.terrain,
      regionBounds,
      childSizeX,
      childSizeZ
    )

    // Add to hierarchy
    parentNode.childIds.push(childNode.id)
    hw.nodes[childNode.id] = childNode
    hw.updatedAt = new Date()

    setHierarchicalWorld({ ...hw })

    // Save
    await saveNodeData(storyId, serializeWorldNode(childNode))
    await saveNodeData(storyId, serializeWorldNode(parentNode))
    await saveHierarchyMeta(storyId, serializeHierarchicalWorld(hw))

    setShowRegionDialog(false)
    setRegionBounds(null)
    setRegionName("")
    setActiveTool('select')

    // Auto-enter the newly created region
    await handleEnterNode(childNode.id)
  }, [regionBounds, regionName, activeNodeId, storyId, setActiveTool, handleEnterNode])

  // Compute breadcrumb segments
  const breadcrumbSegments = hierarchicalWorld && activeNodeId
    ? buildBreadcrumbSegments(activeNodeId, hierarchicalWorld.nodes)
    : []

  // Get child regions for the active node (to render as outlines)
  const activeNode = hierarchicalWorld && activeNodeId
    ? hierarchicalWorld.nodes[activeNodeId]
    : null
  const childRegions = activeNode
    ? activeNode.childIds
        .map((id) => hierarchicalWorld?.nodes[id])
        .filter((n): n is WorldNode => !!n && !!n.boundsInParent)
    : []

  // Sculpt callback
  const handleTerrainSculpt = useCallback((cx: number, cz: number, brush: BrushSettings) => {
    if (!world) return
    // Snapshot heights at stroke start for undo
    if (!strokeStartHeightsRef.current) {
      strokeStartHeightsRef.current = new Float32Array(world.terrain.heights)
    }
    applySculptBrush(world.terrain, cx, cz, brush)
    setWorld({ ...world, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // Paint callback
  const handleTerrainPaint = useCallback((cx: number, cz: number, brush: MaterialBrushSettings) => {
    if (!world) return
    // Snapshot materials at stroke start for undo
    if (!strokeStartMaterialsRef.current) {
      strokeStartMaterialsRef.current = new Uint8Array(world.terrain.materials)
    }
    applyMaterialBrush(world.terrain, cx, cz, brush)
    setWorld({ ...world, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // After a stroke ends — compute diff and push undo
  const handleTerrainChanged = useCallback(() => {
    if (world) {
      // Sculpt undo
      if (strokeStartHeightsRef.current) {
        const oldH = strokeStartHeightsRef.current
        const newH = world.terrain.heights
        const cells: { index: number; oldHeight: number; newHeight: number }[] = []
        for (let i = 0; i < oldH.length; i++) {
          if (oldH[i] !== newH[i]) {
            cells.push({ index: i, oldHeight: oldH[i], newHeight: newH[i] })
          }
        }
        if (cells.length > 0) {
          pushUndo({ type: 'terrain-sculpt', cells })
        }
        strokeStartHeightsRef.current = null
      }
      // Paint undo
      if (strokeStartMaterialsRef.current) {
        const oldM = strokeStartMaterialsRef.current
        const newM = world.terrain.materials
        const cells: { index: number; oldMaterial: number; newMaterial: number }[] = []
        for (let i = 0; i < oldM.length; i++) {
          if (oldM[i] !== newM[i]) {
            cells.push({ index: i, oldMaterial: oldM[i], newMaterial: newM[i] })
          }
        }
        if (cells.length > 0) {
          pushUndo({ type: 'terrain-paint', cells })
        }
        strokeStartMaterialsRef.current = null
      }
    }
    setHasUnsavedChanges(true)
  }, [world, pushUndo])

  // Undo
  const handleUndo = useCallback(() => {
    if (!world) return
    const command = storeUndo()
    if (!command) return

    if (command.type === 'terrain-sculpt') {
      for (const cell of command.cells) {
        world.terrain.heights[cell.index] = cell.oldHeight
      }
      setWorld({ ...world, terrain: { ...world.terrain, heights: new Float32Array(world.terrain.heights) }, updatedAt: new Date() })
    } else if (command.type === 'terrain-paint') {
      for (const cell of command.cells) {
        world.terrain.materials[cell.index] = cell.oldMaterial
      }
      setWorld({ ...world, terrain: { ...world.terrain, materials: new Uint8Array(world.terrain.materials) }, updatedAt: new Date() })
    }
    setHasUnsavedChanges(true)
  }, [world, storeUndo])

  // Redo
  const handleRedo = useCallback(() => {
    if (!world) return
    const command = storeRedo()
    if (!command) return

    if (command.type === 'terrain-sculpt') {
      for (const cell of command.cells) {
        world.terrain.heights[cell.index] = cell.newHeight
      }
      setWorld({ ...world, terrain: { ...world.terrain, heights: new Float32Array(world.terrain.heights) }, updatedAt: new Date() })
    } else if (command.type === 'terrain-paint') {
      for (const cell of command.cells) {
        world.terrain.materials[cell.index] = cell.newMaterial
      }
      setWorld({ ...world, terrain: { ...world.terrain, materials: new Uint8Array(world.terrain.materials) }, updatedAt: new Date() })
    }
    setHasUnsavedChanges(true)
  }, [world, storeRedo])

  // Camera position callback — writes to refs (cheap), bumps tick for minimap at low rate
  const lastCameraTickRef = useRef(0)
  const handleCameraUpdate = useCallback((position: [number, number, number], yaw: number) => {
    cameraPosRef.current = position
    cameraYawRef.current = yaw
    // Bump React tick at ~2fps max for minimap + HUD (not every 250ms)
    const now = performance.now()
    if (now - lastCameraTickRef.current > 500) {
      lastCameraTickRef.current = now
      setCameraTick((t) => t + 1)
    }
  }, [])

  // Cursor move
  const handleCursorMove = useCallback((
    worldPos: [number, number, number] | null,
    gridPos: { x: number; z: number } | null
  ) => {
    setCursorWorldPosition(worldPos)
    setCursorGridPosition(gridPos)
  }, [setCursorWorldPosition, setCursorGridPosition])

  // Reset terrain
  const handleResetTerrain = useCallback(() => {
    if (!world) return
    if (!confirm("Reset terrain to flat land? This cannot be undone.")) return
    const newTerrain = createTerrain(world.terrain.size, world.terrain.sizeZ)
    // Set all heights to just above sea level so terrain is visible as land
    const target = Math.min(1, newTerrain.seaLevel + 0.02)
    for (let i = 0; i < newTerrain.heights.length; i++) {
      newTerrain.heights[i] = target
    }
    setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // Level ground: flatten ALL terrain to just above sea level (raises underwater terrain too)
  const handleFlattenToGround = useCallback(() => {
    if (!world) return
    if (!confirm("Flatten all terrain to ground level? This cannot be undone.")) return
    const { seaLevel } = world.terrain

    // Target: sea level + small offset so everything is visible as land
    const target = Math.min(1, seaLevel + 0.02)
    const newHeights = new Float32Array(world.terrain.heights.length)
    for (let i = 0; i < newHeights.length; i++) {
      newHeights[i] = target
    }

    const newTerrain: TerrainData = {
      ...world.terrain,
      heights: newHeights,
      materials: new Uint8Array(world.terrain.materials),
    }
    setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // Smooth coastlines: blend land/water boundary into a gradual slope
  const handleSmoothCoastlines = useCallback(() => {
    if (!world) return
    const { heights, seaLevel, size, sizeZ } = world.terrain
    const total = size * sizeZ
    const newHeights = new Float32Array(heights)

    const COAST_RADIUS = 10
    const PASSES = 6

    // Step 1: identify coastline cells (adjacent to opposite side of sea level)
    const isCoastline = new Uint8Array(total)
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < size; x++) {
        const idx = z * size + x
        const above = heights[idx] >= seaLevel
        for (const [dx, dz] of dirs) {
          const nx = x + dx, nz = z + dz
          if (nx >= 0 && nx < size && nz >= 0 && nz < sizeZ) {
            const nAbove = heights[nz * size + nx] >= seaLevel
            if (above !== nAbove) {
              isCoastline[idx] = 1
              break
            }
          }
        }
      }
    }

    // Step 2: BFS distance from coastline
    const dist = new Float32Array(total)
    dist.fill(COAST_RADIUS + 1)
    const queue: number[] = []
    for (let i = 0; i < total; i++) {
      if (isCoastline[i]) {
        dist[i] = 0
        queue.push(i)
      }
    }
    let head = 0
    while (head < queue.length) {
      const idx = queue[head++]
      const x = idx % size
      const z = Math.floor(idx / size)
      const d = dist[idx]
      if (d >= COAST_RADIUS) continue
      for (const [dx, dz] of dirs) {
        const nx = x + dx, nz = z + dz
        if (nx >= 0 && nx < size && nz >= 0 && nz < sizeZ) {
          const nIdx = nz * size + nx
          if (dist[nIdx] > d + 1) {
            dist[nIdx] = d + 1
            queue.push(nIdx)
          }
        }
      }
    }

    // Step 3: smoothing passes on cells within the coastal band
    for (let pass = 0; pass < PASSES; pass++) {
      const temp = new Float32Array(newHeights)
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < size; x++) {
          const idx = z * size + x
          if (dist[idx] > COAST_RADIUS) continue

          // Stronger smoothing closer to the coastline
          const weight = 1 - dist[idx] / (COAST_RADIUS + 1)

          let sum = 0, count = 0
          for (let dz = -2; dz <= 2; dz++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx, nz = z + dz
              if (nx >= 0 && nx < size && nz >= 0 && nz < sizeZ) {
                sum += temp[nz * size + nx]
                count++
              }
            }
          }
          let smoothed = temp[idx] + (sum / count - temp[idx]) * weight

          // Cells that were originally above water can't erode below sea level
          if (heights[idx] >= seaLevel) {
            smoothed = Math.max(smoothed, seaLevel + 0.001)
          }

          newHeights[idx] = smoothed
        }
      }
    }

    const newTerrain: TerrainData = {
      ...world.terrain,
      heights: newHeights,
      materials: new Uint8Array(world.terrain.materials),
    }
    setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // Scale map
  const handleScaleMap = useCallback(() => {
    if (!world) return
    const vFactor = scaleUniform ? scaleVertical : scaleVertical
    const hFactor = scaleUniform ? scaleVertical : scaleHorizontal

    const newMaxHeight = Math.max(10, Math.min(5000, world.terrain.maxHeight * vFactor))
    const newCellSize = Math.max(0.1, Math.min(20, world.terrain.cellSize * hFactor))

    // Scale object positions proportionally
    const scaledObjects = world.objects.map((obj) => ({
      ...obj,
      position: [
        obj.position[0] * hFactor,
        obj.position[1] * vFactor,
        obj.position[2] * hFactor,
      ] as [number, number, number],
    }))

    // Clone typed arrays to trigger React change detection
    const newTerrain: TerrainData = {
      ...world.terrain,
      maxHeight: newMaxHeight,
      cellSize: newCellSize,
      heights: new Float32Array(world.terrain.heights),
      materials: new Uint8Array(world.terrain.materials),
    }

    setWorld({ ...world, terrain: newTerrain, objects: scaledObjects, updatedAt: new Date() })
    setHasUnsavedChanges(true)
    setShowScaleDialog(false)
    setScaleVertical(1.0)
    setScaleHorizontal(1.0)
  }, [world, scaleVertical, scaleHorizontal, scaleUniform])

  // New world with different size
  const handleNewWorld = useCallback((sizeX: number, sizeZ: number) => {
    // Skip confirmation if terrain is blank (setup phase)
    const isBlank = !world || !world.terrain.heights.some((h: number) => h > 0)
    if (!isBlank && !confirm(`Create new ${sizeX}x${sizeZ} world? Current world will be lost.`)) return
    const newWorld = createWorld(storyId, "My World", sizeX, sizeZ)
    setWorld(newWorld)
    setCartographyGrid(createCartographyGrid(sizeX, sizeZ, 'plains'))
    setHasUnsavedChanges(true)
  }, [storyId, world])

  // ── Location CRUD ────────────────────────────────────────────

  const handleSaveLocation = useCallback(() => {
    if (!world || !newLocationName.trim()) return
    if (!cameraPosRef.current) {
      alert("Camera position not available. Move the camera first.")
      return
    }

    const location = createWorldLocation(
      newLocationName.trim(),
      cameraPosRef.current,
      [0, cameraYawRef.current, 0],  // Store yaw as Y rotation
      undefined  // TODO: Generate thumbnail
    )

    const updatedWorld = {
      ...world,
      locations: [...(world.locations || []), location],
      updatedAt: new Date(),
    }
    setWorld(updatedWorld)
    setHasUnsavedChanges(true)
    setShowSaveLocationDialog(false)
    setNewLocationName("")
  }, [world, newLocationName])

  const handleDeleteLocation = useCallback((locationId: string) => {
    if (!world) return
    if (!confirm("Delete this location?")) return

    const updatedWorld = {
      ...world,
      locations: (world.locations || []).filter(loc => loc.id !== locationId),
      updatedAt: new Date(),
    }
    setWorld(updatedWorld)
    setHasUnsavedChanges(true)
  }, [world])

  // ── Object CRUD ────────────────────────────────────────────

  const handleObjectPlace = useCallback((worldPos: [number, number, number]) => {
    if (!world) return

    const objType = useWorldBuilderStore.getState().selectedObjectType
    if (!objType) return
    const entry = getCatalogEntry(objType)
    if (!entry) return

    const newObj: WorldObject = {
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: objType,
      category: entry.category,
      position: worldPos,
      rotation: [0, 0, 0],
      scale: [...entry.defaultScale],
      color: entry.defaultColor,
      locked: false,
      visible: true,
    }

    const updatedWorld = {
      ...world,
      objects: [...world.objects, newObj],
      updatedAt: new Date(),
    }
    setWorld(updatedWorld)
    setHasUnsavedChanges(true)
  }, [world])

  const handleObjectSelect = useCallback((objectId: string | null, additive: boolean) => {
    if (!objectId) {
      clearSelection()
      return
    }
    if (additive) {
      addToSelection(objectId)
    } else {
      selectObject(objectId)
    }
  }, [clearSelection, addToSelection, selectObject])

  const handleObjectMove = useCallback((objectId: string, newPos: [number, number, number]) => {
    if (!world) return
    const updatedObjects = world.objects.map((obj) => {
      if (obj.id === objectId && !obj.locked) {
        return { ...obj, position: newPos }
      }
      return obj
    })
    setWorld({ ...world, objects: updatedObjects, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  const handleObjectColorChange = useCallback((objectId: string, color: string) => {
    if (!world) return
    const updatedObjects = world.objects.map((obj) => {
      if (obj.id === objectId) {
        return { ...obj, color }
      }
      return obj
    })
    setWorld({ ...world, objects: updatedObjects, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // Generic object property update
  const handleObjectUpdate = useCallback((objectId: string, updates: Partial<WorldObject>) => {
    if (!world) return
    const updatedObjects = world.objects.map((obj) => {
      if (obj.id === objectId) return { ...obj, ...updates }
      return obj
    })
    setWorld({ ...world, objects: updatedObjects, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // Duplicate selected objects
  const handleDuplicateSelected = useCallback(() => {
    if (!world) return
    const ids = useWorldBuilderStore.getState().selectedObjectIds
    if (ids.length === 0) return
    const duplicates = world.objects
      .filter((obj) => ids.includes(obj.id))
      .map((obj) => ({
        ...obj,
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        position: [obj.position[0] + 2, obj.position[1], obj.position[2] + 2] as [number, number, number],
        locked: false,
      }))
    const newIds = duplicates.map((d) => d.id)
    setWorld({ ...world, objects: [...world.objects, ...duplicates], updatedAt: new Date() })
    useWorldBuilderStore.getState().setSelection(newIds)
    setHasUnsavedChanges(true)
  }, [world])

  // Export heightmap as PNG
  const handleExportHeightmap = useCallback(() => {
    if (!world) return
    const { heights, size, sizeZ } = world.terrain
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = sizeZ
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(size, sizeZ)
    for (let i = 0; i < heights.length; i++) {
      const v = Math.round(heights[i] * 255)
      const pi = i * 4
      imageData.data[pi] = v
      imageData.data[pi + 1] = v
      imageData.data[pi + 2] = v
      imageData.data[pi + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
    const link = document.createElement('a')
    link.download = `heightmap-${size}x${sizeZ}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [world])

  const handleDeleteSelected = useCallback(() => {
    if (!world) return
    const ids = useWorldBuilderStore.getState().selectedObjectIds
    if (ids.length === 0) return
    const updatedObjects = world.objects.filter((obj) => !ids.includes(obj.id))
    setWorld({ ...world, objects: updatedObjects, updatedAt: new Date() })
    clearSelection()
    setHasUnsavedChanges(true)
  }, [world, clearSelection])

  // ── Cartography handlers ──────────────────────────────────

  const handleCartographyChange = useCallback((grid: Uint8Array) => {
    setCartographyGrid(grid)
    setHasUnsavedChanges(true)
  }, [])

  const handleGenerateTerrain = useCallback(() => {
    if (!world || !cartographyGrid) return
    if (!confirm("Generate terrain from cartography map? This will replace current terrain heights and materials.")) return

    generateTerrainFromCartography(cartographyGrid, world.terrain.size, world.terrain.sizeZ, world.terrain, cartographySettings)
    // Create a NEW terrain object so React detects the change
    const newTerrain = {
      ...world.terrain,
      heights: new Float32Array(world.terrain.heights),
      materials: new Uint8Array(world.terrain.materials),
    }
    setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
    setHasUnsavedChanges(true)
    setActiveTool('sculpt')
    setEditorPhase('editor')
  }, [world, cartographyGrid, cartographySettings, setActiveTool])

  const handleCartographyClear = useCallback(() => {
    if (!world) return
    if (!confirm("Clear the entire cartography map?")) return
    setCartographyGrid(createCartographyGrid(world.terrain.size, world.terrain.sizeZ, 'plains'))
    setHasUnsavedChanges(true)
  }, [world])

  const handleCartographyFillAll = useCallback(() => {
    if (!world) return
    const biomeIdx = indexFromBiome(cartographyBiome)
    const grid = new Uint8Array(world.terrain.size * world.terrain.sizeZ)
    grid.fill(biomeIdx)
    setCartographyGrid(grid)
    setHasUnsavedChanges(true)
  }, [cartographyBiome, world])

  // ── Heightmap handler ────────────────────────────────────

  const handleHeightmapUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!world || !e.target.files?.[0]) return
    try {
      const { heights, sizeX, sizeZ } = await loadHeightmapFromFile(e.target.files[0])

      // If image dimensions differ from current terrain, create a new world at that size
      let baseWorld = world
      if (sizeX !== world.terrain.size || sizeZ !== world.terrain.sizeZ) {
        baseWorld = createWorld(storyId, "My World", sizeX, sizeZ)
      }

      // Create a NEW terrain object so React detects the change
      const newTerrain = {
        ...baseWorld.terrain,
        heights: new Float32Array(heights),
        materials: new Uint8Array(baseWorld.terrain.materials),
      }
      setWorld({ ...baseWorld, terrain: newTerrain, updatedAt: new Date() })

      // Populate the 2D cartography map from the height data (1:1 with terrain)
      const grid = cartographyGridFromHeights(heights, sizeX, sizeZ)
      setCartographyGrid(grid)

      setHasUnsavedChanges(true)
      setEditorPhase('editor')
    } catch (err) {
      console.error("Failed to load heightmap:", err)
      alert("Failed to load heightmap image.")
    }
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [world, storyId])

  // ── Keyboard shortcuts ─────────────────────────────────────

  // Phase-tool sync: switching to cartography sets phase, switching away restores editor
  useEffect(() => {
    if (editorPhase === 'setup') return // don't sync during setup
    if (activeTool === 'cartography') {
      setEditorPhase('cartography')
    } else if (editorPhase === 'cartography') {
      setEditorPhase('editor')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool])

  // Adjust brush size for the active tool
  const adjustBrushSize = useCallback((delta: number) => {
    const state = useWorldBuilderStore.getState()
    if (state.activeTool === 'sculpt') {
      state.setSculptBrushSize(state.sculptBrush.size + delta)
    } else if (state.activeTool === 'paint-material') {
      state.setMaterialBrushSize(state.materialBrush.size + delta)
    } else if (state.activeTool === 'cartography') {
      state.setCartographyBrushSize(state.cartographyBrushSize + delta)
    }
  }, [])

  // Playtest handlers
  const handleStartPlaytest = useCallback(() => {
    setPlaytesting(true)
    setCameraMode('first-person')
  }, [setPlaytesting, setCameraMode])

  const handleStopPlaytest = useCallback(() => {
    setPlaytesting(false)
    setCameraMode('orbit')
  }, [setPlaytesting, setCameraMode])

  // Refs for keyboard handler to use late-defined callbacks
  const handleFinishBorderRef = useRef<() => void>(() => {})
  const handleFinishRoadRef = useRef<() => void>(() => {})

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      // Don't capture during setup phase
      if (editorPhase === 'setup') return

      // Universal shortcuts (work in all modes)
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z': e.preventDefault(); handleUndo(); return
          case 'y': e.preventDefault(); handleRedo(); return
          case 'd': e.preventDefault(); handleDuplicateSelected(); return
          case 's': e.preventDefault(); handleSave(); return
        }
      }

      // Brush size shortcuts (work in all modes)
      if (e.key === '[') { adjustBrushSize(-1); return }
      if (e.key === ']') { adjustBrushSize(1); return }

      // Escape — exit playtest first, then cancel drawing
      if (e.key === 'Escape') {
        if (isPlaytesting) { handleStopPlaytest(); return }
        if (borderDrawMode === 'drawing') { clearBorderVertices(); return }
        if (roadDrawMode === 'drawing') { clearRoadWaypoints(); return }
        if (wallStartPoint) { setWallStartPoint(null); setWallDrawMode('idle'); return }
        if (lotCorner1) { setLotCorner1(null); return }
      }

      // Don't capture tool shortcuts when in first-person mode (WASD conflicts)
      if (cameraMode === 'first-person') {
        switch (e.key.toLowerCase()) {
          case 'f': setCameraMode('orbit'); break
        }
        return
      }

      // Enter key to finish border/road drawing
      if (e.key === 'Enter') {
        if (activeTool === 'draw-border' && borderDrawMode === 'drawing') {
          handleFinishBorderRef.current()
          return
        }
        if (activeTool === 'draw-road' && roadDrawMode === 'drawing') {
          handleFinishRoadRef.current()
          return
        }
      }

      const levelTools = LEVEL_TOOLS[currentLevel] || []
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break
        case 'b': if (levelTools.includes('sculpt')) setActiveTool('sculpt'); break
        case 'p': if (levelTools.includes('paint-material')) setActiveTool('paint-material'); break
        case 'o': if (levelTools.includes('place-object')) setActiveTool('place-object'); break
        case 'm': if (levelTools.includes('cartography')) setActiveTool('cartography'); break
        case 'x': setActiveTool('delete'); break
        case 'r': if (levelTools.includes('define-region')) setActiveTool('define-region'); break
        case 'g': if (levelTools.includes('draw-border')) setActiveTool('draw-border'); break
        case 'l': if (levelTools.includes('draw-lot')) setActiveTool('draw-lot'); break
        case 'd': if (levelTools.includes('draw-road')) setActiveTool('draw-road'); break
        case 'w': if (levelTools.includes('place-wall')) setActiveTool('place-wall'); break
        case 'a': if (levelTools.includes('place-furniture')) setActiveTool('place-furniture'); break
        case 'f':
          if (levelTools.includes('paint-floor')) setActiveTool('paint-floor')
          else setCameraMode(cameraMode === 'orbit' ? 'first-person' : 'orbit')
          break
        case 'delete':
        case 'backspace':
          handleDeleteSelected()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveTool, handleDeleteSelected, editorPhase, cameraMode, setCameraMode, handleUndo, handleRedo, adjustBrushSize, handleDuplicateSelected, handleSave, activeTool, borderDrawMode, roadDrawMode, clearBorderVertices, clearRoadWaypoints, wallStartPoint, setWallStartPoint, setWallDrawMode, lotCorner1, setLotCorner1, currentLevel, isPlaytesting, handleStopPlaytest])

  // ── Get current node data helpers ────────────────────────────
  const currentNode = hierarchicalWorld && activeNodeId ? hierarchicalWorld.nodes[activeNodeId] : null

  // ── Border handlers ────────────────────────────────────────
  const handleBorderClick = useCallback((worldPos: [number, number, number]) => {
    if (borderDrawMode === 'idle') {
      setBorderDrawMode('drawing')
    }
    addBorderVertex({ x: worldPos[0], z: worldPos[2] })
  }, [borderDrawMode, setBorderDrawMode, addBorderVertex])

  const handleFinishBorder = useCallback(() => {
    if (borderVertices.length < 3) return
    setShowBorderNameDialog(true)
  }, [borderVertices])
  handleFinishBorderRef.current = handleFinishBorder

  const handleConfirmBorder = useCallback(async () => {
    if (!hierarchicalWorld || !activeNodeId || borderVertices.length < 3 || !world) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node) return
    const hw = hierarchicalWorld

    const newBorder: PolygonBorder = {
      id: `border-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: newBorderName || `Border ${(node.polygonBorders?.length ?? 0) + 1}`,
      vertices: [...borderVertices],
      color: borderColor,
      style: borderStyle,
      fillOpacity: 0.1,
    }

    // Compute bounding box from vertices (in world coords) → grid coords
    const cs = world.terrain.cellSize || 1
    const xs = borderVertices.map(v => v.x / cs)
    const zs = borderVertices.map(v => v.z / cs)
    const rawMinX = Math.floor(Math.min(...xs))
    const rawMinZ = Math.floor(Math.min(...zs))
    const rawMaxX = Math.ceil(Math.max(...xs))
    const rawMaxZ = Math.ceil(Math.max(...zs))
    // Clamp to parent terrain bounds
    const minX = Math.max(0, rawMinX)
    const minZ = Math.max(0, rawMinZ)
    const maxX = Math.min(world.terrain.size, rawMaxX)
    const maxZ = Math.min(world.terrain.sizeZ, rawMaxZ)
    const boundsWidth = Math.max(maxX - minX, 8)
    const boundsDepth = Math.max(maxZ - minZ, 8)

    // Auto-create a child region from this border
    const childLevel = getChildLevel(node.level)
    if (childLevel) {
      const regionBoundsForChild = { startX: minX, startZ: minZ, width: boundsWidth, depth: boundsDepth }
      // Cap child resolution to avoid huge arrays (max ~512 per axis)
      const maxChildSize = 512
      const childSizeX = Math.min(boundsWidth * 4, maxChildSize)
      const childSizeZ = Math.min(boundsDepth * 4, maxChildSize)

      const childNode = createWorldNode(
        activeNodeId,
        childLevel,
        newBorder.name,
        regionBoundsForChild,
        childSizeX,
        childSizeZ
      )

      childNode.terrain = initChildTerrainFromParent(
        node.terrain,
        regionBoundsForChild,
        childSizeX,
        childSizeZ
      )

      node.childIds.push(childNode.id)
      hw.nodes[childNode.id] = childNode
      hw.updatedAt = new Date()
      newBorder.linkedChildId = childNode.id

      await saveNodeData(storyId, serializeWorldNode(childNode))
    }

    const updatedBorders = [...(node.polygonBorders || []), newBorder]
    node.polygonBorders = updatedBorders
    setHierarchicalWorld({ ...hw })
    clearBorderVertices()
    setShowBorderNameDialog(false)
    setNewBorderName("")
    setHasUnsavedChanges(true)
    pushUndo({ type: 'border-create', borderId: newBorder.id })

    // Save
    await saveNodeData(storyId, serializeWorldNode(node))
    await saveHierarchyMeta(storyId, serializeHierarchicalWorld(hw))
    setActiveTool('select')
  }, [hierarchicalWorld, activeNodeId, borderVertices, borderColor, borderStyle, newBorderName, clearBorderVertices, pushUndo, world, storyId, setActiveTool])

  const handleDeleteBorder = useCallback((borderId: string) => {
    if (!hierarchicalWorld || !activeNodeId) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node || !node.polygonBorders) return

    const border = node.polygonBorders.find(b => b.id === borderId)
    if (border) {
      pushUndo({ type: 'border-delete', borderSnapshot: JSON.stringify(border) })
    }
    node.polygonBorders = node.polygonBorders.filter(b => b.id !== borderId)
    setHierarchicalWorld({ ...hierarchicalWorld })
    setHasUnsavedChanges(true)
  }, [hierarchicalWorld, activeNodeId, pushUndo])

  // ── Lot handlers ───────────────────────────────────────────
  const handleLotClick = useCallback((worldPos: [number, number, number]) => {
    if (!world) return
    const gridX = Math.round(worldPos[0] / world.terrain.cellSize)
    const gridZ = Math.round(worldPos[2] / world.terrain.cellSize)

    if (!lotCorner1) {
      setLotCorner1({ x: gridX, z: gridZ })
    } else {
      // Second corner — create lot
      if (!hierarchicalWorld || !activeNodeId) return
      const node = hierarchicalWorld.nodes[activeNodeId]
      if (!node) return

      const startX = Math.min(lotCorner1.x, gridX)
      const startZ = Math.min(lotCorner1.z, gridZ)
      const w = Math.abs(gridX - lotCorner1.x)
      const d = Math.abs(gridZ - lotCorner1.z)
      if (w < 2 || d < 2) { setLotCorner1(null); return }

      const newLot: CityLot = {
        id: `lot-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: `Lot ${(node.lots?.length ?? 0) + 1}`,
        zoning: lotZoning,
        startX, startZ,
        width: w, depth: d,
      }

      node.lots = [...(node.lots || []), newLot]
      setHierarchicalWorld({ ...hierarchicalWorld })
      setLotCorner1(null)
      setHasUnsavedChanges(true)
    }
  }, [world, lotCorner1, setLotCorner1, hierarchicalWorld, activeNodeId, lotZoning])

  const handleDeleteLot = useCallback((lotId: string) => {
    if (!hierarchicalWorld || !activeNodeId) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node || !node.lots) return
    node.lots = node.lots.filter(l => l.id !== lotId)
    setHierarchicalWorld({ ...hierarchicalWorld })
    setHasUnsavedChanges(true)
  }, [hierarchicalWorld, activeNodeId])

  // ── Road handlers ──────────────────────────────────────────
  const handleRoadClick = useCallback((worldPos: [number, number, number]) => {
    if (roadDrawMode === 'idle') {
      setRoadDrawMode('drawing')
    }
    // Snap to existing endpoints
    const network = currentNode?.roadNetwork
    const waypoint: RoadWaypoint = { x: worldPos[0], z: worldPos[2] }
    const snapped = network
      ? snapToRoadEndpoint(waypoint, network.segments, 2)
      : waypoint
    addRoadWaypoint(snapped)
  }, [roadDrawMode, setRoadDrawMode, addRoadWaypoint, currentNode])

  const handleFinishRoad = useCallback(() => {
    if (!hierarchicalWorld || !activeNodeId || roadWaypoints.length < 2) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node) return

    const defaults = ROAD_TYPE_DEFAULTS[roadType]
    const newSegment: RoadSegment = {
      id: `road-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: roadType,
      waypoints: [...roadWaypoints],
      width: defaults.width,
      lanes: defaults.lanes,
      oneWay: false,
      hasSidewalk: defaults.hasSidewalk,
      sidewalkWidth: defaults.sidewalkWidth,
      hasMedian: false,
    }

    const network: RoadNetwork = node.roadNetwork
      ? { ...node.roadNetwork, segments: [...node.roadNetwork.segments, newSegment] }
      : { segments: [newSegment], intersections: [] }

    // Auto-detect intersections
    network.intersections = computeIntersections(network.segments)

    // Auto-paint asphalt under road
    autoMaterialPaint(newSegment.waypoints, newSegment.width, node.terrain)

    node.roadNetwork = network
    setHierarchicalWorld({ ...hierarchicalWorld })
    clearRoadWaypoints()
    setHasUnsavedChanges(true)
  }, [hierarchicalWorld, activeNodeId, roadWaypoints, roadType, clearRoadWaypoints])
  handleFinishRoadRef.current = handleFinishRoad

  const handleDeleteRoad = useCallback((segmentId: string) => {
    if (!hierarchicalWorld || !activeNodeId) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node?.roadNetwork) return
    node.roadNetwork.segments = node.roadNetwork.segments.filter(s => s.id !== segmentId)
    node.roadNetwork.intersections = computeIntersections(node.roadNetwork.segments)
    setHierarchicalWorld({ ...hierarchicalWorld })
    setHasUnsavedChanges(true)
  }, [hierarchicalWorld, activeNodeId])

  // ── Building handlers ──────────────────────────────────────

  // Auto-init building data when entering building level
  useEffect(() => {
    if (currentLevel === 'building' && hierarchicalWorld && activeNodeId) {
      const node = hierarchicalWorld.nodes[activeNodeId]
      if (node && !node.buildingData) {
        node.buildingData = createBuildingData(32, 0.5)
        setHierarchicalWorld({ ...hierarchicalWorld })
      }
    }
  }, [currentLevel, hierarchicalWorld, activeNodeId])

  const handleWallClick = useCallback((worldPos: [number, number, number]) => {
    if (!hierarchicalWorld || !activeNodeId) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node?.buildingData) return

    const bd = node.buildingData
    const snapped = snapToWallGrid(worldPos[0], worldPos[2], bd.gridSize, bd.gridCellSize)

    if (!wallStartPoint) {
      setWallStartPoint(snapped)
      setWallDrawMode('drawing')
    } else {
      // Place wall
      const floor = bd.floors.find(f => f.level === activeFloor)
      if (!floor) return

      const newWall: WallSegment = {
        id: `wall-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        startX: wallStartPoint.x,
        startZ: wallStartPoint.z,
        endX: snapped.x,
        endZ: snapped.z,
        height: wallHeight,
        thickness: 0.15,
        material: wallMat,
      }

      floor.walls = [...floor.walls, newWall]
      // Re-detect rooms
      floor.rooms = detectRooms(floor.walls, bd.gridSize, bd.gridCellSize)
      node.buildingData = { ...bd }
      setHierarchicalWorld({ ...hierarchicalWorld })
      setWallStartPoint(null)
      setWallDrawMode('idle')
      setHasUnsavedChanges(true)
      pushUndo({ type: 'wall-place', wallId: newWall.id, floorLevel: activeFloor })
    }
  }, [hierarchicalWorld, activeNodeId, wallStartPoint, setWallStartPoint, setWallDrawMode, activeFloor, wallHeight, wallMat, pushUndo])

  const handleDoorClick = useCallback((worldPos: [number, number, number]) => {
    if (!hierarchicalWorld || !activeNodeId) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node?.buildingData) return

    const bd = node.buildingData
    const floor = bd.floors.find(f => f.level === activeFloor)
    if (!floor) return

    // Find wall at click position
    const wall = findWallAtPoint(floor.walls, worldPos[0], worldPos[2], 0.5)
    if (!wall) return

    // Compute position along wall (0-1)
    const dx = wall.endX - wall.startX
    const dz = wall.endZ - wall.startZ
    const wLen = Math.hypot(dx, dz)
    if (wLen < 0.01) return
    const t = ((worldPos[0] - wall.startX) * dx + (worldPos[2] - wall.startZ) * dz) / (wLen * wLen)

    const newOpening: WallOpening = {
      id: `opening-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      wallId: wall.id,
      type: 'door',
      position: Math.max(0.1, Math.min(0.9, t)),
      width: 0.9,
      height: 2.1,
      sillHeight: 0,
    }

    floor.openings = [...floor.openings, newOpening]
    node.buildingData = { ...bd }
    setHierarchicalWorld({ ...hierarchicalWorld })
    setHasUnsavedChanges(true)
    pushUndo({ type: 'opening-place', openingId: newOpening.id, floorLevel: activeFloor })
  }, [hierarchicalWorld, activeNodeId, activeFloor, pushUndo])

  const handleFloorPaint = useCallback((worldPos: [number, number, number]) => {
    if (!hierarchicalWorld || !activeNodeId) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node?.buildingData) return

    const bd = node.buildingData
    const floor = bd.floors.find(f => f.level === activeFloor)
    if (!floor) return

    const gx = Math.floor(worldPos[0] / bd.gridCellSize)
    const gz = Math.floor(worldPos[2] / bd.gridCellSize)

    // Add or update floor tile
    const existing = floor.floorTiles.findIndex(t => t.x === gx && t.z === gz)
    if (existing >= 0) {
      floor.floorTiles[existing] = { x: gx, z: gz, material: floorMaterial }
    } else {
      floor.floorTiles = [...floor.floorTiles, { x: gx, z: gz, material: floorMaterial }]
    }
    node.buildingData = { ...bd }
    setHierarchicalWorld({ ...hierarchicalWorld })
    setHasUnsavedChanges(true)
  }, [hierarchicalWorld, activeNodeId, activeFloor, floorMaterial])

  const handleFurniturePlace = useCallback((worldPos: [number, number, number]) => {
    if (!hierarchicalWorld || !activeNodeId || !selectedFurnitureType) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node?.buildingData) return

    const bd = node.buildingData
    const snapped = snapToWallGrid(worldPos[0], worldPos[2], bd.gridSize, bd.gridCellSize)

    const newFurniture: FurniturePlacement = {
      id: `furn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      itemType: selectedFurnitureType,
      position: [snapped.x, 0, snapped.z],
      rotation: 0,
      floorLevel: activeFloor,
    }

    node.buildingData = { ...bd, furniture: [...bd.furniture, newFurniture] }
    setHierarchicalWorld({ ...hierarchicalWorld })
    setHasUnsavedChanges(true)
    pushUndo({ type: 'furniture-place', furnitureId: newFurniture.id })
  }, [hierarchicalWorld, activeNodeId, selectedFurnitureType, activeFloor, pushUndo])

  const handleAddFloor = useCallback(() => {
    if (!hierarchicalWorld || !activeNodeId) return
    const node = hierarchicalWorld.nodes[activeNodeId]
    if (!node?.buildingData) return

    const bd = node.buildingData
    const maxLevel = bd.floors.reduce((max, f) => Math.max(max, f.level), 0)
    const newFloor: BuildingFloor = {
      level: maxLevel + 1,
      floorHeight: (maxLevel + 1) * 3,
      ceilingHeight: 3,
      walls: [],
      openings: [],
      floorTiles: [],
      rooms: [],
    }
    node.buildingData = { ...bd, floors: [...bd.floors, newFloor] }
    setActiveFloor(maxLevel + 1)
    setHierarchicalWorld({ ...hierarchicalWorld })
    setHasUnsavedChanges(true)
  }, [hierarchicalWorld, activeNodeId, setActiveFloor])

  if (!world) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Globe className="w-8 h-8 text-gray-400 animate-pulse" />
      </div>
    )
  }

  // ── Setup phase screen ────────────────────────────────────
  if (editorPhase === 'setup') {
    return (
      <div className="h-screen flex flex-col bg-gray-900 text-white">
        <header className="border-b border-gray-700 bg-gray-900 px-4 py-2 flex items-center gap-3 shrink-0">
          <Globe className="w-5 h-5 text-sky-400" />
          <h1 className="text-sm font-semibold">World Builder</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-lg w-full px-6 space-y-8 text-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Create Your World</h2>
              <p className="text-sm text-gray-400">Choose how to start building your terrain.</p>
            </div>

            {/* Size selector */}
            <div className="flex items-center justify-center gap-3">
              <label className="text-xs text-gray-400">Width</label>
              <input
                type="number"
                min={16}
                max={4096}
                step={1}
                className="bg-gray-800 text-sm border border-gray-700 rounded px-3 py-1.5 w-24 text-center"
                value={world.terrain.size}
                onChange={(e) => {
                  const v = Math.max(16, Math.min(4096, Number(e.target.value) || 256))
                  handleNewWorld(v, world.terrain.sizeZ)
                }}
              />
              <span className="text-gray-500">x</span>
              <label className="text-xs text-gray-400">Height</label>
              <input
                type="number"
                min={16}
                max={4096}
                step={1}
                className="bg-gray-800 text-sm border border-gray-700 rounded px-3 py-1.5 w-24 text-center"
                value={world.terrain.sizeZ}
                onChange={(e) => {
                  const v = Math.max(16, Math.min(4096, Number(e.target.value) || 256))
                  handleNewWorld(world.terrain.size, v)
                }}
              />
            </div>

            {/* Two cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* Upload Heightmap */}
              <button
                onClick={() => heightmapInputRef.current?.click()}
                className="group p-6 rounded-xl border border-gray-700 bg-gray-800/50 hover:border-sky-500 hover:bg-gray-800 transition-all text-left space-y-3"
              >
                <Upload className="w-8 h-8 text-sky-400 group-hover:scale-110 transition-transform" />
                <h3 className="text-sm font-semibold">Upload Heightmap</h3>
                <p className="text-xs text-gray-500">
                  Import a grayscale PNG or JPEG image as terrain elevation data.
                </p>
              </button>

              {/* Paint Map */}
              <button
                onClick={() => {
                  setActiveTool('cartography')
                  setEditorPhase('cartography')
                }}
                className="group p-6 rounded-xl border border-gray-700 bg-gray-800/50 hover:border-emerald-500 hover:bg-gray-800 transition-all text-left space-y-3"
              >
                <MapIcon className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition-transform" />
                <h3 className="text-sm font-semibold">Paint Map</h3>
                <p className="text-xs text-gray-500">
                  Draw biome regions, then generate terrain from your painted map.
                </p>
              </button>
            </div>

            {/* Skip link */}
            <button
              onClick={() => {
                setActiveTool('sculpt')
                setEditorPhase('editor')
              }}
              className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
            >
              Skip to blank editor
            </button>

            {/* Hidden file input for heightmap */}
            <input
              ref={heightmapInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleHeightmapUpload}
            />
          </div>
        </div>
      </div>
    )
  }

  // Tool definitions - filtered by current hierarchy level
  const borderLabel = currentLevel === 'world' ? 'Country' : currentLevel === 'country' ? 'City' : currentLevel === 'city' ? 'Building' : 'Border'
  const allTools: { id: EditorTool; label: string; icon: React.ElementType; shortcut?: string }[] = [
    { id: "select", label: "Select", icon: MousePointer, shortcut: "V" },
    { id: "sculpt", label: "Sculpt", icon: Mountain, shortcut: "B" },
    { id: "paint-material", label: "Paint", icon: Paintbrush, shortcut: "P" },
    { id: "place-object", label: "Objects", icon: Package, shortcut: "O" },
    { id: "cartography", label: "Map", icon: MapIcon, shortcut: "M" },
    { id: "draw-border", label: borderLabel, icon: Pentagon, shortcut: "G" },
    { id: "draw-lot", label: "Lot", icon: LayoutGrid, shortcut: "L" },
    { id: "draw-road", label: "Road", icon: Route, shortcut: "D" },
    { id: "place-wall", label: "Wall", icon: Square, shortcut: "W" },
    { id: "place-door", label: "Door", icon: DoorOpen, shortcut: "D" },
    { id: "paint-floor", label: "Floor", icon: PaintBucket, shortcut: "F" },
    { id: "place-furniture", label: "Furnish", icon: Armchair, shortcut: "A" },
    { id: "delete", label: "Delete", icon: Trash2, shortcut: "X" },
  ]
  const allowedTools: EditorTool[] = LEVEL_TOOLS[currentLevel] || allTools.map(t => t.id)
  const tools = allTools.filter(t => allowedTools.includes(t.id))

  const sculptBrushTypes = [
    { type: 'raise' as const, label: 'Raise' },
    { type: 'lower' as const, label: 'Lower' },
    { type: 'smooth' as const, label: 'Smooth' },
    { type: 'flatten' as const, label: 'Flatten' },
    { type: 'noise' as const, label: 'Noise' },
    { type: 'plateau' as const, label: 'Plateau' },
    { type: 'erode' as const, label: 'Erode' },
  ]

  const naturalMaterials = getMaterialsByCategory('natural')
  const urbanMaterials = getMaterialsByCategory('urban')
  const fantasyMaterials = getMaterialsByCategory('fantasy')

  const buildingObjects = getCatalogByCategory('building')
  const decorationObjects = getCatalogByCategory('decoration')

  // Get selected object data for the right panel
  const selectedObj = selectedObjectIds.length === 1
    ? world.objects.find((o) => o.id === selectedObjectIds[0])
    : null

  // Compute dock column visibility
  const hasVisibleLeft = (['toolbox', 'locations'] as const).some(id => {
    if (!panels[id].visible) return false
    if (id === 'toolbox' && currentLevel === 'building') return false
    return true
  })

  const hasVisibleRight = (['explorer', 'properties'] as const).some(id => {
    if (!panels[id].visible) return false
    return true
  })

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Hidden file input for heightmap */}
      <input ref={heightmapInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleHeightmapUpload} />

      {/* ── Ribbon Tab Bar ── */}
      <div className="shrink-0 bg-gray-900 border-b border-gray-700/50">
        <div className="flex items-center h-9 pl-12 pr-3 gap-1">
          <div className="flex items-center gap-1.5 mr-4">
            <Globe className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-200">World Builder</span>
            {hasUnsavedChanges && <span className="text-xs text-amber-500">●</span>}
          </div>
          {(['home', 'terrain', 'build', 'environment', 'view'] as const)
            .filter(tab => !(tab === 'terrain' && currentLevel === 'building'))
            .map(tab => (
            <button
              key={tab}
              onClick={() => setRibbonTab(tab)}
              className={`px-4 py-1.5 text-xs font-medium rounded-t transition-colors ${
                ribbonTab === tab
                  ? 'bg-gray-800 text-white border-t-2 border-x border-sky-500/60 border-x-gray-700/50'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <div className="flex-1" />
          {!isPlaytesting ? (
            <button
              onClick={handleStartPlaytest}
              className="h-7 px-3 flex items-center gap-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Play
            </button>
          ) : (
            <button
              onClick={handleStopPlaytest}
              className="h-7 px-3 flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
        </div>
      </div>

      {/* ── Ribbon Content ── */}
      {!isPlaytesting && (
      <div className="shrink-0 bg-gray-800/90 border-b border-gray-700/50 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto">

        {/* ─── HOME TAB ─── */}
        {ribbonTab === 'home' && (
          <>
            <button onClick={handleUndo} disabled={undoStack.length === 0} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300 disabled:text-gray-600" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
            <button onClick={handleRedo} disabled={redoStack.length === 0} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300 disabled:text-gray-600" title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
            <button onClick={handleDuplicateSelected} disabled={selectedObjectIds.length === 0} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300 disabled:text-gray-600" title="Duplicate (Ctrl+D)"><Copy className="w-4 h-4" /></button>
            <button onClick={handleDeleteSelected} disabled={selectedObjectIds.length === 0} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300 disabled:text-gray-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button onClick={handleSave} disabled={!hasUnsavedChanges} className="h-8 px-3 flex items-center gap-1.5 rounded-md bg-sky-600 text-white text-xs font-medium hover:bg-sky-500 disabled:opacity-40"><Save className="w-4 h-4" /> Save</button>
            <button onClick={() => heightmapInputRef.current?.click()} className="h-8 px-2.5 flex items-center gap-1 rounded-md hover:bg-gray-700 text-gray-300 text-xs" title="Import Heightmap"><Upload className="w-4 h-4" /> Import</button>
            <button onClick={handleExportHeightmap} className="h-8 px-2.5 flex items-center gap-1 rounded-md hover:bg-gray-700 text-gray-300 text-xs" title="Export Heightmap"><Download className="w-4 h-4" /> Export</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button
              onClick={() => setCameraMode(cameraMode === 'orbit' ? 'first-person' : 'orbit')}
              className={`h-8 px-2.5 flex items-center gap-1 rounded-md text-xs ${cameraMode === 'first-person' ? 'bg-amber-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
              title="Toggle Camera (F)"
            >
              {cameraMode === 'orbit' ? <User className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {cameraMode === 'orbit' ? 'First Person' : 'Orbit'}
            </button>
            {cameraMode === 'first-person' && (
              <>
                <button
                  onClick={() => setFirstPersonSubMode(firstPersonSubMode === 'walk' ? 'fly' : 'walk')}
                  className={`h-8 px-2.5 rounded-md text-xs ${firstPersonSubMode === 'fly' ? 'bg-amber-700/60 text-amber-200' : 'hover:bg-gray-700 text-gray-300'}`}
                >
                  {firstPersonSubMode === 'walk' ? 'Walk' : 'Fly'}
                </button>
                <input type="range" min={1} max={100} value={Math.round(firstPersonSpeed * 10)} onChange={(e) => setFirstPersonSpeed(Number(e.target.value) / 10)} className="w-20 h-1.5" title={`Speed: ${firstPersonSpeed.toFixed(1)}x`} />
              </>
            )}
          </>
        )}

        {/* ─── TERRAIN TAB ─── */}
        {ribbonTab === 'terrain' && currentLevel !== 'building' && (
          <>
            <button
              onClick={() => setActiveTool('sculpt')}
              className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'sculpt' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
            >
              <Mountain className="w-4 h-4" /> Sculpt
            </button>
            <button
              onClick={() => setActiveTool('paint-material')}
              className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'paint-material' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
            >
              <Paintbrush className="w-4 h-4" /> Paint
            </button>
            <div
              className="w-7 h-7 rounded-md border-2 border-gray-600 cursor-pointer"
              style={{ backgroundColor: (() => { const mat = TERRAIN_MATERIALS[materialBrush.materialId]; return mat ? `rgb(${Math.round(mat.color[0]*255)},${Math.round(mat.color[1]*255)},${Math.round(mat.color[2]*255)})` : '#888' })() }}
              title={TERRAIN_MATERIALS[materialBrush.materialId]?.name ?? 'Material'}
              onClick={() => setActiveTool('paint-material')}
            />
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button
              onClick={() => setActiveTool('cartography')}
              className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'cartography' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
            >
              <MapIcon className="w-4 h-4" /> Map
            </button>
            <div className="w-6 h-6 rounded border-2 border-gray-600" style={{ backgroundColor: BIOME_COLORS[cartographyBiome] ?? '#888' }} title={BIOME_LABELS[cartographyBiome]} />
            <button onClick={handleGenerateTerrain} className="h-7 px-2 text-[11px] rounded-md hover:bg-gray-700 text-gray-300">Generate</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button onClick={handleResetTerrain} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300" title="Flatten All"><RotateCcw className="w-4 h-4" /></button>
            <button onClick={handleFlattenToGround} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300" title="Level Ground"><Minus className="w-4 h-4" /></button>
            <button onClick={handleSmoothCoastlines} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300" title="Smooth Coasts"><Droplets className="w-4 h-4" /></button>
            <button onClick={() => { setShowScaleDialog(true); setScaleVertical(1.0); setScaleHorizontal(1.0) }} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300" title="Scale Map"><Scaling className="w-4 h-4" /></button>
          </>
        )}

        {/* ─── BUILD TAB ─── */}
        {ribbonTab === 'build' && (
          <>
            <button onClick={() => setActiveTool('select')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'select' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><MousePointer className="w-4 h-4" /> Select</button>
            <button onClick={() => setActiveTool('delete')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'delete' ? 'bg-red-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Trash2 className="w-4 h-4" /> Delete</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />

            {/* Objects (country/city) */}
            {currentLevel !== 'world' && currentLevel !== 'building' && (
              <>
                <button onClick={() => setActiveTool('place-object')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'place-object' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Package className="w-4 h-4" /> Objects</button>
                <div className="w-px h-7 bg-gray-700/50 mx-1" />
              </>
            )}

            {/* Regions (world/country/city) */}
            {currentLevel !== 'building' && (
              <>
                <button onClick={() => setActiveTool('draw-border')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'draw-border' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Pentagon className="w-4 h-4" /> {borderLabel}</button>
                <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} className="w-7 h-7 rounded-md border border-gray-600 bg-transparent cursor-pointer" title="Border color" />
                {borderVertices.length > 0 && (
                  <>
                    <button onClick={handleFinishBorder} disabled={borderVertices.length < 3} className="h-8 px-2.5 text-xs rounded-md bg-sky-600 text-white disabled:opacity-40">Finish</button>
                    <button onClick={clearBorderVertices} className="h-8 px-2.5 text-xs rounded-md hover:bg-gray-700 text-gray-400">Cancel</button>
                  </>
                )}
                <div className="w-px h-7 bg-gray-700/50 mx-1" />
              </>
            )}

            {/* City tools */}
            {currentLevel === 'city' && (
              <>
                <button onClick={() => setActiveTool('draw-lot')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'draw-lot' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><LayoutGrid className="w-4 h-4" /> Lot</button>
                <button onClick={() => setActiveTool('draw-road')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'draw-road' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Route className="w-4 h-4" /> Road</button>
                <div className="w-px h-7 bg-gray-700/50 mx-1" />
              </>
            )}

            {/* Building tools */}
            {currentLevel === 'building' && (
              <>
                <button onClick={() => setActiveTool('place-wall')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'place-wall' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Square className="w-4 h-4" /> Wall</button>
                <button onClick={() => setActiveTool('place-door')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'place-door' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><DoorOpen className="w-4 h-4" /> Door</button>
                <button onClick={() => setActiveTool('paint-floor')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'paint-floor' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><PaintBucket className="w-4 h-4" /> Floor</button>
                <button onClick={() => setActiveTool('place-furniture')} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${activeTool === 'place-furniture' ? 'bg-sky-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Armchair className="w-4 h-4" /> Furnish</button>
                {currentNode?.buildingData && (
                  <>
                    <div className="w-px h-7 bg-gray-700/50 mx-1" />
                    <button onClick={() => setActiveFloor(Math.max(0, activeFloor - 1))} disabled={activeFloor === 0} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300 disabled:text-gray-600"><ChevronDown className="w-4 h-4" /></button>
                    <span className="text-xs text-gray-300 px-1">Floor {activeFloor}</span>
                    <button onClick={() => setActiveFloor(activeFloor + 1)} disabled={!currentNode.buildingData!.floors.some(f => f.level > activeFloor)} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300 disabled:text-gray-600"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={handleAddFloor} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-300" title="Add floor"><Plus className="w-4 h-4" /></button>
                  </>
                )}
              </>
            )}

            {/* Toolbox button - opens object library panel */}
            {currentLevel !== 'building' && (
              <>
                <div className="w-px h-7 bg-gray-700/50 mx-1" />
                <button
                  onClick={() => { setActiveTool('place-object'); setPanelVisible('toolbox', !panels.toolbox.visible) }}
                  className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs font-medium ${panels.toolbox.visible ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                >
                  <Package className="w-4 h-4" /> Toolbox
                </button>
              </>
            )}
          </>
        )}

        {/* ─── ENVIRONMENT TAB ─── */}
        {ribbonTab === 'environment' && (
          <>
            <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[10px] text-gray-500">Dir</span>
            <input type="range" min={0} max={360} value={sunAngle} onChange={(e) => setSunAngle(Number(e.target.value))} className="w-24 h-1.5" title={`Direction: ${sunAngle}°`} />
            <span className="text-[10px] text-gray-400 w-7">{sunAngle}°</span>
            <span className="text-[10px] text-gray-500">Elev</span>
            <input type="range" min={5} max={85} value={sunElevation} onChange={(e) => setSunElevation(Number(e.target.value))} className="w-24 h-1.5" title={`Elevation: ${sunElevation}°`} />
            <span className="text-[10px] text-gray-400 w-7">{sunElevation}°</span>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            {[
              { label: 'Dawn', angle: 80, el: 12 },
              { label: 'Morning', angle: 120, el: 35 },
              { label: 'Noon', angle: 160, el: 75 },
              { label: 'Dusk', angle: 260, el: 12 },
            ].map(preset => (
              <button key={preset.label} onClick={() => { setSunAngle(preset.angle); setSunElevation(preset.el) }} className="h-8 px-2.5 text-xs rounded-md hover:bg-gray-700 text-gray-300">{preset.label}</button>
            ))}
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button disabled className="h-8 px-2.5 flex items-center gap-1 rounded-md text-xs text-gray-500 opacity-40 cursor-not-allowed" title="Coming Soon"><Cloud className="w-4 h-4" /> Sky</button>
            <button disabled className="h-8 px-2.5 flex items-center gap-1 rounded-md text-xs text-gray-500 opacity-40 cursor-not-allowed" title="Coming Soon"><CloudFog className="w-4 h-4" /> Fog</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            {[
              { label: 'Clear', icon: Sun },
              { label: 'Cloudy', icon: Cloud },
              { label: 'Rain', icon: CloudRain },
              { label: 'Snow', icon: Snowflake },
              { label: 'Fog', icon: CloudFog },
            ].map(w => (
              <button key={w.label} disabled className="h-8 w-8 flex items-center justify-center rounded-md text-gray-500 opacity-40 cursor-not-allowed" title="Coming Soon"><w.icon className="w-4 h-4" /></button>
            ))}
          </>
        )}

        {/* ─── VIEW TAB ─── */}
        {ribbonTab === 'view' && (
          <>
            {/* Panel toggles */}
            <button onClick={() => setPanelVisible('explorer', !panels.explorer.visible)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${panels.explorer.visible ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><Flag className="w-4 h-4" /> Explorer</button>
            <button onClick={() => setPanelVisible('toolbox', !panels.toolbox.visible)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${panels.toolbox.visible ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><Package className="w-4 h-4" /> Toolbox</button>
            <button onClick={() => setPanelVisible('properties', !panels.properties.visible)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${panels.properties.visible ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><MousePointer className="w-4 h-4" /> Properties</button>
            <button onClick={() => setPanelVisible('locations', !panels.locations.visible)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${panels.locations.visible ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><MapPin className="w-4 h-4" /> Locations</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button onClick={() => setShowGrid(!showGrid)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${showGrid ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><Grid3x3 className="w-4 h-4" /> Grid</button>
            <button onClick={() => setShowWater(!showWater)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${showWater ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><Waves className="w-4 h-4" /> Water</button>
            <button onClick={() => setShowWireframe(!showWireframe)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${showWireframe ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><Box className="w-4 h-4" /> Wireframe</button>
            <button onClick={() => setShowMiniMap(!showMiniMap)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${showMiniMap ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><MapIcon className="w-4 h-4" /> Mini-Map</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button onClick={() => setShowBorders(!showBorders)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${showBorders ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><Pentagon className="w-4 h-4" /> Borders</button>
            <button onClick={() => setShowLots(!showLots)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${showLots ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><LayoutGrid className="w-4 h-4" /> Lots</button>
            <button onClick={() => setShowRoads(!showRoads)} className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-xs ${showRoads ? 'bg-sky-700/50 text-sky-200' : 'hover:bg-gray-700 text-gray-300'}`}><Route className="w-4 h-4" /> Roads</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button onClick={() => setShowSaveLocationDialog(true)} className="h-8 px-2.5 flex items-center gap-1 rounded-md text-xs hover:bg-gray-700 text-gray-300"><Camera className="w-4 h-4" /> Save Loc</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button disabled className="h-8 px-2.5 text-xs rounded-md text-gray-500 opacity-40 cursor-not-allowed" title="Coming Soon">Top</button>
            <button disabled className="h-8 px-2.5 text-xs rounded-md text-gray-500 opacity-40 cursor-not-allowed" title="Coming Soon">Front</button>
            <button disabled className="h-8 px-2.5 text-xs rounded-md text-gray-500 opacity-40 cursor-not-allowed" title="Coming Soon">Side</button>
            <button disabled className="h-8 px-2.5 text-xs rounded-md text-gray-500 opacity-40 cursor-not-allowed" title="Coming Soon">Persp</button>
            <div className="w-px h-7 bg-gray-700/50 mx-1" />
            <button disabled className="h-8 px-2.5 flex items-center gap-1 rounded-md text-xs text-gray-500 opacity-40 cursor-not-allowed" title="Coming Soon"><MonitorUp className="w-4 h-4" /> Screenshot</button>
          </>
        )}
      </div>
      )}

      {/* Main Area — flex layout with dock columns */}
      <div className="flex-1 overflow-hidden flex">

        {/* Left dock */}
        {!isPlaytesting && hasVisibleLeft && (
          <>
            <DockColumn side="left" width={leftDockWidth}>
              <DockPanel id="toolbox" title="Toolbox" icon={<Package className="w-3.5 h-3.5 text-green-400" />} autoHide={currentLevel === 'building'}>
                <div className="p-3 space-y-2">
                  <input
                    type="text"
                    value={toolboxSearch}
                    onChange={(e) => setToolboxSearch(e.target.value)}
                    placeholder="Search objects..."
                    className="w-full bg-gray-800 text-xs border border-gray-700 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  />
                  {[
                    { label: 'Buildings', items: buildingObjects },
                    { label: 'Decorations', items: decorationObjects },
                  ].map((group) => {
                    const filtered = toolboxSearch
                      ? group.items.filter(e => e.name.toLowerCase().includes(toolboxSearch.toLowerCase()))
                      : group.items
                    if (filtered.length === 0) return null
                    return (
                      <div key={group.label}>
                        <label className="text-[10px] text-gray-500 mb-1 block">{group.label}</label>
                        <div className="grid grid-cols-3 gap-1">
                          {filtered.map((entry) => (
                            <button
                              key={entry.type}
                              onClick={() => {
                                setSelectedObjectType(selectedObjectType === entry.type ? null : entry.type)
                                setActiveTool('place-object')
                              }}
                              className={`py-2 px-1 text-[10px] rounded-md border transition-colors flex flex-col items-center gap-1 ${
                                selectedObjectType === entry.type
                                  ? 'border-sky-500 bg-sky-900/40 text-sky-300'
                                  : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                              }`}
                            >
                              <div
                                className="w-7 h-7 rounded-md"
                                style={{ backgroundColor: entry.defaultColor }}
                              />
                              <span className="truncate w-full text-center">{entry.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </DockPanel>
              <DockPanel id="locations" title="Locations" icon={<MapPin className="w-3.5 h-3.5 text-sky-400" />}>
                <div className="p-3">
                  {(!world?.locations || world.locations.length === 0) ? (
                    <p className="text-[10px] text-gray-600">
                      No locations saved yet. Use &quot;Save Location&quot; to bookmark camera positions for use in scenes.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {world.locations.map((loc) => (
                        <li
                          key={loc.id}
                          className="group flex items-center justify-between p-1.5 rounded bg-gray-800/50 text-[10px] text-gray-300"
                        >
                          <div className="flex items-center gap-1.5">
                            <Camera className="w-3 h-3 text-gray-500" />
                            <span className="truncate max-w-[120px]">{loc.name}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteLocation(loc.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                            title="Delete location"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => setShowSaveLocationDialog(true)}
                    className="mt-2 w-full py-1.5 text-[10px] rounded border border-gray-700 text-gray-400 hover:bg-gray-800 flex items-center justify-center gap-1"
                  >
                    <MapPin className="w-3 h-3" /> Save Current Location
                  </button>
                </div>
              </DockPanel>
            </DockColumn>
            <DockResizeHandle side="left" currentWidth={leftDockWidth} onWidthChange={setLeftDockWidth} />
          </>
        )}

        {/* Viewport (fills remaining space) */}
        <div className="flex-1 min-w-0 relative overflow-hidden">
          {/* Hierarchy Breadcrumb */}
          {breadcrumbSegments.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <LevelBreadcrumb
                segments={breadcrumbSegments}
                onNavigate={handleBreadcrumbNavigate}
              />
            </div>
          )}

          {/* Level indicator badge */}
          {currentLevel !== 'world' && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              <button
                onClick={handleExitToParent}
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50 text-xs text-slate-300 hover:text-white hover:bg-slate-700/80 backdrop-blur-sm transition-all"
              >
                Exit to Parent
              </button>
            </div>
          )}

          {/* 3D Viewport — hidden (not unmounted) when cartography active */}
          <div style={{ display: activeTool === 'cartography' ? 'none' : 'block' }} className="w-full h-full">
            <WorldViewport3D
              terrain={world.terrain}
              activeTool={activeTool}
              sculptBrush={sculptBrush}
              materialBrush={materialBrush}
              showGrid={showGrid}
              showWater={showWater}

              objects={world.objects}
              selectedObjectIds={selectedObjectIds}
              selectedObjectType={selectedObjectType}

              cameraMode={cameraMode}
              firstPersonSubMode={firstPersonSubMode}
              firstPersonSpeed={firstPersonSpeed}
              onCameraModeChange={setCameraMode}
              onSubModeChange={setFirstPersonSubMode}

              onTerrainSculpt={handleTerrainSculpt}
              onTerrainPaint={handleTerrainPaint}
              onTerrainChanged={handleTerrainChanged}
              onCursorMove={handleCursorMove}
              onFpsUpdate={setFps}
              onObjectPlace={handleObjectPlace}
              onObjectSelect={handleObjectSelect}
              onObjectMove={handleObjectMove}
              onCameraUpdate={handleCameraUpdate}
              sunAngle={sunAngle}
              sunElevation={sunElevation}
              childRegions={childRegions.map((child) => {
                // Find linked border polygon for this child region
                const linkedBorder = currentNode?.polygonBorders?.find(b => b.linkedChildId === child.id)
                return {
                  id: child.id,
                  name: child.name,
                  bounds: child.boundsInParent!,
                  color: linkedBorder?.color,
                  polygonVertices: linkedBorder?.vertices,
                }
              })}
              onRegionClick={(worldPos) => {
                // Handle region corner clicks for define-region tool
                const gridX = Math.round(worldPos[0] / (world?.terrain.cellSize ?? 1))
                const gridZ = Math.round(worldPos[2] / (world?.terrain.cellSize ?? 1))

                if (!regionCorner1) {
                  setRegionCorner1({ x: gridX, z: gridZ })
                } else {
                  const startX = Math.min(regionCorner1.x, gridX)
                  const startZ = Math.min(regionCorner1.z, gridZ)
                  const endX = Math.max(regionCorner1.x, gridX)
                  const endZ = Math.max(regionCorner1.z, gridZ)
                  const width = Math.max(endX - startX, 8)
                  const depth = Math.max(endZ - startZ, 8)
                  setRegionBounds({ startX, startZ, width, depth })
                  setRegionCorner1(null)
                  setShowRegionDialog(true)
                }
              }}
              onRegionDoubleClick={(regionId) => {
                handleEnterNode(regionId)
              }}

              currentLevel={currentLevel}
              polygonBorders={currentNode?.polygonBorders}
              showBorders={showBorders}
              borderDrawMode={borderDrawMode}
              borderVertices={borderVertices}
              borderColor={borderColor}
              onBorderClick={handleBorderClick}
              lots={currentNode?.lots}
              showLots={showLots}
              onLotClick={handleLotClick}
              roadNetwork={currentNode?.roadNetwork}
              showRoads={showRoads}
              roadDrawMode={roadDrawMode}
              roadWaypoints={roadWaypoints}
              roadWidth={ROAD_TYPE_DEFAULTS[roadType]?.width ?? 10}
              onRoadClick={handleRoadClick}
              buildingData={currentNode?.buildingData}
              activeFloor={activeFloor}
              wallDrawMode={wallDrawMode}
              wallStartPoint={wallStartPoint}
              wallHeight={wallHeight}
              wallMaterial={wallMat}
              onWallClick={activeTool === 'place-door' ? handleDoorClick : handleWallClick}
              onFloorPaint={handleFloorPaint}
              onFurniturePlace={handleFurniturePlace}
            />
          </div>

          {/* 2D Cartography Editor */}
          {activeTool === 'cartography' && cartographyGrid && (
            <CartographyEditor
              cartographyGrid={cartographyGrid}
              gridSizeX={world.terrain.size}
              gridSizeZ={world.terrain.sizeZ}
              activeBiome={cartographyBiome}
              brushSize={cartographyBrushSize}
              onDataChange={handleCartographyChange}
            />
          )}

          {/* Mini-map (hidden in cartography mode) */}
          {activeTool !== 'cartography' && (
            <MiniMap
              terrain={world.terrain}
              objects={world.objects}
              visible={showMiniMap}
              cameraPosition={cameraPosRef.current}
              cameraYaw={cameraYawRef.current}
              cameraTick={cameraTick}
            />
          )}

          {/* Tool hint */}
          <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none flex items-center gap-2">
            <span>
              {activeTool === "select" && "Click objects to select · Drag to move · Delete to remove"}
              {activeTool === "sculpt" && `Sculpt: ${sculptBrush.type} — Click & drag on terrain`}
              {activeTool === "paint-material" && `Paint: ${TERRAIN_MATERIALS[materialBrush.materialId]?.name ?? 'Grass'} — Click & drag on terrain`}
              {activeTool === "place-object" && (selectedObjectType ? `Place: ${OBJECT_CATALOG[selectedObjectType]?.name ?? selectedObjectType} — Click terrain` : "Select an object type from the panel →")}
              {activeTool === "cartography" && `Cartography: Paint ${BIOME_LABELS[cartographyBiome]} — Click & drag to paint biomes`}
              {activeTool === "delete" && "Click objects to select, then press Delete"}
              {activeTool === "define-region" && (regionCorner1 ? `Click terrain to set the second corner` : `Click terrain to place the first corner`)}
              {activeTool === "draw-border" && (borderDrawMode === 'drawing' ? `${borderVertices.length} points — Click to add more, Enter to finish` : `Click to draw ${borderLabel.toLowerCase()} borders. Enter to finish.`)}
              {activeTool === "draw-lot" && (lotCorner1 ? `Click to set second corner` : "Click two corners to define a rectangular lot")}
              {activeTool === "draw-road" && (roadDrawMode === 'drawing' ? `${roadWaypoints.length} waypoints — Click to add, Enter to finish` : "Click to place waypoints. Enter to finish.")}
              {activeTool === "place-wall" && (wallStartPoint ? "Click to set wall end point" : "Click to start wall, click again to end")}
              {activeTool === "place-door" && "Click on a wall to place a door"}
              {activeTool === "paint-floor" && `Paint floor: ${floorMaterial}`}
              {activeTool === "place-furniture" && (selectedFurnitureType ? `Place: ${selectedFurnitureType}` : "Select furniture from the panel →")}
            </span>
            {cameraMode === 'first-person' && (
              <span className="text-amber-300">· FP Mode</span>
            )}
          </div>

          {/* Status bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900/80 text-[10px] text-gray-400 px-3 py-1 flex items-center gap-4 pointer-events-none">
            <span>{fps} FPS</span>
            {cursorGridPos && (
              <span>Grid: ({cursorGridPos.x}, {cursorGridPos.z})</span>
            )}
            {cameraMode === 'first-person' && cameraPosRef.current && (
              <span>Pos: ({cameraPosRef.current[0].toFixed(0)}, {cameraPosRef.current[1].toFixed(0)}, {cameraPosRef.current[2].toFixed(0)})</span>
            )}
            <span>Sea level: {Math.round(world.terrain.seaLevel * 100)}%</span>
            <span>{world.objects.length} objects</span>
            {undoStack.length > 0 && (
              <span className="text-gray-500">{undoStack.length} undo</span>
            )}
          </div>

          {/* Playtest stop overlay */}
          {isPlaytesting && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-600/50">
              <button
                onClick={handleStopPlaytest}
                className="h-7 px-3 flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
              >
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
              <span className="text-[11px] text-gray-400">Press ESC to exit</span>
            </div>
          )}

        </div>{/* end viewport */}

        {/* Right dock */}
        {!isPlaytesting && hasVisibleRight && (
          <>
            <DockResizeHandle side="right" currentWidth={rightDockWidth} onWidthChange={setRightDockWidth} />
            <DockColumn side="right" width={rightDockWidth}>

          {/* ── Explorer Panel (scene tree) ── */}
          <DockPanel id="explorer" title="Explorer" icon={<Globe className="w-3.5 h-3.5 text-sky-400" />}>
            <ExplorerTree
              objects={world.objects}
              childRegions={childRegions}
              childLevel={getChildLevel(currentLevel)}
              currentLevel={currentLevel}
              selectedObjectIds={selectedObjectIds}
              polygonBorders={currentNode?.polygonBorders}
              onSelectObject={(id, additive) => {
                if (additive) addToSelection(id)
                else selectObject(id)
              }}
              onDeleteObject={(ids) => {
                if (!world) return
                const updatedObjects = world.objects.filter((obj) => !ids.includes(obj.id))
                setWorld({ ...world, objects: updatedObjects, updatedAt: new Date() })
                const currentSel = useWorldBuilderStore.getState().selectedObjectIds
                const newSel = currentSel.filter((id) => !ids.includes(id))
                if (newSel.length !== currentSel.length) useWorldBuilderStore.getState().setSelection(newSel)
                setHasUnsavedChanges(true)
              }}
              onEnterRegion={handleEnterNode}
              onDeleteBorder={handleDeleteBorder}
              onDrawBorder={() => setActiveTool('draw-border')}
            />
          </DockPanel>

          {/* ── Properties Panel ── */}
          <DockPanel id="properties" title="Properties" icon={<MousePointer className="w-3.5 h-3.5 text-sky-400" />}>

          {/* Selected object properties — always visible when something is selected */}
          {selectedObj && (
            <div className="p-3 space-y-2.5 border-b border-gray-700/50">
              {/* Type & Name */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Type</label>
                <span className="text-xs text-gray-200">
                  {OBJECT_CATALOG[selectedObj.type]?.name ?? selectedObj.type}
                </span>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Name</label>
                <input
                  type="text"
                  value={selectedObj.name ?? ''}
                  placeholder={OBJECT_CATALOG[selectedObj.type]?.name ?? 'Unnamed'}
                  onChange={(e) => handleObjectUpdate(selectedObj.id, { name: e.target.value || undefined })}
                  className="w-full bg-gray-800 text-[10px] border border-gray-700 rounded px-1.5 py-1 text-gray-200"
                />
              </div>

              {/* Position */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Position</label>
                <div className="flex gap-1">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex-1">
                      <label className="text-[8px] text-gray-600 block text-center">{axis}</label>
                      <input
                        type="number"
                        step={0.5}
                        value={Number(selectedObj.position[i].toFixed(1))}
                        onChange={(e) => {
                          const newPos = [...selectedObj.position] as [number, number, number]
                          newPos[i] = Number(e.target.value) || 0
                          handleObjectUpdate(selectedObj.id, { position: newPos })
                        }}
                        className="w-full bg-gray-800 text-[10px] border border-gray-700 rounded px-1 py-0.5 text-center text-gray-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Rotation (deg)</label>
                <div className="flex gap-1">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex-1">
                      <label className="text-[8px] text-gray-600 block text-center">{axis}</label>
                      <input
                        type="number"
                        step={5}
                        value={Math.round(selectedObj.rotation[i] * 180 / Math.PI)}
                        onChange={(e) => {
                          const newRot = [...selectedObj.rotation] as [number, number, number]
                          newRot[i] = (Number(e.target.value) || 0) * Math.PI / 180
                          handleObjectUpdate(selectedObj.id, { rotation: newRot })
                        }}
                        className="w-full bg-gray-800 text-[10px] border border-gray-700 rounded px-1 py-0.5 text-center text-gray-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Scale */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Scale</label>
                <div className="flex gap-1">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex-1">
                      <label className="text-[8px] text-gray-600 block text-center">{axis}</label>
                      <input
                        type="number"
                        step={0.1}
                        min={0.01}
                        value={Number(selectedObj.scale[i].toFixed(2))}
                        onChange={(e) => {
                          const newScale = [...selectedObj.scale] as [number, number, number]
                          newScale[i] = Math.max(0.01, Number(e.target.value) || 1)
                          handleObjectUpdate(selectedObj.id, { scale: newScale })
                        }}
                        className="w-full bg-gray-800 text-[10px] border border-gray-700 rounded px-1 py-0.5 text-center text-gray-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedObj.color}
                    onChange={(e) => handleObjectColorChange(selectedObj.id, e.target.value)}
                    className="w-8 h-6 rounded border border-gray-600 cursor-pointer bg-transparent"
                  />
                  <span className="text-[10px] text-gray-400 font-mono">{selectedObj.color}</span>
                </div>
              </div>

              {/* Lock & Visibility */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleObjectUpdate(selectedObj.id, { locked: !selectedObj.locked })}
                  className={`flex-1 py-1 text-[10px] rounded border flex items-center justify-center gap-1 ${
                    selectedObj.locked
                      ? 'border-amber-600 bg-amber-900/30 text-amber-300'
                      : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {selectedObj.locked ? <Lock className="w-3 h-3" /> : <UnlockIcon className="w-3 h-3" />}
                  {selectedObj.locked ? 'Locked' : 'Lock'}
                </button>
                <button
                  onClick={() => handleObjectUpdate(selectedObj.id, { visible: !selectedObj.visible })}
                  className={`flex-1 py-1 text-[10px] rounded border flex items-center justify-center gap-1 ${
                    !selectedObj.visible
                      ? 'border-gray-600 bg-gray-800 text-gray-500'
                      : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {selectedObj.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {selectedObj.visible ? 'Visible' : 'Hidden'}
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  onClick={handleDuplicateSelected}
                  className="flex-1 py-1.5 text-[10px] rounded border border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center justify-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Duplicate
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="flex-1 py-1.5 text-[10px] rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          )}
          {!selectedObj && selectedObjectIds.length > 1 && (
            <div className="p-3 border-b border-gray-700/50 space-y-2">
              <p className="text-[10px] text-gray-400">
                {selectedObjectIds.length} objects selected
              </p>
              <div className="flex gap-1">
                <button
                  onClick={handleDuplicateSelected}
                  className="flex-1 py-1.5 text-[10px] rounded border border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center justify-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Duplicate
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="flex-1 py-1.5 text-[10px] rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          )}

          {/* Camera settings (first-person mode) */}
          {cameraMode === 'first-person' && (
            <div className="p-3 space-y-3 border-b border-gray-700/50">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-amber-400" /> Camera
              </h3>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Mode</label>
                <div className="flex gap-1">
                  {(['walk', 'fly'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFirstPersonSubMode(mode)}
                      className={`flex-1 py-1 text-[10px] rounded border ${
                        firstPersonSubMode === mode
                          ? 'border-amber-500 bg-amber-900/40 text-amber-300'
                          : 'border-gray-700 text-gray-400'
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 flex justify-between">
                  <span>Speed</span><span>{firstPersonSpeed.toFixed(1)}x</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={Math.round(firstPersonSpeed * 10)}
                  onChange={(e) => setFirstPersonSpeed(Number(e.target.value) / 10)}
                  className="w-full h-1 mt-1"
                />
              </div>
            </div>
          )}

          {/* Sculpt settings */}
          {activeTool === 'sculpt' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Mountain className="w-3.5 h-3.5" /> Sculpt Brush
              </h3>
              <div className="grid grid-cols-2 gap-1">
                {sculptBrushTypes.map((b) => (
                  <button
                    key={b.type}
                    onClick={() => setSculptBrushType(b.type)}
                    className={`py-1.5 text-[10px] rounded border transition-colors ${
                      sculptBrush.type === b.type
                        ? 'border-sky-500 bg-sky-900/40 text-sky-300'
                        : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[10px] text-gray-500 flex justify-between">
                  <span>Size</span><span>{sculptBrush.size}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={64}
                  value={sculptBrush.size}
                  onChange={(e) => setSculptBrushSize(Number(e.target.value))}
                  className="w-full h-1 mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 flex justify-between">
                  <span>Strength</span><span>{Math.round(sculptBrush.strength * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(sculptBrush.strength * 100)}
                  onChange={(e) => setSculptBrushStrength(Number(e.target.value) / 100)}
                  className="w-full h-1 mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Falloff</label>
                <div className="flex gap-1">
                  {(['linear', 'smooth', 'constant'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setSculptBrushFalloff(f)}
                      className={`flex-1 py-1 text-[10px] rounded border ${
                        sculptBrush.falloff === f
                          ? 'border-sky-500 bg-sky-900/40 text-sky-300'
                          : 'border-gray-700 text-gray-400'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                // Derive land height and ocean depth from maxHeight + seaLevel
                const oceanDepth = Math.round(world.terrain.seaLevel * world.terrain.maxHeight)
                const landHeight = Math.round((1 - world.terrain.seaLevel) * world.terrain.maxHeight)

                const updateHeights = (newLand: number, newOcean: number) => {
                  const total = newLand + newOcean
                  const newSeaLevel = total > 0 ? newOcean / total : 0
                  const newTerrain = { ...world.terrain, maxHeight: total, seaLevel: newSeaLevel }
                  setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
                  setHasUnsavedChanges(true)
                }

                return (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500 flex justify-between">
                        <span>Land Height</span><span>{landHeight}</span>
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={2000}
                        step={10}
                        value={landHeight}
                        onChange={(e) => updateHeights(Number(e.target.value), oceanDepth)}
                        className="w-full h-1 mt-1"
                      />
                      <div className="flex gap-1 mt-1">
                        {[50, 100, 300, 500, 1000].map((v) => (
                          <button
                            key={v}
                            onClick={() => updateHeights(v, oceanDepth)}
                            className={`flex-1 py-0.5 text-[9px] rounded border ${
                              landHeight === v
                                ? 'border-sky-500 bg-sky-900/40 text-sky-300'
                                : 'border-gray-700 text-gray-500 hover:bg-gray-800'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 flex justify-between">
                        <span>Ocean Depth</span><span>{oceanDepth}</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1000}
                        step={10}
                        value={oceanDepth}
                        onChange={(e) => updateHeights(landHeight, Number(e.target.value))}
                        className="w-full h-1 mt-1"
                      />
                      <div className="flex gap-1 mt-1">
                        {[0, 20, 50, 100, 300].map((v) => (
                          <button
                            key={v}
                            onClick={() => updateHeights(landHeight, v)}
                            className={`flex-1 py-0.5 text-[9px] rounded border ${
                              oceanDepth === v
                                ? 'border-sky-500 bg-sky-900/40 text-sky-300'
                                : 'border-gray-700 text-gray-500 hover:bg-gray-800'
                            }`}
                          >
                            {v === 0 ? 'None' : v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )
              })()}
              {/* Terrain stats */}
              <div className="pt-2 border-t border-gray-800">
                <label className="text-[10px] text-gray-500 mb-1 block">Terrain Stats</label>
                {(() => {
                  const h = world.terrain.heights
                  let min = 1, max = 0, sum = 0, aboveWater = 0
                  for (let i = 0; i < h.length; i++) {
                    if (h[i] < min) min = h[i]
                    if (h[i] > max) max = h[i]
                    sum += h[i]
                    if (h[i] >= world.terrain.seaLevel) aboveWater++
                  }
                  const avg = sum / h.length
                  const landPct = Math.round((aboveWater / h.length) * 100)
                  return (
                    <div className="text-[9px] text-gray-600 space-y-0.5">
                      <div className="flex justify-between"><span>Min height</span><span>{(min * world.terrain.maxHeight).toFixed(0)}</span></div>
                      <div className="flex justify-between"><span>Max height</span><span>{(max * world.terrain.maxHeight).toFixed(0)}</span></div>
                      <div className="flex justify-between"><span>Avg height</span><span>{(avg * world.terrain.maxHeight).toFixed(0)}</span></div>
                      <div className="flex justify-between"><span>Land / Water</span><span>{landPct}% / {100 - landPct}%</span></div>
                      <div className="flex justify-between"><span>Vertices</span><span>{(world.terrain.size * world.terrain.sizeZ).toLocaleString()}</span></div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Material paint settings */}
          {activeTool === 'paint-material' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Paintbrush className="w-3.5 h-3.5" /> Material Paint
              </h3>
              <div>
                <label className="text-[10px] text-gray-500 flex justify-between">
                  <span>Brush Size</span><span>{materialBrush.size}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={64}
                  value={materialBrush.size}
                  onChange={(e) => setMaterialBrushSize(Number(e.target.value))}
                  className="w-full h-1 mt-1"
                />
              </div>
              <button
                onClick={() => {
                  if (!confirm("Auto-paint entire terrain based on height? This replaces all materials.")) return
                  applyMaterialBrush(world.terrain, 0, 0, { ...materialBrush, type: 'auto-paint' })
                  setWorld({ ...world, updatedAt: new Date() })
                  setHasUnsavedChanges(true)
                }}
                className="w-full py-1.5 text-[10px] rounded border border-sky-700 text-sky-300 hover:bg-sky-900/30"
              >
                Auto-Paint by Height
              </button>
              {[
                { label: 'Natural', materials: naturalMaterials },
                { label: 'Urban', materials: urbanMaterials },
                { label: 'Fantasy', materials: fantasyMaterials },
              ].map((group) => (
                <div key={group.label}>
                  <label className="text-[10px] text-gray-500 mb-1 block">{group.label}</label>
                  <div className="grid grid-cols-5 gap-1">
                    {group.materials.map((mat) => (
                      <button
                        key={mat.id}
                        onClick={() => setMaterialBrushMaterial(mat.id)}
                        className={`aspect-square rounded border-2 transition-all ${
                          materialBrush.materialId === mat.id
                            ? 'border-white scale-110'
                            : 'border-transparent hover:border-gray-500'
                        }`}
                        style={{
                          backgroundColor: `rgb(${Math.round(mat.color[0] * 255)}, ${Math.round(mat.color[1] * 255)}, ${Math.round(mat.color[2] * 255)})`,
                        }}
                        title={mat.name}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete tool */}
          {activeTool === 'delete' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </h3>
              <p className="text-[10px] text-gray-500">
                Click objects to select them, then press <kbd className="bg-gray-800 px-1 rounded text-gray-300">Delete</kbd> to remove.
              </p>
              {selectedObjectIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="w-full py-1.5 text-[10px] rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete {selectedObjectIds.length} selected
                </button>
              )}
            </div>
          )}

          {/* Cartography panel */}
          {activeTool === 'cartography' && (
            <CartographyPanel
              activeBiome={cartographyBiome}
              brushSize={cartographyBrushSize}
              settings={cartographySettings}
              onBiomeChange={setCartographyBiome}
              onBrushSizeChange={setCartographyBrushSize}
              onSettingsChange={setCartographySettings}
              onGenerate={handleGenerateTerrain}
              onClear={handleCartographyClear}
              onFillAll={handleCartographyFillAll}
            />
          )}

          {/* ── Border / Region Drawing Panel ────────────────────── */}
          {activeTool === 'draw-border' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Pentagon className="w-3.5 h-3.5" /> Draw {borderLabel}
              </h3>
              <p className="text-[10px] text-gray-500">
                Click to draw the border. Press Enter or double-click to finish.
                {getChildLevel(currentLevel) && ` This creates a ${getChildLevel(currentLevel)} you can enter.`}
              </p>

              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Border Color</label>
                <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} className="w-full h-6 rounded border border-gray-700 bg-gray-800 cursor-pointer" />
              </div>

              {borderVertices.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400">{borderVertices.length} points placed</p>
                  <div className="flex gap-1">
                    <button onClick={handleFinishBorder} disabled={borderVertices.length < 3} className="flex-1 py-1.5 text-[10px] rounded bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50">
                      Finish
                    </button>
                    <button onClick={clearBorderVertices} className="flex-1 py-1.5 text-[10px] rounded border border-gray-700 text-gray-400 hover:bg-gray-800">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Lot Drawing Panel ───────────────────────── */}
          {activeTool === 'draw-lot' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5" /> Draw Lot
              </h3>
              <p className="text-[10px] text-gray-500">{lotCorner1 ? `Click to set second corner` : `Click two corners to define a rectangular lot`}</p>

              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Zoning</label>
                <div className="grid grid-cols-2 gap-1">
                  {(['residential', 'commercial', 'industrial', 'park', 'special'] as LotZoning[]).map(z => (
                    <button key={z} onClick={() => setLotZoning(z)} className={`py-1.5 text-[10px] rounded border flex items-center gap-1 justify-center ${lotZoning === z ? 'border-sky-500 bg-sky-900/40 text-sky-300' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                      <span className="w-2 h-2 rounded" style={{ backgroundColor: LOT_ZONING_COLORS[z] }} />
                      {z}
                    </button>
                  ))}
                </div>
              </div>

              {/* Existing lots list */}
              {currentNode?.lots && currentNode.lots.length > 0 && (
                <div className="border-t border-gray-800 pt-2">
                  <label className="text-[10px] text-gray-500 mb-1 block">Existing Lots</label>
                  <ul className="space-y-1">
                    {currentNode.lots.map(lot => (
                      <li key={lot.id} className="flex items-center justify-between p-1.5 rounded bg-gray-800/50 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded" style={{ backgroundColor: LOT_ZONING_COLORS[lot.zoning] }} />
                          <span className="text-gray-300 truncate max-w-[80px]">{lot.name}</span>
                          <span className="text-gray-600">{lot.zoning}</span>
                        </div>
                        <button onClick={() => handleDeleteLot(lot.id)} className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Road Drawing Panel ──────────────────────── */}
          {activeTool === 'draw-road' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Route className="w-3.5 h-3.5" /> Draw Road
              </h3>
              <p className="text-[10px] text-gray-500">Click to place waypoints. Enter to finish.</p>

              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Road Type</label>
                <div className="grid grid-cols-2 gap-1">
                  {(['highway', 'main', 'street', 'alley', 'footpath'] as RoadType[]).map(rt => (
                    <button key={rt} onClick={() => setRoadType(rt)} className={`py-1.5 text-[10px] rounded border ${roadType === rt ? 'border-sky-500 bg-sky-900/40 text-sky-300' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                      {rt}
                    </button>
                  ))}
                </div>
              </div>

              {roadType && ROAD_TYPE_DEFAULTS[roadType] && (
                <div className="text-[9px] text-gray-600 space-y-0.5">
                  <div>Width: {ROAD_TYPE_DEFAULTS[roadType].width}m · Lanes: {ROAD_TYPE_DEFAULTS[roadType].lanes}</div>
                  <div>Sidewalk: {ROAD_TYPE_DEFAULTS[roadType].hasSidewalk ? `${ROAD_TYPE_DEFAULTS[roadType].sidewalkWidth}m` : 'none'}</div>
                </div>
              )}

              {roadWaypoints.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400">{roadWaypoints.length} waypoints</p>
                  <div className="flex gap-1">
                    <button onClick={handleFinishRoad} disabled={roadWaypoints.length < 2} className="flex-1 py-1.5 text-[10px] rounded bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50">
                      Finish Road
                    </button>
                    <button onClick={clearRoadWaypoints} className="flex-1 py-1.5 text-[10px] rounded border border-gray-700 text-gray-400 hover:bg-gray-800">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing roads list */}
              {currentNode?.roadNetwork?.segments && currentNode.roadNetwork.segments.length > 0 && (
                <div className="border-t border-gray-800 pt-2">
                  <label className="text-[10px] text-gray-500 mb-1 block">Roads</label>
                  <ul className="space-y-1">
                    {currentNode.roadNetwork.segments.map(seg => (
                      <li key={seg.id} className="flex items-center justify-between p-1.5 rounded bg-gray-800/50 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <Route className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-300">{seg.name || seg.type}</span>
                          <span className="text-gray-600">{seg.waypoints.length}pts</span>
                        </div>
                        <button onClick={() => handleDeleteRoad(seg.id)} className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Intersections list */}
              {currentNode?.roadNetwork?.intersections && currentNode.roadNetwork.intersections.length > 0 && (
                <div className="border-t border-gray-800 pt-2">
                  <label className="text-[10px] text-gray-500 mb-1 block">Intersections</label>
                  <ul className="space-y-1">
                    {currentNode.roadNetwork.intersections.map(ix => (
                      <li key={ix.id} className="p-1.5 rounded bg-gray-800/50 text-[10px] text-gray-400">
                        {ix.type} · {ix.connectedSegmentIds.length} roads
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Place Wall Panel ─────────────────────────── */}
          {activeTool === 'place-wall' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Square className="w-3.5 h-3.5" /> Place Wall
              </h3>
              <p className="text-[10px] text-gray-500">{wallStartPoint ? 'Click to set end point' : 'Click to start wall, click again to end'}</p>

              <div>
                <label className="text-[10px] text-gray-500 flex justify-between"><span>Height</span><span>{wallHeight}m</span></label>
                <input type="range" min={2} max={5} step={0.5} value={wallHeight} onChange={e => setWallHeight(Number(e.target.value))} className="w-full h-1 mt-1" />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Material</label>
                <div className="grid grid-cols-3 gap-1">
                  {['drywall', 'brick', 'stone', 'glass', 'wood', 'concrete'].map(m => (
                    <button key={m} onClick={() => setWallMat(m)} className={`py-1 text-[9px] rounded border ${wallMat === m ? 'border-sky-500 bg-sky-900/40 text-sky-300' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Place Door/Window Panel ──────────────────── */}
          {activeTool === 'place-door' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <DoorOpen className="w-3.5 h-3.5" /> Place Opening
              </h3>
              <p className="text-[10px] text-gray-500">Click on a wall to place a door</p>
              <div className="text-[9px] text-gray-600">
                <div>Door: 0.9m wide × 2.1m tall</div>
              </div>
            </div>
          )}

          {/* ── Paint Floor Panel ────────────────────────── */}
          {activeTool === 'paint-floor' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <PaintBucket className="w-3.5 h-3.5" /> Paint Floor
              </h3>
              <p className="text-[10px] text-gray-500">Click/drag to paint floor tiles</p>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Material</label>
                <div className="grid grid-cols-3 gap-1">
                  {['wood', 'tile', 'carpet', 'marble', 'concrete', 'stone'].map(m => (
                    <button key={m} onClick={() => setFloorMaterial(m)} className={`py-1 text-[9px] rounded border ${floorMaterial === m ? 'border-sky-500 bg-sky-900/40 text-sky-300' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Furniture Panel ──────────────────────────── */}
          {activeTool === 'place-furniture' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Armchair className="w-3.5 h-3.5" /> Place Furniture
              </h3>
              <p className="text-[10px] text-gray-500">Select item and click to place</p>

              <div className="flex gap-0.5 flex-wrap">
                {FURNITURE_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setFurnitureCategory(cat.id)} className={`px-2 py-0.5 text-[9px] rounded ${furnitureCategory === cat.id ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                {getFurnitureByCategory(furnitureCategory).map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedFurnitureType(item.id)}
                    className={`py-1.5 text-[9px] rounded border text-center ${selectedFurnitureType === item.id ? 'border-sky-500 bg-sky-900/40 text-sky-300' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls reference */}
          <div className="p-3 border-t border-gray-800">
            <h4 className="text-[10px] font-medium text-gray-500 mb-1">Controls</h4>
            {cameraMode === 'first-person' ? (
              <ul className="text-[9px] text-gray-600 space-y-0.5">
                <li>WASD — Move</li>
                <li>Right-drag — Look around</li>
                <li>Shift — Toggle cursor lock</li>
                <li>Ctrl — Sprint (2x speed)</li>
                <li>Space — Jump (walk) / Up (fly)</li>
                <li>Q — Descend (fly mode)</li>
                <li>Double Space — Toggle fly/walk</li>
                <li>[ / ] — Brush size</li>
                <li>Ctrl+Z / Y — Undo / Redo</li>
                <li>Click — Use tool</li>
                <li>ESC — Unlock cursor</li>
                <li>F — Exit first-person</li>
              </ul>
            ) : (
              <ul className="text-[9px] text-gray-600 space-y-0.5">
                <li>MMB drag — Orbit camera</li>
                <li>RMB drag — Pan</li>
                <li>Scroll — Zoom</li>
                <li>V/B/P/O/M/X — Switch tools</li>
                <li>[ / ] — Brush size</li>
                <li>Ctrl+Z / Y — Undo / Redo</li>
                <li>Ctrl+D — Duplicate objects</li>
                <li>Ctrl+S — Save</li>
                <li>F — First-person camera</li>
                <li>Delete — Remove selected objects</li>
              </ul>
            )}
          </div>
          </DockPanel>

            </DockColumn>
          </>
        )}

      </div>{/* end main flex */}

      {/* Border Name Dialog */}
      <Dialog open={showBorderNameDialog} onOpenChange={setShowBorderNameDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {getChildLevel(currentLevel) ? `New ${getChildLevel(currentLevel) === 'country' ? 'Country' : getChildLevel(currentLevel) === 'city' ? 'City' : 'Building'}` : 'Name Border'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {getChildLevel(currentLevel)
                ? `This border will create a ${getChildLevel(currentLevel)} you can enter and edit.`
                : 'Enter a name for this border.'}
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={newBorderName}
            onChange={e => setNewBorderName(e.target.value)}
            placeholder={getChildLevel(currentLevel) === 'country' ? 'Country name...' : getChildLevel(currentLevel) === 'city' ? 'City name...' : 'Name...'}
            className="bg-gray-800 text-sm border border-gray-700 rounded px-3 py-2 w-full text-white"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleConfirmBorder() }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBorderNameDialog(false); clearBorderVertices() }} className="border-gray-600 text-gray-300">Cancel</Button>
            <Button onClick={handleConfirmBorder} className="bg-sky-600 hover:bg-sky-500 text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scale Map Dialog */}
      <Dialog open={showScaleDialog} onOpenChange={setShowScaleDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Scale Map</DialogTitle>
            <DialogDescription className="text-gray-400">
              Resize your world&apos;s dimensions. This scales terrain height, cell size, and object positions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Uniform toggle */}
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <button
                onClick={() => {
                  setScaleUniform(!scaleUniform)
                  if (!scaleUniform) setScaleHorizontal(scaleVertical)
                }}
                className={`w-5 h-5 rounded border flex items-center justify-center ${
                  scaleUniform ? 'border-sky-500 bg-sky-900/60' : 'border-gray-600 bg-gray-800'
                }`}
              >
                {scaleUniform ? <Link className="w-3 h-3 text-sky-300" /> : <Unlink className="w-3 h-3 text-gray-500" />}
              </button>
              Lock axes (uniform scale)
            </label>

            {/* Vertical scale */}
            <div>
              <label className="text-[10px] text-gray-500 flex justify-between">
                <span>Vertical Scale</span>
                <span>{scaleVertical.toFixed(2)}x → maxHeight {Math.round(world.terrain.maxHeight * scaleVertical)}</span>
              </label>
              <input
                type="range"
                min={10}
                max={400}
                value={Math.round(scaleVertical * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100
                  setScaleVertical(v)
                  if (scaleUniform) setScaleHorizontal(v)
                }}
                className="w-full h-1 mt-1"
              />
            </div>

            {/* Horizontal scale */}
            <div className={scaleUniform ? 'opacity-40 pointer-events-none' : ''}>
              <label className="text-[10px] text-gray-500 flex justify-between">
                <span>Horizontal Scale</span>
                <span>{scaleHorizontal.toFixed(2)}x → cellSize {(world.terrain.cellSize * scaleHorizontal).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={10}
                max={400}
                value={Math.round(scaleHorizontal * 100)}
                onChange={(e) => setScaleHorizontal(Number(e.target.value) / 100)}
                className="w-full h-1 mt-1"
              />
            </div>

            {/* Quick presets */}
            <div className="flex gap-1">
              {[0.25, 0.5, 1, 2, 4].map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setScaleVertical(v)
                    if (scaleUniform) setScaleHorizontal(v)
                  }}
                  className={`flex-1 py-1 text-[10px] rounded border ${
                    scaleVertical === v
                      ? 'border-sky-500 bg-sky-900/40 text-sky-300'
                      : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {v}x
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="bg-gray-800 rounded p-3 text-[10px] text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Max Height</span>
                <span className="text-gray-200">{world.terrain.maxHeight} → {Math.round(world.terrain.maxHeight * (scaleUniform ? scaleVertical : scaleVertical))}</span>
              </div>
              <div className="flex justify-between">
                <span>Cell Size</span>
                <span className="text-gray-200">{world.terrain.cellSize} → {(world.terrain.cellSize * (scaleUniform ? scaleVertical : scaleHorizontal)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>World Span</span>
                <span className="text-gray-200">
                  {world.terrain.size * world.terrain.cellSize} → {(world.terrain.size * world.terrain.cellSize * (scaleUniform ? scaleVertical : scaleHorizontal)).toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowScaleDialog(false)} className="border-gray-700 text-gray-300">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleScaleMap}
              disabled={scaleVertical === 1.0 && scaleHorizontal === 1.0}
            >
              Apply Scale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Location Dialog */}
      <Dialog open={showSaveLocationDialog} onOpenChange={setShowSaveLocationDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-400" />
              Save Location
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Save the current camera position as a location bookmark. Locations can be used as backdrops in scenes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Location Name</label>
              <input
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="e.g., Mountain Peak, Forest Clearing..."
                className="w-full bg-gray-800 text-sm border border-gray-700 rounded px-3 py-2 text-gray-200 placeholder:text-gray-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newLocationName.trim()) {
                    handleSaveLocation()
                  }
                }}
              />
            </div>

            {cameraPosRef.current && (
              <div className="bg-gray-800 rounded p-3 text-[10px] text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Position</span>
                  <span className="text-gray-200">
                    ({cameraPosRef.current[0].toFixed(1)}, {cameraPosRef.current[1].toFixed(1)}, {cameraPosRef.current[2].toFixed(1)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Direction</span>
                  <span className="text-gray-200">{Math.round(cameraYawRef.current * 180 / Math.PI)}°</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSaveLocationDialog(false)} className="border-gray-700 text-gray-300">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveLocation}
              disabled={!newLocationName.trim()}
            >
              Save Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Region Definition Dialog */}
      <Dialog open={showRegionDialog} onOpenChange={setShowRegionDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>New {activeNode ? (getChildLevel(activeNode.level) === 'country' ? 'Country' : getChildLevel(activeNode.level) === 'city' ? 'City' : 'Building') : 'Region'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Name your new {activeNode ? getChildLevel(activeNode.level) : 'region'}. You can enter it to edit at higher detail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Name</label>
              <input
                type="text"
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder={`My ${activeNode ? (getChildLevel(activeNode.level) === 'country' ? 'Country' : getChildLevel(activeNode.level) === 'city' ? 'City' : 'Building') : 'Region'}`}
                className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowRegionDialog(false); setRegionBounds(null); setRegionName("") }}
              className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateRegion}
              disabled={!regionName.trim() || !regionBounds}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
