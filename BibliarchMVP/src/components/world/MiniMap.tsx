'use client'

import { useEffect, useRef } from 'react'
import { TerrainData, WorldObject, terrainIndex } from '@/types/world'
import { getMaterialColor } from '@/lib/terrain/materials'
import { TerrainMaterialId } from '@/types/world'

interface MiniMapProps {
  terrain: TerrainData
  objects: WorldObject[]
  visible: boolean
  cameraPosition?: [number, number, number] | null
  cameraYaw?: number
  cameraTick?: number
}

const MAP_MAX = 160

export default function MiniMap({ terrain, objects, visible, cameraPosition, cameraYaw, cameraTick }: MiniMapProps) {
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null)
  const playerCanvasRef = useRef<HTMLCanvasElement>(null)

  // Compute map pixel dimensions preserving terrain aspect ratio
  const sizeX = terrain.size
  const sizeZ = terrain.sizeZ
  const aspect = sizeX / sizeZ
  let mapW: number, mapH: number
  if (aspect >= 1) {
    mapW = MAP_MAX
    mapH = Math.max(32, Math.round(MAP_MAX / aspect))
  } else {
    mapH = MAP_MAX
    mapW = Math.max(32, Math.round(MAP_MAX * aspect))
  }

  // Heavy layer: terrain pixels + object dots (only redraws when terrain/objects change)
  useEffect(() => {
    if (!visible) return
    const canvas = terrainCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scaleX = mapW / sizeX
    const scaleZ = mapH / sizeZ

    const imageData = ctx.createImageData(mapW, mapH)
    const data = imageData.data

    for (let py = 0; py < mapH; py++) {
      for (let px = 0; px < mapW; px++) {
        const gx = Math.floor(px / scaleX)
        const gz = Math.floor(py / scaleZ)
        const idx = terrainIndex(
          Math.min(gx, sizeX - 1),
          Math.min(gz, sizeZ - 1),
          sizeX
        )

        const height = terrain.heights[idx]
        const matId = terrain.materials[idx] as TerrainMaterialId
        const pixelIdx = (py * mapW + px) * 4

        if (height < terrain.seaLevel) {
          const depth = (terrain.seaLevel - height) / terrain.seaLevel
          data[pixelIdx] = Math.round(30 - depth * 20)
          data[pixelIdx + 1] = Math.round(80 + (1 - depth) * 40)
          data[pixelIdx + 2] = Math.round(180 + (1 - depth) * 50)
          data[pixelIdx + 3] = 255
        } else {
          const rgb = getMaterialColor(matId)
          const shade = 0.6 + height * 0.4
          data[pixelIdx] = Math.round(rgb[0] * 255 * shade)
          data[pixelIdx + 1] = Math.round(rgb[1] * 255 * shade)
          data[pixelIdx + 2] = Math.round(rgb[2] * 255 * shade)
          data[pixelIdx + 3] = 255
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)

    // Draw objects as small colored dots
    const worldSizeX = sizeX * terrain.cellSize
    const worldSizeZ = sizeZ * terrain.cellSize
    for (const obj of objects) {
      if (!obj.visible) continue
      const ox = (obj.position[0] / worldSizeX) * mapW
      const oz = (obj.position[2] / worldSizeZ) * mapH
      ctx.fillStyle = obj.color
      ctx.beginPath()
      ctx.arc(ox, oz, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [terrain, objects, visible, sizeX, sizeZ, mapW, mapH])

  // Cheap layer: just the player position triangle (redraws on camera tick)
  useEffect(() => {
    if (!visible) return
    const canvas = playerCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, mapW, mapH)

    if (cameraPosition) {
      const worldSizeX = sizeX * terrain.cellSize
      const worldSizeZ = sizeZ * terrain.cellSize
      const px = (cameraPosition[0] / worldSizeX) * mapW
      const pz = (cameraPosition[2] / worldSizeZ) * mapH
      const yaw = cameraYaw ?? 0

      const triSize = 5
      ctx.save()
      ctx.translate(px, pz)
      ctx.rotate(-yaw)
      ctx.beginPath()
      ctx.moveTo(0, -triSize)
      ctx.lineTo(-triSize * 0.6, triSize * 0.5)
      ctx.lineTo(triSize * 0.6, triSize * 0.5)
      ctx.closePath()
      ctx.fillStyle = '#facc15'
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sizeX, sizeZ, mapW, mapH, terrain.cellSize, cameraTick])

  if (!visible) return null

  return (
    <div className="absolute bottom-10 right-3 border border-gray-600 rounded overflow-hidden shadow-lg bg-black/50">
      <div className="relative" style={{ width: mapW, height: mapH }}>
        <canvas
          ref={terrainCanvasRef}
          width={mapW}
          height={mapH}
          className="absolute inset-0 block"
          style={{ width: mapW, height: mapH }}
        />
        <canvas
          ref={playerCanvasRef}
          width={mapW}
          height={mapH}
          className="absolute inset-0 block"
          style={{ width: mapW, height: mapH }}
        />
      </div>
    </div>
  )
}
