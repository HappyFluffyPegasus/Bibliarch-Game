"use client"

import {
  Mountain, Paintbrush, RotateCcw, Minus, Droplets, Scaling,
  Map as MapIcon,
} from "lucide-react"
import RibbonGroup from "../RibbonGroup"
import RibbonButton from "../RibbonButton"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
import { TERRAIN_MATERIALS } from "@/lib/terrain/materials"
import { BIOME_COLORS, BIOME_LABELS } from "@/lib/terrain/cartography"
import type { RibbonCallbacks } from "../RibbonBar"

interface TerrainTabProps {
  callbacks: RibbonCallbacks
}

export default function TerrainTab({ callbacks }: TerrainTabProps) {
  const activeTool = useWorldBuilderStore((s) => s.activeTool)
  const setActiveTool = useWorldBuilderStore((s) => s.setActiveTool)
  const materialBrush = useWorldBuilderStore((s) => s.materialBrush)
  const cartographyBiome = useWorldBuilderStore((s) => s.cartographyBiome)

  const mat = TERRAIN_MATERIALS[materialBrush.materialId]
  const matColor = mat ? `rgb(${Math.round(mat.color[0]*255)},${Math.round(mat.color[1]*255)},${Math.round(mat.color[2]*255)})` : '#888'

  return (
    <>
      <RibbonGroup label="Tools">
        <RibbonButton icon={<Mountain className="w-4 h-4" />} label="Sculpt" active={activeTool === 'sculpt'} onClick={() => setActiveTool('sculpt')} size="large" />
        <RibbonButton icon={<Paintbrush className="w-4 h-4" />} label="Paint" active={activeTool === 'paint-material'} onClick={() => setActiveTool('paint-material')} size="large" />
        <RibbonButton icon={<MapIcon className="w-4 h-4" />} label="Map" active={activeTool === 'cartography'} onClick={() => setActiveTool('cartography')} size="large" />
      </RibbonGroup>

      <RibbonGroup label="Brush">
        <div
          className="w-7 h-7 rounded border-2 border-[#3d3d3d] cursor-pointer"
          style={{ backgroundColor: matColor }}
          title={mat?.name ?? 'Material'}
          onClick={() => setActiveTool('paint-material')}
        />
        <div
          className="w-6 h-6 rounded border-2 border-[#3d3d3d]"
          style={{ backgroundColor: BIOME_COLORS[cartographyBiome] ?? '#888' }}
          title={BIOME_LABELS[cartographyBiome]}
        />
      </RibbonGroup>

      <RibbonGroup label="Actions" noDivider>
        <RibbonButton icon={<RotateCcw className="w-4 h-4" />} label="Generate" onClick={callbacks.onGenerateTerrain} size="large" />
        <RibbonButton icon={<RotateCcw className="w-4 h-4" />} label="Reset" onClick={callbacks.onResetTerrain} />
        <RibbonButton icon={<Minus className="w-4 h-4" />} label="Flatten" onClick={callbacks.onFlattenToGround} />
        <RibbonButton icon={<Droplets className="w-4 h-4" />} label="Smooth" onClick={callbacks.onSmoothCoastlines} />
        <RibbonButton icon={<Scaling className="w-4 h-4" />} label="Scale" onClick={callbacks.onOpenScaleDialog} />
      </RibbonGroup>
    </>
  )
}
