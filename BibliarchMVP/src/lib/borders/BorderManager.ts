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
  Sprite,
  SpriteManager,
  VertexData,
  LinesMesh,
} from '@babylonjs/core'
import { PolygonBorder, TerrainData } from '@/types/world'

export class BorderManager {
  private parent: TransformNode
  private borderMeshes: Map<string, TransformNode> = new Map()
  private highlightedId: string | null = null
  private scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
    this.parent = new TransformNode('polygon-borders', scene)
  }

  getParent(): TransformNode {
    return this.parent
  }

  syncBorders(borders: PolygonBorder[], terrain: TerrainData): void {
    this.disposeAll()

    for (const border of borders) {
      if (border.vertices.length < 3) continue
      const borderGroup = this.createBorderMesh(border, terrain)
      borderGroup.metadata = { borderId: border.id }
      this.borderMeshes.set(border.id, borderGroup)
    }
  }

  renderPreview(
    vertices: { x: number; z: number }[],
    cursorPos: { x: number; z: number } | null,
    terrain: TerrainData,
    color: string
  ): TransformNode | null {
    if (vertices.length === 0) return null

    const previewGroup = new TransformNode('border-preview', this.scene)
    const threeColor = Color3.FromHexString(color)

    const allVerts = [...vertices]
    if (cursorPos) allVerts.push(cursorPos)

    const points: Vector3[] = allVerts.map(v => {
      const y = this.getTerrainHeight(v.x, v.z, terrain) + 1.5
      return new Vector3(v.x, y, v.z)
    })

    // Dashed preview line
    if (points.length >= 2) {
      const colors: Color4[] = points.map(() => new Color4(threeColor.r, threeColor.g, threeColor.b, 0.8))
      const line = MeshBuilder.CreateLines('preview-line', {
        points,
        colors,
      }, this.scene)
      line.renderingGroupId = 2
      line.parent = previewGroup
    }

    // Vertex dots
    for (const pt of points) {
      const dot = MeshBuilder.CreateSphere('dot', { diameter: 1, segments: 8 }, this.scene)
      const dotMat = new StandardMaterial('dot-mat', this.scene)
      dotMat.diffuseColor = threeColor
      dotMat.disableLighting = true
      dot.material = dotMat
      dot.position = pt
      dot.renderingGroupId = 2
      dot.parent = previewGroup
    }

    // Filled polygon when 3+ vertices
    if (vertices.length >= 3) {
      const avgY = points.slice(0, vertices.length).reduce((s, v) => s + v.y, 0) / vertices.length

      // Create a ground-like mesh for the fill
      const fillMat = new StandardMaterial('fill-mat', this.scene)
      fillMat.diffuseColor = threeColor
      fillMat.alpha = 0.15
      fillMat.backFaceCulling = false
      fillMat.disableLighting = true

      // Simple triangle fan from first vertex
      const positions: number[] = []
      const indices: number[] = []
      for (let i = 0; i < vertices.length; i++) {
        positions.push(vertices[i].x, avgY, vertices[i].z)
      }
      for (let i = 1; i < vertices.length - 1; i++) {
        indices.push(0, i, i + 1)
      }

      const fillMesh = new Mesh('fill', this.scene)
      const vertexData = new VertexData()
      vertexData.positions = positions
      vertexData.indices = indices
      VertexData.ComputeNormals(positions, indices, vertexData.normals = [])
      vertexData.applyToMesh(fillMesh)
      fillMesh.material = fillMat
      fillMesh.renderingGroupId = 1
      fillMesh.parent = previewGroup
    }

    return previewGroup
  }

  setHighlighted(borderId: string | null): void {
    if (this.highlightedId === borderId) return
    this.highlightedId = borderId
    // Highlighting via line width isn't directly supported in Babylon.js WebGL
    // Could use glow layer or different material for highlighting
  }

  dispose(): void {
    this.disposeAll()
  }

  private disposeAll(): void {
    for (const [, node] of this.borderMeshes) {
      node.dispose()
    }
    this.borderMeshes.clear()
    this.highlightedId = null
  }

  private createBorderMesh(border: PolygonBorder, terrain: TerrainData): TransformNode {
    const group = new TransformNode(`border-${border.id}`, this.scene)
    group.parent = this.parent
    const color = Color3.FromHexString(border.color)

    const verts = border.vertices.map(v => {
      const y = this.getTerrainHeight(v.x, v.z, terrain) + 0.5
      return new Vector3(v.x, y, v.z)
    })

    // Outline
    const outlinePoints = [...verts, verts[0].clone()]
    const outlineColors = outlinePoints.map(() => new Color4(color.r, color.g, color.b, 0.9))

    const outlineLine = MeshBuilder.CreateLines(`outline-${border.id}`, {
      points: outlinePoints,
      colors: outlineColors,
    }, this.scene)
    outlineLine.renderingGroupId = 1
    outlineLine.parent = group

    // Semi-transparent fill
    if (border.fillOpacity > 0) {
      const avgY = verts.reduce((sum, v) => sum + v.y, 0) / verts.length

      const fillMat = new StandardMaterial(`fill-mat-${border.id}`, this.scene)
      fillMat.diffuseColor = color
      fillMat.alpha = border.fillOpacity
      fillMat.backFaceCulling = false
      fillMat.disableLighting = true

      const positions: number[] = []
      const indices: number[] = []
      for (let i = 0; i < border.vertices.length; i++) {
        positions.push(border.vertices[i].x, avgY - 0.1, border.vertices[i].z)
      }
      for (let i = 1; i < border.vertices.length - 1; i++) {
        indices.push(0, i, i + 1)
      }

      const fillMesh = new Mesh(`fill-${border.id}`, this.scene)
      const vertexData = new VertexData()
      vertexData.positions = positions
      vertexData.indices = indices
      VertexData.ComputeNormals(positions, indices, vertexData.normals = [])
      vertexData.applyToMesh(fillMesh)
      fillMesh.material = fillMat
      fillMesh.renderingGroupId = 1
      fillMesh.parent = group
    }

    // Label at centroid using DynamicTexture
    const cx = border.vertices.reduce((s, v) => s + v.x, 0) / border.vertices.length
    const cz = border.vertices.reduce((s, v) => s + v.z, 0) / border.vertices.length
    const cy = this.getTerrainHeight(cx, cz, terrain) + 5

    const textureSize = 256
    const texture = new DynamicTexture(`label-tex-${border.id}`, { width: textureSize, height: 64 }, this.scene)
    texture.hasAlpha = true
    const ctx2d = texture.getContext() as unknown as CanvasRenderingContext2D
    ctx2d.clearRect(0, 0, textureSize, 64)
    ctx2d.fillStyle = `#${color.toHexString().slice(1)}`
    ctx2d.font = 'bold 28px sans-serif'
    ctx2d.textAlign = 'center'
    ctx2d.fillText(border.name, textureSize / 2, 40)
    texture.update()

    const labelPlane = MeshBuilder.CreatePlane(`label-${border.id}`, { width: 10, height: 2.5 }, this.scene)
    const labelMat = new StandardMaterial(`label-mat-${border.id}`, this.scene)
    labelMat.diffuseTexture = texture
    labelMat.opacityTexture = texture
    labelMat.disableLighting = true
    labelMat.backFaceCulling = false
    labelPlane.material = labelMat
    labelPlane.position = new Vector3(cx, cy, cz)
    labelPlane.billboardMode = Mesh.BILLBOARDMODE_ALL
    labelPlane.renderingGroupId = 2
    labelPlane.parent = group

    return group
  }

  private getTerrainHeight(wx: number, wz: number, terrain: TerrainData): number {
    const gx = Math.floor(wx / terrain.cellSize)
    const gz = Math.floor(wz / terrain.cellSize)
    if (gx < 0 || gx >= terrain.size || gz < 0 || gz >= terrain.sizeZ) return 0
    return terrain.heights[gz * terrain.size + gx] * terrain.maxHeight
  }
}
