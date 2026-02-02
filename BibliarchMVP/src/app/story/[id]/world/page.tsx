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
  terrainIndex,
  isInBounds,
  serializeWorld,
  deserializeWorld,
  World,
  WorldObject,
  SerializedWorld,
  CartographyGenerationSettings,
} from "@/types/world"
import { TERRAIN_MATERIALS, getMaterialsByCategory } from "@/lib/terrain/materials"
import { OBJECT_CATALOG, getCatalogByCategory } from "@/lib/terrain/objectCatalog"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
import MiniMap from "@/components/world/MiniMap"
import CartographyEditor from "@/components/world/CartographyEditor"
import CartographyPanel from "@/components/world/CartographyPanel"
import {
  createCartographyGrid,
  generateTerrainFromCartography,
  cartographyGridFromHeights,
  biomeFromIndex,
  indexFromBiome,
  BIOME_LABELS,
} from "@/lib/terrain/cartography"
import { loadHeightmapFromFile } from "@/lib/terrain/heightmapLoader"
import { idbGet, idbSet } from "@/services/worldStorage"
import type { WorldViewport3DProps } from "@/components/world/WorldViewport3D"

// Dynamic import for Three.js component
const WorldViewport3D = dynamic<WorldViewport3DProps>(
  () => import("@/components/world/WorldViewport3D"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-sky-200 to-green-200 dark:from-gray-800 dark:to-gray-700">
        <div className="text-center">
          <Globe className="w-12 h-12 text-gray-400 animate-pulse mx-auto mb-3" />
          <p className="text-gray-500">Loading 3D World...</p>
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

// ── Main Page Component ──────────────────────────────────────

export default function WorldPage() {
  const params = useParams()
  const storyId = params.id as string

  // World data
  const [world, setWorld] = useState<World | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editorPhase, setEditorPhase] = useState<'setup' | 'cartography' | 'editor'>('setup')
  const terrainRef = useRef<TerrainData | null>(null)

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

    const applyWorld = (w: World) => {
      setWorld(w)
      terrainRef.current = w.terrain
      initCartography(w)
      // If terrain has any non-zero heights, go straight to editor
      const hasExistingTerrain = w.terrain.heights.some((h: number) => h > 0)
      setEditorPhase(hasExistingTerrain ? 'editor' : 'setup')
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
      try {
        // Try IndexedDB first
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
  }, [storyId, buildCartographyData])

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

  // Sculpt callback
  const handleTerrainSculpt = useCallback((cx: number, cz: number, brush: BrushSettings) => {
    if (!world) return
    applySculptBrush(world.terrain, cx, cz, brush)
    setWorld({ ...world, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // Paint callback
  const handleTerrainPaint = useCallback((cx: number, cz: number, brush: MaterialBrushSettings) => {
    if (!world) return
    applyMaterialBrush(world.terrain, cx, cz, brush)
    setWorld({ ...world, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // After a stroke ends
  const handleTerrainChanged = useCallback(() => {
    setHasUnsavedChanges(true)
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
    if (!confirm("Reset terrain to flat? This cannot be undone.")) return
    const newTerrain = createTerrain(world.terrain.size, world.terrain.sizeZ)
    setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // Level ground: flatten above-water terrain to just above sea level, leave underwater untouched
  const handleFlattenToGround = useCallback(() => {
    if (!world) return
    if (!confirm("Flatten all above-water terrain to just above sea level? Underwater cells are untouched. This cannot be undone.")) return
    const { heights, seaLevel } = world.terrain

    // Target: sea level + small offset (0.01 normalized ≈ 1% of height range)
    const target = Math.min(1, seaLevel + 0.01)
    const newHeights = new Float32Array(heights)
    for (let i = 0; i < newHeights.length; i++) {
      if (newHeights[i] >= seaLevel) {
        newHeights[i] = target
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

  // ── Object CRUD ────────────────────────────────────────────

  const handleObjectPlace = useCallback((worldPos: [number, number, number]) => {
    if (!world) return
    const objType = useWorldBuilderStore.getState().selectedObjectType
    if (!objType) return
    const entry = OBJECT_CATALOG[objType]
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      // Don't capture during setup phase
      if (editorPhase === 'setup') return

      // Don't capture tool shortcuts when in first-person mode (WASD conflicts)
      if (cameraMode === 'first-person') {
        switch (e.key.toLowerCase()) {
          case 'f': setCameraMode('orbit'); break
        }
        return
      }

      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break
        case 'b': setActiveTool('sculpt'); break
        case 'p': setActiveTool('paint-material'); break
        case 'o': setActiveTool('place-object'); break
        case 'm': setActiveTool('cartography'); break
        case 'x': setActiveTool('delete'); break
        case 'f': setCameraMode(cameraMode === 'orbit' ? 'first-person' : 'orbit'); break
        case 'delete':
        case 'backspace':
          handleDeleteSelected()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveTool, handleDeleteSelected, editorPhase, cameraMode, setCameraMode])

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

  // Tool definitions
  const tools: { id: EditorTool; label: string; icon: React.ElementType; shortcut?: string }[] = [
    { id: "select", label: "Select", icon: MousePointer, shortcut: "V" },
    { id: "sculpt", label: "Sculpt", icon: Mountain, shortcut: "B" },
    { id: "paint-material", label: "Paint", icon: Paintbrush, shortcut: "P" },
    { id: "place-object", label: "Objects", icon: Package, shortcut: "O" },
    { id: "cartography", label: "Map", icon: MapIcon, shortcut: "M" },
    { id: "delete", label: "Delete", icon: Trash2, shortcut: "X" },
  ]

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

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Top Bar */}
      <header className="border-b border-gray-700 bg-gray-900 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-sky-400" />
          <h1 className="text-sm font-semibold">World Builder</h1>
          <span className="text-xs text-gray-500">
            {world.terrain.size}x{world.terrain.sizeZ}
          </span>
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-400">● Unsaved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={16}
              max={4096}
              className="bg-gray-800 text-xs border border-gray-700 rounded px-1.5 py-1 w-16 text-center"
              value={world.terrain.size}
              onChange={(e) => {
                const v = Math.max(16, Math.min(4096, Number(e.target.value) || 256))
                handleNewWorld(v, world.terrain.sizeZ)
              }}
            />
            <span className="text-xs text-gray-500">x</span>
            <input
              type="number"
              min={16}
              max={4096}
              className="bg-gray-800 text-xs border border-gray-700 rounded px-1.5 py-1 w-16 text-center"
              value={world.terrain.sizeZ}
              onChange={(e) => {
                const v = Math.max(16, Math.min(4096, Number(e.target.value) || 256))
                handleNewWorld(world.terrain.size, v)
              }}
            />
          </div>
          <input
            ref={heightmapInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleHeightmapUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => heightmapInputRef.current?.click()}
            className="text-xs h-7 border-gray-700"
          >
            <Upload className="w-3 h-3 mr-1" /> Heightmap
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetTerrain} className="text-xs h-7 border-gray-700">
            <RotateCcw className="w-3 h-3 mr-1" /> Flatten
          </Button>
          <Button variant="outline" size="sm" onClick={handleFlattenToGround} className="text-xs h-7 border-gray-700">
            <Minus className="w-3 h-3 mr-1" /> Level Ground
          </Button>
          <Button variant="outline" size="sm" onClick={handleSmoothCoastlines} className="text-xs h-7 border-gray-700">
            <Droplets className="w-3 h-3 mr-1" /> Smooth Coasts
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowScaleDialog(true); setScaleVertical(1.0); setScaleHorizontal(1.0); }} className="text-xs h-7 border-gray-700">
            <Scaling className="w-3 h-3 mr-1" /> Scale
          </Button>
          <Button variant="default" size="sm" onClick={handleSave} disabled={!hasUnsavedChanges} className="text-xs h-7">
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Tool Bar */}
        <div className="w-14 border-r border-gray-700 bg-gray-900 py-2 flex flex-col items-center gap-1 shrink-0">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg transition-colors ${
                activeTool === t.id
                  ? "bg-sky-600 text-white"
                  : "hover:bg-gray-800 text-gray-400"
              }`}
              title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
            >
              <t.icon className="w-4 h-4" />
              <span className="text-[9px] mt-0.5">{t.label}</span>
            </button>
          ))}

          {/* Camera mode toggle */}
          <div className="my-1 w-8 border-t border-gray-700" />
          <button
            onClick={() => setCameraMode(cameraMode === 'orbit' ? 'first-person' : 'orbit')}
            className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg transition-colors ${
              cameraMode === 'first-person'
                ? 'bg-amber-600 text-white'
                : 'hover:bg-gray-800 text-gray-400'
            }`}
            title={`${cameraMode === 'orbit' ? 'First-Person' : 'Orbit'} Camera (F)`}
          >
            {cameraMode === 'orbit' ? <User className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="text-[9px] mt-0.5">{cameraMode === 'orbit' ? 'FP' : 'Orbit'}</span>
          </button>

          <div className="flex-1" />

          {/* Viewport toggles */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg ${showGrid ? 'text-sky-400' : 'text-gray-600'}`}
            title="Toggle grid"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowWater(!showWater)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg ${showWater ? 'text-sky-400' : 'text-gray-600'}`}
            title="Toggle water"
          >
            <Waves className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg ${showMiniMap ? 'text-sky-400' : 'text-gray-600'}`}
            title="Toggle mini-map"
          >
            <MapIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="flex-1 relative">
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
            <span>Sea level: {Math.round(world.terrain.seaLevel * 100)}%</span>
            <span>{world.objects.length} objects</span>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-60 border-l border-gray-700 bg-gray-900 overflow-y-auto shrink-0">
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
              <div>
                <label className="text-[10px] text-gray-500 flex justify-between">
                  <span>Sea Level</span><span>{Math.round(world.terrain.seaLevel * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={Math.round(world.terrain.seaLevel * 100)}
                  onChange={(e) => {
                    world.terrain.seaLevel = Number(e.target.value) / 100
                    setWorld({ ...world, updatedAt: new Date() })
                    setHasUnsavedChanges(true)
                  }}
                  className="w-full h-1 mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 flex justify-between">
                  <span>Max Height</span><span>{world.terrain.maxHeight}</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={2000}
                  step={10}
                  value={world.terrain.maxHeight}
                  onChange={(e) => {
                    const newTerrain = { ...world.terrain, maxHeight: Number(e.target.value) }
                    setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
                    setHasUnsavedChanges(true)
                  }}
                  className="w-full h-1 mt-1"
                />
                <div className="flex gap-1 mt-1">
                  {[100, 200, 500, 1000, 2000].map((v) => (
                    <button
                      key={v}
                      onClick={() => {
                        const newTerrain = { ...world.terrain, maxHeight: v }
                        setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
                        setHasUnsavedChanges(true)
                      }}
                      className={`flex-1 py-0.5 text-[9px] rounded border ${
                        world.terrain.maxHeight === v
                          ? 'border-sky-500 bg-sky-900/40 text-sky-300'
                          : 'border-gray-700 text-gray-500 hover:bg-gray-800'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
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

          {/* Select tool — selected object info */}
          {activeTool === 'select' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <MousePointer className="w-3.5 h-3.5" /> Select
              </h3>
              {selectedObj ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Type</label>
                    <span className="text-xs text-gray-200">
                      {OBJECT_CATALOG[selectedObj.type]?.name ?? selectedObj.type}
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Position</label>
                    <span className="text-[10px] text-gray-300 font-mono">
                      ({selectedObj.position[0].toFixed(1)}, {selectedObj.position[1].toFixed(1)}, {selectedObj.position[2].toFixed(1)})
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Color</label>
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
                  <button
                    onClick={handleDeleteSelected}
                    className="w-full py-1.5 text-[10px] rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete Object
                  </button>
                </div>
              ) : selectedObjectIds.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-400">
                    {selectedObjectIds.length} objects selected
                  </p>
                  <button
                    onClick={handleDeleteSelected}
                    className="w-full py-1.5 text-[10px] rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete Selected
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500">
                  Click objects to select them. Shift+click to add to selection. Drag to move.
                </p>
              )}
            </div>
          )}

          {/* Place-object tool — object library grid */}
          {activeTool === 'place-object' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Package className="w-3.5 h-3.5" /> Object Library
              </h3>
              {[
                { label: 'Buildings', items: buildingObjects },
                { label: 'Decorations', items: decorationObjects },
              ].map((group) => (
                <div key={group.label}>
                  <label className="text-[10px] text-gray-500 mb-1 block">{group.label}</label>
                  <div className="grid grid-cols-2 gap-1">
                    {group.items.map((entry) => (
                      <button
                        key={entry.type}
                        onClick={() => setSelectedObjectType(
                          selectedObjectType === entry.type ? null : entry.type
                        )}
                        className={`py-2 px-1 text-[10px] rounded border transition-colors flex flex-col items-center gap-1 ${
                          selectedObjectType === entry.type
                            ? 'border-sky-500 bg-sky-900/40 text-sky-300'
                            : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: entry.defaultColor }}
                        />
                        <span>{entry.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {selectedObjectType && (
                <p className="text-[10px] text-gray-500 mt-2">
                  Click on terrain to place a {OBJECT_CATALOG[selectedObjectType]?.name ?? 'object'}.
                </p>
              )}
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

          {/* First-Person Camera settings */}
          {cameraMode === 'first-person' && (
            <div className="p-3 border-t border-gray-800 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-amber-400" /> First-Person Camera
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

          {/* Controls reference */}
          <div className="p-3 border-t border-gray-800 mt-auto">
            <h4 className="text-[10px] font-medium text-gray-500 mb-1">Controls</h4>
            {cameraMode === 'first-person' ? (
              <ul className="text-[9px] text-gray-600 space-y-0.5">
                <li>WASD — Move</li>
                <li>Mouse — Look around</li>
                <li>Ctrl — Sprint (2x speed)</li>
                <li>Space — Jump (walk) / Up (fly)</li>
                <li>Shift — Down (fly mode)</li>
                <li>Double Space — Toggle fly/walk</li>
                <li>Click — Use tool at crosshair</li>
                <li>ESC / F — Exit first-person</li>
              </ul>
            ) : (
              <ul className="text-[9px] text-gray-600 space-y-0.5">
                <li>MMB drag — Orbit camera</li>
                <li>RMB drag — Pan</li>
                <li>Scroll — Zoom</li>
                <li>V/B/P/O/M/X — Switch tools</li>
                <li>F — First-person camera</li>
                <li>Delete — Remove selected objects</li>
              </ul>
            )}
          </div>
        </div>
      </div>

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
    </div>
  )
}
