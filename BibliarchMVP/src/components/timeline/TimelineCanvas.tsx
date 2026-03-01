'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Plus, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelineEvent } from '@/types/timeline'
import TimelineEventBlock from './TimelineEventBlock'
import TimelineTrack from './TimelineTrack'

interface Track {
  id: string
  name: string
  color: string
}

interface TimelineCanvasProps {
  events: TimelineEvent[]
  tracks: Track[]
  selectedEventId: string | null
  onSelectEvent: (id: string | null) => void
  onUpdateEvent: (id: string, updates: Partial<TimelineEvent>) => void
  onCreateEvent: (trackIndex: number) => void
  onAddTrack: () => void
  onRenameTrack: (trackId: string, name: string) => void
  onDeleteTrack: (trackId: string) => void
  parentEvent?: TimelineEvent | null
  onNavigateUp?: () => void
  breadcrumbs?: { id: string; title: string }[]
  onNavigateToBreadcrumb?: (id: string | null) => void
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
const ZOOM_STEP = 0.25

export default function TimelineCanvas({
  events,
  tracks,
  selectedEventId,
  onSelectEvent,
  onUpdateEvent,
  onCreateEvent,
  onAddTrack,
  onRenameTrack,
  onDeleteTrack,
  parentEvent,
  onNavigateUp,
  breadcrumbs = [],
  onNavigateToBreadcrumb
}: TimelineCanvasProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [zoom, setZoom] = useState(1)
  const [draggedEvent, setDraggedEvent] = useState<string | null>(null)
  const [draggedOverTrack, setDraggedOverTrack] = useState<number | null>(null)

  // Track height (pixels) - taller to show more summary content
  const TRACK_HEIGHT = 270
  const TRACK_HEADER_WIDTH = 150
  const EVENT_WIDTH_BASE = 320 // Base width per event unit - wider for more content

  // Calculate timeline width based on events - minimum shows some empty space for adding events
  const timelineWidth = useMemo(() => {
    if (events.length === 0) return 800
    const maxOrder = Math.max(...events.map(e => e.order || 0))
    return Math.max(800, (maxOrder + 2) * EVENT_WIDTH_BASE * zoom)
  }, [events, zoom])

  // Handle zoom
  const handleZoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  const handleZoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  const handleZoomReset = () => setZoom(1)

  // Handle mouse wheel zoom (ctrl/cmd + wheel)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)))
    }
    // Normal scroll is handled by the browser
  }, [])

  // Handle event drag
  const handleEventDragStart = useCallback((eventId: string, e: React.MouseEvent) => {
    setDraggedEvent(eventId)
  }, [])

  const handleEventDrag = useCallback((e: React.MouseEvent) => {
    if (!draggedEvent || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const rect = container.getBoundingClientRect()
    const scrollLeft = container.scrollLeft
    const scrollTop = container.scrollTop

    // Calculate position relative to timeline content
    const relativeX = (e.clientX - rect.left + scrollLeft - TRACK_HEADER_WIDTH) / zoom
    const relativeY = e.clientY - rect.top + scrollTop - 30 // account for ruler

    // Calculate new order and track
    let newOrder = Math.max(0, Math.round(relativeX / EVENT_WIDTH_BASE))
    const newTrack = Math.max(0, Math.min(tracks.length - 1, Math.floor(relativeY / TRACK_HEIGHT)))

    // Collision detection: check if any other event on the same track occupies this order
    const otherEventsOnTrack = events.filter(
      ev => ev.id !== draggedEvent && (ev.track ?? 0) === newTrack
    )
    const isCollision = otherEventsOnTrack.some(ev => ev.order === newOrder)

    if (isCollision) {
      // Find nearest non-colliding position
      for (let offset = 1; offset <= 20; offset++) {
        const after = newOrder + offset
        const before = newOrder - offset
        if (!otherEventsOnTrack.some(ev => ev.order === after)) {
          newOrder = after
          break
        }
        if (before >= 0 && !otherEventsOnTrack.some(ev => ev.order === before)) {
          newOrder = before
          break
        }
      }
    }

    // Update the visual indicator for which track we're hovering over
    setDraggedOverTrack(newTrack)

    // Update event position
    onUpdateEvent(draggedEvent, { order: newOrder, track: newTrack })
  }, [draggedEvent, zoom, tracks.length, events, onUpdateEvent, TRACK_HEIGHT, EVENT_WIDTH_BASE])

  const handleEventDragEnd = useCallback(() => {
    setDraggedEvent(null)
    setDraggedOverTrack(null)
  }, [])

  // Group events by track
  const eventsByTrack = useMemo(() => {
    const grouped: Record<number, TimelineEvent[]> = {}
    tracks.forEach((_, i) => { grouped[i] = [] })
    events.forEach(event => {
      const trackIndex = event.track ?? 0
      if (!grouped[trackIndex]) grouped[trackIndex] = []
      grouped[trackIndex].push(event)
    })
    return grouped
  }, [events, tracks])

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2">
          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <button
                onClick={() => onNavigateToBreadcrumb?.(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Root
              </button>
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  <span className="text-muted-foreground">/</span>
                  <button
                    onClick={() => onNavigateToBreadcrumb?.(crumb.id)}
                    className={`transition-colors ${
                      i === breadcrumbs.length - 1
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {crumb.title}
                  </button>
                </span>
              ))}
            </div>
          )}
          {parentEvent && (
            <Button variant="ghost" size="sm" onClick={onNavigateUp} className="gap-1">
              <ChevronLeft className="w-4 h-4" />
              Back to parent
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAddTrack}>
            <Plus className="w-4 h-4 mr-1" />
            Add Track
          </Button>
          <Button size="sm" onClick={() => onCreateEvent(0)} className="bg-sky-500 text-white hover:bg-sky-600">
            <Plus className="w-4 h-4 mr-1" />
            Add Event
          </Button>
          <div className="flex items-center gap-1 border-l border-slate-700 pl-2 ml-2">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleZoomReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable timeline container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
        onWheel={handleWheel}
        onMouseMove={draggedEvent ? handleEventDrag : undefined}
        onMouseUp={draggedEvent ? handleEventDragEnd : undefined}
        onMouseLeave={draggedEvent ? handleEventDragEnd : undefined}
        style={{ cursor: draggedEvent ? 'grabbing' : 'default' }}
      >
        <div className="flex min-h-full">
          {/* Fixed track headers column */}
          <div
            className="flex-shrink-0 bg-slate-800 border-r border-slate-700 sticky left-0 z-10"
            style={{ width: TRACK_HEADER_WIDTH }}
          >
            {/* Header for timeline ruler */}
            <div
              className="border-b border-border flex items-center justify-center text-xs text-muted-foreground bg-muted/50"
              style={{ height: 30 }}
            >
              Order
            </div>
            {/* Track headers */}
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="border-b border-border flex items-center bg-muted/50 relative"
                style={{ height: TRACK_HEIGHT }}
              >
                {/* Track color indicator */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 rounded-r"
                  style={{ backgroundColor: track.color }}
                />
                <div className="flex items-center justify-between flex-1 px-3 pl-4">
                  <input
                    type="text"
                    value={track.name}
                    onChange={(e) => onRenameTrack(track.id, e.target.value)}
                    className="bg-transparent text-sm font-medium text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                  />
                  {tracks.length > 1 && (
                    <button
                      onClick={() => onDeleteTrack(track.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Delete track"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline content area */}
          <div className="flex-1" style={{ minWidth: timelineWidth }}>
            {/* Timeline ruler */}
            <div
              className="border-b border-border flex items-end sticky top-0 bg-background z-5"
              style={{ height: 30 }}
            >
              {Array.from({ length: Math.ceil(timelineWidth / (EVENT_WIDTH_BASE * zoom)) }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 border-l border-slate-700/50 text-xs text-muted-foreground px-1"
                  style={{ width: EVENT_WIDTH_BASE * zoom }}
                >
                  {i}
                </div>
              ))}
            </div>

            {/* Tracks with events */}
            {tracks.map((track, trackIndex) => (
              <TimelineTrack
                key={track.id}
                track={track}
                trackIndex={trackIndex}
                height={TRACK_HEIGHT}
                width={timelineWidth}
                events={eventsByTrack[trackIndex] || []}
                selectedEventId={selectedEventId}
                onSelectEvent={onSelectEvent}
                onEventDragStart={handleEventDragStart}
                zoom={zoom}
                eventWidthBase={EVENT_WIDTH_BASE}
                isDragTarget={draggedEvent !== null && draggedOverTrack === trackIndex}
                draggingEventId={draggedEvent}
              />
            ))}
          </div>
        </div>

        {/* Help hint for navigation */}
        {events.length > 0 && (
          <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/60 pointer-events-none">
            Double-click to edit • Drag handle to move
          </div>
        )}
      </div>
    </div>
  )
}
