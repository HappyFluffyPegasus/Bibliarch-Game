"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { CartographyRegionType } from "@/types/world"
import {
  BIOME_COLORS,
  biomeFromIndex,
  indexFromBiome,
} from "@/lib/terrain/cartography"

interface CartographyEditorProps {
  cartographyGrid: Uint8Array
  gridSizeX: number
  gridSizeZ: number
  activeBiome: CartographyRegionType
  brushSize: number
  onDataChange: (grid: Uint8Array) => void
}

export default function CartographyEditor({
  cartographyGrid,
  gridSizeX,
  gridSizeZ,
  activeBiome,
  brushSize,
  onDataChange,
}: CartographyEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isPaintingRef = useRef(false)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [canvasW, setCanvasW] = useState(512)
  const [canvasH, setCanvasH] = useState(512)

  // Resize observer for responsive canvas — maintains grid aspect ratio
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      const maxW = width - 16
      const maxH = height - 16

      // Keep cells square by using a single cell pixel size
      const cellPx = Math.max(1, Math.floor(Math.min(maxW / gridSizeX, maxH / gridSizeZ)))
      setCanvasW(cellPx * gridSizeX)
      setCanvasH(cellPx * gridSizeZ)
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [gridSizeX, gridSizeZ])

  // Draw the cartography grid
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cellPixelSizeX = canvasW / gridSizeX
    const cellPixelSizeZ = canvasH / gridSizeZ

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvasW, canvasH)

    // Draw biome cells
    for (let z = 0; z < gridSizeZ; z++) {
      for (let x = 0; x < gridSizeX; x++) {
        const idx = z * gridSizeX + x
        const biome = biomeFromIndex(cartographyGrid[idx])
        ctx.fillStyle = BIOME_COLORS[biome]
        ctx.fillRect(
          x * cellPixelSizeX,
          z * cellPixelSizeZ,
          cellPixelSizeX + 0.5,
          cellPixelSizeZ + 0.5
        )
      }
    }

    // Draw subtle grid lines if cells are big enough
    const minCellPx = Math.min(cellPixelSizeX, cellPixelSizeZ)
    if (minCellPx >= 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      for (let i = 0; i <= gridSizeX; i++) {
        const pos = i * cellPixelSizeX
        ctx.moveTo(pos, 0)
        ctx.lineTo(pos, canvasH)
      }
      for (let i = 0; i <= gridSizeZ; i++) {
        const pos = i * cellPixelSizeZ
        ctx.moveTo(0, pos)
        ctx.lineTo(canvasW, pos)
      }
      ctx.stroke()
    }

    // Draw brush cursor
    if (mousePos) {
      const cx = Math.floor(mousePos.x / cellPixelSizeX)
      const cz = Math.floor(mousePos.y / cellPixelSizeZ)
      const brushRadiusPx = brushSize * Math.min(cellPixelSizeX, cellPixelSizeZ)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(
        (cx + 0.5) * cellPixelSizeX,
        (cz + 0.5) * cellPixelSizeZ,
        brushRadiusPx,
        0,
        Math.PI * 2
      )
      ctx.stroke()
    }
  }, [cartographyGrid, gridSizeX, gridSizeZ, canvasW, canvasH, brushSize, mousePos])

  // Redraw on data or state changes
  useEffect(() => {
    draw()
  }, [draw])

  // Paint biome at cursor position
  const paintAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvasW / rect.width
    const scaleY = canvasH / rect.height
    const px = (clientX - rect.left) * scaleX
    const py = (clientY - rect.top) * scaleY

    const cellPixelSizeX = canvasW / gridSizeX
    const cellPixelSizeZ = canvasH / gridSizeZ
    const cx = Math.floor(px / cellPixelSizeX)
    const cz = Math.floor(py / cellPixelSizeZ)

    const biomeIdx = indexFromBiome(activeBiome)
    const newGrid = new Uint8Array(cartographyGrid)
    let changed = false

    // Paint within brush radius
    for (let dz = -brushSize; dz <= brushSize; dz++) {
      for (let dx = -brushSize; dx <= brushSize; dx++) {
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist > brushSize) continue

        const gx = cx + dx
        const gz = cz + dz
        if (gx < 0 || gx >= gridSizeX || gz < 0 || gz >= gridSizeZ) continue

        const idx = gz * gridSizeX + gx
        if (newGrid[idx] !== biomeIdx) {
          newGrid[idx] = biomeIdx
          changed = true
        }
      }
    }

    if (changed) {
      onDataChange(newGrid)
    }
  }, [cartographyGrid, gridSizeX, gridSizeZ, canvasW, canvasH, activeBiome, brushSize, onDataChange])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isPaintingRef.current = true
    paintAt(e.clientX, e.clientY)
  }, [paintAt])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvasW / rect.width
    const scaleY = canvasH / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY

    setMousePos({ x: px, y: py })

    if (isPaintingRef.current) {
      paintAt(e.clientX, e.clientY)
    }
  }, [canvasW, canvasH, paintAt])

  const handleMouseUp = useCallback(() => {
    isPaintingRef.current = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    isPaintingRef.current = false
    setMousePos(null)
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-gray-950"
    >
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{
          width: canvasW,
          height: canvasH,
          maxWidth: '100%',
          maxHeight: '100%',
          cursor: 'crosshair',
          imageRendering: 'pixelated',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
}
