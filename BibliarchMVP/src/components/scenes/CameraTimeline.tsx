'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Camera, Plus, Trash2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CameraKeyframe, EasingType } from '@/types/scenes'

interface CameraTimelineProps {
  keyframes: CameraKeyframe[]
  duration: number
  currentTime: number
  selectedKeyframeId: string | null
  onAddKeyframe: (time: number) => void
  onRemoveKeyframe: (id: string) => void
  onSelectKeyframe: (id: string | null) => void
  onUpdateKeyframe: (id: string, updates: Partial<CameraKeyframe>) => void
  onSeek: (time: number) => void
}

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
]

export default function CameraTimeline({
  keyframes,
  duration,
  currentTime,
  selectedKeyframeId,
  onAddKeyframe,
  onRemoveKeyframe,
  onSelectKeyframe,
  onUpdateKeyframe,
  onSeek,
}: CameraTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedKeyframeId, setDraggedKeyframeId] = useState<string | null>(null)

  const selectedKeyframe = keyframes.find(kf => kf.id === selectedKeyframeId)

  // Convert time to percentage position
  const timeToPosition = useCallback((time: number) => {
    return (time / duration) * 100
  }, [duration])

  // Convert position to time
  const positionToTime = useCallback((clientX: number) => {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percent = Math.max(0, Math.min(1, x / rect.width))
    return percent * duration
  }, [duration])

  // Handle timeline click for seeking
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return
    const time = positionToTime(e.clientX)
    onSeek(time)
  }, [positionToTime, onSeek, isDragging])

  // Handle keyframe drag
  const handleKeyframeDragStart = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setIsDragging(true)
    setDraggedKeyframeId(id)
    onSelectKeyframe(id)
  }, [onSelectKeyframe])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !draggedKeyframeId) return
    const newTime = positionToTime(e.clientX)
    onUpdateKeyframe(draggedKeyframeId, { time: Math.round(newTime * 10) / 10 })
  }, [isDragging, draggedKeyframeId, positionToTime, onUpdateKeyframe])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDraggedKeyframeId(null)
  }, [])

  // Attach document-level mouse handlers during drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Handle double-click to add keyframe
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const time = positionToTime(e.clientX)
    onAddKeyframe(Math.round(time * 10) / 10)
  }, [positionToTime, onAddKeyframe])

  return (
    <div className="bg-slate-900 border-t border-slate-700">
      {/* Timeline header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-medium text-slate-300">Camera Keyframes</span>
          <span className="text-xs text-slate-500">({keyframes.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddKeyframe(currentTime)}
            className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
            title="Add keyframe at current time"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add at Playhead
          </Button>
        </div>
      </div>

      {/* Timeline track */}
      <div
        ref={timelineRef}
        className="relative h-12 mx-3 my-2 bg-slate-800 rounded cursor-pointer"
        onClick={handleTimelineClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Time markers */}
        <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
          {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-px h-2 bg-slate-600" />
              <span className="text-[8px] text-slate-500">{i}s</span>
            </div>
          ))}
        </div>

        {/* Keyframe markers */}
        {keyframes.map(kf => (
          <div
            key={kf.id}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing ${
              kf.id === selectedKeyframeId ? 'z-10' : ''
            }`}
            style={{ left: `${timeToPosition(kf.time)}%` }}
            onMouseDown={(e) => handleKeyframeDragStart(e, kf.id)}
            onClick={(e) => {
              e.stopPropagation()
              onSelectKeyframe(kf.id)
            }}
          >
            <div
              className={`w-3 h-3 rotate-45 border-2 transition-colors ${
                kf.id === selectedKeyframeId
                  ? 'bg-sky-500 border-sky-400'
                  : 'bg-slate-600 border-slate-500 hover:bg-slate-500'
              }`}
            />
          </div>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
          style={{ left: `${timeToPosition(currentTime)}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
        </div>
      </div>

      {/* Selected keyframe details */}
      {selectedKeyframe && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Keyframe at {selectedKeyframe.time.toFixed(1)}s
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onRemoveKeyframe(selectedKeyframe.id)
                onSelectKeyframe(null)
              }}
              className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Time input */}
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Time (s)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max={duration}
                value={selectedKeyframe.time}
                onChange={(e) => onUpdateKeyframe(selectedKeyframe.id, { time: parseFloat(e.target.value) || 0 })}
                className="w-full px-1.5 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200"
              />
            </div>

            {/* FOV input */}
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">FOV</label>
              <input
                type="number"
                step="5"
                min="20"
                max="120"
                value={selectedKeyframe.fov}
                onChange={(e) => onUpdateKeyframe(selectedKeyframe.id, { fov: parseInt(e.target.value) || 50 })}
                className="w-full px-1.5 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200"
              />
            </div>

            {/* Easing select */}
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Easing</label>
              <select
                value={selectedKeyframe.easing}
                onChange={(e) => onUpdateKeyframe(selectedKeyframe.id, { easing: e.target.value as EasingType })}
                className="w-full px-1.5 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200"
              >
                {EASING_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Position display (read-only for now) */}
          <div className="text-[10px] text-slate-500">
            Position: ({selectedKeyframe.position.map(v => v.toFixed(1)).join(', ')})
          </div>
        </div>
      )}

      {/* Help text when no keyframes */}
      {keyframes.length === 0 && (
        <div className="px-3 pb-3 text-xs text-slate-500 text-center">
          Double-click on the timeline to add keyframes, or use &quot;Add at Playhead&quot;.
        </div>
      )}
    </div>
  )
}
