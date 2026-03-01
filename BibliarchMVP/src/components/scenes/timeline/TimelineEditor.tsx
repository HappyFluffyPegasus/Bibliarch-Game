'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Plus, Camera, Move, MessageSquare, Magnet } from 'lucide-react'
import TimelineRuler from './TimelineRuler'
import TimelineTrack from './TimelineTrack'
import TimelinePlayhead from './TimelinePlayhead'
import type {
  SceneCharacter,
  CameraKeyframe,
  MovementKeyframe,
  AnimationKeyframe,
  DialogueLine
} from '@/types/scenes'

export interface TimelineEditorProps {
  duration: number
  currentTime: number
  characters: SceneCharacter[]
  selectedCharacterId?: string | null
  cameraKeyframes: CameraKeyframe[]
  movementKeyframes: MovementKeyframe[]
  animationKeyframes: AnimationKeyframe[]
  dialogue: DialogueLine[]

  // Selection
  selectedKeyframeId: string | null
  selectedKeyframeType: 'camera' | 'movement' | 'animation' | 'dialogue' | null
  selectedKeyframeIds?: Set<string>

  // Callbacks
  onSeek: (time: number) => void
  onSelectKeyframe: (id: string | null, type: 'camera' | 'movement' | 'animation' | 'dialogue' | null, shiftKey?: boolean) => void
  onDurationChange: (duration: number) => void

  // Camera
  onAddCameraKeyframe: (time: number) => void
  onUpdateCameraKeyframe: (id: string, updates: Partial<CameraKeyframe>) => void
  onDeleteCameraKeyframe: (id: string) => void

  // Movement
  onAddMovementKeyframe: (characterId: string, time: number) => void
  onUpdateMovementKeyframe: (id: string, updates: Partial<MovementKeyframe>) => void
  onDeleteMovementKeyframe: (id: string) => void

  // Animation
  onAddAnimationKeyframe: (characterId: string, time: number) => void
  onUpdateAnimationKeyframe: (id: string, updates: Partial<AnimationKeyframe>) => void
  onDeleteAnimationKeyframe: (id: string) => void

  // Dialogue
  onAddDialogue: () => void
  onUpdateDialogue: (id: string, updates: Partial<DialogueLine>) => void
  onDeleteDialogue: (id: string) => void
}

const TRACK_LABEL_WIDTH = 180
const MIN_PIXELS_PER_SECOND = 20
const MAX_PIXELS_PER_SECOND = 200
const DEFAULT_PIXELS_PER_SECOND = 60

// Distinct colors for character tracks
const CHARACTER_COLORS = [
  '#34d399', // emerald-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#60a5fa', // blue-400
  '#a3e635', // lime-400
  '#c084fc', // purple-400
  '#fbbf24', // amber-400
  '#2dd4bf', // teal-400
]

export default function TimelineEditor({
  duration,
  currentTime,
  characters,
  selectedCharacterId,
  cameraKeyframes,
  movementKeyframes,
  animationKeyframes,
  dialogue,
  selectedKeyframeId,
  selectedKeyframeType,
  selectedKeyframeIds = new Set(),
  onSeek,
  onSelectKeyframe,
  onDurationChange,
  onAddCameraKeyframe,
  onUpdateCameraKeyframe,
  onDeleteCameraKeyframe,
  onAddMovementKeyframe,
  onUpdateMovementKeyframe,
  onDeleteMovementKeyframe,
  onAddAnimationKeyframe,
  onUpdateAnimationKeyframe,
  onDeleteAnimationKeyframe,
  onAddDialogue,
  onUpdateDialogue,
  onDeleteDialogue
}: TimelineEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Zoom level (pixels per second)
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND)

  // Scroll position
  const [scrollLeft, setScrollLeft] = useState(0)

  // Snap mode
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapInterval, setSnapInterval] = useState(0.25) // seconds

  // Track visibility
  const [hiddenTracks, setHiddenTracks] = useState<Set<string>>(new Set())

  // Track expanded state (for showing property curves)
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set())

  // Dragging state
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)

  // Calculate timeline width
  const timelineWidth = useMemo(() => {
    return Math.max(duration * pixelsPerSecond, 800)
  }, [duration, pixelsPerSecond])

  // Convert time to pixel position
  const timeToPixel = useCallback((time: number) => {
    return time * pixelsPerSecond
  }, [pixelsPerSecond])

  // Convert pixel position to time
  const pixelToTime = useCallback((pixel: number) => {
    return pixel / pixelsPerSecond
  }, [pixelsPerSecond])

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft)
  }, [])

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setPixelsPerSecond(prev => Math.min(MAX_PIXELS_PER_SECOND, prev * 1.25))
  }, [])

  const handleZoomOut = useCallback(() => {
    setPixelsPerSecond(prev => Math.max(MIN_PIXELS_PER_SECOND, prev / 1.25))
  }, [])

  const handleZoomFit = useCallback(() => {
    if (!scrollContainerRef.current) return
    const containerWidth = scrollContainerRef.current.clientWidth - TRACK_LABEL_WIDTH
    const newPps = Math.max(MIN_PIXELS_PER_SECOND, Math.min(MAX_PIXELS_PER_SECOND, containerWidth / duration))
    setPixelsPerSecond(newPps)
    setScrollLeft(0)
  }, [duration])

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setPixelsPerSecond(prev => Math.max(MIN_PIXELS_PER_SECOND, Math.min(MAX_PIXELS_PER_SECOND, prev * delta)))
    }
  }, [])

  // Handle playhead drag
  const handlePlayheadDrag = useCallback((e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return

    const rect = scrollContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - TRACK_LABEL_WIDTH + scrollLeft
    const time = Math.max(0, Math.min(duration, pixelToTime(x)))
    onSeek(Math.round(time * 100) / 100)
  }, [scrollLeft, pixelToTime, duration, onSeek])

  // Handle mouse move for playhead drag
  useEffect(() => {
    if (!isDraggingPlayhead) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current) return
      const rect = scrollContainerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left - TRACK_LABEL_WIDTH + scrollLeft
      const time = Math.max(0, Math.min(duration, pixelToTime(x)))
      onSeek(Math.round(time * 100) / 100)
    }

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPlayhead, scrollLeft, pixelToTime, duration, onSeek])

  // Toggle track visibility
  const toggleTrackVisibility = useCallback((trackId: string) => {
    setHiddenTracks(prev => {
      const next = new Set(prev)
      if (next.has(trackId)) {
        next.delete(trackId)
      } else {
        next.add(trackId)
      }
      return next
    })
  }, [])

  // Toggle track expanded
  const toggleTrackExpanded = useCallback((trackId: string) => {
    setExpandedTracks(prev => {
      const next = new Set(prev)
      if (next.has(trackId)) {
        next.delete(trackId)
      } else {
        next.add(trackId)
      }
      return next
    })
  }, [])

  // Build tracks data
  const tracks = useMemo(() => {
    const result: Array<{
      id: string
      type: 'camera' | 'character' | 'dialogue'
      label: string
      color: string
      characterId?: string
      keyframes: Array<{ id: string; time: number; type: string }>
      clips?: Array<{ id: string; startTime: number; duration: number; label: string }>
    }> = []

    // Camera track
    result.push({
      id: 'camera',
      type: 'camera',
      label: 'Camera',
      color: '#38bdf8', // sky-400
      keyframes: cameraKeyframes.map(kf => ({ id: kf.id, time: kf.time, type: 'camera' }))
    })

    // Character tracks (each character gets a unique color)
    characters.forEach((char, index) => {
      const charMovementKfs = movementKeyframes.filter(kf => kf.characterId === char.id)
      const charAnimationKfs = animationKeyframes.filter(kf => kf.characterId === char.id)

      result.push({
        id: `char-${char.id}`,
        type: 'character',
        label: char.name,
        color: CHARACTER_COLORS[index % CHARACTER_COLORS.length],
        characterId: char.id,
        keyframes: [
          ...charMovementKfs.map(kf => ({ id: kf.id, time: kf.time, type: 'movement' })),
          ...charAnimationKfs.map(kf => ({ id: kf.id, time: kf.time, type: 'animation' }))
        ]
      })
    })

    // Dialogue track
    result.push({
      id: 'dialogue',
      type: 'dialogue',
      label: 'Dialogue',
      color: '#a78bfa', // violet-400
      keyframes: [],
      clips: dialogue.map(d => ({
        id: d.id,
        startTime: d.startTime,
        duration: d.duration,
        label: `${d.characterName}: "${d.text.slice(0, 20)}${d.text.length > 20 ? '...' : ''}"`
      }))
    })

    return result
  }, [characters, cameraKeyframes, movementKeyframes, animationKeyframes, dialogue])

  return (
    <div ref={containerRef} className="flex flex-col bg-slate-900 select-none h-full min-h-[200px]" onWheel={handleWheel}>
      {/* Toolbar */}
      <div className="h-8 flex items-center justify-between px-2 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Timeline</span>
          <div className="h-4 w-px bg-slate-700" />
          {/* Quick add buttons */}
          <button
            onClick={() => onAddCameraKeyframe(currentTime)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 hover:bg-sky-500/30"
            title="Add Camera Keyframe"
          >
            <Camera className="w-3 h-3" />
            <Plus className="w-2.5 h-2.5" />
          </button>
          {characters.length > 0 && (
            <button
              onClick={() => {
                const targetId = selectedCharacterId || characters[0].id
                onAddMovementKeyframe(targetId, currentTime)
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
              title={`Add Movement Keyframe${selectedCharacterId ? '' : ' (first character)'}`}
            >
              <Move className="w-3 h-3" />
              <Plus className="w-2.5 h-2.5" />
            </button>
          )}
          <button
            onClick={onAddDialogue}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
            title="Add Dialogue"
          >
            <MessageSquare className="w-3 h-3" />
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          {/* Snap toggle */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`p-1 rounded transition-colors mr-1 ${
              snapEnabled ? 'text-sky-400 bg-sky-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
            title={snapEnabled ? `Snap: ${snapInterval}s (click to disable)` : 'Snap: Off (click to enable)'}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
          {snapEnabled && (
            <select
              value={snapInterval}
              onChange={(e) => setSnapInterval(parseFloat(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300 px-1 py-0.5 mr-2"
            >
              <option value={0.1}>0.1s</option>
              <option value={0.25}>0.25s</option>
              <option value={0.5}>0.5s</option>
              <option value={1}>1s</option>
            </select>
          )}
          <div className="h-4 w-px bg-slate-700 mr-1" />
          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
            title="Zoom Out (Ctrl+Scroll)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="w-16 h-1 bg-slate-700 rounded-full mx-1 relative">
            <div
              className="absolute top-0 left-0 h-full bg-sky-500 rounded-full"
              style={{
                width: `${((pixelsPerSecond - MIN_PIXELS_PER_SECOND) / (MAX_PIXELS_PER_SECOND - MIN_PIXELS_PER_SECOND)) * 100}%`
              }}
            />
          </div>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
            title="Zoom In (Ctrl+Scroll)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomFit}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 ml-1"
            title="Fit to Window"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-500 ml-2">
            {Math.round(pixelsPerSecond)}px/s
          </span>
        </div>
      </div>

      {/* Timeline content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div style={{ width: timelineWidth + TRACK_LABEL_WIDTH, minHeight: '100%' }}>
          {/* Time ruler */}
          <div className="sticky top-0 z-20 flex">
            <div className="w-[180px] flex-shrink-0 bg-slate-800 border-b border-r border-slate-700/50" />
            <TimelineRuler
              duration={duration}
              pixelsPerSecond={pixelsPerSecond}
              width={timelineWidth}
              onSeek={onSeek}
              onDurationChange={onDurationChange}
            />
          </div>

          {/* Tracks */}
          <div className="relative">
            {tracks.map(track => (
              <TimelineTrack
                key={track.id}
                id={track.id}
                type={track.type}
                label={track.label}
                color={track.color}
                characterId={track.characterId}
                keyframes={track.keyframes}
                clips={track.clips}
                duration={duration}
                pixelsPerSecond={pixelsPerSecond}
                timelineWidth={timelineWidth}
                isHidden={hiddenTracks.has(track.id)}
                isExpanded={expandedTracks.has(track.id)}
                snapInterval={snapEnabled ? snapInterval : null}
                selectedKeyframeId={selectedKeyframeId}
                selectedKeyframeType={selectedKeyframeType}
                selectedKeyframeIds={selectedKeyframeIds}
                onToggleVisibility={() => toggleTrackVisibility(track.id)}
                onToggleExpanded={() => toggleTrackExpanded(track.id)}
                onSelectKeyframe={onSelectKeyframe}
                onAddKeyframe={(time) => {
                  if (track.type === 'camera') {
                    onAddCameraKeyframe(time)
                  } else if (track.type === 'character' && track.characterId) {
                    // Default to movement keyframe
                    onAddMovementKeyframe(track.characterId, time)
                  } else if (track.type === 'dialogue') {
                    onAddDialogue()
                  }
                }}
                onMoveKeyframe={(id, time, type) => {
                  if (type === 'camera') {
                    onUpdateCameraKeyframe(id, { time })
                  } else if (type === 'movement') {
                    onUpdateMovementKeyframe(id, { time })
                  } else if (type === 'animation') {
                    onUpdateAnimationKeyframe(id, { time })
                  }
                }}
                onMoveClip={(id, startTime, duration) => {
                  onUpdateDialogue(id, { startTime, duration })
                }}
                onDeleteKeyframe={(id, type) => {
                  if (type === 'camera') {
                    onDeleteCameraKeyframe(id)
                  } else if (type === 'movement') {
                    onDeleteMovementKeyframe(id)
                  } else if (type === 'animation') {
                    onDeleteAnimationKeyframe(id)
                  } else if (type === 'dialogue') {
                    onDeleteDialogue(id)
                  }
                }}
              />
            ))}

            {/* Playhead */}
            <TimelinePlayhead
              currentTime={currentTime}
              pixelsPerSecond={pixelsPerSecond}
              labelWidth={TRACK_LABEL_WIDTH}
              height={tracks.length * 36 + (tracks.filter(t => expandedTracks.has(t.id)).length * 60)}
              isDragging={isDraggingPlayhead}
              onDragStart={() => setIsDraggingPlayhead(true)}
              onDrag={handlePlayheadDrag}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
