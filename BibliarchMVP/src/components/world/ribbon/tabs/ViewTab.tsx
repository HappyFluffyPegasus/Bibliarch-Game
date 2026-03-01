"use client"

import {
  Flag, Package, MousePointer, MapPin, Grid3x3, Waves, Box,
  Map as MapIcon, Pentagon, LayoutGrid, Route, Camera, MonitorUp, Terminal,
} from "lucide-react"
import RibbonGroup from "../RibbonGroup"
import RibbonButton from "../RibbonButton"
import { useWorldBuilderStore } from "@/stores/worldBuilderStore"
import type { RibbonCallbacks } from "../RibbonBar"

interface ViewTabProps {
  callbacks: RibbonCallbacks
}

export default function ViewTab({ callbacks }: ViewTabProps) {
  const panels = useWorldBuilderStore((s) => s.panels)
  const setPanelVisible = useWorldBuilderStore((s) => s.setPanelVisible)
  const showGrid = useWorldBuilderStore((s) => s.showGrid)
  const setShowGrid = useWorldBuilderStore((s) => s.setShowGrid)
  const showWater = useWorldBuilderStore((s) => s.showWater)
  const setShowWater = useWorldBuilderStore((s) => s.setShowWater)
  const showWireframe = useWorldBuilderStore((s) => s.showWireframe)
  const setShowWireframe = useWorldBuilderStore((s) => s.setShowWireframe)
  const showMiniMap = useWorldBuilderStore((s) => s.showMiniMap)
  const setShowMiniMap = useWorldBuilderStore((s) => s.setShowMiniMap)
  const showBorders = useWorldBuilderStore((s) => s.showBorders)
  const setShowBorders = useWorldBuilderStore((s) => s.setShowBorders)
  const showLots = useWorldBuilderStore((s) => s.showLots)
  const setShowLots = useWorldBuilderStore((s) => s.setShowLots)
  const showRoads = useWorldBuilderStore((s) => s.showRoads)
  const setShowRoads = useWorldBuilderStore((s) => s.setShowRoads)

  const toggle = (id: 'explorer' | 'toolbox' | 'properties' | 'locations' | 'output') =>
    setPanelVisible(id, !panels[id].visible)

  return (
    <>
      <RibbonGroup label="Panels">
        <RibbonButton icon={<Flag className="w-4 h-4" />} label="Explorer" active={panels.explorer.visible} onClick={() => toggle('explorer')} />
        <RibbonButton icon={<Package className="w-4 h-4" />} label="Toolbox" active={panels.toolbox.visible} onClick={() => toggle('toolbox')} />
        <RibbonButton icon={<MousePointer className="w-4 h-4" />} label="Properties" active={panels.properties.visible} onClick={() => toggle('properties')} />
        <RibbonButton icon={<MapPin className="w-4 h-4" />} label="Locations" active={panels.locations.visible} onClick={() => toggle('locations')} />
        <RibbonButton icon={<Terminal className="w-4 h-4" />} label="Output" active={panels.output.visible} onClick={() => toggle('output')} />
      </RibbonGroup>

      <RibbonGroup label="Display">
        <RibbonButton icon={<Grid3x3 className="w-4 h-4" />} label="Grid" active={showGrid} onClick={() => setShowGrid(!showGrid)} />
        <RibbonButton icon={<Waves className="w-4 h-4" />} label="Water" active={showWater} onClick={() => setShowWater(!showWater)} />
        <RibbonButton icon={<Box className="w-4 h-4" />} label="Wireframe" active={showWireframe} onClick={() => setShowWireframe(!showWireframe)} />
        <RibbonButton icon={<MapIcon className="w-4 h-4" />} label="Mini-Map" active={showMiniMap} onClick={() => setShowMiniMap(!showMiniMap)} />
      </RibbonGroup>

      <RibbonGroup label="Overlays">
        <RibbonButton icon={<Pentagon className="w-4 h-4" />} label="Borders" active={showBorders} onClick={() => setShowBorders(!showBorders)} />
        <RibbonButton icon={<LayoutGrid className="w-4 h-4" />} label="Lots" active={showLots} onClick={() => setShowLots(!showLots)} />
        <RibbonButton icon={<Route className="w-4 h-4" />} label="Roads" active={showRoads} onClick={() => setShowRoads(!showRoads)} />
      </RibbonGroup>

      <RibbonGroup label="Camera">
        {(['top', 'front', 'side', 'perspective'] as const).map(p => (
          <button key={p} onClick={() => callbacks.onCameraPreset(p)} className="h-7 px-2 text-[11px] rounded hover:bg-[#383838] text-[#ccc]">
            {p.charAt(0).toUpperCase() + p.slice(1).replace('perspective', 'Persp')}
          </button>
        ))}
      </RibbonGroup>

      <RibbonGroup label="Capture" noDivider>
        <RibbonButton icon={<Camera className="w-4 h-4" />} label="Save Loc" onClick={callbacks.onSaveLocation} />
        <RibbonButton icon={<MonitorUp className="w-4 h-4" />} label="Screenshot" onClick={callbacks.onScreenshot} />
      </RibbonGroup>
    </>
  )
}
