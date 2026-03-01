"use client"

import { useCallback, useRef } from "react"

interface DockResizeHandleProps {
  side: 'left' | 'right'
  currentWidth: number
  onWidthChange: (width: number) => void
}

export default function DockResizeHandle({ side, currentWidth, onWidthChange }: DockResizeHandleProps) {
  const dragging = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startW = currentWidth

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX
      const newWidth = side === 'left' ? startW + delta : startW - delta
      onWidthChange(Math.max(200, Math.min(500, newWidth)))
    }

    const onUp = () => {
      dragging.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [side, currentWidth, onWidthChange])

  return (
    <div
      onPointerDown={handlePointerDown}
      className="w-1 shrink-0 cursor-col-resize hover:bg-[#0066cc]/30 active:bg-[#0066cc]/50 transition-colors"
    />
  )
}
