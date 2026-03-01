"use client"

import {
  MousePointer, Trash2, Package, Pentagon, LayoutGrid, Route,
  Square, DoorOpen, PaintBucket, Armchair,
  ChevronUp, ChevronDown, Plus,
} from "lucide-react"
import RibbonGroup from "../RibbonGroup"
import RibbonButton from "../RibbonButton"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
import type { WorldLevel } from "@/types/world"
import { LEVEL_TOOLS } from "@/types/world"
import type { RibbonCallbacks } from "../RibbonBar"

interface BuildTabProps {
  callbacks: RibbonCallbacks
  currentLevel: WorldLevel
}

export default function BuildTab({ callbacks, currentLevel }: BuildTabProps) {
  const activeTool = useWorldBuilderStore((s) => s.activeTool)
  const setActiveTool = useWorldBuilderStore((s) => s.setActiveTool)
  const panels = useWorldBuilderStore((s) => s.panels)
  const setPanelVisible = useWorldBuilderStore((s) => s.setPanelVisible)
  const borderColor = useWorldBuilderStore((s) => s.borderColor)
  const setBorderColor = useWorldBuilderStore((s) => s.setBorderColor)
  const clearBorderVertices = useWorldBuilderStore((s) => s.clearBorderVertices)
  const activeFloor = useWorldBuilderStore((s) => s.activeFloor)
  const setActiveFloor = useWorldBuilderStore((s) => s.setActiveFloor)

  const allowed = LEVEL_TOOLS[currentLevel]
  const can = (tool: string) => allowed.includes(tool as any)

  return (
    <>
      <RibbonGroup label="Select">
        <RibbonButton icon={<MousePointer className="w-4 h-4" />} label="Select" active={activeTool === 'select'} onClick={() => setActiveTool('select')} size="large" />
        <RibbonButton icon={<Trash2 className="w-4 h-4" />} label="Delete" active={activeTool === 'delete'} onClick={() => setActiveTool('delete')} variant="danger" size="large" disabled={!can('delete')} />
      </RibbonGroup>

      {/* Objects */}
      <RibbonGroup label="Objects">
        <RibbonButton icon={<Package className="w-4 h-4" />} label="Place" active={activeTool === 'place-object'} onClick={() => setActiveTool('place-object')} size="large" disabled={!can('place-object')} />
        <button
          onClick={() => { setActiveTool('place-object'); setPanelVisible('toolbox', !panels.toolbox.visible) }}
          disabled={!can('place-object')}
          className={`h-7 px-2 flex items-center gap-1 rounded text-[11px] ${
            !can('place-object')
              ? 'text-[#666] cursor-not-allowed'
              : panels.toolbox.visible
                ? 'bg-green-600 text-white'
                : 'bg-[#2d2d2d] hover:bg-[#383838] text-[#ccc]'
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Toolbox
        </button>
      </RibbonGroup>

      {/* Regions */}
      <RibbonGroup label="Regions">
        <RibbonButton icon={<Pentagon className="w-4 h-4" />} label={callbacks.borderLabel} active={activeTool === 'draw-border'} onClick={() => setActiveTool('draw-border')} size="large" disabled={!can('draw-border')} />
        <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} className="w-6 h-6 rounded border border-[#3d3d3d] bg-transparent cursor-pointer" title="Border color" disabled={!can('draw-border')} />
        {callbacks.borderVertexCount > 0 && (
          <>
            <button onClick={callbacks.onFinishBorder} disabled={callbacks.borderVertexCount < 3} className="h-7 px-2 text-[11px] rounded bg-[#0066cc] text-white disabled:opacity-40">Finish</button>
            <button onClick={callbacks.onCancelBorder} className="h-7 px-2 text-[11px] rounded hover:bg-[#383838] text-[#999]">Cancel</button>
          </>
        )}
      </RibbonGroup>

      {/* City tools */}
      <RibbonGroup label="City">
        <RibbonButton icon={<LayoutGrid className="w-4 h-4" />} label="Lot" active={activeTool === 'draw-lot'} onClick={() => setActiveTool('draw-lot')} size="large" disabled={!can('draw-lot')} />
        <RibbonButton icon={<Route className="w-4 h-4" />} label="Road" active={activeTool === 'draw-road'} onClick={() => setActiveTool('draw-road')} size="large" disabled={!can('draw-road')} />
      </RibbonGroup>

      {/* Building tools */}
      <RibbonGroup label="Building">
        <RibbonButton icon={<Square className="w-4 h-4" />} label="Wall" active={activeTool === 'place-wall'} onClick={() => setActiveTool('place-wall')} size="large" disabled={!can('place-wall')} />
        <RibbonButton icon={<DoorOpen className="w-4 h-4" />} label="Door" active={activeTool === 'place-door'} onClick={() => setActiveTool('place-door')} size="large" disabled={!can('place-door')} />
        <RibbonButton icon={<PaintBucket className="w-4 h-4" />} label="Floor" active={activeTool === 'paint-floor'} onClick={() => setActiveTool('paint-floor')} size="large" disabled={!can('paint-floor')} />
        <RibbonButton icon={<Armchair className="w-4 h-4" />} label="Furnish" active={activeTool === 'place-furniture'} onClick={() => setActiveTool('place-furniture')} size="large" disabled={!can('place-furniture')} />
      </RibbonGroup>
      {callbacks.hasFloors && (
        <RibbonGroup label="Floor" noDivider>
          <button onClick={() => setActiveFloor(Math.max(0, activeFloor - 1))} disabled={activeFloor === 0} className="h-7 w-7 flex items-center justify-center rounded hover:bg-[#383838] text-[#ccc] disabled:text-[#666]"><ChevronDown className="w-4 h-4" /></button>
          <span className="text-[11px] text-[#ccc] px-1">Floor {activeFloor}</span>
          <button onClick={() => setActiveFloor(activeFloor + 1)} disabled={activeFloor >= callbacks.maxFloor} className="h-7 w-7 flex items-center justify-center rounded hover:bg-[#383838] text-[#ccc] disabled:text-[#666]"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={callbacks.onAddFloor} className="h-7 w-7 flex items-center justify-center rounded hover:bg-[#383838] text-[#ccc]" title="Add floor"><Plus className="w-4 h-4" /></button>
        </RibbonGroup>
      )}
    </>
  )
}
