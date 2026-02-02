"use client"

import { Map, Trash2, PaintBucket } from "lucide-react"
import {
  CartographyRegionType,
  CartographyGenerationSettings,
} from "@/types/world"
import {
  BIOME_COLORS,
  BIOME_LABELS,
  ALL_BIOMES,
} from "@/lib/terrain/cartography"

interface CartographyPanelProps {
  activeBiome: CartographyRegionType
  brushSize: number
  settings: CartographyGenerationSettings
  onBiomeChange: (biome: CartographyRegionType) => void
  onBrushSizeChange: (size: number) => void
  onSettingsChange: (settings: CartographyGenerationSettings) => void
  onGenerate: () => void
  onClear: () => void
  onFillAll: () => void
}

export default function CartographyPanel({
  activeBiome,
  brushSize,
  settings,
  onBiomeChange,
  onBrushSizeChange,
  onSettingsChange,
  onGenerate,
  onClear,
  onFillAll,
}: CartographyPanelProps) {
  return (
    <div className="p-3 space-y-3">
      <h3 className="text-xs font-medium text-gray-300 flex items-center gap-2">
        <Map className="w-3.5 h-3.5" /> Cartography
      </h3>

      {/* Biome palette — 2x5 grid */}
      <div>
        <label className="text-[10px] text-gray-500 mb-1 block">Biome</label>
        <div className="grid grid-cols-5 gap-1">
          {ALL_BIOMES.map((biome) => (
            <button
              key={biome}
              onClick={() => onBiomeChange(biome)}
              className={`aspect-square rounded border-2 transition-all flex items-center justify-center ${
                activeBiome === biome
                  ? 'border-white scale-110'
                  : 'border-transparent hover:border-gray-500'
              }`}
              style={{ backgroundColor: BIOME_COLORS[biome] }}
              title={BIOME_LABELS[biome]}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          {BIOME_LABELS[activeBiome]}
        </p>
      </div>

      {/* Brush size */}
      <div>
        <label className="text-[10px] text-gray-500 flex justify-between">
          <span>Brush Size</span><span>{brushSize}</span>
        </label>
        <input
          type="range"
          min={1}
          max={16}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="w-full h-1 mt-1"
        />
      </div>

      {/* Generation settings */}
      <div className="border-t border-gray-800 pt-3 space-y-2">
        <label className="text-[10px] text-gray-400 font-medium block">Generation</label>

        <div>
          <label className="text-[10px] text-gray-500 flex justify-between">
            <span>Noise Scale</span><span>{settings.noiseScale}</span>
          </label>
          <input
            type="range"
            min={1}
            max={32}
            value={settings.noiseScale}
            onChange={(e) =>
              onSettingsChange({ ...settings, noiseScale: Number(e.target.value) })
            }
            className="w-full h-1 mt-1"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 flex justify-between">
            <span>Octaves</span><span>{settings.noiseOctaves}</span>
          </label>
          <input
            type="range"
            min={1}
            max={8}
            value={settings.noiseOctaves}
            onChange={(e) =>
              onSettingsChange({ ...settings, noiseOctaves: Number(e.target.value) })
            }
            className="w-full h-1 mt-1"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 flex justify-between">
            <span>Height Multiplier</span><span>{settings.heightMultiplier.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={5}
            max={50}
            value={Math.round(settings.heightMultiplier * 10)}
            onChange={(e) =>
              onSettingsChange({ ...settings, heightMultiplier: Number(e.target.value) / 10 })
            }
            className="w-full h-1 mt-1"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 flex justify-between">
            <span>Smoothing Passes</span><span>{settings.smoothingPasses}</span>
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={settings.smoothingPasses}
            onChange={(e) =>
              onSettingsChange({ ...settings, smoothingPasses: Number(e.target.value) })
            }
            className="w-full h-1 mt-1"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-1.5 border-t border-gray-800 pt-3">
        <button
          onClick={onGenerate}
          className="w-full py-2 text-[11px] font-medium rounded border border-sky-600 bg-sky-700/40 text-sky-200 hover:bg-sky-700/60 transition-colors"
        >
          Generate & View 3D
        </button>

        <div className="flex gap-1">
          <button
            onClick={onClear}
            className="flex-1 py-1.5 text-[10px] rounded border border-gray-700 text-gray-400 hover:bg-gray-800 flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
          <button
            onClick={onFillAll}
            className="flex-1 py-1.5 text-[10px] rounded border border-gray-700 text-gray-400 hover:bg-gray-800 flex items-center justify-center gap-1"
          >
            <PaintBucket className="w-3 h-3" /> Fill All
          </button>
        </div>
      </div>
    </div>
  )
}
