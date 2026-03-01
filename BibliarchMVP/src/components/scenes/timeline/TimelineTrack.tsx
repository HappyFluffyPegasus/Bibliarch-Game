'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react'

interface Keyframe {
  id: string
  time: number
  type: string
}

interface Clip {
  id: string
  startTime: number
  duration: number
  label: string
}

interface TimelineTrackProps {
  id: string
  type: 'camera' | 'character' | 'dialogue'
  label: string
  color: string
  characterId?: string
  keyframes: Keyframe[]
  clips?: Clip[]
  duration: number
  pixelsPerSecond: number
  timelineWidth: number
  isHidden: boolean
  isExpanded: boolean
  selectedKeyframeId: string | null
  selectedKeyframeType: 'camera' | 'movement' | 'animation' | 'dialogue' | null
  selectedKeyframeIds?: Set<string>
  snapInterval: number | null // null = no snapping
  onToggleVisibility: () => void
  onToggleExpanded: () => void
  onSelectKeyframe: (id: string | null, type: 'camera' | 'movement' | 'animation' | 'dialogue' | null, shiftKey?: boolean) => void
  onAddKeyframe: (time: number) => void
  onMoveKeyframe: (id: string, time: number, type: string) => void
  onMoveClip: (id: string, startTime: number, duration: number) => void
  onDeleteKeyframe: (id: string, type: string) => void
}

const TRACK_LABEL_WIDTH = 180
const TRACK_HEIGHT = 36
const EXPANDED_HEIGHT = 96

export default function TimelineTrack({
  id,
  type,
  label,
  color,
  characterId,
  keyframes,
  clips,
  duration,
  pixelsPerSecond,
  timelineWidth,
  isHidden,
  isExpanded,
  selectedKeyframeId,
  selectedKeyframeType,
  selectedKeyframeIds = new Set(),
  snapInterval,
  onToggleVisibility,
  onToggleExpanded,
  onSelectKeyframe,
  onAddKeyframe,
  onMoveKeyframe,
  onMoveClip,
  onDeleteKeyframe
}: TimelineTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [draggingKeyframe, setDraggingKeyframe] = useState<{ id: string; type: string; startX: number; startTime: number } | null>(null)
  const [draggingClip, setDraggingClip] = useState<{ id: string; mode: 'move' | 'resize-left' | 'resize-right'; startX: number; startTime: number; startDuration: number } | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)

  // Snap time to grid if enabled
  const snapTime = useCallback((time: number) => {
    if (!snapInterval) return Math.round(time * 100) / 100
    return Math.round(time / snapInterval) * snapInterval
  }, [snapInterval])

  // Calculate track height
  const trackHeight = isExpanded ? EXPANDED_HEIGHT : TRACK_HEIGHT

  // Handle double-click to add keyframe
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isLocked || isHidden) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = Math.max(0, Math.round((x / pixelsPerSecond) * 100) / 100)
    onAddKeyframe(time)
  }, [isLocked, isHidden, pixelsPerSecond, onAddKeyframe])

  // Handle track mouse move for hover indicator
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingKeyframe || draggingClip) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = Math.max(0, x / pixelsPerSecond)
    setHoverTime(time)
  }, [draggingKeyframe, draggingClip, pixelsPerSecond])

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null)
  }, [])

  // Keyframe dragging
  const handleKeyframeDragStart = useCallback((e: React.MouseEvent, kf: Keyframe) => {
    if (isLocked) return
    e.stopPropagation()
    onSelectKeyframe(kf.id, kf.type as 'camera' | 'movement' | 'animation' | 'dialogue', e.shiftKey)
    setDraggingKeyframe({
      id: kf.id,
      type: kf.type,
      startX: e.clientX,
      startTime: kf.time
    })
  }, [isLocked, onSelectKeyframe])

  // Clip dragging
  const handleClipDragStart = useCallback((e: React.MouseEvent, clip: Clip, mode: 'move' | 'resize-left' | 'resize-right') => {
    if (isLocked) return
    e.stopPropagation()
    onSelectKeyframe(clip.id, 'dialogue')
    setDraggingClip({
      id: clip.id,
      mode,
      startX: e.clientX,
      startTime: clip.startTime,
      startDuration: clip.duration
    })
  }, [isLocked, onSelectKeyframe])

  // Attach global listeners for dragging
  useEffect(() => {
    if (!draggingKeyframe && !draggingClip) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingKeyframe) {
        const deltaX = e.clientX - draggingKeyframe.startX
        const deltaTime = deltaX / pixelsPerSecond
        const raw = draggingKeyframe.startTime + deltaTime
        const newTime = Math.max(0, Math.min(duration, snapTime(raw)))
        onMoveKeyframe(draggingKeyframe.id, newTime, draggingKeyframe.type)
      }

      if (draggingClip) {
        const deltaX = e.clientX - draggingClip.startX
        const deltaTime = deltaX / pixelsPerSecond

        if (draggingClip.mode === 'move') {
          const newStart = Math.max(0, snapTime(draggingClip.startTime + deltaTime))
          onMoveClip(draggingClip.id, newStart, draggingClip.startDuration)
        } else if (draggingClip.mode === 'resize-left') {
          const newStart = Math.max(0, snapTime(draggingClip.startTime + deltaTime))
          const newDuration = Math.max(0.5, draggingClip.startDuration - (newStart - draggingClip.startTime))
          onMoveClip(draggingClip.id, newStart, snapTime(newDuration))
        } else if (draggingClip.mode === 'resize-right') {
          const newDuration = Math.max(0.5, snapTime(draggingClip.startDuration + deltaTime))
          onMoveClip(draggingClip.id, draggingClip.startTime, newDuration)
        }
      }
    }

    const handleGlobalMouseUp = () => {
      setDraggingKeyframe(null)
      setDraggingClip(null)
    }

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [draggingKeyframe, draggingClip, pixelsPerSecond, duration, onMoveKeyframe, onMoveClip, snapTime])

  // Sort keyframes by time
  const sortedKeyframes = useMemo(() => {
    return [...keyframes].sort((a, b) => a.time - b.time)
  }, [keyframes])

  // Handle keyframe deletion with keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeId) {
      const kf = keyframes.find(k => k.id === selectedKeyframeId)
      if (kf) {
        onDeleteKeyframe(kf.id, kf.type)
      }
    }
  }, [selectedKeyframeId, keyframes, onDeleteKeyframe])

  return (
    <div
      className={`flex border-b border-slate-700/50 ${isHidden ? 'opacity-50' : ''}`}
      style={{ height: trackHeight }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Track label area */}
      <div
        className="flex-shrink-0 bg-slate-800 border-r border-slate-700/50 flex items-start py-2 px-2 gap-1"
        style={{ width: TRACK_LABEL_WIDTH }}
      >
        {/* Expand/collapse button */}
        <button
          onClick={onToggleExpanded}
          className="p-0.5 rounded hover:bg-slate-700 text-slate-400"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Track color indicator */}
        <div
          className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Label */}
        <span className="text-xs text-slate-300 truncate flex-1">{label}</span>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onToggleVisibility}
            className="p-0.5 rounded hover:bg-slate-700 text-slate-400"
            title={isHidden ? 'Show Track' : 'Hide Track'}
          >
            {isHidden ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`p-0.5 rounded hover:bg-slate-700 ${isLocked ? 'text-amber-400' : 'text-slate-400'}`}
            title={isLocked ? 'Unlock Track' : 'Lock Track'}
          >
            {isLocked ? (
              <Lock className="w-3 h-3" />
            ) : (
              <Unlock className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Track content area */}
      <div
        ref={trackRef}
        className={`relative flex-1 ${isLocked ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
        style={{ width: timelineWidth }}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Track background */}
        <div className="absolute inset-0 bg-slate-900/50" />

        {/* Grid lines (every second) */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-slate-700/30"
              style={{ left: i * pixelsPerSecond }}
            />
          ))}
        </div>

        {/* Clips (for dialogue track) */}
        {clips?.map(clip => {
          const isSelected = selectedKeyframeId === clip.id && selectedKeyframeType === 'dialogue'
          const clipWidth = clip.duration * pixelsPerSecond

          return (
            <div
              key={clip.id}
              className={`absolute top-1 bottom-1 rounded group ${isSelected ? 'ring-2 ring-white' : ''}`}
              style={{
                left: clip.startTime * pixelsPerSecond,
                width: clipWidth,
                backgroundColor: color,
                opacity: isHidden ? 0.3 : 0.8
              }}
            >
              {/* Left resize handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
                onMouseDown={(e) => handleClipDragStart(e, clip, 'resize-left')}
              />

              {/* Center drag area */}
              <div
                className="absolute inset-0 mx-2 cursor-move flex items-center overflow-hidden px-1"
                onMouseDown={(e) => handleClipDragStart(e, clip, 'move')}
              >
                <span className="text-[10px] text-white truncate">{clip.label}</span>
              </div>

              {/* Right resize handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
                onMouseDown={(e) => handleClipDragStart(e, clip, 'resize-right')}
              />

              {/* Delete button on hover */}
              {isSelected && !isLocked && (
                <button
                  className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteKeyframe(clip.id, 'dialogue')
                  }}
                >
                  <Trash2 className="w-2.5 h-2.5 text-white" />
                </button>
              )}
            </div>
          )
        })}

        {/* Keyframes */}
        {sortedKeyframes.map(kf => {
          const isSelected = selectedKeyframeId === kf.id || selectedKeyframeIds.has(kf.id)
          const x = kf.time * pixelsPerSecond

          return (
            <div
              key={kf.id}
              className={`absolute top-1/2 -translate-y-1/2 cursor-pointer group ${isHidden ? 'pointer-events-none' : ''}`}
              style={{ left: x }}
              onMouseDown={(e) => handleKeyframeDragStart(e, kf)}
            >
              {/* Keyframe diamond - animation keyframes are rounded */}
              <div
                className={`w-3 h-3 -translate-x-1/2 border-2 transition-colors ${
                  kf.type === 'animation' ? 'rounded-full' : 'rotate-45'
                } ${
                  isSelected
                    ? 'bg-white border-white'
                    : 'border-current hover:bg-current/50'
                }`}
                style={{ color: color, backgroundColor: isSelected ? undefined : 'transparent' }}
              />

              {/* Type indicator */}
              {kf.type !== 'camera' && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color }}
                >
                  {kf.type === 'movement' ? 'Mov' : 'Anim'}
                </div>
              )}

              {/* Delete button on hover */}
              {isSelected && !isLocked && (
                <button
                  className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteKeyframe(kf.id, kf.type)
                  }}
                >
                  <Trash2 className="w-2.5 h-2.5 text-white" />
                </button>
              )}
            </div>
          )
        })}

        {/* Hover indicator line */}
        {hoverTime !== null && !isLocked && (
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-500/50 pointer-events-none"
            style={{ left: hoverTime * pixelsPerSecond }}
          />
        )}

        {/* Expanded property curves area */}
        {isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-slate-800/50 border-t border-slate-700/30">
            {/* Property curve graph placeholder */}
            <svg className="w-full h-full">
              {/* Y-axis labels */}
              <text x="4" y="15" className="text-[8px] fill-slate-500">100</text>
              <text x="4" y="55" className="text-[8px] fill-slate-500">0</text>

              {/* Curve path connecting keyframes */}
              {sortedKeyframes.length > 1 && (
                <path
                  d={sortedKeyframes.map((kf, i) => {
                    const x = kf.time * pixelsPerSecond
                    const y = 30 // Middle of the curve area
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                  }).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  opacity="0.7"
                />
              )}

              {/* Keyframe points on curve */}
              {sortedKeyframes.map(kf => {
                const x = kf.time * pixelsPerSecond
                const y = 30
                const isSelected = selectedKeyframeId === kf.id

                return (
                  <circle
                    key={kf.id}
                    cx={x}
                    cy={y}
                    r={isSelected ? 5 : 3}
                    fill={isSelected ? 'white' : color}
                    stroke={color}
                    strokeWidth="2"
                  />
                )
              })}
            </svg>
          </div>
        )}

        {/* Add keyframe button hint */}
        {!isLocked && !isHidden && hoverTime !== null && (
          <div
            className="absolute top-1 text-[8px] text-slate-400 pointer-events-none whitespace-nowrap"
            style={{ left: hoverTime * pixelsPerSecond + 4 }}
          >
            Double-click to add
          </div>
        )}
      </div>
    </div>
  )
}
