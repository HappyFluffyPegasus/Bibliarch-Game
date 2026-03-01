"use client"

import { Children, type ReactNode, useState, useCallback } from "react"
import { useWorldBuilderStore, type DockPanelId, type DockSide } from "@/stores/worldBuilderStore"

interface DockColumnProps {
  side: DockSide
  width?: number
  children: ReactNode
}

export default function DockColumn({ side, width, children }: DockColumnProps) {
  const movePanelToSide = useWorldBuilderStore((s) => s.movePanelToSide)
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const panelId = e.dataTransfer.getData('text/plain') as DockPanelId
    if (panelId) {
      movePanelToSide(panelId, side)
    }
  }, [movePanelToSide, side])

  // Filter out null/false children (hidden panels)
  const visibleChildren = Children.toArray(children).filter(Boolean)
  if (visibleChildren.length === 0) return null

  const borderClass =
    side === 'left' ? 'border-r border-[#3d3d3d]' :
    side === 'right' ? 'border-l border-[#3d3d3d]' :
    'border-t border-[#3d3d3d]'

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`shrink-0 flex flex-col bg-[#1e1e1e] ${borderClass} ${
        dragOver ? 'ring-2 ring-inset ring-[#0066cc]/60 bg-[#0066cc]/10' : ''
      }`}
      style={width ? { width } : undefined}
    >
      {visibleChildren.map((child, i) => (
        <div key={i} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {child}
        </div>
      ))}
    </div>
  )
}
