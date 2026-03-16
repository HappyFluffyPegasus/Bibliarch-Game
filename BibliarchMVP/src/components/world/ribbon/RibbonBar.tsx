"use client"

import { Globe, Play, Square } from "lucide-react"
import HomeTab from "./tabs/HomeTab"
import TerrainTab from "./tabs/TerrainTab"
import BuildTab from "./tabs/BuildTab"
import EnvironmentTab from "./tabs/EnvironmentTab"
import ViewTab from "./tabs/ViewTab"
import type { WorldLevel, EditorTool } from "@/types/world"

export interface RibbonCallbacks {
  // Home
  onUndo: () => void
  onRedo: () => void
  onDuplicate: () => void
  onDelete: () => void
  onSave: () => void
  onImportHeightmap: () => void
  onExportHeightmap: () => void
  onPlaceDummy: () => void
  undoCount: number
  redoCount: number
  selectedCount: number
  hasUnsavedChanges: boolean
  transformMode: 'translate' | 'scale' | 'rotate'
  onTransformModeChange: (mode: 'translate' | 'scale' | 'rotate') => void

  // Terrain
  onGenerateTerrain: () => void
  onResetTerrain: () => void
  onFlattenToGround: () => void
  onSmoothCoastlines: () => void
  onOpenScaleDialog: () => void

  // Build
  onFinishBorder: () => void
  onCancelBorder: () => void
  borderVertexCount: number
  borderLabel: string
  onAddFloor: () => void
  hasFloors: boolean
  maxFloor: number
  onEnterInterior?: () => void

  // Environment
  sunAngle: number
  sunElevation: number
  skyColor: string
  fogEnabled: boolean
  weatherType: 'clear' | 'rain' | 'snow' | 'fog' | 'cloudy'
  showSkyPicker: boolean
  onSunAngleChange: (v: number) => void
  onSunElevationChange: (v: number) => void
  onSkyColorChange: (v: string) => void
  onWaterColorChange?: (v: string) => void
  onFogToggle: () => void
  onWeatherChange: (w: 'clear' | 'rain' | 'snow' | 'fog' | 'cloudy') => void
  onToggleSkyPicker: () => void

  // View
  onScreenshot: () => void
  onSaveLocation: () => void
  onCameraPreset: (preset: 'top' | 'front' | 'side' | 'perspective') => void

  // Playtest
  isPlaytesting: boolean
  onStartPlaytest: () => void
  onStopPlaytest: () => void
}

interface RibbonBarProps {
  ribbonTab: 'home' | 'terrain' | 'build' | 'environment' | 'view'
  onTabChange: (tab: 'home' | 'terrain' | 'build' | 'environment' | 'view') => void
  currentLevel: WorldLevel
  callbacks: RibbonCallbacks
}

const TAB_ORDER = ['home', 'terrain', 'build', 'environment', 'view'] as const

export default function RibbonBar({ ribbonTab, onTabChange, currentLevel, callbacks }: RibbonBarProps) {
  return (
    <>
      {/* Tab row */}
      <div className="shrink-0 bg-[#1e1e1e] border-b border-[#3d3d3d]">
        <div className="flex items-center h-8 pl-12 pr-3">
          <div className="flex items-center gap-1.5 mr-4">
            <Globe className="w-4 h-4 text-[#4da6ff]" />
            <span className="text-[11px] font-semibold text-[#ccc]">World Builder</span>
            {callbacks.hasUnsavedChanges && <span className="text-xs text-amber-500">●</span>}
          </div>
          {TAB_ORDER
            .filter(tab => !(tab === 'terrain' && (currentLevel === 'building' || currentLevel === 'interior')))
            .map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-4 py-1.5 text-[11px] font-medium transition-colors ${
                ribbonTab === tab
                  ? 'text-white border-b-2 border-[#0066cc] bg-[#252526]'
                  : 'text-[#999] hover:text-[#ccc] hover:bg-[#2d2d2d]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <div className="flex-1" />
          {!callbacks.isPlaytesting ? (
            <button
              onClick={callbacks.onStartPlaytest}
              className="h-7 px-3 flex items-center gap-1.5 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Play
            </button>
          ) : (
            <button
              onClick={callbacks.onStopPlaytest}
              className="h-7 px-3 flex items-center gap-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
        </div>
      </div>

      {/* Ribbon content */}
      {!callbacks.isPlaytesting && (
        <div className="shrink-0 bg-[#252526] border-b border-[#3d3d3d] px-1 flex items-stretch overflow-x-auto" style={{ minHeight: 62 }}>
          {ribbonTab === 'home' && <HomeTab callbacks={callbacks} />}
          {ribbonTab === 'terrain' && currentLevel !== 'building' && <TerrainTab callbacks={callbacks} />}
          {ribbonTab === 'build' && <BuildTab callbacks={callbacks} currentLevel={currentLevel} />}
          {ribbonTab === 'environment' && <EnvironmentTab callbacks={callbacks} />}
          {ribbonTab === 'view' && <ViewTab callbacks={callbacks} />}
        </div>
      )}
    </>
  )
}
