'use client'

import { useCallback, useMemo } from 'react'

interface TimelineRulerProps {
  duration: number
  pixelsPerSecond: number
  width: number
  onSeek: (time: number) => void
  onDurationChange: (duration: number) => void
}

export default function TimelineRuler({
  duration,
  pixelsPerSecond,
  width,
  onSeek,
  onDurationChange
}: TimelineRulerProps) {
  // Calculate appropriate tick interval based on zoom level
  const tickInterval = useMemo(() => {
    if (pixelsPerSecond >= 100) return 0.5
    if (pixelsPerSecond >= 60) return 1
    if (pixelsPerSecond >= 30) return 2
    if (pixelsPerSecond >= 15) return 5
    return 10
  }, [pixelsPerSecond])

  // Generate tick marks
  const ticks = useMemo(() => {
    const result: Array<{ time: number; major: boolean }> = []
    const majorInterval = tickInterval * 5

    for (let t = 0; t <= duration + tickInterval; t += tickInterval) {
      const isMajor = Math.abs(t % majorInterval) < 0.001 || t === 0
      result.push({ time: t, major: isMajor })
    }
    return result
  }, [duration, tickInterval])

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const frames = Math.floor((seconds % 1) * 30) // Assume 30fps for frame display

    if (pixelsPerSecond >= 80) {
      return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [pixelsPerSecond])

  // Handle click to seek
  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = x / pixelsPerSecond
    onSeek(Math.max(0, Math.min(duration, Math.round(time * 100) / 100)))
  }, [pixelsPerSecond, duration, onSeek])

  // Handle double-click to extend duration
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = x / pixelsPerSecond
    if (time > duration) {
      onDurationChange(Math.ceil(time))
    }
  }, [pixelsPerSecond, duration, onDurationChange])

  return (
    <div
      className="h-6 bg-slate-800 border-b border-slate-700/50 relative cursor-pointer"
      style={{ width }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Tick marks */}
      {ticks.map(({ time, major }) => (
        <div
          key={time}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: time * pixelsPerSecond }}
        >
          <div
            className={`w-px ${major ? 'h-3 bg-slate-500' : 'h-2 bg-slate-600'}`}
          />
          {major && (
            <span className="text-[9px] text-slate-400 mt-0.5 -translate-x-1/2 whitespace-nowrap">
              {formatTime(time)}
            </span>
          )}
        </div>
      ))}

      {/* Duration end marker */}
      <div
        className="absolute top-0 bottom-0 w-px bg-amber-500/50"
        style={{ left: duration * pixelsPerSecond }}
      >
        <div className="absolute -top-0 left-0 w-2 h-2 bg-amber-500 -translate-x-1/2" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
      </div>

      {/* Extend hint area */}
      <div
        className="absolute top-0 bottom-0 right-0 bg-slate-700/20"
        style={{ left: duration * pixelsPerSecond, minWidth: 50 }}
      />
    </div>
  )
}
