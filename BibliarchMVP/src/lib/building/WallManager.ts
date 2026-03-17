import * as THREE from 'three'
import { BuildingData, WallSegment, WallOpening, FloorTile, DetectedRoom, FurniturePlacement } from '@/types/world'
import { splitWallAtOpening, getRoomCentroid } from './wallUtils'
import { getFurnitureEntry } from './furnitureCatalog'

// Material colors
const WALL_MATERIAL_COLORS: Record<string, number> = {
  drywall: 0xeeeeee,
  brick: 0xaa5533,
  stone: 0x888888,
  glass: 0x88ccee,
  wood: 0xbb8844,
  concrete: 0xaaaaaa,
}

const FLOOR_MATERIAL_COLORS: Record<string, number> = {
  wood: 0xcc9955,
  tile: 0xdddddd,
  carpet: 0x886655,
  marble: 0xeeeedd,
  concrete: 0xaaaaaa,
  stone: 0x999988,
}

/**
 * Manages rendering of building interiors: walls, floors, rooms, doors/windows.
 */
export class WallManager {
  private group: THREE.Group
  private wallGroup: THREE.Group
  private floorGroup: THREE.Group
  private labelGroup: THREE.Group
  private gridOverlay: THREE.Group
  private ghostGroup: THREE.Group
  private furnitureGroup: THREE.Group

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'building-interior'
    this.wallGroup = new THREE.Group()
    this.wallGroup.name = 'walls'
    this.floorGroup = new THREE.Group()
    this.floorGroup.name = 'floor-tiles'
    this.labelGroup = new THREE.Group()
    this.labelGroup.name = 'room-labels'
    this.gridOverlay = new THREE.Group()
    this.gridOverlay.name = 'building-grid'
    this.ghostGroup = new THREE.Group()
    this.ghostGroup.name = 'ghost-preview'
    this.furnitureGroup = new THREE.Group()
    this.furnitureGroup.name = 'furniture'
    this.group.add(this.wallGroup)
    this.group.add(this.floorGroup)
    this.group.add(this.labelGroup)
    this.group.add(this.gridOverlay)
    this.group.add(this.ghostGroup)
    this.group.add(this.furnitureGroup)
  }

  getGroup(): THREE.Group {
    return this.group
  }

  /** Get all pickable meshes (walls + furniture) for raycasting */
  getPickableMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = []
    for (const child of this.wallGroup.children) {
      if ((child as THREE.Mesh).isMesh && child.userData.wallId) {
        meshes.push(child)
      }
    }
    for (const child of this.furnitureGroup.children) {
      if ((child as THREE.Mesh).isMesh && child.userData.furnitureId) {
        meshes.push(child)
      }
    }
    return meshes
  }

  /** Full rebuild for visible floor */
  syncBuilding(data: BuildingData, activeFloor: number, floorVisibility: 'active-only' | 'transparent' | 'all' = 'transparent'): void {
    this.clearAll()

    const baseY = data.baseElevation ?? 0

    // Grid overlay
    this.createGridOverlay(data, baseY)

    const floor = data.floors.find(f => f.level === activeFloor)
    if (!floor) return

    const floorY = floor.floorHeight + baseY

    // Render walls
    for (const wall of floor.walls) {
      // Collect openings for this wall
      const wallOpenings = floor.openings.filter(o => o.wallId === wall.id)
      if (wallOpenings.length === 0) {
        this.addWallMesh(wall, floorY)
      } else {
        // Split wall at each opening, render segments + opening meshes
        let segments: WallSegment[] = [wall]
        for (const opening of wallOpenings) {
          const newSegments: WallSegment[] = []
          for (const seg of segments) {
            newSegments.push(...splitWallAtOpening(seg, opening))
          }
          segments = newSegments
        }
        for (const seg of segments) {
          this.addWallMesh(seg, floorY)
        }
        // Render opening meshes (door frames, windows)
        for (const opening of wallOpenings) {
          this.addOpeningMesh(wall, opening, floorY)
        }
      }
    }

    // Render floor tiles
    for (const tile of floor.floorTiles) {
      this.addFloorTileMesh(tile, data.gridCellSize, floorY)
    }

    // Render room labels
    for (const room of floor.rooms) {
      this.addRoomLabel(room, data.gridSize, data.gridCellSize, floorY)
    }

    // Render furniture for this floor
    const floorFurniture = data.furniture.filter(f => f.floorLevel === activeFloor)
    for (const furn of floorFurniture) {
      this.addFurnitureMesh(furn, floorY)
    }

    // Other floors based on visibility mode
    if (floorVisibility !== 'active-only') {
      for (const otherFloor of data.floors) {
        if (otherFloor.level === activeFloor) continue
        const otherFloorY = otherFloor.floorHeight + baseY
        for (const wall of otherFloor.walls) {
          if (floorVisibility === 'all') {
            this.addWallMesh(wall, otherFloorY)
          } else {
            this.addGhostWall(wall, otherFloorY)
          }
        }
        if (floorVisibility === 'all') {
          for (const tile of otherFloor.floorTiles) {
            this.addFloorTileMesh(tile, data.gridCellSize, otherFloorY)
          }
          const otherFurniture = data.furniture.filter(f => f.floorLevel === otherFloor.level)
          for (const furn of otherFurniture) {
            this.addFurnitureMesh(furn, otherFloorY)
          }
        }
      }
    }
  }

  /** Show ghost wall preview while drawing */
  showGhostWall(
    startX: number, startZ: number,
    endX: number, endZ: number,
    height: number, floorY: number,
    material: string
  ): void {
    this.clearGhost()

    const dx = endX - startX
    const dz = endZ - startZ
    const length = Math.hypot(dx, dz)
    if (length < 0.01) return

    const color = WALL_MATERIAL_COLORS[material] || 0xcccccc
    const geo = new THREE.BoxGeometry(length, height, 0.15)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)

    // Position at midpoint
    mesh.position.set(
      (startX + endX) / 2,
      floorY + height / 2,
      (startZ + endZ) / 2
    )
    // Rotate to align with wall direction
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.renderOrder = 20

    this.ghostGroup.add(mesh)
  }

  clearGhost(): void {
    while (this.ghostGroup.children.length > 0) {
      const child = this.ghostGroup.children[0]
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
      if ((child as THREE.Mesh).material) ((child as THREE.Mesh).material as THREE.Material).dispose()
      this.ghostGroup.remove(child)
    }
  }

  /** Highlight wall on hover (for place-door tool) */
  highlightWall(wall: WallSegment | null, floorY: number): void {
    // Remove existing highlight
    const existing = this.wallGroup.getObjectByName('wall-highlight')
    if (existing) {
      (existing as THREE.Mesh).geometry.dispose();
      ((existing as THREE.Mesh).material as THREE.Material).dispose()
      this.wallGroup.remove(existing)
    }

    if (!wall) return

    const dx = wall.endX - wall.startX
    const dz = wall.endZ - wall.startZ
    const length = Math.hypot(dx, dz)
    if (length < 0.01) return

    const geo = new THREE.BoxGeometry(length, wall.height + 0.1, wall.thickness + 0.1)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = 'wall-highlight'
    mesh.position.set(
      (wall.startX + wall.endX) / 2,
      floorY + wall.height / 2,
      (wall.startZ + wall.endZ) / 2
    )
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.renderOrder = 21
    this.wallGroup.add(mesh)
  }

  dispose(): void {
    this.clearAll()
  }

  private clearAll(): void {
    this.clearGroup(this.wallGroup)
    this.clearGroup(this.floorGroup)
    this.clearGroup(this.labelGroup)
    this.clearGroup(this.gridOverlay)
    this.clearGroup(this.furnitureGroup)
    this.clearGhost()
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0]
      child.traverse(obj => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose()
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach(m => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })
      group.remove(child)
    }
  }

  private addWallMesh(wall: WallSegment, floorY: number): void {
    const dx = wall.endX - wall.startX
    const dz = wall.endZ - wall.startZ
    const length = Math.hypot(dx, dz)
    if (length < 0.01) return

    const color = WALL_MATERIAL_COLORS[wall.material] || 0xcccccc
    // Extend wall by half-thickness on each end so corners overlap cleanly
    const geo = new THREE.BoxGeometry(length + wall.thickness, wall.height, wall.thickness)
    const mat = new THREE.MeshLambertMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)

    mesh.position.set(
      (wall.startX + wall.endX) / 2,
      floorY + wall.height / 2,
      (wall.startZ + wall.endZ) / 2
    )
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.userData.wallId = wall.id

    this.wallGroup.add(mesh)
  }

  private addGhostWall(wall: WallSegment, floorY: number): void {
    const dx = wall.endX - wall.startX
    const dz = wall.endZ - wall.startZ
    const length = Math.hypot(dx, dz)
    if (length < 0.01) return

    const geo = new THREE.BoxGeometry(length, wall.height, wall.thickness)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      (wall.startX + wall.endX) / 2,
      floorY + wall.height / 2,
      (wall.startZ + wall.endZ) / 2
    )
    mesh.rotation.y = -Math.atan2(dz, dx)
    this.wallGroup.add(mesh)
  }

  private addOpeningMesh(wall: WallSegment, opening: WallOpening, floorY: number): void {
    const dx = wall.endX - wall.startX
    const dz = wall.endZ - wall.startZ
    const wLen = Math.hypot(dx, dz)
    if (wLen < 0.01) return

    // Position of opening along wall
    const cx = wall.startX + dx * opening.position
    const cz = wall.startZ + dz * opening.position
    const angle = -Math.atan2(dz, dx)

    if (opening.type === 'door') {
      // Door frame (two vertical posts + header)
      const frameColor = 0x664422
      const postGeo = new THREE.BoxGeometry(0.05, opening.height, wall.thickness + 0.02)
      const postMat = new THREE.MeshLambertMaterial({ color: frameColor })

      const leftPost = new THREE.Mesh(postGeo, postMat)
      const rightPost = new THREE.Mesh(postGeo, postMat.clone())
      const halfW = opening.width / 2

      leftPost.position.set(cx - (dx / wLen) * halfW, floorY + opening.height / 2, cz - (dz / wLen) * halfW)
      rightPost.position.set(cx + (dx / wLen) * halfW, floorY + opening.height / 2, cz + (dz / wLen) * halfW)
      leftPost.rotation.y = angle
      rightPost.rotation.y = angle

      const headerGeo = new THREE.BoxGeometry(opening.width, 0.08, wall.thickness + 0.02)
      const header = new THREE.Mesh(headerGeo, postMat.clone())
      header.position.set(cx, floorY + opening.height, cz)
      header.rotation.y = angle

      this.wallGroup.add(leftPost, rightPost, header)
    } else if (opening.type === 'window') {
      // Window: sill + header + glass
      const frameColor = 0x888888
      const frameMat = new THREE.MeshLambertMaterial({ color: frameColor })

      // Sill
      const sillGeo = new THREE.BoxGeometry(opening.width + 0.1, 0.05, wall.thickness + 0.05)
      const sill = new THREE.Mesh(sillGeo, frameMat)
      sill.position.set(cx, floorY + opening.sillHeight, cz)
      sill.rotation.y = angle

      // Header
      const header = sill.clone()
      header.position.y = floorY + opening.sillHeight + opening.height

      // Glass pane
      const glassGeo = new THREE.PlaneGeometry(opening.width, opening.height)
      const glassMat = new THREE.MeshBasicMaterial({
        color: 0x88bbdd,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const glass = new THREE.Mesh(glassGeo, glassMat)
      glass.position.set(cx, floorY + opening.sillHeight + opening.height / 2, cz)
      glass.rotation.y = angle

      this.wallGroup.add(sill, header, glass)
    }
  }

  private addFloorTileMesh(tile: FloorTile, cellSize: number, floorY: number): void {
    const color = FLOOR_MATERIAL_COLORS[tile.material] || 0xcccccc
    const geo = new THREE.PlaneGeometry(cellSize, cellSize)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      tile.x * cellSize + cellSize / 2,
      floorY + 0.01,
      tile.z * cellSize + cellSize / 2
    )
    mesh.renderOrder = 5
    this.floorGroup.add(mesh)
  }

  private addRoomLabel(room: DetectedRoom, gridSize: number, cellSize: number, floorY: number): void {
    const centroid = getRoomCentroid(room, gridSize, cellSize)

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#88bbff'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    const label = room.roomType ? `${room.name} (${room.roomType})` : room.name
    ctx.fillText(label, 128, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.7 })
    const sprite = new THREE.Sprite(mat)
    sprite.position.set(centroid.x, floorY + 1.5, centroid.z)
    sprite.scale.set(4, 1, 1)
    this.labelGroup.add(sprite)
  }

  private addFurnitureMesh(furn: FurniturePlacement, floorY: number): void {
    const entry = getFurnitureEntry(furn.itemType)
    const width = entry?.width ?? 0.5
    const depth = entry?.depth ?? 0.5
    const height = entry?.height ?? 0.8
    const color = entry?.color ?? 0xaa8866
    const name = entry?.name ?? furn.itemType

    // Box placeholder mesh
    const geo = new THREE.BoxGeometry(width, height, depth)
    const mat = new THREE.MeshLambertMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      furn.position[0],
      floorY + height / 2,
      furn.position[2]
    )
    mesh.rotation.y = furn.rotation
    mesh.userData.furnitureId = furn.id

    // Sprite label above the furniture
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(name, 128, 40)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8 })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.position.set(
        furn.position[0],
        floorY + height + 0.3,
        furn.position[2]
      )
      sprite.scale.set(2, 0.5, 1)
      this.furnitureGroup.add(sprite)
    }

    this.furnitureGroup.add(mesh)
  }

  private createGridOverlay(data: BuildingData, baseY: number = 0): void {
    const totalSize = data.gridSize * data.gridCellSize
    const grid = new THREE.GridHelper(totalSize, data.gridSize, 0x444466, 0x333344)
    grid.position.set(totalSize / 2, baseY + 0.02, totalSize / 2)
    grid.material.opacity = 0.3
    grid.material.transparent = true
    this.gridOverlay.add(grid)
  }
}
