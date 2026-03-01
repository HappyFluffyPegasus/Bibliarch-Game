import {
  Mesh,
  MeshBuilder,
  Vector3,
  Color3,
  Color4,
  StandardMaterial,
  TransformNode,
  Scene,
  VertexData,
} from '@babylonjs/core'
import { RoadNetwork, RoadSegment, RoadIntersection, RoadWaypoint, TerrainData, ROAD_TYPE_DEFAULTS } from '@/types/world'
import { computeRoadRibbon, offsetPolyline } from './roadUtils'

/**
 * Manages rendering of road networks (segments + intersections) in the 3D scene.
 */
export class RoadNetworkManager {
  private parent: TransformNode
  private segmentMeshes: Map<string, TransformNode> = new Map()
  private intersectionMeshes: Map<string, Mesh> = new Map()
  private scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
    this.parent = new TransformNode('road-network', scene)
  }

  getParent(): TransformNode {
    return this.parent
  }

  syncNetwork(network: RoadNetwork, terrain: TerrainData): void {
    this.disposeAll()

    for (const segment of network.segments) {
      if (segment.waypoints.length < 2) continue
      const segGroup = this.createSegmentMesh(segment, terrain)
      segGroup.metadata = { segmentId: segment.id }
      this.segmentMeshes.set(segment.id, segGroup)
    }

    for (const ix of network.intersections) {
      const mesh = this.createIntersectionMesh(ix, terrain)
      mesh.metadata = { intersectionId: ix.id }
      this.intersectionMeshes.set(ix.id, mesh)
    }
  }

  /** Render a preview line for in-progress road drawing */
  renderPreview(
    waypoints: RoadWaypoint[],
    cursorPos: RoadWaypoint | null,
    width: number,
    terrain: TerrainData,
  ): TransformNode | null {
    if (waypoints.length === 0 && !cursorPos) return null

    const group = new TransformNode('road-preview', this.scene)
    const allPoints = [...waypoints]
    if (cursorPos) allPoints.push(cursorPos)

    if (allPoints.length >= 2) {
      // Road ribbon preview
      const ribbon = computeRoadRibbon(allPoints, width, terrain)
      if (ribbon.positions.length > 0) {
        const mesh = new Mesh('preview-road', this.scene)
        const vertexData = new VertexData()
        vertexData.positions = ribbon.positions
        vertexData.indices = ribbon.indices
        VertexData.ComputeNormals(ribbon.positions, ribbon.indices, vertexData.normals = [])
        vertexData.applyToMesh(mesh)

        const mat = new StandardMaterial('preview-road-mat', this.scene)
        mat.diffuseColor = Color3.FromHexString('#333333')
        mat.alpha = 0.5
        mat.backFaceCulling = false
        mat.disableLighting = true
        mesh.material = mat
        mesh.renderingGroupId = 1
        mesh.parent = group
      }
    }

    // Waypoint markers
    for (const wp of allPoints) {
      const y = this.getTerrainHeight(wp.x, wp.z, terrain) + 0.5
      const dot = MeshBuilder.CreateSphere('waypoint-dot', { diameter: 1, segments: 8 }, this.scene)
      const dotMat = new StandardMaterial('dot-mat', this.scene)
      dotMat.diffuseColor = Color3.FromHexString('#ff4444')
      dotMat.disableLighting = true
      dot.material = dotMat
      dot.position.set(wp.x, y, wp.z)
      dot.renderingGroupId = 2
      dot.parent = group
    }

    // Center line preview
    if (allPoints.length >= 2) {
      const linePoints = allPoints.map(p => {
        const y = this.getTerrainHeight(p.x, p.z, terrain) + 0.3
        return new Vector3(p.x, y, p.z)
      })
      const colors = linePoints.map(() => new Color4(1, 1, 0, 0.8))
      const line = MeshBuilder.CreateLines('preview-centerline', {
        points: linePoints,
        colors,
      }, this.scene)
      line.renderingGroupId = 2
      line.parent = group
    }

    return group
  }

  dispose(): void {
    this.disposeAll()
    this.parent.dispose()
  }

  private disposeAll(): void {
    for (const [, node] of this.segmentMeshes) {
      node.dispose()
    }
    for (const [, mesh] of this.intersectionMeshes) {
      mesh.dispose()
    }
    this.segmentMeshes.clear()
    this.intersectionMeshes.clear()
  }

  private createSegmentMesh(segment: RoadSegment, terrain: TerrainData): TransformNode {
    const group = new TransformNode(`road-seg-${segment.id}`, this.scene)
    group.parent = this.parent

    // Main road surface
    const ribbon = computeRoadRibbon(segment.waypoints, segment.width, terrain)
    if (ribbon.positions.length > 0) {
      const mesh = new Mesh(`road-surface-${segment.id}`, this.scene)
      const vertexData = new VertexData()
      vertexData.positions = ribbon.positions
      vertexData.indices = ribbon.indices
      VertexData.ComputeNormals(ribbon.positions, ribbon.indices, vertexData.normals = [])
      vertexData.applyToMesh(mesh)

      const roadColor = segment.type === 'footpath' ? '#999988' : '#333333'
      const mat = new StandardMaterial(`road-mat-${segment.id}`, this.scene)
      mat.diffuseColor = Color3.FromHexString(roadColor)
      mat.backFaceCulling = false
      mat.disableLighting = true
      mesh.material = mat
      mesh.renderingGroupId = 1
      mesh.parent = group
    }

    // Center line (dashed) - rendered as simple line
    if (segment.lanes >= 2 && !segment.oneWay) {
      const centerPoints = segment.waypoints.map(p => {
        const y = this.getTerrainHeight(p.x, p.z, terrain) + 0.2
        return new Vector3(p.x, y, p.z)
      })
      const colors = centerPoints.map(() => new Color4(1, 1, 0, 0.7))
      const centerLine = MeshBuilder.CreateLines(`center-line-${segment.id}`, {
        points: centerPoints,
        colors,
      }, this.scene)
      centerLine.renderingGroupId = 1
      centerLine.parent = group
    }

    // Sidewalks
    if (segment.hasSidewalk && segment.sidewalkWidth > 0) {
      const swOffset = segment.width / 2 + segment.sidewalkWidth / 2
      const leftSW = offsetPolyline(segment.waypoints, swOffset)
      const rightSW = offsetPolyline(segment.waypoints, -swOffset)

      for (const sidewalk of [leftSW, rightSW]) {
        const swRibbon = computeRoadRibbon(sidewalk, segment.sidewalkWidth, terrain)
        if (swRibbon.positions.length > 0) {
          // Raise sidewalk slightly above road
          for (let i = 1; i < swRibbon.positions.length; i += 3) {
            swRibbon.positions[i] += 0.1
          }
          const mesh = new Mesh('sidewalk', this.scene)
          const vertexData = new VertexData()
          vertexData.positions = swRibbon.positions
          vertexData.indices = swRibbon.indices
          VertexData.ComputeNormals(swRibbon.positions, swRibbon.indices, vertexData.normals = [])
          vertexData.applyToMesh(mesh)

          const mat = new StandardMaterial('sidewalk-mat', this.scene)
          mat.diffuseColor = Color3.FromHexString('#999999')
          mat.backFaceCulling = false
          mat.disableLighting = true
          mesh.material = mat
          mesh.renderingGroupId = 1
          mesh.parent = group
        }
      }
    }

    // Direction arrows for one-way roads
    if (segment.oneWay && segment.waypoints.length >= 2) {
      const mid = Math.floor(segment.waypoints.length / 2)
      const p1 = segment.waypoints[Math.max(0, mid - 1)]
      const p2 = segment.waypoints[Math.min(segment.waypoints.length - 1, mid)]
      const cx = (p1.x + p2.x) / 2
      const cz = (p1.z + p2.z) / 2
      const cy = this.getTerrainHeight(cx, cz, terrain) + 0.3

      const dx = p2.x - p1.x
      const dz = p2.z - p1.z
      const arrowAngle = Math.atan2(dx, dz)

      const arrowMat = new StandardMaterial('arrow-mat', this.scene)
      arrowMat.diffuseColor = Color3.White()
      arrowMat.alpha = 0.6
      arrowMat.disableLighting = true

      const arrow = MeshBuilder.CreateCylinder('arrow', {
        diameterTop: 0, diameterBottom: 1.6, height: 2, tessellation: 4
      }, this.scene)
      arrow.rotation.x = Math.PI / 2
      arrow.material = arrowMat
      arrow.position.set(cx, cy, cz)
      arrow.rotation.y = arrowAngle
      arrow.renderingGroupId = 1
      arrow.parent = group
    }

    return group
  }

  private createIntersectionMesh(ix: RoadIntersection, terrain: TerrainData): Mesh {
    const y = this.getTerrainHeight(ix.position.x, ix.position.z, terrain) + 0.2
    const radius = ix.type === 'roundabout' ? 5 : 3
    const tessellation = ix.type === 'roundabout' ? 24 : 8

    const mesh = MeshBuilder.CreateDisc(`intersection-${ix.id}`, {
      radius, tessellation
    }, this.scene)
    // Rotate to lie flat
    mesh.rotation.x = Math.PI / 2

    const colorMap: Record<string, string> = {
      stop: '#ff4444',
      signal: '#44ff44',
      roundabout: '#4444ff',
      yield: '#ffaa44',
      uncontrolled: '#888888',
    }
    const mat = new StandardMaterial(`ix-mat-${ix.id}`, this.scene)
    mat.diffuseColor = Color3.FromHexString(colorMap[ix.type] || '#888888')
    mat.alpha = 0.3
    mat.backFaceCulling = false
    mat.disableLighting = true
    mesh.material = mat
    mesh.position.set(ix.position.x, y, ix.position.z)
    mesh.renderingGroupId = 1
    mesh.parent = this.parent
    return mesh
  }

  private getTerrainHeight(wx: number, wz: number, terrain: TerrainData): number {
    const gx = Math.floor(wx / terrain.cellSize)
    const gz = Math.floor(wz / terrain.cellSize)
    if (gx < 0 || gx >= terrain.size || gz < 0 || gz >= terrain.sizeZ) return 0
    return terrain.heights[gz * terrain.size + gx] * terrain.maxHeight
  }
}
