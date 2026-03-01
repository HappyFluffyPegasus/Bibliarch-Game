import * as THREE from 'three'
import { PolygonBorder, TerrainData } from '@/types/world'

/**
 * Manages rendering of polygon borders in the 3D scene.
 * Follows the ObjectManager pattern: owns a THREE.Group, has sync/dispose.
 */
export class BorderManager {
  private group: THREE.Group
  private borderMeshes: Map<string, THREE.Group> = new Map()
  private highlightedId: string | null = null

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'polygon-borders'
  }

  getGroup(): THREE.Group {
    return this.group
  }

  /** Full rebuild of all border visualizations */
  syncBorders(borders: PolygonBorder[], terrain: TerrainData): void {
    this.disposeAll()

    for (const border of borders) {
      if (border.vertices.length < 3) continue
      const borderGroup = this.createBorderMesh(border, terrain)
      borderGroup.userData.borderId = border.id
      this.borderMeshes.set(border.id, borderGroup)
      this.group.add(borderGroup)
    }
  }

  /** Render a preview group for in-progress border drawing (line + fill + vertex dots) */
  renderPreview(
    vertices: { x: number; z: number }[],
    cursorPos: { x: number; z: number } | null,
    terrain: TerrainData,
    color: string
  ): THREE.Group | null {
    if (vertices.length === 0) return null

    const previewGroup = new THREE.Group()
    previewGroup.name = 'border-preview'
    const threeColor = new THREE.Color(color)

    const allVerts = [...vertices]
    if (cursorPos) allVerts.push(cursorPos)

    const points: THREE.Vector3[] = allVerts.map(v => {
      const y = this.getTerrainHeight(v.x, v.z, terrain) + 1.5
      return new THREE.Vector3(v.x, y, v.z)
    })

    // Dashed preview line
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineDashedMaterial({
      color: threeColor,
      dashSize: 2,
      gapSize: 1,
      opacity: 0.8,
      transparent: true,
      depthTest: false,
    })
    const line = new THREE.Line(lineGeo, lineMat)
    line.computeLineDistances()
    line.renderOrder = 20
    previewGroup.add(line)

    // Vertex dots (small spheres)
    const dotGeo = new THREE.SphereGeometry(0.5, 8, 8)
    const dotMat = new THREE.MeshBasicMaterial({ color: threeColor, depthTest: false })
    for (const pt of points) {
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.copy(pt)
      dot.renderOrder = 21
      previewGroup.add(dot)
    }

    // Filled semi-transparent polygon when 3+ placed vertices
    if (vertices.length >= 3) {
      const shape = new THREE.Shape()
      shape.moveTo(vertices[0].x, vertices[0].z)
      for (let i = 1; i < vertices.length; i++) {
        shape.lineTo(vertices[i].x, vertices[i].z)
      }
      shape.closePath()

      const fillGeo = new THREE.ShapeGeometry(shape)
      fillGeo.rotateX(-Math.PI / 2)

      const avgY = points.slice(0, vertices.length).reduce((s, v) => s + v.y, 0) / vertices.length
      const fillMat = new THREE.MeshBasicMaterial({
        color: threeColor,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      })
      const fillMesh = new THREE.Mesh(fillGeo, fillMat)
      fillMesh.position.y = avgY
      fillMesh.renderOrder = 19
      previewGroup.add(fillMesh)
    }

    return previewGroup
  }

  setHighlighted(borderId: string | null): void {
    if (this.highlightedId === borderId) return

    // Reset previous highlight
    if (this.highlightedId) {
      const prev = this.borderMeshes.get(this.highlightedId)
      if (prev) {
        prev.traverse(child => {
          if (child instanceof THREE.Line) {
            const mat = child.material as THREE.LineBasicMaterial
            mat.linewidth = 1
          }
        })
      }
    }

    this.highlightedId = borderId

    // Apply new highlight
    if (borderId) {
      const group = this.borderMeshes.get(borderId)
      if (group) {
        group.traverse(child => {
          if (child instanceof THREE.Line) {
            const mat = child.material as THREE.LineBasicMaterial
            mat.linewidth = 3
          }
        })
      }
    }
  }

  dispose(): void {
    this.disposeAll()
  }

  private disposeAll(): void {
    for (const [, group] of this.borderMeshes) {
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
    this.borderMeshes.clear()
    this.highlightedId = null
  }

  private createBorderMesh(border: PolygonBorder, terrain: TerrainData): THREE.Group {
    const group = new THREE.Group()
    const color = new THREE.Color(border.color)

    // Build vertices projected to terrain
    const verts = border.vertices.map(v => {
      const y = this.getTerrainHeight(v.x, v.z, terrain) + 0.5
      return new THREE.Vector3(v.x, y, v.z)
    })

    // Outline
    const outlinePoints = [...verts, verts[0].clone()]
    const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints)
    let outlineMat: THREE.Material
    if (border.style === 'dashed') {
      outlineMat = new THREE.LineDashedMaterial({
        color,
        dashSize: 3,
        gapSize: 1.5,
        opacity: 0.9,
        transparent: true,
      })
    } else if (border.style === 'dotted') {
      outlineMat = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.5,
        gapSize: 1,
        opacity: 0.9,
        transparent: true,
      })
    } else {
      outlineMat = new THREE.LineBasicMaterial({
        color,
        opacity: 0.9,
        transparent: true,
      })
    }
    const outlineLine = new THREE.Line(outlineGeo, outlineMat)
    outlineLine.computeLineDistances()
    outlineLine.renderOrder = 11
    group.add(outlineLine)

    // Semi-transparent fill
    if (border.fillOpacity > 0) {
      const shape = new THREE.Shape()
      // Use 2D projection (XZ plane) for the shape
      shape.moveTo(border.vertices[0].x, border.vertices[0].z)
      for (let i = 1; i < border.vertices.length; i++) {
        shape.lineTo(border.vertices[i].x, border.vertices[i].z)
      }
      shape.closePath()

      const fillGeo = new THREE.ShapeGeometry(shape)
      // Rotate from XY to XZ plane
      fillGeo.rotateX(-Math.PI / 2)

      const avgY = verts.reduce((sum, v) => sum + v.y, 0) / verts.length
      const fillMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: border.fillOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const fillMesh = new THREE.Mesh(fillGeo, fillMat)
      fillMesh.position.y = avgY - 0.1
      fillMesh.renderOrder = 10
      group.add(fillMesh)
    }

    // Label at centroid
    const cx = border.vertices.reduce((s, v) => s + v.x, 0) / border.vertices.length
    const cz = border.vertices.reduce((s, v) => s + v.z, 0) / border.vertices.length
    const cy = this.getTerrainHeight(cx, cz, terrain) + 5

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = `#${color.getHexString()}`
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(border.name, 128, 40)

      const texture = new THREE.CanvasTexture(canvas)
      const labelMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85 })
      const sprite = new THREE.Sprite(labelMat)
      sprite.position.set(cx, cy, cz)

      // Scale based on border extent
      const extentX = Math.max(...border.vertices.map(v => v.x)) - Math.min(...border.vertices.map(v => v.x))
      const scale = Math.max(10, extentX * 0.4)
      sprite.scale.set(scale, scale * 0.25, 1)
      group.add(sprite)
    }

    return group
  }

  private getTerrainHeight(wx: number, wz: number, terrain: TerrainData): number {
    const gx = Math.floor(wx / terrain.cellSize)
    const gz = Math.floor(wz / terrain.cellSize)
    if (gx < 0 || gx >= terrain.size || gz < 0 || gz >= terrain.sizeZ) return 0
    return terrain.heights[gz * terrain.size + gx] * terrain.maxHeight
  }
}
