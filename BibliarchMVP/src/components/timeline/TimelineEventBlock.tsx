'use client'

import { GripVertical, ChevronRight, Users, Link2, Calendar, MapPin } from 'lucide-react'
import { TimelineEvent } from '@/types/timeline'

interface TimelineEventBlockProps {
  event: TimelineEvent
  trackColor: string
  isSelected: boolean
  onSelect: () => void
  onDragStart: (e: React.MouseEvent) => void
  left: number
  width: number
  height: number
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  'Opening': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'Rising Action': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'Climax': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'Falling Action': { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  'Resolution': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'Flashback': { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  'Dream': { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
  'Conflict': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  'Romance': { bg: 'bg-pink-500/20', text: 'text-pink-400' },
  'Comedy': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'Drama': { bg: 'bg-violet-500/20', text: 'text-violet-400' },
  'Action': { bg: 'bg-cyan-500/20', text: 'text-cyan-400' }
}

export default function TimelineEventBlock({
  event,
  trackColor,
  isSelected,
  onSelect,
  onDragStart,
  left,
  width,
  height
}: TimelineEventBlockProps) {
  // Get primary tag color
  const primaryTag = event.tags?.[0]
  const tagColor = primaryTag ? TAG_COLORS[primaryTag] : null

  // Truncate summary to ~400 characters for display
  const displaySummary = event.summary
    ? event.summary.length > 400
      ? event.summary.slice(0, 397) + '...'
      : event.summary
    : ''

  return (
    <div
      className={`absolute top-2 rounded-lg shadow-md border transition-all cursor-pointer group flex flex-col ${
        isSelected
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background z-20 border-black/20'
          : 'hover:ring-1 hover:ring-primary/50 z-10 border-black/10'
      }`}
      style={{
        left,
        width,
        height,
        backgroundColor: trackColor
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Drag handle - always visible on left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing bg-black/5 hover:bg-black/10 rounded-l-lg transition-all"
        onMouseDown={(e) => {
          e.stopPropagation()
          onDragStart(e)
        }}
        title="Drag to reorder or move to another track"
      >
        <GripVertical className="w-4 h-4" style={{ color: 'rgba(0,0,0,0.5)' }} />
      </div>

      {/* Content - offset for drag handle */}
      <div className="flex flex-col h-full pl-6 pr-3 py-2 overflow-hidden">
        {/* Header: Title + metadata */}
        <div className="flex items-start justify-between gap-2 mb-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(0,0,0,0.5)' }} />
            <h3 className="font-bold text-sm truncate" style={{ color: 'rgba(0,0,0,0.85)' }}>
              {event.title}
            </h3>
            {event.hasChildren && (
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(0,0,0,0.5)' }} />
            )}
          </div>
        </div>

        {/* Location & Timeframe bar */}
        {(event.location || event.timeframe) && (
          <div className="flex items-center gap-3 text-[11px] mb-1.5 flex-shrink-0" style={{ color: 'rgba(0,0,0,0.55)' }}>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {event.location}
              </span>
            )}
            {event.timeframe && (
              <span>{event.timeframe}</span>
            )}
          </div>
        )}

        {/* Summary - main content area */}
        <div className="flex-1 overflow-hidden mb-2">
          {displaySummary ? (
            <p
              className="text-xs leading-relaxed overflow-hidden whitespace-pre-wrap break-words"
              style={{
                color: 'rgba(0,0,0,0.75)',
                display: '-webkit-box',
                WebkitLineClamp: Math.floor((height - 80) / 16),
                WebkitBoxOrient: 'vertical',
              }}
            >
              {displaySummary}
            </p>
          ) : (
            <p className="text-xs italic" style={{ color: 'rgba(0,0,0,0.4)' }}>
              Double-click to edit...
            </p>
          )}
        </div>

        {/* Footer: Tags and indicators */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {/* Tags */}
          {primaryTag && tagColor && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tagColor.bg} ${tagColor.text}`}>
              {primaryTag}
            </span>
          )}
          {event.tags && event.tags.length > 1 && (
            <span className="text-[10px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
              +{event.tags.length - 1} more
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Indicators */}
          {event.characters && event.characters.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'rgba(0,0,0,0.55)' }} title={`${event.characters.length} character(s)`}>
              <Users className="w-3 h-3" />
              {event.characters.length}
            </span>
          )}

          {event.linkedSceneId && (
            <span title="Linked to scene">
              <Link2 className="w-3 h-3" style={{ color: 'rgba(0,0,0,0.55)' }} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
