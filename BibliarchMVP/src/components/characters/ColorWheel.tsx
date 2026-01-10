'use client'

import { useState } from 'react'

interface ColorWheelProps {
  currentColor: string
  onChange: (color: string) => void
  onClose: () => void
}

export default function ColorWheel({ currentColor, onChange, onClose }: ColorWheelProps) {
  const [color, setColor] = useState(currentColor || '#000000')

  const handleChange = (newColor: string) => {
    setColor(newColor)
    // Real-time preview - uncomment if you want live updates
    // onChange(newColor)
  }

  const handleDone = () => {
    onChange(color)
    onClose()
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Color Picker
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-muted hover:bg-muted/80 text-foreground"
        >
          ✕
        </button>
      </div>

      {/* Color input */}
      <div className="flex gap-3">
        <input
          type="color"
          value={color}
          onChange={(e) => handleChange(e.target.value)}
          className="w-24 h-24 rounded-lg cursor-pointer border-2 border-border"
        />
        <div className="flex-1 flex flex-col gap-2">
          <input
            type="text"
            value={color.toUpperCase()}
            onChange={(e) => handleChange(e.target.value)}
            className="px-3 py-2 rounded-lg font-mono text-sm border-2 bg-muted text-foreground border-border"
            placeholder="#000000"
          />
          <div className="text-xs text-muted-foreground">
            Enter HEX color code
          </div>
        </div>
      </div>

      {/* Quick colors */}
      <div>
        <p className="text-sm font-medium mb-2 text-foreground">
          Quick Colors
        </p>
        <div className="grid grid-cols-6 gap-2">
          {[
            '#8B4513', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DFE6E9', '#000000', '#FFFFFF', '#FF7675', '#74B9FF'
          ].map((presetColor) => (
            <button
              key={presetColor}
              onClick={() => handleChange(presetColor)}
              className="w-full h-10 rounded-lg border-2 transition-all"
              style={{
                background: presetColor,
                borderColor: color === presetColor ? '#0ea5e9' : 'var(--border)'
              }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={handleDone}
        className="w-full py-3 rounded-lg font-semibold text-white transition-all bg-sky-500 hover:bg-sky-600"
      >
        Done
      </button>
    </div>
  )
}
