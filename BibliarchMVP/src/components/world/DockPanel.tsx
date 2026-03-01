"use client"

import { type ReactNode, useCallback } from "react"
import { X, Minus, Plus, GripHorizontal } from "lucide-react"
import { useWorldBuilderStore, type DockPanelId } from "@/stores/worldBuilderStore"

interface DockPanelProps {
  id: DockPanelId
  title: string
  icon?: ReactNode
  children: ReactNode
  autoHide?: boolean
}

export default function DockPanel({ id, title, icon, children, autoHide }: DockPanelProps) {
  const panel = useWorldBuilderStore((s) => s.panels[id])
  const setPanelVisible = useWorldBuilderStore((s) => s.setPanelVisible)
  const setPanelCollapsed = useWorldBuilderStore((s) => s.setPanelCollapsed)

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }, [id])

  if (!panel.visible || autoHide) return null

  return (
    <div className="flex flex-col min-h-0">
      {/* Title bar — draggable */}
      <div
        draggable
        onDragStart={handleDragStart}
        className="h-7 shrink-0 flex items-center gap-1.5 px-2 bg-[#252526] select-none border-b border-[#3d3d3d] cursor-grab active:cursor-grabbing"
      >
        <GripHorizontal className="w-3 h-3 text-[#666] shrink-0" />
        {icon && <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[#999]">{icon}</span>}
        <span className="text-[11px] font-medium text-[#ccc] flex-1 truncate">{title}</span>
        <button
          onClick={() => setPanelCollapsed(id, !panel.collapsed)}
          className="w-4 h-4 flex items-center justify-center text-[#666] hover:text-[#ccc]"
        >
          {panel.collapsed ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        </button>
        <button
          onClick={() => setPanelVisible(id, false)}
          className="w-4 h-4 flex items-center justify-center text-[#666] hover:text-[#ccc]"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Body */}
      {!panel.collapsed && (
        <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
      )}
    </div>
  )
}
