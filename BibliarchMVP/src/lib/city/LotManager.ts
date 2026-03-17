import * as THREE from 'three'
import { CityLot, TerrainData, LOT_ZONING_COLORS, LotZoning, WorldNode } from '@/types/world'

/**
 * Manages rendering of city lots (rectangular parcels) in the 3D scene.
 */
export class LotManager {
  private group: THREE.Group
  private lotMeshes: Map<string, THREE.Group> = new Map()
  private selectedLotId: string | null = null

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'city-lots'
  }

  getGroup(): THREE.Group {
    return this.group
  }

  syncLots(lots: CityLot[], terrain: TerrainData, buildingNodes?: Map<string, WorldNode>): void {
    this.disposeAll()

    for (const lot of lots) {
      const lotGroup = this.createLotMesh(lot, terrain)
      lotGroup.userData.lotId = lot.id

      // If lot has a linked building, render a solid block for it
      if (lot.linkedBuildingId && buildingNodes) {
        const bldgNode = buildingNodes.get(lot.linkedBuildingId)
        if (bldgNode?.buildingData) {
          const blockMesh = this.createBuildingBlock(lot, terrain, bldgNode)
          if (blockMesh) lotGroup.add(blockMesh)
        }
      }

      this.lotMeshes.set(lot.id, lotGroup)
      this.group.add(lotGroup)
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
        const outline = prev.getObjectByName('selection-outline')
        if (outline) prev.remove(outline)
      }
    }

    this.selectedLotId = lotId

    if (lotId) {
      const group = this.lotMeshes.get(lotId)
      if (group) {
        // Add selection outline
        const selOutline = group.getObjectByName('lot-outline') as THREE.LineLoop | null
        if (selOutline) {
          const geo = selOutline.geometry.clone()
          const mat = new THREE.LineBasicMaterial({ color: 0x4488ff, linewidth: 2, opacity: 1, transparent: false })
          const sel = new THREE.LineLoop(geo, mat)
          sel.name = 'selection-outline'
          sel.position.y = 0.2
          sel.renderOrder = 15
          group.add(sel)
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
  }

  private disposeAll(): void {
    for (const [, group] of this.lotMeshes) {
      group.traverse(child => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach(m => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })
      this.group.remove(group)
    }
    this.lotMeshes.clear()
    this.selectedLotId = null
  }

  private createLotMesh(lot: CityLot, terrain: TerrainData): THREE.Group {
    const group = new THREE.Group()
    const cs = terrain.cellSize
    const zoningColor = lot.color || LOT_ZONING_COLORS[lot.zoning] || '#888888'
    const color = new THREE.Color(zoningColor)

    const x0 = lot.startX * cs
    const z0 = lot.startZ * cs
    const x1 = (lot.startX + lot.width) * cs
    const z1 = (lot.startZ + lot.depth) * cs

    // Average terrain height for Y position
    const avgY = this.getAverageHeight(lot.startX, lot.startZ, lot.width, lot.depth, terrain) + 0.3

    // Outline rectangle
    const outlinePoints = [
      new THREE.Vector3(x0, avgY, z0),
      new THREE.Vector3(x1, avgY, z0),
      new THREE.Vector3(x1, avgY, z1),
      new THREE.Vector3(x0, avgY, z1),
    ]
    const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints)
    const outlineMat = new THREE.LineBasicMaterial({ color, opacity: 0.9, transparent: true })
    const outlineLine = new THREE.LineLoop(outlineGeo, outlineMat)
    outlineLine.name = 'lot-outline'
    outlineLine.renderOrder = 11
    group.add(outlineLine)

    // Semi-transparent fill
    const fillGeo = new THREE.PlaneGeometry(lot.width * cs, lot.depth * cs)
    fillGeo.rotateX(-Math.PI / 2)
    const fillMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const fillMesh = new THREE.Mesh(fillGeo, fillMat)
    fillMesh.position.set((x0 + x1) / 2, avgY - 0.1, (z0 + z1) / 2)
    fillMesh.renderOrder = 10
    fillMesh.userData.lotId = lot.id
    group.add(fillMesh)

    // Label
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = `#${color.getHexString()}`
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(lot.name, 128, 36)

      const texture = new THREE.CanvasTexture(canvas)
      const labelMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8 })
      const sprite = new THREE.Sprite(labelMat)
      sprite.position.set((x0 + x1) / 2, avgY + 3, (z0 + z1) / 2)
      const scale = Math.max(5, lot.width * cs * 0.3)
      sprite.scale.set(scale, scale * 0.25, 1)
      group.add(sprite)
    }

    return group
  }

  /** Render a solid block representing a building on a lot */
  private createBuildingBlock(lot: CityLot, terrain: TerrainData, bldgNode: WorldNode): THREE.Mesh | null {
    const bd = bldgNode.buildingData
    if (!bd) return null

    const cs = terrain.cellSize

    // Find tallest wall across all floors
    let maxHeight = 3 // default 1 floor
    for (const floor of bd.floors) {
      if (floor.walls.length > 0) {
        const tallest = Math.max(...floor.walls.map(w => w.height))
        const top = floor.floorHeight + tallest
        if (top > maxHeight) maxHeight = top
      }
    }

    const widthWorld = lot.width * cs
    const depthWorld = lot.depth * cs
    const x0 = lot.startX * cs
    const z0 = lot.startZ * cs
    const baseY = bd.baseElevation ?? this.getAverageHeight(lot.startX, lot.startZ, lot.width, lot.depth, terrain)

    // Inset slightly from lot edges so the outline is still visible
    const inset = cs * 0.1
    const geo = new THREE.BoxGeometry(widthWorld - inset * 2, maxHeight, depthWorld - inset * 2)
    const mat = new THREE.MeshLambertMaterial({
      color: 0xccbbaa,
      transparent: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      x0 + widthWorld / 2,
      baseY + maxHeight / 2,
      z0 + depthWorld / 2
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = 'building-block'

    return mesh
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
