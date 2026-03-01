'use client'

import { TimelineEvent } from '@/types/timeline'
import TimelineEventBlock from './TimelineEventBlock'

interface Track {
  id: string
  name: string
  color: string
}

interface TimelineTrackProps {
  track: Track
  trackIndex: number
  height: number
  width: number
  events: TimelineEvent[]
  selectedEventId: string | null
  onSelectEvent: (id: string | null) => void
  onEventDragStart: (eventId: string, e: React.MouseEvent) => void
  zoom: number
  eventWidthBase: number
  isDragTarget?: boolean
  draggingEventId?: string | null
}

export default function TimelineTrack({
  track,
  trackIndex,
  height,
  width,
  events,
  selectedEventId,
  onSelectEvent,
  onEventDragStart,
  zoom,
  eventWidthBase,
  isDragTarget = false,
  draggingEventId = null
}: TimelineTrackProps) {
  // Sort events by order for proper display
  const sortedEvents = [...events].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div
      className={`relative border-b border-border transition-colors ${
        isDragTarget ? 'bg-primary/10' : ''
      }`}
      style={{ height, width }}
    >
      {/* Background grid lines */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: Math.ceil(width / (eventWidthBase * zoom)) }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-border/20"
            style={{ left: i * eventWidthBase * zoom }}
          />
        ))}
      </div>

      {/* Drag target indicator */}
      {isDragTarget && (
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-primary/50 rounded-sm" />
      )}

      {/* Events on this track */}
      {sortedEvents.map((event) => (
        <TimelineEventBlock
          key={event.id}
          event={event}
          trackColor={track.color}
          isSelected={selectedEventId === event.id}
          isDragging={draggingEventId === event.id}
          onSelect={() => onSelectEvent(event.id)}
          onDragStart={(e) => onEventDragStart(event.id, e)}
          left={(event.order || 0) * eventWidthBase * zoom}
          width={eventWidthBase * zoom - 12}
          height={height - 20}
        />
      ))}

    </div>
  )
}
