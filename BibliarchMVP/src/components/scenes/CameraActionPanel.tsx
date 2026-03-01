'use client'

import { useState } from 'react'
import { Camera, Move, RotateCcw, ZoomIn, X, Sparkles } from 'lucide-react'

// Camera preset shots
const CAMERA_PRESETS = [
  { id: 'wide', label: 'Wide Shot', position: [0, 3, 12], rotation: [0, Math.PI, 0], fov: 50 },
  { id: 'medium', label: 'Medium Shot', position: [0, 2, 6], rotation: [0, Math.PI, 0], fov: 45 },
  { id: 'closeup', label: 'Close-Up', position: [0, 1.8, 3], rotation: [0, Math.PI, 0], fov: 35 },
  { id: 'over-shoulder-l', label: 'Over Shoulder L', position: [-2, 2, 4], rotation: [0, Math.PI - 0.3, 0], fov: 40 },
  { id: 'over-shoulder-r', label: 'Over Shoulder R', position: [2, 2, 4], rotation: [0, Math.PI + 0.3, 0], fov: 40 },
  { id: 'low-angle', label: 'Low Angle', position: [0, 0.5, 5], rotation: [-0.3, Math.PI, 0], fov: 50 },
  { id: 'high-angle', label: 'High Angle', position: [0, 5, 6], rotation: [0.5, Math.PI, 0], fov: 50 },
  { id: 'dutch', label: 'Dutch Angle', position: [2, 2, 5], rotation: [0, Math.PI - 0.2, 0.2], fov: 45 },
]

interface CameraActionPanelProps {
  currentFov: number
  onApplyPreset: (position: number[], rotation: number[], fov: number) => void
  onChangeFov: (fov: number) => void
  onClose: () => void
}

export default function CameraActionPanel({
  currentFov,
  onApplyPreset,
  onChangeFov,
  onClose
}: CameraActionPanelProps) {
  const [localFov, setLocalFov] = useState(currentFov)

  const handleFovChange = (value: number) => {
    setLocalFov(value)
    onChangeFov(value)
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700 shadow-2xl overflow-hidden z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-medium text-slate-200">Camera</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-4">
        {/* Camera presets */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 mb-2">Quick Shots</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {CAMERA_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => onApplyPreset(preset.position, preset.rotation, preset.fov)}
                className="px-2 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 text-xs rounded transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* FOV slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <ZoomIn className="w-3 h-3" />
              Field of View
            </h4>
            <span className="text-xs text-slate-500">{localFov}°</span>
          </div>
          <input
            type="range"
            min={20}
            max={90}
            value={localFov}
            onChange={(e) => handleFovChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>Telephoto</span>
            <span>Wide</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-[10px] text-slate-500 space-y-1">
          <p className="flex items-center gap-1">
            <Move className="w-3 h-3" />
            <span>G key or drag to move camera</span>
          </p>
          <p className="flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            <span>R key to rotate camera</span>
          </p>
        </div>
      </div>

      {/* Quick tip */}
      <div className="px-3 py-2 bg-slate-800/50 border-t border-slate-700">
        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Moving camera creates keyframes automatically
        </p>
      </div>
    </div>
  )
}
