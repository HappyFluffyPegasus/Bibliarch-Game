'use client'

import { Camera, Move, Play, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  CameraKeyframe,
  MovementKeyframe,
  AnimationKeyframe,
  DialogueLine,
  EasingType,
  CharacterAnimationState,
  SceneCharacter
} from '@/types/scenes'
import AnimationPicker from './AnimationPicker'

interface KeyframePropertiesPanelProps {
  keyframeType: 'camera' | 'movement' | 'animation' | 'dialogue' | null
  keyframeId: string | null
  duration: number
  characters: SceneCharacter[]

  // Keyframe data
  cameraKeyframes: CameraKeyframe[]
  movementKeyframes: MovementKeyframe[]
  animationKeyframes: AnimationKeyframe[]
  dialogue: DialogueLine[]

  // Update callbacks
  onUpdateCameraKeyframe: (id: string, updates: Partial<CameraKeyframe>) => void
  onDeleteCameraKeyframe: (id: string) => void
  onUpdateMovementKeyframe: (id: string, updates: Partial<MovementKeyframe>) => void
  onDeleteMovementKeyframe: (id: string) => void
  onUpdateAnimationKeyframe: (id: string, updates: Partial<AnimationKeyframe>) => void
  onDeleteAnimationKeyframe: (id: string) => void
  onUpdateDialogue: (id: string, updates: Partial<DialogueLine>) => void
  onDeleteDialogue: (id: string) => void

  // Camera capture
  onCaptureCameraPosition?: () => { position: [number, number, number]; rotation: [number, number, number]; fov: number } | null
}

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
]

export default function KeyframePropertiesPanel({
  keyframeType,
  keyframeId,
  duration,
  characters,
  cameraKeyframes,
  movementKeyframes,
  animationKeyframes,
  dialogue,
  onUpdateCameraKeyframe,
  onDeleteCameraKeyframe,
  onUpdateMovementKeyframe,
  onDeleteMovementKeyframe,
  onUpdateAnimationKeyframe,
  onDeleteAnimationKeyframe,
  onUpdateDialogue,
  onDeleteDialogue,
  onCaptureCameraPosition
}: KeyframePropertiesPanelProps) {
  if (!keyframeType || !keyframeId) {
    return (
      <div className="p-4 text-center text-slate-500 text-sm">
        <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Select a keyframe to edit</p>
        <p className="text-xs mt-1 opacity-70">
          Double-click on a track to add keyframes
        </p>
      </div>
    )
  }

  // Camera keyframe
  if (keyframeType === 'camera') {
    const kf = cameraKeyframes.find(k => k.id === keyframeId)
    if (!kf) return null

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-medium text-slate-200">Camera Keyframe</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteCameraKeyframe(kf.id)}
            className="h-7 px-2 text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Time */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Time (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max={duration}
            value={kf.time}
            onChange={(e) => onUpdateCameraKeyframe(kf.id, { time: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
          />
        </div>

        {/* Capture button */}
        {onCaptureCameraPosition && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const captured = onCaptureCameraPosition()
              if (captured) {
                onUpdateCameraKeyframe(kf.id, {
                  position: captured.position,
                  rotation: captured.rotation,
                  fov: captured.fov
                })
              }
            }}
            className="w-full bg-slate-800 border-slate-700"
          >
            <Camera className="w-3 h-3 mr-2" />
            Capture Current Camera
          </Button>
        )}

        {/* Position */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Position (X, Y, Z)</label>
          <div className="grid grid-cols-3 gap-1">
            {['X', 'Y', 'Z'].map((axis, i) => (
              <input
                key={axis}
                type="number"
                step="0.5"
                value={kf.position[i]}
                onChange={(e) => {
                  const newPos = [...kf.position] as [number, number, number]
                  newPos[i] = parseFloat(e.target.value) || 0
                  onUpdateCameraKeyframe(kf.id, { position: newPos })
                }}
                className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 text-center"
                title={axis}
              />
            ))}
          </div>
        </div>

        {/* Rotation */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Rotation (X, Y, Z) deg</label>
          <div className="grid grid-cols-3 gap-1">
            {['X', 'Y', 'Z'].map((axis, i) => (
              <input
                key={axis}
                type="number"
                step="5"
                value={Math.round((kf.rotation[i] * 180) / Math.PI)}
                onChange={(e) => {
                  const newRot = [...kf.rotation] as [number, number, number]
                  newRot[i] = ((parseFloat(e.target.value) || 0) * Math.PI) / 180
                  onUpdateCameraKeyframe(kf.id, { rotation: newRot })
                }}
                className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 text-center"
                title={axis}
              />
            ))}
          </div>
        </div>

        {/* FOV */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">FOV: {kf.fov}</label>
          <input
            type="range"
            min="20"
            max="120"
            value={kf.fov}
            onChange={(e) => onUpdateCameraKeyframe(kf.id, { fov: parseInt(e.target.value) })}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        {/* Easing */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Easing</label>
          <select
            value={kf.easing}
            onChange={(e) => onUpdateCameraKeyframe(kf.id, { easing: e.target.value as EasingType })}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            {EASING_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  // Movement keyframe
  if (keyframeType === 'movement') {
    const kf = movementKeyframes.find(k => k.id === keyframeId)
    if (!kf) return null

    const character = characters.find(c => c.id === kf.characterId)

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-200">Movement Keyframe</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteMovementKeyframe(kf.id)}
            className="h-7 px-2 text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {character && (
          <div className="text-xs text-slate-400">
            Character: <span className="text-slate-200">{character.name}</span>
          </div>
        )}

        {/* Time */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Time (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max={duration}
            value={kf.time}
            onChange={(e) => onUpdateMovementKeyframe(kf.id, { time: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Position (X, Y, Z)</label>
          <div className="grid grid-cols-3 gap-1">
            {['X', 'Y', 'Z'].map((axis, i) => (
              <input
                key={axis}
                type="number"
                step="0.5"
                value={kf.position[i]}
                onChange={(e) => {
                  const newPos = [...kf.position] as [number, number, number]
                  newPos[i] = parseFloat(e.target.value) || 0
                  onUpdateMovementKeyframe(kf.id, { position: newPos })
                }}
                className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 text-center"
                title={axis}
              />
            ))}
          </div>
        </div>

        {/* Rotation */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Rotation (deg)</label>
          <input
            type="number"
            step="15"
            value={Math.round((kf.rotation * 180) / Math.PI)}
            onChange={(e) => {
              const deg = parseFloat(e.target.value) || 0
              onUpdateMovementKeyframe(kf.id, { rotation: (deg * Math.PI) / 180 })
            }}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
          />
        </div>

        {/* Easing */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Easing</label>
          <select
            value={kf.easing}
            onChange={(e) => onUpdateMovementKeyframe(kf.id, { easing: e.target.value as EasingType })}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            {EASING_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  // Animation keyframe
  if (keyframeType === 'animation') {
    const kf = animationKeyframes.find(k => k.id === keyframeId)
    if (!kf) return null

    const character = characters.find(c => c.id === kf.characterId)

    const updateAnimation = (updates: Partial<CharacterAnimationState>) => {
      onUpdateAnimationKeyframe(kf.id, {
        animation: { ...kf.animation, ...updates }
      })
    }

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-slate-200">Animation Keyframe</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteAnimationKeyframe(kf.id)}
            className="h-7 px-2 text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {character && (
          <div className="text-xs text-slate-400">
            Character: <span className="text-slate-200">{character.name}</span>
          </div>
        )}

        {/* Time */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Time (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max={duration}
            value={kf.time}
            onChange={(e) => onUpdateAnimationKeyframe(kf.id, { time: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
          />
        </div>

        {/* Pose */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Pose</label>
          <AnimationPicker
            type="pose"
            selectedId={kf.animation.basePose}
            onSelect={(id) => updateAnimation({ basePose: id })}
            compact
          />
        </div>

        {/* Emotion */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Emotion</label>
          <AnimationPicker
            type="emotion"
            selectedId={kf.animation.emotion}
            onSelect={(id) => updateAnimation({ emotion: id })}
            compact
          />
          {kf.animation.emotion && (
            <div className="mt-2">
              <label className="block text-[10px] text-slate-500 mb-1">Intensity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={kf.animation.emotionIntensity}
                onChange={(e) => updateAnimation({ emotionIntensity: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          )}
        </div>

        {/* Clip */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Animation Clip</label>
          <AnimationPicker
            type="clip"
            selectedId={kf.animation.clipAnimation}
            onSelect={(id) => updateAnimation({ clipAnimation: id })}
            compact
          />
        </div>

        {/* Easing */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Easing</label>
          <select
            value={kf.easing}
            onChange={(e) => onUpdateAnimationKeyframe(kf.id, { easing: e.target.value as EasingType })}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            {EASING_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  // Dialogue
  if (keyframeType === 'dialogue') {
    const line = dialogue.find(d => d.id === keyframeId)
    if (!line) return null

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-slate-200">Dialogue</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteDialogue(line.id)}
            className="h-7 px-2 text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Character */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Character</label>
          <select
            value={line.characterId}
            onChange={(e) => {
              const char = characters.find(c => c.id === e.target.value)
              if (char) {
                onUpdateDialogue(line.id, {
                  characterId: char.id,
                  characterName: char.name
                })
              }
            }}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            {characters.map(char => (
              <option key={char.id} value={char.id}>{char.name}</option>
            ))}
          </select>
        </div>

        {/* Text */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Text</label>
          <textarea
            value={line.text}
            onChange={(e) => onUpdateDialogue(line.id, { text: e.target.value })}
            rows={3}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 resize-none"
          />
        </div>

        {/* Timing */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Start (s)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max={duration - line.duration}
              value={line.startTime}
              onChange={(e) => onUpdateDialogue(line.id, { startTime: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Duration (s)</label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max={duration - line.startTime}
              value={line.duration}
              onChange={(e) => onUpdateDialogue(line.id, { duration: parseFloat(e.target.value) || 1 })}
              className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
            />
          </div>
        </div>
      </div>
    )
  }

  return null
}
