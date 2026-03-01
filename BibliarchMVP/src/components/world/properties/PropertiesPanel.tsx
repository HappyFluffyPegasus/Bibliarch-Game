"use client"

import { Copy, Trash2 } from "lucide-react"
import ObjectProperties from "./ObjectProperties"
import ToolProperties from "./ToolProperties"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
import type { WorldObject, WorldNode, CartographyGenerationSettings, CartographyRegionType } from "@/types/world"
import { OBJECT_CATALOG } from "@/lib/terrain/objectCatalog"

interface PropertiesPanelProps {
  objects: WorldObject[]
  terrain: { maxHeight: number; seaLevel: number; heights: Float32Array; size: number; sizeZ: number; cellSize: number }
  onObjectUpdate: (id: string, props: Partial<WorldObject>) => void
  onObjectColorChange: (id: string, color: string) => void
  onDuplicate: () => void
  onDelete: () => void
  onTerrainUpdate: (updates: Record<string, unknown>) => void
  onAutoMaterialPaint: () => void
  borderLabel: string
  borderVertexCount: number
  onFinishBorder: () => void
  onCancelBorder: () => void
  currentNode: WorldNode | null
  onDeleteLot: (id: string) => void
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
}

export default function PropertiesPanel({
  objects,
  terrain,
  onObjectUpdate,
  onObjectColorChange,
  onDuplicate,
  onDelete,
  onTerrainUpdate,
  onAutoMaterialPaint,
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
}: PropertiesPanelProps) {
  const selectedObjectIds = useWorldBuilderStore((s) => s.selectedObjectIds)
  const cameraMode = useWorldBuilderStore((s) => s.cameraMode)

  const selectedObj = selectedObjectIds.length === 1
    ? objects.find((o) => o.id === selectedObjectIds[0])
    : null

  return (
    <div className="overflow-y-auto">
      {/* Single object selected */}
      {selectedObj && (
        <ObjectProperties
          selectedObj={selectedObj}
          onUpdate={onObjectUpdate}
          onColorChange={onObjectColorChange}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}

      {/* Multi-selection */}
      {!selectedObj && selectedObjectIds.length > 1 && (
        <div className="p-2 border-b border-[#3d3d3d] space-y-1.5">
          <p className="text-[10px] text-[#999]">{selectedObjectIds.length} objects selected</p>
          <div className="flex gap-1">
            <button onClick={onDuplicate} className="flex-1 py-1 text-[9px] rounded border border-[#3d3d3d] text-[#ccc] hover:bg-[#383838] flex items-center justify-center gap-1">
              <Copy className="w-3 h-3" /> Duplicate
            </button>
            <button onClick={onDelete} className="flex-1 py-1 text-[9px] rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center justify-center gap-1">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Tool properties (always shown below object props) */}
      <ToolProperties
        terrain={terrain}
        onTerrainUpdate={onTerrainUpdate}
        onAutoMaterialPaint={onAutoMaterialPaint}
        selectedCount={selectedObjectIds.length}
        onDeleteSelected={onDelete}
        borderLabel={borderLabel}
        borderVertexCount={borderVertexCount}
        onFinishBorder={onFinishBorder}
        onCancelBorder={onCancelBorder}
        currentNode={currentNode}
        onDeleteLot={onDeleteLot}
        onFinishRoad={onFinishRoad}
        onDeleteRoad={onDeleteRoad}
        cartographyBiome={cartographyBiome}
        cartographyBrushSize={cartographyBrushSize}
        cartographySettings={cartographySettings}
        onBiomeChange={onBiomeChange}
        onBrushSizeChange={onBrushSizeChange}
        onSettingsChange={onSettingsChange}
        onCartographyGenerate={onCartographyGenerate}
        onCartographyClear={onCartographyClear}
        onCartographyFillAll={onCartographyFillAll}
        cameraMode={cameraMode}
      />

      {/* Controls reference */}
      <div className="p-2 border-t border-[#2d2d2d]">
        <h4 className="text-[9px] font-medium text-[#666] mb-0.5">Controls</h4>
        {cameraMode === 'first-person' ? (
          <ul className="text-[8px] text-[#666] space-y-0.5">
            <li>WASD — Move</li>
            <li>Right-drag — Look around</li>
            <li>[ / ] — Brush size</li>
            <li>Ctrl+Z/Y — Undo/Redo</li>
            <li>F — Exit first-person</li>
          </ul>
        ) : (
          <ul className="text-[8px] text-[#666] space-y-0.5">
            <li>MMB — Orbit · RMB — Pan · Scroll — Zoom</li>
            <li>V/B/P/O/M/X — Switch tools</li>
            <li>[ / ] — Brush size</li>
            <li>Ctrl+Z/Y — Undo/Redo</li>
            <li>Ctrl+D — Duplicate · Del — Delete</li>
            <li>F — First-person · Ctrl+S — Save</li>
          </ul>
        )}
      </div>
    </div>
  )
}
