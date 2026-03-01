"use client"

import { Sun, Cloud, CloudRain, Snowflake, CloudFog, Moon } from "lucide-react"
import RibbonGroup from "../RibbonGroup"
import type { RibbonCallbacks } from "../RibbonBar"

interface EnvironmentTabProps {
  callbacks: RibbonCallbacks
}

const SUN_PRESETS = [
  { label: 'Dawn', angle: 80, el: 12, sky: '#ff8c42', water: '#2d4a7a' },
  { label: 'Morning', angle: 120, el: 35, sky: '#87CEEB', water: '#2980b9' },
  { label: 'Noon', angle: 160, el: 75, sky: '#87CEEB', water: '#2980b9' },
  { label: 'Dusk', angle: 260, el: 12, sky: '#2d1b69', water: '#1a1040' },
  { label: 'Night', angle: 200, el: 8, sky: '#0a0a1e', water: '#050510' },
] as const

const WEATHER_OPTIONS = [
  { label: 'Clear', icon: Sun, value: 'clear' as const },
  { label: 'Cloudy', icon: Cloud, value: 'cloudy' as const },
  { label: 'Rain', icon: CloudRain, value: 'rain' as const },
  { label: 'Snow', icon: Snowflake, value: 'snow' as const },
] as const

export default function EnvironmentTab({ callbacks }: EnvironmentTabProps) {
  return (
    <>
      <RibbonGroup label="Sun">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[9px] text-[#666] w-5">Dir</span>
            <input type="range" min={0} max={360} value={callbacks.sunAngle} onChange={(e) => callbacks.onSunAngleChange(Number(e.target.value))} className="w-20 h-1" />
            <span className="text-[9px] text-[#999] w-6">{callbacks.sunAngle}°</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5" />
            <span className="text-[9px] text-[#666] w-5">Elev</span>
            <input type="range" min={5} max={85} value={callbacks.sunElevation} onChange={(e) => callbacks.onSunElevationChange(Number(e.target.value))} className="w-20 h-1" />
            <span className="text-[9px] text-[#999] w-6">{callbacks.sunElevation}°</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 ml-1">
          {SUN_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => {
                callbacks.onSunAngleChange(p.angle)
                callbacks.onSunElevationChange(p.el)
                callbacks.onSkyColorChange(p.sky)
                callbacks.onWaterColorChange?.(p.water)
              }}
              className="h-5 px-2 text-[9px] rounded hover:bg-[#383838] text-[#ccc] text-left flex items-center gap-1"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.sky }} />
              {p.label}
            </button>
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label="Fog">
        <button onClick={callbacks.onFogToggle} className={`h-6 px-2 flex items-center gap-1 rounded text-[10px] ${callbacks.fogEnabled ? 'bg-[#0066cc]/40 text-[#4da6ff]' : 'hover:bg-[#383838] text-[#ccc]'}`}>
          <CloudFog className="w-3.5 h-3.5" /> Fog
        </button>
      </RibbonGroup>

      <RibbonGroup label="Weather" noDivider>
        {WEATHER_OPTIONS.map(w => (
          <button key={w.label} onClick={() => callbacks.onWeatherChange(w.value)} className={`h-8 w-8 flex items-center justify-center rounded ${callbacks.weatherType === w.value ? 'bg-[#0066cc]/40 text-[#4da6ff]' : 'hover:bg-[#383838] text-[#ccc]'}`} title={w.label}>
            <w.icon className="w-4 h-4" />
          </button>
        ))}
      </RibbonGroup>
    </>
  )
}
