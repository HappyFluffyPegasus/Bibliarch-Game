'use client'

import { useCallback, useState, useEffect } from 'react'

interface TimelinePlayheadProps {
  currentTime: number
  pixelsPerSecond: number
  labelWidth: number
  height: number
  isDragging: boolean
  onDragStart: () => void
  onDrag: (e: React.MouseEvent) => void
}

export default function TimelinePlayhead({
  currentTime,
  pixelsPerSecond,
  labelWidth,
  height,
  isDragging,
  onDragStart,
  onDrag
}: TimelinePlayheadProps) {
  const x = labelWidth + currentTime * pixelsPerSecond

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const frames = Math.floor((seconds % 1) * 30)
    return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDragStart()
    onDrag(e)
  }, [onDragStart, onDrag])

  return (
    <div
      className="absolute top-0 pointer-events-none z-30"
      style={{
        left: x,
        height: height + 24 // +24 for ruler height
      }}
    >
      {/* Playhead handle */}
      <div
        className={`absolute -top-6 -translate-x-1/2 cursor-grab pointer-events-auto ${isDragging ? 'cursor-grabbing' : ''}`}
        onMouseDown={handleMouseDown}
      >
        {/* Triangle head */}
        <div
          className="w-4 h-4 bg-red-500 hover:bg-red-400 transition-colors"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)'
          }}
        />

        {/* Time tooltip while dragging */}
        {isDragging && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap border border-slate-600">
            {formatTime(currentTime)}
          </div>
        )}
      </div>

      {/* Playhead line */}
      <div
        className="w-px bg-red-500"
        style={{ height: '100%' }}
      />

      {/* Time indicator at bottom */}
      <div className="absolute bottom-0 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1 rounded-t whitespace-nowrap">
        {formatTime(currentTime)}
      </div>
    </div>
  )
}
