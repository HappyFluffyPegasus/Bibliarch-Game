'use client'

import { Move, RotateCw, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TransformGizmoMode, SceneCharacter } from '@/types/scenes'

interface CharacterTransformPanelProps {
  character: SceneCharacter | null
  gizmoMode: TransformGizmoMode
  onGizmoModeChange: (mode: TransformGizmoMode) => void
  onPositionChange: (position: [number, number, number]) => void
  onRotationChange: (rotation: number) => void
}

export default function CharacterTransformPanel({
  character,
  gizmoMode,
  onGizmoModeChange,
  onPositionChange,
  onRotationChange,
}: CharacterTransformPanelProps) {
  if (!character) {
    return (
      <div className="p-4 text-center text-slate-500 text-sm">
        Select a character to edit transform
      </div>
    )
  }

  const handlePositionInput = (axis: 0 | 1 | 2, value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return

    const newPos: [number, number, number] = [...character.position]
    newPos[axis] = num
    onPositionChange(newPos)
  }

  const handleRotationInput = (value: string) => {
    const degrees = parseFloat(value)
    if (isNaN(degrees)) return

    // Convert degrees to radians
    const radians = (degrees * Math.PI) / 180
    onRotationChange(radians)
  }

  // Convert rotation to degrees for display
  const rotationDegrees = Math.round((character.rotation * 180) / Math.PI)

  return (
    <div className="p-4 space-y-4">
      {/* Character name */}
      <div className="text-sm font-medium text-slate-200">
        {character.name}
      </div>

      {/* Gizmo mode buttons */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-400">
          Transform Mode
        </label>
        <div className="flex gap-1">
          <Button
            variant={gizmoMode === 'translate' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onGizmoModeChange('translate')}
            className={`flex-1 ${gizmoMode === 'translate' ? 'bg-sky-600' : 'bg-slate-800 border-slate-700'}`}
            title="Move (G)"
          >
            <Move className="w-4 h-4 mr-1" />
            Move
          </Button>
          <Button
            variant={gizmoMode === 'rotate' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onGizmoModeChange('rotate')}
            className={`flex-1 ${gizmoMode === 'rotate' ? 'bg-sky-600' : 'bg-slate-800 border-slate-700'}`}
            title="Rotate (R)"
          >
            <RotateCw className="w-4 h-4 mr-1" />
            Rotate
          </Button>
          <Button
            variant={gizmoMode === 'scale' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onGizmoModeChange('scale')}
            className={`flex-1 ${gizmoMode === 'scale' ? 'bg-sky-600' : 'bg-slate-800 border-slate-700'}`}
            title="Scale (S)"
          >
            <Maximize2 className="w-4 h-4 mr-1" />
            Scale
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Shortcuts: G (move), R (rotate), S (scale)
        </p>
      </div>

      {/* Position inputs */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-400">
          Position
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">X</label>
            <input
              type="number"
              step="0.1"
              value={character.position[0].toFixed(2)}
              onChange={(e) => handlePositionInput(0, e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-600 rounded bg-slate-900 text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Y</label>
            <input
              type="number"
              step="0.1"
              value={character.position[1].toFixed(2)}
              onChange={(e) => handlePositionInput(1, e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-600 rounded bg-slate-900 text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Z</label>
            <input
              type="number"
              step="0.1"
              value={character.position[2].toFixed(2)}
              onChange={(e) => handlePositionInput(2, e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-600 rounded bg-slate-900 text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Rotation input */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-400">
          Rotation (Y-axis)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="15"
            value={rotationDegrees}
            onChange={(e) => handleRotationInput(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-slate-600 rounded bg-slate-900 text-slate-200"
          />
          <span className="text-xs text-slate-500">degrees</span>
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          value={rotationDegrees}
          onChange={(e) => handleRotationInput(e.target.value)}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />
      </div>
    </div>
  )
}
