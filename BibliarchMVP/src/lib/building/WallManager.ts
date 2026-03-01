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
import { BuildingData, WallSegment, WallOpening, FloorTile, DetectedRoom } from '@/types/world'
import { splitWallAtOpening, getRoomCentroid } from './wallUtils'

// Material colors
const WALL_MATERIAL_COLORS: Record<string, string> = {
  drywall: '#eeeeee',
  brick: '#aa5533',
  stone: '#888888',
  glass: '#88ccee',
  wood: '#bb8844',
  concrete: '#aaaaaa',
}

const FLOOR_MATERIAL_COLORS: Record<string, string> = {
  wood: '#cc9955',
  tile: '#dddddd',
  carpet: '#886655',
  marble: '#eeeedd',
  concrete: '#aaaaaa',
  stone: '#999988',
}

/**
 * Manages rendering of building interiors: walls, floors, rooms, doors/windows.
 */
export class WallManager {
  private parent: TransformNode
  private wallGroup: TransformNode
  private floorGroup: TransformNode
  private labelGroup: TransformNode
  private gridOverlay: TransformNode
  private ghostGroup: TransformNode
  private scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
    this.parent = new TransformNode('building-interior', scene)
    this.wallGroup = new TransformNode('walls', scene)
    this.wallGroup.parent = this.parent
    this.floorGroup = new TransformNode('floor-tiles', scene)
    this.floorGroup.parent = this.parent
    this.labelGroup = new TransformNode('room-labels', scene)
    this.labelGroup.parent = this.parent
    this.gridOverlay = new TransformNode('building-grid', scene)
    this.gridOverlay.parent = this.parent
    this.ghostGroup = new TransformNode('ghost-preview', scene)
    this.ghostGroup.parent = this.parent
  }

  getParent(): TransformNode {
    return this.parent
  }

  /** Full rebuild for visible floor */
  syncBuilding(data: BuildingData, activeFloor: number): void {
    this.clearAll()

    // Grid overlay
    this.createGridOverlay(data)

    const floor = data.floors.find(f => f.level === activeFloor)
    if (!floor) return

    const floorY = floor.floorHeight

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

    // Ghost other floors (semi-transparent)
    for (const otherFloor of data.floors) {
      if (otherFloor.level === activeFloor) continue
      for (const wall of otherFloor.walls) {
        this.addGhostWall(wall, otherFloor.floorHeight)
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

    const colorHex = WALL_MATERIAL_COLORS[material] || '#cccccc'
    const mat = new StandardMaterial('ghost-wall-mat', this.scene)
    mat.diffuseColor = Color3.FromHexString(colorHex)
    mat.alpha = 0.4
    mat.disableLighting = true
    mat.backFaceCulling = false

    const mesh = MeshBuilder.CreateBox('ghost-wall', {
      width: length, height, depth: 0.15
    }, this.scene)
    mesh.material = mat

    // Position at midpoint
    mesh.position.set(
      (startX + endX) / 2,
      floorY + height / 2,
      (startZ + endZ) / 2
    )
    // Rotate to align with wall direction
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.renderingGroupId = 2
    mesh.parent = this.ghostGroup
  }

  clearGhost(): void {
    this.clearChildMeshes(this.ghostGroup)
  }

  /** Highlight wall on hover (for place-door tool) */
  highlightWall(wall: WallSegment | null, floorY: number): void {
    // Remove existing highlight
    const existing = this.wallGroup.getChildMeshes(false).find(m => m.name === 'wall-highlight')
    if (existing) {
      existing.dispose()
    }

    if (!wall) return

    const dx = wall.endX - wall.startX
    const dz = wall.endZ - wall.startZ
    const length = Math.hypot(dx, dz)
    if (length < 0.01) return

    const mat = new StandardMaterial('highlight-mat', this.scene)
    mat.diffuseColor = Color3.FromHexString('#44aaff')
    mat.alpha = 0.3
    mat.disableLighting = true
    mat.backFaceCulling = false

    const mesh = MeshBuilder.CreateBox('wall-highlight', {
      width: length, height: wall.height + 0.1, depth: wall.thickness + 0.1
    }, this.scene)
    mesh.material = mat
    mesh.position.set(
      (wall.startX + wall.endX) / 2,
      floorY + wall.height / 2,
      (wall.startZ + wall.endZ) / 2
    )
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.renderingGroupId = 2
    mesh.parent = this.wallGroup
  }

  dispose(): void {
    this.clearAll()
    this.parent.dispose()
  }

  private clearAll(): void {
    this.clearChildMeshes(this.wallGroup)
    this.clearChildMeshes(this.floorGroup)
    this.clearChildMeshes(this.labelGroup)
    this.clearChildMeshes(this.gridOverlay)
    this.clearGhost()
  }

  private clearChildMeshes(node: TransformNode): void {
    const children = node.getChildMeshes(false)
    for (const child of children) {
      child.dispose()
    }
    // Also dispose TransformNode children
    const childNodes = node.getChildren()
    for (const child of childNodes) {
      if (child instanceof TransformNode && !(child instanceof Mesh)) {
        child.dispose()
      }
    }
  }

  private addWallMesh(wall: WallSegment, floorY: number): void {
    const dx = wall.endX - wall.startX
    const dz = wall.endZ - wall.startZ
    const length = Math.hypot(dx, dz)
    if (length < 0.01) return

    const colorHex = WALL_MATERIAL_COLORS[wall.material] || '#cccccc'
    const mat = new StandardMaterial(`wall-mat-${wall.id}`, this.scene)
    mat.diffuseColor = Color3.FromHexString(colorHex)
    mat.specularColor = Color3.Black()

    const mesh = MeshBuilder.CreateBox(`wall-${wall.id}`, {
      width: length, height: wall.height, depth: wall.thickness
    }, this.scene)
    mesh.material = mat

    mesh.position.set(
      (wall.startX + wall.endX) / 2,
      floorY + wall.height / 2,
      (wall.startZ + wall.endZ) / 2
    )
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.metadata = { wallId: wall.id }
    mesh.parent = this.wallGroup
  }

  private addGhostWall(wall: WallSegment, floorY: number): void {
    const dx = wall.endX - wall.startX
    const dz = wall.endZ - wall.startZ
    const length = Math.hypot(dx, dz)
    if (length < 0.01) return

    const mat = new StandardMaterial('ghost-mat', this.scene)
    mat.diffuseColor = Color3.FromHexString('#888888')
    mat.alpha = 0.15
    mat.disableLighting = true
    mat.backFaceCulling = false

    const mesh = MeshBuilder.CreateBox('ghost-wall', {
      width: length, height: wall.height, depth: wall.thickness
    }, this.scene)
    mesh.material = mat
    mesh.position.set(
      (wall.startX + wall.endX) / 2,
      floorY + wall.height / 2,
      (wall.startZ + wall.endZ) / 2
    )
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.parent = this.wallGroup
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
      const frameMat = new StandardMaterial('door-frame-mat', this.scene)
      frameMat.diffuseColor = Color3.FromHexString('#664422')
      frameMat.specularColor = Color3.Black()

      const halfW = opening.width / 2

      const leftPost = MeshBuilder.CreateBox('door-post-l', {
        width: 0.05, height: opening.height, depth: wall.thickness + 0.02
      }, this.scene)
      leftPost.material = frameMat
      leftPost.position.set(cx - (dx / wLen) * halfW, floorY + opening.height / 2, cz - (dz / wLen) * halfW)
      leftPost.rotation.y = angle
      leftPost.parent = this.wallGroup

      const rightPost = MeshBuilder.CreateBox('door-post-r', {
        width: 0.05, height: opening.height, depth: wall.thickness + 0.02
      }, this.scene)
      rightPost.material = frameMat.clone('door-frame-mat-r')
      rightPost.position.set(cx + (dx / wLen) * halfW, floorY + opening.height / 2, cz + (dz / wLen) * halfW)
      rightPost.rotation.y = angle
      rightPost.parent = this.wallGroup

      const header = MeshBuilder.CreateBox('door-header', {
        width: opening.width, height: 0.08, depth: wall.thickness + 0.02
      }, this.scene)
      header.material = frameMat.clone('door-frame-mat-h')
      header.position.set(cx, floorY + opening.height, cz)
      header.rotation.y = angle
      header.parent = this.wallGroup
    } else if (opening.type === 'window') {
      // Window: sill + header + glass
      const frameMat = new StandardMaterial('window-frame-mat', this.scene)
      frameMat.diffuseColor = Color3.FromHexString('#888888')
      frameMat.specularColor = Color3.Black()

      // Sill
      const sill = MeshBuilder.CreateBox('window-sill', {
        width: opening.width + 0.1, height: 0.05, depth: wall.thickness + 0.05
      }, this.scene)
      sill.material = frameMat
      sill.position.set(cx, floorY + opening.sillHeight, cz)
      sill.rotation.y = angle
      sill.parent = this.wallGroup

      // Header
      const header = MeshBuilder.CreateBox('window-header', {
        width: opening.width + 0.1, height: 0.05, depth: wall.thickness + 0.05
      }, this.scene)
      header.material = frameMat.clone('window-frame-mat-h')
      header.position.set(cx, floorY + opening.sillHeight + opening.height, cz)
      header.rotation.y = angle
      header.parent = this.wallGroup

      // Glass pane
      const glassMat = new StandardMaterial('glass-mat', this.scene)
      glassMat.diffuseColor = Color3.FromHexString('#88bbdd')
      glassMat.alpha = 0.3
      glassMat.backFaceCulling = false
      glassMat.disableLighting = true

      const glass = MeshBuilder.CreatePlane('window-glass', {
        width: opening.width, height: opening.height
      }, this.scene)
      glass.material = glassMat
      glass.position.set(cx, floorY + opening.sillHeight + opening.height / 2, cz)
      glass.rotation.y = angle
      glass.parent = this.wallGroup
    }
  }

  private addFloorTileMesh(tile: FloorTile, cellSize: number, floorY: number): void {
    const colorHex = FLOOR_MATERIAL_COLORS[tile.material] || '#cccccc'
    const mat = new StandardMaterial('floor-tile-mat', this.scene)
    mat.diffuseColor = Color3.FromHexString(colorHex)
    mat.specularColor = Color3.Black()
    mat.backFaceCulling = false

    const mesh = MeshBuilder.CreateGround('floor-tile', {
      width: cellSize, height: cellSize
    }, this.scene)
    mesh.material = mat
    mesh.position.set(
      tile.x * cellSize + cellSize / 2,
      floorY + 0.01,
      tile.z * cellSize + cellSize / 2
    )
    mesh.renderingGroupId = 1
    mesh.parent = this.floorGroup
  }

  private addRoomLabel(room: DetectedRoom, gridSize: number, cellSize: number, floorY: number): void {
    const centroid = getRoomCentroid(room, gridSize, cellSize)

    const label = room.roomType ? `${room.name} (${room.roomType})` : room.name

    const textureSize = 256
    const texture = new DynamicTexture('room-label-tex', { width: textureSize, height: 64 }, this.scene)
    texture.hasAlpha = true
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D
    ctx.clearRect(0, 0, textureSize, 64)
    ctx.fillStyle = '#88bbff'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(label, 128, 40)
    texture.update()

    const labelMat = new StandardMaterial('room-label-mat', this.scene)
    labelMat.diffuseTexture = texture
    labelMat.opacityTexture = texture
    labelMat.disableLighting = true
    labelMat.backFaceCulling = false

    const labelPlane = MeshBuilder.CreatePlane('room-label', { width: 4, height: 1 }, this.scene)
    labelPlane.material = labelMat
    labelPlane.position.set(centroid.x, floorY + 1.5, centroid.z)
    labelPlane.billboardMode = Mesh.BILLBOARDMODE_ALL
    labelPlane.renderingGroupId = 2
    labelPlane.parent = this.labelGroup
  }

  private createGridOverlay(data: BuildingData): void {
    const totalSize = data.gridSize * data.gridCellSize
    const gridLines: Vector3[] = []

    // Create grid lines manually
    for (let i = 0; i <= data.gridSize; i++) {
      const pos = i * data.gridCellSize
      // Horizontal lines
      gridLines.push(new Vector3(0, 0.02, pos))
      gridLines.push(new Vector3(totalSize, 0.02, pos))
      // Vertical lines
      gridLines.push(new Vector3(pos, 0.02, 0))
      gridLines.push(new Vector3(pos, 0.02, totalSize))
    }

    // Draw lines in pairs
    for (let i = 0; i < gridLines.length; i += 2) {
      const colors = [
        new Color4(0.2, 0.2, 0.27, 0.3),
        new Color4(0.2, 0.2, 0.27, 0.3),
      ]
      const line = MeshBuilder.CreateLines(`grid-line-${i}`, {
        points: [gridLines[i], gridLines[i + 1]],
        colors,
      }, this.scene)
      line.parent = this.gridOverlay
    }
  }
}
