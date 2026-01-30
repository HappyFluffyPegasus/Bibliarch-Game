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
  Map,
  Save,
  RotateCcw,
  Grid3x3,
  Waves,
  Sprout,
  Eye,
  EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  TerrainData,
  TerrainMaterialId,
  EditorTool,
  BrushSettings,
  MaterialBrushSettings,
  TerrainSize,
  TERRAIN_SIZE_PRESETS,
  createTerrain,
  createWorld,
  terrainIndex,
  isInBounds,
  serializeWorld,
  deserializeWorld,
  World,
  SerializedWorld,
} from "@/types/world"
import { TERRAIN_MATERIALS, getMaterialsByCategory } from "@/lib/terrain/materials"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
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
      if (!isInBounds(gx, gz, terrain.size)) continue

      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > radius) continue

      // Falloff
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
              if (isInBounds(ngx, ngz, terrain.size)) {
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
          // Flatten to the height at the brush center
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
          // Find lowest neighbor and move material toward it
          let lowestH = terrain.heights[idx]
          let lowestIdx = idx
          for (let nz = -1; nz <= 1; nz++) {
            for (let nx = -1; nx <= 1; nx++) {
              if (nx === 0 && nz === 0) continue
              const ngx = gx + nx
              const ngz = gz + nz
              if (isInBounds(ngx, ngz, terrain.size)) {
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
            terrain.heights[lowestIdx] += transfer * 0.8 // 20% material loss
          }
          break
        }
      }
    }
  }
}

function applyMaterialBrush(terrain: TerrainData, cx: number, cz: number, brush: MaterialBrushSettings): void {
  if (brush.type === 'fill') {
    // Flood fill
    const targetMat = terrain.materials[terrainIndex(cx, cz, terrain.size)]
    if (targetMat === brush.materialId) return
    const stack: { x: number; z: number }[] = [{ x: cx, z: cz }]
    const visited = new Set<string>()
    while (stack.length > 0) {
      const { x, z } = stack.pop()!
      const key = `${x}_${z}`
      if (visited.has(key)) continue
      visited.add(key)
      if (!isInBounds(x, z, terrain.size)) continue
      const idx = terrainIndex(x, z, terrain.size)
      if (terrain.materials[idx] !== targetMat) continue
      terrain.materials[idx] = brush.materialId
      stack.push({ x: x + 1, z }, { x: x - 1, z }, { x, z: z + 1 }, { x, z: z - 1 })
    }
    return
  }

  if (brush.type === 'auto-paint') {
    // Auto-paint entire terrain by height
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

  // Paint brush
  const radius = brush.size
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const gx = cx + dx
      const gz = cz + dz
      if (!isInBounds(gx, gz, terrain.size)) continue
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
  const terrainRef = useRef<TerrainData | null>(null)

  // Editor store
  const activeTool = useWorldBuilderStore((s) => s.activeTool)
  const setActiveTool = useWorldBuilderStore((s) => s.setActiveTool)
  const sculptBrush = useWorldBuilderStore((s) => s.sculptBrush)
  const materialBrush = useWorldBuilderStore((s) => s.materialBrush)
  const showGrid = useWorldBuilderStore((s) => s.showGrid)
  const setShowGrid = useWorldBuilderStore((s) => s.setShowGrid)
  const showWater = useWorldBuilderStore((s) => s.showWater)
  const setShowWater = useWorldBuilderStore((s) => s.setShowWater)
  const showGrass = useWorldBuilderStore((s) => s.showGrass)
  const setShowGrass = useWorldBuilderStore((s) => s.setShowGrass)
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

  // Load world on mount
  useEffect(() => {
    const saved = localStorage.getItem(`bibliarch-world-${storyId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Detect old format: old worlds have { objects, terrain: { heights: number[][], size } }
        // New format has { id, storyId, terrain: { size, heights: number[], materials: number[] } }
        const isOldFormat = parsed.terrain && Array.isArray(parsed.terrain?.heights?.[0])
        if (isOldFormat) {
          // Old format - discard and create fresh
          console.log("Migrating from old world format, creating new world")
          const newWorld = createWorld(storyId, "My World", 256)
          setWorld(newWorld)
          terrainRef.current = newWorld.terrain
        } else {
          const loaded = deserializeWorld(parsed as SerializedWorld)
          setWorld(loaded)
          terrainRef.current = loaded.terrain
        }
      } catch (e) {
        console.error("Failed to load world:", e)
        const newWorld = createWorld(storyId, "My World", 256)
        setWorld(newWorld)
        terrainRef.current = newWorld.terrain
      }
    } else {
      const newWorld = createWorld(storyId, "My World", 256)
      setWorld(newWorld)
      terrainRef.current = newWorld.terrain
    }
  }, [storyId])

  // Auto-save
  useEffect(() => {
    if (!hasUnsavedChanges || !world) return
    const timeout = setTimeout(() => {
      const serialized = serializeWorld(world)
      localStorage.setItem(`bibliarch-world-${storyId}`, JSON.stringify(serialized))
      setHasUnsavedChanges(false)
    }, 2000)
    return () => clearTimeout(timeout)
  }, [hasUnsavedChanges, world, storyId])

  // Manual save
  const handleSave = useCallback(() => {
    if (!world) return
    const serialized = serializeWorld(world)
    localStorage.setItem(`bibliarch-world-${storyId}`, JSON.stringify(serialized))
    setHasUnsavedChanges(false)
  }, [world, storyId])

  // Sculpt callback
  const handleTerrainSculpt = useCallback((cx: number, cz: number, brush: BrushSettings) => {
    if (!world) return
    applySculptBrush(world.terrain, cx, cz, brush)
    // Trigger re-render by creating new world ref (terrain is mutated in-place for perf)
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

  // After a stroke ends, notify for undo etc
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
    const newTerrain = createTerrain(world.terrain.size)
    setWorld({ ...world, terrain: newTerrain, updatedAt: new Date() })
    setHasUnsavedChanges(true)
  }, [world])

  // New world with different size
  const handleNewWorld = useCallback((size: TerrainSize) => {
    if (!confirm(`Create new ${size}x${size} world? Current world will be lost.`)) return
    const newWorld = createWorld(storyId, "My World", size)
    setWorld(newWorld)
    setHasUnsavedChanges(true)
  }, [storyId])

  if (!world) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Globe className="w-8 h-8 text-gray-400 animate-pulse" />
      </div>
    )
  }

  // Tool definitions
  const tools: { id: EditorTool; label: string; icon: React.ElementType; shortcut?: string }[] = [
    { id: "select", label: "Select", icon: MousePointer, shortcut: "V" },
    { id: "sculpt", label: "Sculpt", icon: Mountain, shortcut: "B" },
    { id: "paint-material", label: "Paint", icon: Paintbrush, shortcut: "P" },
    { id: "place-object", label: "Objects", icon: Package, shortcut: "O" },
    { id: "cartography", label: "Map", icon: Map, shortcut: "M" },
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

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Top Bar */}
      <header className="border-b border-gray-700 bg-gray-900 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-sky-400" />
          <h1 className="text-sm font-semibold">World Builder</h1>
          <span className="text-xs text-gray-500">
            {world.terrain.size}x{world.terrain.size}
          </span>
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-400">● Unsaved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* World size selector */}
          <select
            className="bg-gray-800 text-xs border border-gray-700 rounded px-2 py-1"
            value={world.terrain.size}
            onChange={(e) => handleNewWorld(Number(e.target.value) as TerrainSize)}
          >
            {TERRAIN_SIZE_PRESETS.map((p) => (
              <option key={p.size} value={p.size}>
                {p.label} ({p.size}x{p.size})
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleResetTerrain} className="text-xs h-7 border-gray-700">
            <RotateCcw className="w-3 h-3 mr-1" /> Flatten
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
            onClick={() => setShowGrass(!showGrass)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg ${showGrass ? 'text-sky-400' : 'text-gray-600'}`}
            title="Toggle grass"
          >
            <Sprout className="w-4 h-4" />
          </button>
        </div>

        {/* 3D Viewport */}
        <div className="flex-1 relative">
          <WorldViewport3D
            terrain={world.terrain}
            activeTool={activeTool}
            sculptBrush={sculptBrush}
            materialBrush={materialBrush}
            showGrid={showGrid}
            showWater={showWater}
            showGrass={showGrass}
            onTerrainSculpt={handleTerrainSculpt}
            onTerrainPaint={handleTerrainPaint}
            onTerrainChanged={handleTerrainChanged}
            onCursorMove={handleCursorMove}
            onFpsUpdate={setFps}
          />

          {/* Tool hint */}
          <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
            {activeTool === "select" && "Click objects to select"}
            {activeTool === "sculpt" && `Sculpt: ${sculptBrush.type} — Click & drag on terrain`}
            {activeTool === "paint-material" && `Paint: ${TERRAIN_MATERIALS[materialBrush.materialId]?.name ?? 'Grass'} — Click & drag on terrain`}
            {activeTool === "place-object" && "Click terrain to place objects (coming soon)"}
            {activeTool === "cartography" && "2D Map Editor (coming soon)"}
            {activeTool === "delete" && "Click objects to delete"}
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
              {/* Brush type buttons */}
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
              {/* Size slider */}
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
              {/* Strength slider */}
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
              {/* Falloff */}
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
              {/* Sea level */}
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
            </div>
          )}

          {/* Material paint settings */}
          {activeTool === 'paint-material' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <Paintbrush className="w-3.5 h-3.5" /> Material Paint
              </h3>
              {/* Brush size */}
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
              {/* Auto-paint button */}
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
              {/* Material palette */}
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

          {/* Select tool - show info */}
          {activeTool === 'select' && (
            <div className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
                <MousePointer className="w-3.5 h-3.5" /> Select
              </h3>
              <p className="text-[10px] text-gray-500">
                Click objects to select them. Use W/E/R to switch between Move, Rotate, and Scale modes.
              </p>
              <p className="text-[10px] text-gray-500">
                Object placement coming in a future update.
              </p>
            </div>
          )}

          {/* Placeholder for other tools */}
          {(activeTool === 'place-object' || activeTool === 'cartography' || activeTool === 'delete') && (
            <div className="p-3">
              <p className="text-[10px] text-gray-500 italic">
                {activeTool === 'place-object' && "Object library coming in Phase 7."}
                {activeTool === 'cartography' && "2D Cartography editor coming in Phase 6."}
                {activeTool === 'delete' && "Click objects to delete them."}
              </p>
            </div>
          )}

          {/* Controls reference */}
          <div className="p-3 border-t border-gray-800 mt-auto">
            <h4 className="text-[10px] font-medium text-gray-500 mb-1">Controls</h4>
            <ul className="text-[9px] text-gray-600 space-y-0.5">
              <li>Left-click drag — Orbit camera</li>
              <li>Right-click drag — Pan</li>
              <li>Scroll — Zoom</li>
              <li>Left-click (sculpt/paint) — Brush stroke</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
