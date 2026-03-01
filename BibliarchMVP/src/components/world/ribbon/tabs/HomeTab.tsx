"use client"

import {
  Undo2, Redo2, Copy, Trash2, Save,
  Move, Maximize2, RotateCw,
  Upload, Download, User, Eye, UserRound,
} from "lucide-react"
import RibbonGroup from "../RibbonGroup"
import RibbonButton from "../RibbonButton"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
import type { RibbonCallbacks } from "../RibbonBar"

interface HomeTabProps {
  callbacks: RibbonCallbacks
}

export default function HomeTab({ callbacks }: HomeTabProps) {
  const cameraMode = useWorldBuilderStore((s) => s.cameraMode)
  const setCameraMode = useWorldBuilderStore((s) => s.setCameraMode)
  const firstPersonSubMode = useWorldBuilderStore((s) => s.firstPersonSubMode)
  const setFirstPersonSubMode = useWorldBuilderStore((s) => s.setFirstPersonSubMode)
  const firstPersonSpeed = useWorldBuilderStore((s) => s.firstPersonSpeed)
  const setFirstPersonSpeed = useWorldBuilderStore((s) => s.setFirstPersonSpeed)

  return (
    <>
      <RibbonGroup label="Clipboard">
        <RibbonButton icon={<Undo2 className="w-4 h-4" />} label="Undo" onClick={callbacks.onUndo} disabled={callbacks.undoCount === 0} title="Undo (Ctrl+Z)" size="large" />
        <RibbonButton icon={<Redo2 className="w-4 h-4" />} label="Redo" onClick={callbacks.onRedo} disabled={callbacks.redoCount === 0} title="Redo (Ctrl+Y)" size="large" />
      </RibbonGroup>

      <RibbonGroup label="Edit">
        <RibbonButton icon={<Copy className="w-4 h-4" />} label="Duplicate" onClick={callbacks.onDuplicate} disabled={callbacks.selectedCount === 0} title="Duplicate (Ctrl+D)" size="large" />
        <RibbonButton icon={<Trash2 className="w-4 h-4" />} label="Delete" onClick={callbacks.onDelete} disabled={callbacks.selectedCount === 0} variant="danger" size="large" />
      </RibbonGroup>

      <RibbonGroup label="Save">
        <button
          onClick={callbacks.onSave}
          disabled={!callbacks.hasUnsavedChanges}
          className="h-9 px-4 flex items-center gap-1.5 rounded bg-[#0066cc] text-white text-xs font-medium hover:bg-[#0077ee] disabled:opacity-40 transition-colors"
        >
          <Save className="w-4 h-4" /> Save
        </button>
      </RibbonGroup>

      <RibbonGroup label="Transform">
        <div className="flex items-center gap-0.5 bg-[#1e1e1e] rounded p-0.5">
          <button onClick={() => callbacks.onTransformModeChange('translate')} className={`h-7 w-7 flex items-center justify-center rounded ${callbacks.transformMode === 'translate' ? 'bg-[#0066cc] text-white' : 'hover:bg-[#383838] text-[#ccc]'}`} title="Move"><Move className="w-3.5 h-3.5" /></button>
          <button onClick={() => callbacks.onTransformModeChange('scale')} className={`h-7 w-7 flex items-center justify-center rounded ${callbacks.transformMode === 'scale' ? 'bg-[#0066cc] text-white' : 'hover:bg-[#383838] text-[#ccc]'}`} title="Scale"><Maximize2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => callbacks.onTransformModeChange('rotate')} className={`h-7 w-7 flex items-center justify-center rounded ${callbacks.transformMode === 'rotate' ? 'bg-[#0066cc] text-white' : 'hover:bg-[#383838] text-[#ccc]'}`} title="Rotate"><RotateCw className="w-3.5 h-3.5" /></button>
        </div>
        <RibbonButton icon={<UserRound className="w-4 h-4" />} label="Dummy" onClick={callbacks.onPlaceDummy} title="Place Scaling Dummy (1.8m)" />
      </RibbonGroup>

      <RibbonGroup label="Import/Export">
        <RibbonButton icon={<Upload className="w-4 h-4" />} label="Import" onClick={callbacks.onImportHeightmap} title="Import Heightmap" />
        <RibbonButton icon={<Download className="w-4 h-4" />} label="Export" onClick={callbacks.onExportHeightmap} title="Export Heightmap" />
      </RibbonGroup>

      <RibbonGroup label="Camera" noDivider>
        <RibbonButton
          icon={cameraMode === 'orbit' ? <User className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          label={cameraMode === 'orbit' ? 'First Person' : 'Orbit'}
          active={cameraMode === 'first-person'}
          onClick={() => setCameraMode(cameraMode === 'orbit' ? 'first-person' : 'orbit')}
          title="Toggle Camera (F)"
        />
        {cameraMode === 'first-person' && (
          <>
            <button
              onClick={() => setFirstPersonSubMode(firstPersonSubMode === 'walk' ? 'fly' : 'walk')}
              className={`h-7 px-2 rounded text-[11px] ${firstPersonSubMode === 'fly' ? 'bg-amber-700/60 text-amber-200' : 'hover:bg-[#383838] text-[#ccc]'}`}
            >
              {firstPersonSubMode === 'walk' ? 'Walk' : 'Fly'}
            </button>
            <input type="range" min={1} max={100} value={Math.round(firstPersonSpeed * 10)} onChange={(e) => setFirstPersonSpeed(Number(e.target.value) / 10)} className="w-16 h-1.5" title={`Speed: ${firstPersonSpeed.toFixed(1)}x`} />
          </>
        )}
      </RibbonGroup>
    </>
  )
}
