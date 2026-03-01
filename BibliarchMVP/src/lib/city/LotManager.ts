import {
  Mesh,
  MeshBuilder,
  Vector3,
  Color3,
  Color4,
  StandardMaterial,
  TransformNode,
  Scene,
  DynamicTexture,
  VertexData,
} from '@babylonjs/core'
import { CityLot, TerrainData, LOT_ZONING_COLORS, LotZoning } from '@/types/world'

/**
 * Manages rendering of city lots (rectangular parcels) in the 3D scene.
 */
export class LotManager {
  private parent: TransformNode
  private lotMeshes: Map<string, TransformNode> = new Map()
  private selectedLotId: string | null = null
  private scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
    this.parent = new TransformNode('city-lots', scene)
  }

  getParent(): TransformNode {
    return this.parent
  }

  syncLots(lots: CityLot[], terrain: TerrainData): void {
    this.disposeAll()

    for (const lot of lots) {
      const lotGroup = this.createLotMesh(lot, terrain)
      lotGroup.metadata = { lotId: lot.id }
      this.lotMeshes.set(lot.id, lotGroup)
    }

    // Re-apply selection
    if (this.selectedLotId) {
      this.setSelected(this.selectedLotId)
    }
  }

  setSelected(lotId: string | null): void {
    // Remove old selection outlines
    if (this.selectedLotId) {
      const prev = this.lotMeshes.get(this.selectedLotId)
      if (prev) {
        const outline = prev.getChildMeshes(false).find(m => m.name === 'selection-outline')
        if (outline) outline.dispose()
      }
    }

    this.selectedLotId = lotId

    if (lotId) {
      const group = this.lotMeshes.get(lotId)
      if (group) {
        // Find the outline mesh and create a highlighted copy
        const lotOutline = group.getChildMeshes(false).find(m => m.name.startsWith('lot-outline'))
        if (lotOutline) {
          // Get the outline points from metadata
          const outlineData = lotOutline.metadata?.outlinePoints as Vector3[] | undefined
          if (outlineData && outlineData.length >= 2) {
            const colors = outlineData.map(() => new Color4(0.27, 0.53, 1, 1))
            // Close the loop
            const points = [...outlineData, outlineData[0]]
            const loopColors = [...colors, colors[0]]
            const sel = MeshBuilder.CreateLines('selection-outline', {
              points,
              colors: loopColors,
            }, this.scene)
            sel.position.y = 0.2
            sel.renderingGroupId = 2
            sel.parent = group
          }
        }
      }
    }
  }

  /** Find lot id from a world position click */
  findLotAtPosition(x: number, z: number, lots: CityLot[], terrain: TerrainData): string | null {
    const cs = terrain.cellSize
    for (const lot of lots) {
      const x0 = lot.startX * cs
      const z0 = lot.startZ * cs
      const x1 = (lot.startX + lot.width) * cs
      const z1 = (lot.startZ + lot.depth) * cs
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) {
        return lot.id
      }
    }
    return null
  }

  dispose(): void {
    this.disposeAll()
    this.parent.dispose()
  }

  private disposeAll(): void {
    for (const [, group] of this.lotMeshes) {
      group.dispose()
    }
    this.lotMeshes.clear()
    this.selectedLotId = null
  }

  private createLotMesh(lot: CityLot, terrain: TerrainData): TransformNode {
    const group = new TransformNode(`lot-${lot.id}`, this.scene)
    group.parent = this.parent
    const cs = terrain.cellSize
    const zoningColor = lot.color || LOT_ZONING_COLORS[lot.zoning] || '#888888'
    const color = Color3.FromHexString(zoningColor)

    const x0 = lot.startX * cs
    const z0 = lot.startZ * cs
    const x1 = (lot.startX + lot.width) * cs
    const z1 = (lot.startZ + lot.depth) * cs

    // Average terrain height for Y position
    const avgY = this.getAverageHeight(lot.startX, lot.startZ, lot.width, lot.depth, terrain) + 0.3

    // Outline rectangle
    const outlinePoints = [
      new Vector3(x0, avgY, z0),
      new Vector3(x1, avgY, z0),
      new Vector3(x1, avgY, z1),
      new Vector3(x0, avgY, z1),
    ]
    const closedPoints = [...outlinePoints, outlinePoints[0]]
    const outlineColors = closedPoints.map(() => new Color4(color.r, color.g, color.b, 0.9))
    const outlineLine = MeshBuilder.CreateLines(`lot-outline-${lot.id}`, {
      points: closedPoints,
      colors: outlineColors,
    }, this.scene)
    outlineLine.renderingGroupId = 1
    outlineLine.metadata = { outlinePoints }
    outlineLine.parent = group

    // Semi-transparent fill
    const fillMat = new StandardMaterial(`lot-fill-mat-${lot.id}`, this.scene)
    fillMat.diffuseColor = color
    fillMat.alpha = 0.12
    fillMat.backFaceCulling = false
    fillMat.disableLighting = true

    const fillMesh = MeshBuilder.CreateGround(`lot-fill-${lot.id}`, {
      width: lot.width * cs, height: lot.depth * cs
    }, this.scene)
    fillMesh.material = fillMat
    fillMesh.position.set((x0 + x1) / 2, avgY - 0.1, (z0 + z1) / 2)
    fillMesh.renderingGroupId = 1
    fillMesh.metadata = { lotId: lot.id }
    fillMesh.parent = group

    // Label using DynamicTexture
    const textureSize = 256
    const texture = new DynamicTexture(`lot-label-tex-${lot.id}`, { width: textureSize, height: 64 }, this.scene)
    texture.hasAlpha = true
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D
    ctx.clearRect(0, 0, textureSize, 64)
    ctx.fillStyle = `#${color.toHexString().slice(1)}`
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(lot.name, 128, 36)
    texture.update()

    const labelMat = new StandardMaterial(`lot-label-mat-${lot.id}`, this.scene)
    labelMat.diffuseTexture = texture
    labelMat.opacityTexture = texture
    labelMat.disableLighting = true
    labelMat.backFaceCulling = false

    const scale = Math.max(5, lot.width * cs * 0.3)
    const labelPlane = MeshBuilder.CreatePlane(`lot-label-${lot.id}`, {
      width: scale, height: scale * 0.25
    }, this.scene)
    labelPlane.material = labelMat
    labelPlane.position.set((x0 + x1) / 2, avgY + 3, (z0 + z1) / 2)
    labelPlane.billboardMode = Mesh.BILLBOARDMODE_ALL
    labelPlane.renderingGroupId = 2
    labelPlane.parent = group

    return group
  }

  private getAverageHeight(startX: number, startZ: number, w: number, d: number, terrain: TerrainData): number {
    let sum = 0
    let count = 0
    const step = Math.max(1, Math.floor(Math.max(w, d) / 4))
    for (let z = startZ; z < startZ + d; z += step) {
      for (let x = startX; x < startX + w; x += step) {
        if (x >= 0 && x < terrain.size && z >= 0 && z < terrain.sizeZ) {
          sum += terrain.heights[z * terrain.size + x] * terrain.maxHeight
          count++
        }
      }
    }
    return count > 0 ? sum / count : 0
  }
}
