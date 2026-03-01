"use client"

import {
  Lock, Unlock as UnlockIcon, Eye, EyeOff, Copy, Trash2,
} from "lucide-react"
import PropertySection from "./PropertySection"
import PropertyRow from "./PropertyRow"
import { OBJECT_CATALOG } from "@/lib/terrain/objectCatalog"
import type { WorldObject } from "@/types/world"

interface ObjectPropertiesProps {
  selectedObj: WorldObject
  onUpdate: (id: string, props: Partial<WorldObject>) => void
  onColorChange: (id: string, color: string) => void
  onDuplicate: () => void
  onDelete: () => void
}

export default function ObjectProperties({
  selectedObj,
  onUpdate,
  onColorChange,
  onDuplicate,
  onDelete,
}: ObjectPropertiesProps) {
  return (
    <div>
      {/* Data section */}
      <PropertySection title="Data">
        <PropertyRow label="Type">
          <span className="text-[10px] text-[#ccc]">
            {OBJECT_CATALOG[selectedObj.type]?.name ?? selectedObj.type}
          </span>
        </PropertyRow>
        <PropertyRow label="Name">
          <input
            type="text"
            value={selectedObj.name ?? ''}
            placeholder={OBJECT_CATALOG[selectedObj.type]?.name ?? 'Unnamed'}
            onChange={(e) => onUpdate(selectedObj.id, { name: e.target.value || undefined })}
            className="w-full bg-[#1e1e1e] text-[10px] border border-[#3d3d3d] rounded px-1.5 py-0.5 text-[#ccc] focus:border-[#0066cc] focus:outline-none"
          />
        </PropertyRow>
        <PropertyRow label="Locked">
          <button
            onClick={() => onUpdate(selectedObj.id, { locked: !selectedObj.locked })}
            className={`h-5 px-2 text-[9px] rounded flex items-center gap-1 ${
              selectedObj.locked
                ? 'bg-amber-900/30 text-amber-300 border border-amber-600'
                : 'border border-[#3d3d3d] text-[#999] hover:bg-[#383838]'
            }`}
          >
            {selectedObj.locked ? <Lock className="w-2.5 h-2.5" /> : <UnlockIcon className="w-2.5 h-2.5" />}
            {selectedObj.locked ? 'Yes' : 'No'}
          </button>
        </PropertyRow>
      </PropertySection>

      {/* Transform section */}
      <PropertySection title="Transform">
        {(['Position', 'Rotation', 'Scale'] as const).map((prop) => {
          const key = prop.toLowerCase() as 'position' | 'rotation' | 'scale'
          const isRotation = key === 'rotation'
          const step = key === 'rotation' ? 5 : key === 'scale' ? 0.1 : 0.5
          const min = key === 'scale' ? 0.01 : undefined
          return (
            <PropertyRow key={prop} label={prop}>
              <div className="flex gap-0.5">
                {['X', 'Y', 'Z'].map((axis, i) => {
                  let val = selectedObj[key][i]
                  if (isRotation) val = Math.round(val * 180 / Math.PI)
                  else val = Number(val.toFixed(key === 'scale' ? 2 : 1))
                  return (
                    <div key={axis} className="flex-1 flex items-center">
                      <span className="text-[8px] text-[#666] w-3 text-center">{axis}</span>
                      <input
                        type="number"
                        step={step}
                        min={min}
                        value={val}
                        onChange={(e) => {
                          const arr = [...selectedObj[key]] as [number, number, number]
                          let v = Number(e.target.value) || (key === 'scale' ? 1 : 0)
                          if (isRotation) v = v * Math.PI / 180
                          if (key === 'scale') v = Math.max(0.01, v)
                          arr[i] = v
                          onUpdate(selectedObj.id, { [key]: arr })
                        }}
                        className="w-full bg-[#1e1e1e] text-[9px] border border-[#3d3d3d] rounded px-1 py-0.5 text-center text-[#ccc] focus:border-[#0066cc] focus:outline-none"
                      />
                    </div>
                  )
                })}
              </div>
            </PropertyRow>
          )
        })}
      </PropertySection>

      {/* Appearance section */}
      <PropertySection title="Appearance">
        <PropertyRow label="Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedObj.color}
              onChange={(e) => onColorChange(selectedObj.id, e.target.value)}
              className="w-6 h-5 rounded border border-[#3d3d3d] cursor-pointer bg-transparent"
            />
            <span className="text-[9px] text-[#999] font-mono">{selectedObj.color}</span>
          </div>
        </PropertyRow>
        <PropertyRow label="Visible">
          <button
            onClick={() => onUpdate(selectedObj.id, { visible: !selectedObj.visible })}
            className={`h-5 px-2 text-[9px] rounded flex items-center gap-1 ${
              !selectedObj.visible
                ? 'bg-[#2d2d2d] text-[#666] border border-[#3d3d3d]'
                : 'border border-[#3d3d3d] text-[#999] hover:bg-[#383838]'
            }`}
          >
            {selectedObj.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
            {selectedObj.visible ? 'Yes' : 'No'}
          </button>
        </PropertyRow>
      </PropertySection>

      {/* Actions section */}
      <PropertySection title="Actions">
        <div className="flex gap-1 px-2 py-1">
          <button
            onClick={onDuplicate}
            className="flex-1 py-1.5 text-[10px] rounded border border-[#3d3d3d] text-[#ccc] hover:bg-[#383838] flex items-center justify-center gap-1"
          >
            <Copy className="w-3 h-3" /> Duplicate
          </button>
          <button
            onClick={onDelete}
            className="flex-1 py-1.5 text-[10px] rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </PropertySection>
    </div>
  )
}
