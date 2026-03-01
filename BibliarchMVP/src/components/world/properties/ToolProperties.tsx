"use client"

import {
  Mountain, Paintbrush, Trash2, Pentagon, LayoutGrid, Route,
  Square, DoorOpen, PaintBucket, Armchair, Eye, X,
} from "lucide-react"
import PropertySection from "./PropertySection"
import PropertyRow from "./PropertyRow"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
import { TERRAIN_MATERIALS, getMaterialsByCategory } from "@/lib/terrain/materials"
import { OBJECT_CATALOG } from "@/lib/terrain/objectCatalog"
import {
  LOT_ZONING_COLORS, ROAD_TYPE_DEFAULTS,
  type LotZoning, type RoadType, type WorldNode,
} from "@/types/world"
import CartographyPanel from "@/components/world/CartographyPanel"
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, getFurnitureByCategory, type FurnitureCategory } from "@/lib/building/furnitureCatalog"
import type { CartographyGenerationSettings, CartographyRegionType } from "@/types/world"
import { useState } from "react"

const SCULPT_TYPES = [
  { type: 'raise' as const, label: 'Raise' },
  { type: 'lower' as const, label: 'Lower' },
  { type: 'smooth' as const, label: 'Smooth' },
  { type: 'flatten' as const, label: 'Flatten' },
  { type: 'noise' as const, label: 'Noise' },
  { type: 'plateau' as const, label: 'Plateau' },
  { type: 'erode' as const, label: 'Erode' },
]

interface ToolPropertiesProps {
  terrain: { maxHeight: number; seaLevel: number; heights: Float32Array; size: number; sizeZ: number; cellSize: number }
  onTerrainUpdate: (updates: Record<string, unknown>) => void
  onAutoMaterialPaint: () => void
  // Selection
  selectedCount: number
  onDeleteSelected: () => void
  // Border
  borderLabel: string
  borderVertexCount: number
  onFinishBorder: () => void
  onCancelBorder: () => void
  // Lot
  currentNode: WorldNode | null
  onDeleteLot: (id: string) => void
  // Road
  onFinishRoad: () => void
  onDeleteRoad: (id: string) => void
  // Cartography
  cartographyBiome: CartographyRegionType
  cartographyBrushSize: number
  cartographySettings: CartographyGenerationSettings
  onBiomeChange: (biome: CartographyRegionType) => void
  onBrushSizeChange: (size: number) => void
  onSettingsChange: (s: CartographyGenerationSettings) => void
  onCartographyGenerate: () => void
  onCartographyClear: () => void
  onCartographyFillAll: () => void
  // Camera
  cameraMode: 'orbit' | 'first-person'
}

export default function ToolProperties({
  terrain,
  onTerrainUpdate,
  onAutoMaterialPaint,
  selectedCount,
  onDeleteSelected,
  borderLabel,
  borderVertexCount,
  onFinishBorder,
  onCancelBorder,
  currentNode,
  onDeleteLot,
  onFinishRoad,
  onDeleteRoad,
  cartographyBiome,
  cartographyBrushSize,
  cartographySettings,
  onBiomeChange,
  onBrushSizeChange,
  onSettingsChange,
  onCartographyGenerate,
  onCartographyClear,
  onCartographyFillAll,
  cameraMode,
}: ToolPropertiesProps) {
  const activeTool = useWorldBuilderStore((s) => s.activeTool)
  const sculptBrush = useWorldBuilderStore((s) => s.sculptBrush)
  const materialBrush = useWorldBuilderStore((s) => s.materialBrush)
  const setSculptBrushType = useWorldBuilderStore((s) => s.setSculptBrushType)
  const setSculptBrushSize = useWorldBuilderStore((s) => s.setSculptBrushSize)
  const setSculptBrushStrength = useWorldBuilderStore((s) => s.setSculptBrushStrength)
  const setSculptBrushFalloff = useWorldBuilderStore((s) => s.setSculptBrushFalloff)
  const setMaterialBrushMaterial = useWorldBuilderStore((s) => s.setMaterialBrushMaterial)
  const setMaterialBrushSize = useWorldBuilderStore((s) => s.setMaterialBrushSize)
  const borderColor = useWorldBuilderStore((s) => s.borderColor)
  const setBorderColor = useWorldBuilderStore((s) => s.setBorderColor)
  const borderDrawMode = useWorldBuilderStore((s) => s.borderDrawMode)
  const clearBorderVertices = useWorldBuilderStore((s) => s.clearBorderVertices)
  const lotZoning = useWorldBuilderStore((s) => s.lotZoning)
  const setLotZoning = useWorldBuilderStore((s) => s.setLotZoning)
  const lotCorner1 = useWorldBuilderStore((s) => s.lotCorner1)
  const roadType = useWorldBuilderStore((s) => s.roadType)
  const setRoadType = useWorldBuilderStore((s) => s.setRoadType)
  const roadDrawMode = useWorldBuilderStore((s) => s.roadDrawMode)
  const roadWaypoints = useWorldBuilderStore((s) => s.roadWaypoints)
  const clearRoadWaypoints = useWorldBuilderStore((s) => s.clearRoadWaypoints)
  const wallStartPoint = useWorldBuilderStore((s) => s.wallStartPoint)
  const wallHeight = useWorldBuilderStore((s) => s.wallHeight)
  const setWallHeight = useWorldBuilderStore((s) => s.setWallHeight)
  const wallMat = useWorldBuilderStore((s) => s.wallMaterial)
  const setWallMat = useWorldBuilderStore((s) => s.setWallMaterial)
  const floorMaterial = useWorldBuilderStore((s) => s.floorMaterial)
  const setFloorMaterial = useWorldBuilderStore((s) => s.setFloorMaterial)
  const selectedFurnitureType = useWorldBuilderStore((s) => s.selectedFurnitureType)
  const setSelectedFurnitureType = useWorldBuilderStore((s) => s.setSelectedFurnitureType)
  const firstPersonSubMode = useWorldBuilderStore((s) => s.firstPersonSubMode)
  const setFirstPersonSubMode = useWorldBuilderStore((s) => s.setFirstPersonSubMode)
  const firstPersonSpeed = useWorldBuilderStore((s) => s.firstPersonSpeed)
  const setFirstPersonSpeed = useWorldBuilderStore((s) => s.setFirstPersonSpeed)

  const [furnitureCategory, setFurnitureCategory] = useState<FurnitureCategory>('seating')

  const naturalMaterials = getMaterialsByCategory('natural')
  const urbanMaterials = getMaterialsByCategory('urban')
  const fantasyMaterials = getMaterialsByCategory('fantasy')

  return (
    <>
      {/* Camera settings (first-person mode) */}
      {cameraMode === 'first-person' && (
        <PropertySection title="Camera">
          <PropertyRow label="Mode">
            <div className="flex gap-0.5">
              {(['walk', 'fly'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFirstPersonSubMode(mode)}
                  className={`flex-1 py-0.5 text-[9px] rounded border ${
                    firstPersonSubMode === mode
                      ? 'border-amber-500 bg-amber-900/40 text-amber-300'
                      : 'border-[#3d3d3d] text-[#999]'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </PropertyRow>
          <PropertyRow label="Speed">
            <div className="flex items-center gap-1">
              <input type="range" min={1} max={100} value={Math.round(firstPersonSpeed * 10)} onChange={(e) => setFirstPersonSpeed(Number(e.target.value) / 10)} className="flex-1 h-1" />
              <span className="text-[9px] text-[#999] w-7">{firstPersonSpeed.toFixed(1)}x</span>
            </div>
          </PropertyRow>
        </PropertySection>
      )}

      {/* Sculpt settings */}
      {activeTool === 'sculpt' && (
        <>
          <PropertySection title="Sculpt Brush">
            <div className="px-2 py-1">
              <div className="grid grid-cols-2 gap-0.5">
                {SCULPT_TYPES.map((b) => (
                  <button
                    key={b.type}
                    onClick={() => setSculptBrushType(b.type)}
                    className={`py-1 text-[9px] rounded border transition-colors ${
                      sculptBrush.type === b.type
                        ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]'
                        : 'border-[#3d3d3d] text-[#999] hover:bg-[#383838]'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <PropertyRow label="Size">
              <div className="flex items-center gap-1">
                <input type="range" min={1} max={64} value={sculptBrush.size} onChange={(e) => setSculptBrushSize(Number(e.target.value))} className="flex-1 h-1" />
                <span className="text-[9px] text-[#999] w-5">{sculptBrush.size}</span>
              </div>
            </PropertyRow>
            <PropertyRow label="Strength">
              <div className="flex items-center gap-1">
                <input type="range" min={5} max={100} value={Math.round(sculptBrush.strength * 100)} onChange={(e) => setSculptBrushStrength(Number(e.target.value) / 100)} className="flex-1 h-1" />
                <span className="text-[9px] text-[#999] w-7">{Math.round(sculptBrush.strength * 100)}%</span>
              </div>
            </PropertyRow>
            <PropertyRow label="Falloff">
              <div className="flex gap-0.5">
                {(['linear', 'smooth', 'constant'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSculptBrushFalloff(f)}
                    className={`flex-1 py-0.5 text-[9px] rounded border ${
                      sculptBrush.falloff === f
                        ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]'
                        : 'border-[#3d3d3d] text-[#999]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </PropertyRow>
          </PropertySection>

          <PropertySection title="Terrain Heights">
            {(() => {
              const oceanDepth = Math.round(terrain.seaLevel * terrain.maxHeight)
              const landHeight = Math.round((1 - terrain.seaLevel) * terrain.maxHeight)

              const updateHeights = (newLand: number, newOcean: number) => {
                const total = newLand + newOcean
                const newSeaLevel = total > 0 ? newOcean / total : 0
                onTerrainUpdate({ maxHeight: total, seaLevel: newSeaLevel })
              }

              return (
                <>
                  <PropertyRow label="Land Height">
                    <div className="flex items-center gap-1">
                      <input type="range" min={10} max={2000} step={10} value={landHeight} onChange={(e) => updateHeights(Number(e.target.value), oceanDepth)} className="flex-1 h-1" />
                      <span className="text-[9px] text-[#999] w-7">{landHeight}</span>
                    </div>
                  </PropertyRow>
                  <div className="flex gap-0.5 px-2 pb-1">
                    {[50, 100, 300, 500, 1000].map((v) => (
                      <button key={v} onClick={() => updateHeights(v, oceanDepth)} className={`flex-1 py-0.5 text-[8px] rounded border ${landHeight === v ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]' : 'border-[#3d3d3d] text-[#666] hover:bg-[#383838]'}`}>{v}</button>
                    ))}
                  </div>
                  <PropertyRow label="Ocean Depth">
                    <div className="flex items-center gap-1">
                      <input type="range" min={0} max={1000} step={10} value={oceanDepth} onChange={(e) => updateHeights(landHeight, Number(e.target.value))} className="flex-1 h-1" />
                      <span className="text-[9px] text-[#999] w-7">{oceanDepth}</span>
                    </div>
                  </PropertyRow>
                  <div className="flex gap-0.5 px-2 pb-1">
                    {[0, 20, 50, 100, 300].map((v) => (
                      <button key={v} onClick={() => updateHeights(landHeight, v)} className={`flex-1 py-0.5 text-[8px] rounded border ${oceanDepth === v ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]' : 'border-[#3d3d3d] text-[#666] hover:bg-[#383838]'}`}>{v === 0 ? 'None' : v}</button>
                    ))}
                  </div>
                </>
              )
            })()}
          </PropertySection>

          <PropertySection title="Terrain Stats" defaultOpen={false}>
            <div className="px-2 py-1">
              {(() => {
                const h = terrain.heights
                let min = 1, max = 0, sum = 0, aboveWater = 0
                for (let i = 0; i < h.length; i++) {
                  if (h[i] < min) min = h[i]
                  if (h[i] > max) max = h[i]
                  sum += h[i]
                  if (h[i] >= terrain.seaLevel) aboveWater++
                }
                const avg = sum / h.length
                const landPct = Math.round((aboveWater / h.length) * 100)
                return (
                  <div className="text-[9px] text-[#666] space-y-0.5">
                    <div className="flex justify-between"><span>Min height</span><span>{(min * terrain.maxHeight).toFixed(0)}</span></div>
                    <div className="flex justify-between"><span>Max height</span><span>{(max * terrain.maxHeight).toFixed(0)}</span></div>
                    <div className="flex justify-between"><span>Avg height</span><span>{(avg * terrain.maxHeight).toFixed(0)}</span></div>
                    <div className="flex justify-between"><span>Land / Water</span><span>{landPct}% / {100 - landPct}%</span></div>
                    <div className="flex justify-between"><span>Vertices</span><span>{(terrain.size * terrain.sizeZ).toLocaleString()}</span></div>
                  </div>
                )
              })()}
            </div>
          </PropertySection>
        </>
      )}

      {/* Material paint settings */}
      {activeTool === 'paint-material' && (
        <PropertySection title="Material Paint">
          <PropertyRow label="Brush Size">
            <div className="flex items-center gap-1">
              <input type="range" min={1} max={64} value={materialBrush.size} onChange={(e) => setMaterialBrushSize(Number(e.target.value))} className="flex-1 h-1" />
              <span className="text-[9px] text-[#999] w-5">{materialBrush.size}</span>
            </div>
          </PropertyRow>
          <div className="px-2 py-1">
            <button onClick={onAutoMaterialPaint} className="w-full py-1 text-[9px] rounded border border-[#0066cc] text-[#4da6ff] hover:bg-[#0066cc]/20">
              Auto-Paint by Height
            </button>
          </div>
          {[
            { label: 'Natural', materials: naturalMaterials },
            { label: 'Urban', materials: urbanMaterials },
            { label: 'Fantasy', materials: fantasyMaterials },
          ].map((group) => (
            <div key={group.label} className="px-2 py-1">
              <label className="text-[9px] text-[#666] mb-0.5 block">{group.label}</label>
              <div className="grid grid-cols-5 gap-0.5">
                {group.materials.map((mat) => (
                  <button
                    key={mat.id}
                    onClick={() => setMaterialBrushMaterial(mat.id)}
                    className={`aspect-square rounded border-2 transition-all ${
                      materialBrush.materialId === mat.id
                        ? 'border-white scale-110'
                        : 'border-transparent hover:border-[#666]'
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
        </PropertySection>
      )}

      {/* Delete tool */}
      {activeTool === 'delete' && (
        <PropertySection title="Delete">
          <div className="px-2 py-1">
            <p className="text-[9px] text-[#666]">
              Click objects to select them, then press <kbd className="bg-[#1e1e1e] px-1 rounded text-[#ccc]">Delete</kbd> to remove.
            </p>
            {selectedCount > 0 && (
              <button onClick={onDeleteSelected} className="mt-1 w-full py-1 text-[9px] rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center justify-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete {selectedCount} selected
              </button>
            )}
          </div>
        </PropertySection>
      )}

      {/* Cartography panel */}
      {activeTool === 'cartography' && (
        <CartographyPanel
          activeBiome={cartographyBiome}
          brushSize={cartographyBrushSize}
          settings={cartographySettings}
          onBiomeChange={onBiomeChange}
          onBrushSizeChange={onBrushSizeChange}
          onSettingsChange={onSettingsChange}
          onGenerate={onCartographyGenerate}
          onClear={onCartographyClear}
          onFillAll={onCartographyFillAll}
        />
      )}

      {/* Border drawing */}
      {activeTool === 'draw-border' && (
        <PropertySection title={`Draw ${borderLabel}`}>
          <div className="px-2 py-1 space-y-2">
            <p className="text-[9px] text-[#666]">Click to draw. Enter to finish.</p>
            <PropertyRow label="Border Color">
              <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} className="w-full h-5 rounded border border-[#3d3d3d] bg-[#1e1e1e] cursor-pointer" />
            </PropertyRow>
            {borderVertexCount > 0 && (
              <>
                <p className="text-[9px] text-[#999]">{borderVertexCount} points placed</p>
                <div className="flex gap-1">
                  <button onClick={onFinishBorder} disabled={borderVertexCount < 3} className="flex-1 py-1 text-[9px] rounded bg-[#0066cc] text-white hover:bg-[#0077ee] disabled:opacity-50">Finish</button>
                  <button onClick={onCancelBorder} className="flex-1 py-1 text-[9px] rounded border border-[#3d3d3d] text-[#999] hover:bg-[#383838]">Cancel</button>
                </div>
              </>
            )}
          </div>
        </PropertySection>
      )}

      {/* Lot drawing */}
      {activeTool === 'draw-lot' && (
        <PropertySection title="Draw Lot">
          <div className="px-2 py-1 space-y-2">
            <p className="text-[9px] text-[#666]">{lotCorner1 ? 'Click to set second corner' : 'Click two corners to define a lot'}</p>
            <div className="grid grid-cols-2 gap-0.5">
              {(['residential', 'commercial', 'industrial', 'park', 'special'] as LotZoning[]).map(z => (
                <button key={z} onClick={() => setLotZoning(z)} className={`py-1 text-[9px] rounded border flex items-center gap-1 justify-center ${lotZoning === z ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]' : 'border-[#3d3d3d] text-[#999] hover:bg-[#383838]'}`}>
                  <span className="w-2 h-2 rounded" style={{ backgroundColor: LOT_ZONING_COLORS[z] }} />
                  {z}
                </button>
              ))}
            </div>
            {currentNode?.lots && currentNode.lots.length > 0 && (
              <div className="border-t border-[#2d2d2d] pt-1">
                <label className="text-[9px] text-[#666] mb-0.5 block">Existing Lots</label>
                <ul className="space-y-0.5">
                  {currentNode.lots.map(lot => (
                    <li key={lot.id} className="flex items-center justify-between p-1 rounded bg-[#1e1e1e] text-[9px]">
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: LOT_ZONING_COLORS[lot.zoning] }} />
                        <span className="text-[#ccc] truncate max-w-[80px]">{lot.name}</span>
                      </div>
                      <button onClick={() => onDeleteLot(lot.id)} className="text-[#666] hover:text-red-400"><X className="w-3 h-3" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </PropertySection>
      )}

      {/* Road drawing */}
      {activeTool === 'draw-road' && (
        <PropertySection title="Draw Road">
          <div className="px-2 py-1 space-y-2">
            <p className="text-[9px] text-[#666]">Click to place waypoints. Enter to finish.</p>
            <div className="grid grid-cols-2 gap-0.5">
              {(['highway', 'main', 'street', 'alley', 'footpath'] as RoadType[]).map(rt => (
                <button key={rt} onClick={() => setRoadType(rt)} className={`py-1 text-[9px] rounded border ${roadType === rt ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]' : 'border-[#3d3d3d] text-[#999] hover:bg-[#383838]'}`}>
                  {rt}
                </button>
              ))}
            </div>
            {roadType && ROAD_TYPE_DEFAULTS[roadType] && (
              <div className="text-[8px] text-[#666]">
                Width: {ROAD_TYPE_DEFAULTS[roadType].width}m · Lanes: {ROAD_TYPE_DEFAULTS[roadType].lanes}
              </div>
            )}
            {roadWaypoints.length > 0 && (
              <>
                <p className="text-[9px] text-[#999]">{roadWaypoints.length} waypoints</p>
                <div className="flex gap-1">
                  <button onClick={onFinishRoad} disabled={roadWaypoints.length < 2} className="flex-1 py-1 text-[9px] rounded bg-[#0066cc] text-white hover:bg-[#0077ee] disabled:opacity-50">Finish</button>
                  <button onClick={() => clearRoadWaypoints()} className="flex-1 py-1 text-[9px] rounded border border-[#3d3d3d] text-[#999] hover:bg-[#383838]">Cancel</button>
                </div>
              </>
            )}
            {currentNode?.roadNetwork?.segments && currentNode.roadNetwork.segments.length > 0 && (
              <div className="border-t border-[#2d2d2d] pt-1">
                <label className="text-[9px] text-[#666] mb-0.5 block">Roads</label>
                <ul className="space-y-0.5">
                  {currentNode.roadNetwork.segments.map(seg => (
                    <li key={seg.id} className="flex items-center justify-between p-1 rounded bg-[#1e1e1e] text-[9px]">
                      <span className="text-[#ccc]">{seg.name || seg.type}</span>
                      <button onClick={() => onDeleteRoad(seg.id)} className="text-[#666] hover:text-red-400"><X className="w-3 h-3" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </PropertySection>
      )}

      {/* Wall placement */}
      {activeTool === 'place-wall' && (
        <PropertySection title="Place Wall">
          <div className="px-2 py-1 space-y-2">
            <p className="text-[9px] text-[#666]">{wallStartPoint ? 'Click to set end point' : 'Click to start wall'}</p>
            <PropertyRow label="Height">
              <div className="flex items-center gap-1">
                <input type="range" min={2} max={5} step={0.5} value={wallHeight} onChange={e => setWallHeight(Number(e.target.value))} className="flex-1 h-1" />
                <span className="text-[9px] text-[#999] w-6">{wallHeight}m</span>
              </div>
            </PropertyRow>
            <div className="grid grid-cols-3 gap-0.5">
              {['drywall', 'brick', 'stone', 'glass', 'wood', 'concrete'].map(m => (
                <button key={m} onClick={() => setWallMat(m)} className={`py-0.5 text-[8px] rounded border ${wallMat === m ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]' : 'border-[#3d3d3d] text-[#999] hover:bg-[#383838]'}`}>{m}</button>
              ))}
            </div>
          </div>
        </PropertySection>
      )}

      {/* Door placement */}
      {activeTool === 'place-door' && (
        <PropertySection title="Place Opening">
          <div className="px-2 py-1">
            <p className="text-[9px] text-[#666]">Click on a wall to place a door</p>
            <p className="text-[8px] text-[#666] mt-1">Door: 0.9m × 2.1m</p>
          </div>
        </PropertySection>
      )}

      {/* Floor painting */}
      {activeTool === 'paint-floor' && (
        <PropertySection title="Paint Floor">
          <div className="px-2 py-1 space-y-2">
            <p className="text-[9px] text-[#666]">Click/drag to paint</p>
            <div className="grid grid-cols-3 gap-0.5">
              {['wood', 'tile', 'carpet', 'marble', 'concrete', 'stone'].map(m => (
                <button key={m} onClick={() => setFloorMaterial(m)} className={`py-0.5 text-[8px] rounded border ${floorMaterial === m ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]' : 'border-[#3d3d3d] text-[#999] hover:bg-[#383838]'}`}>{m}</button>
              ))}
            </div>
          </div>
        </PropertySection>
      )}

      {/* Furniture */}
      {activeTool === 'place-furniture' && (
        <PropertySection title="Place Furniture">
          <div className="px-2 py-1 space-y-2">
            <div className="flex gap-0.5 flex-wrap">
              {FURNITURE_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setFurnitureCategory(cat.id)} className={`px-1.5 py-0.5 text-[8px] rounded ${furnitureCategory === cat.id ? 'bg-[#0066cc] text-white' : 'bg-[#1e1e1e] text-[#999] hover:bg-[#383838]'}`}>
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-0.5 max-h-32 overflow-y-auto">
              {getFurnitureByCategory(furnitureCategory).map(item => (
                <button key={item.id} onClick={() => setSelectedFurnitureType(item.id)} className={`py-1 text-[8px] rounded border text-center ${selectedFurnitureType === item.id ? 'border-[#0066cc] bg-[#0066cc]/20 text-[#4da6ff]' : 'border-[#3d3d3d] text-[#999] hover:bg-[#383838]'}`}>
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </PropertySection>
      )}
    </>
  )
}
