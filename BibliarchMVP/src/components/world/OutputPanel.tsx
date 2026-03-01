"use client"

import { useRef, useEffect } from "react"
import { Terminal, Info, AlertTriangle, AlertCircle, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { useOutputStore, type LogLevel } from "@/stores/outputStore"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"

const LEVEL_ICON = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
} as const

const LEVEL_COLOR = {
  info: 'text-[#999]',
  warning: 'text-amber-400',
  error: 'text-red-400',
} as const

export default function OutputPanel() {
  const entries = useOutputStore((s) => s.entries)
  const filter = useOutputStore((s) => s.filter)
  const setFilter = useOutputStore((s) => s.setFilter)
  const clear = useOutputStore((s) => s.clear)
  const panel = useWorldBuilderStore((s) => s.panels.output)
  const setPanelCollapsed = useWorldBuilderStore((s) => s.setPanelCollapsed)
  const scrollRef = useRef<HTMLDivElement>(null)

  const filtered = filter === 'all' ? entries : entries.filter(e => e.level === filter)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filtered.length])

  if (!panel.visible) return null

  return (
    <div className="flex flex-col bg-[#1e1e1e] border-t border-[#3d3d3d]">
      {/* Header */}
      <div className="h-6 shrink-0 flex items-center gap-1.5 px-2 bg-[#252526] select-none cursor-pointer"
        onClick={() => setPanelCollapsed('output', !panel.collapsed)}
      >
        <Terminal className="w-3.5 h-3.5 text-[#999]" />
        <span className="text-[11px] font-medium text-[#ccc] flex-1">Output</span>

        {!panel.collapsed && (
          <>
            {(['all', 'info', 'warning', 'error'] as const).map(f => (
              <button
                key={f}
                onClick={(e) => { e.stopPropagation(); setFilter(f) }}
                className={`h-4 px-1.5 text-[9px] rounded ${
                  filter === f ? 'bg-[#0066cc]/30 text-[#4da6ff]' : 'text-[#666] hover:text-[#999]'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <button onClick={(e) => { e.stopPropagation(); clear() }} className="w-4 h-4 flex items-center justify-center text-[#666] hover:text-[#ccc]">
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}

        {panel.collapsed ? <ChevronUp className="w-3 h-3 text-[#666]" /> : <ChevronDown className="w-3 h-3 text-[#666]" />}
      </div>

      {/* Body */}
      {!panel.collapsed && (
        <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0 font-mono" style={{ maxHeight: 200 }}>
          {filtered.length === 0 ? (
            <p className="text-[9px] text-[#666] p-2">No output</p>
          ) : (
            filtered.map(entry => {
              const Icon = LEVEL_ICON[entry.level]
              return (
                <div key={entry.id} className="flex items-start gap-1.5 px-2 py-0.5 hover:bg-[#2d2d2d] text-[10px]">
                  <Icon className={`w-3 h-3 shrink-0 mt-0.5 ${LEVEL_COLOR[entry.level]}`} />
                  <span className="text-[#666] shrink-0">{entry.timestamp.toLocaleTimeString()}</span>
                  <span className={LEVEL_COLOR[entry.level]}>{entry.message}</span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
