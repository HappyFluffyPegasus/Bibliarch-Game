import * as THREE from 'three'
import { RoadNetwork, RoadSegment, RoadIntersection, RoadWaypoint, TerrainData, ROAD_TYPE_DEFAULTS } from '@/types/world'
import { computeRoadRibbon, offsetPolyline } from './roadUtils'

/**
 * Manages rendering of road networks (segments + intersections) in the 3D scene.
 */
export class RoadNetworkManager {
  private group: THREE.Group
  private segmentMeshes: Map<string, THREE.Group> = new Map()
  private intersectionMeshes: Map<string, THREE.Mesh> = new Map()

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'road-network'
  }

  getGroup(): THREE.Group {
    return this.group
  }

  syncNetwork(network: RoadNetwork, terrain: TerrainData): void {
    this.disposeAll()

    for (const segment of network.segments) {
      if (segment.waypoints.length < 2) continue
      const segGroup = this.createSegmentMesh(segment, terrain)
      segGroup.userData.segmentId = segment.id
      this.segmentMeshes.set(segment.id, segGroup)
      this.group.add(segGroup)
    }

    for (const ix of network.intersections) {
      const mesh = this.createIntersectionMesh(ix, terrain)
      mesh.userData.intersectionId = ix.id
      this.intersectionMeshes.set(ix.id, mesh)
      this.group.add(mesh)
    }
  }

  /** Render a preview line for in-progress road drawing */
  renderPreview(
    waypoints: RoadWaypoint[],
    cursorPos: RoadWaypoint | null,
    width: number,
    terrain: TerrainData,
  ): THREE.Group | null {
    if (waypoints.length === 0 && !cursorPos) return null

    const group = new THREE.Group()
    const allPoints = [...waypoints]
    if (cursorPos) allPoints.push(cursorPos)

    if (allPoints.length >= 2) {
      // Road ribbon preview
      const ribbon = computeRoadRibbon(allPoints, width, terrain)
      if (ribbon.positions.length > 0) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(ribbon.positions, 3))
        geo.setIndex(ribbon.indices)
        geo.computeVertexNormals()

        const mat = new THREE.MeshBasicMaterial({
          color: 0x333333,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.renderOrder = 12
        group.add(mesh)
      }
    }

    // Waypoint markers
    for (const wp of allPoints) {
      const y = this.getTerrainHeight(wp.x, wp.z, terrain) + 0.5
      const dotGeo = new THREE.SphereGeometry(0.5, 8, 8)
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xff4444 })
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.set(wp.x, y, wp.z)
      dot.renderOrder = 15
      group.add(dot)
    }

    // Center line preview
    if (allPoints.length >= 2) {
      const linePoints = allPoints.map(p => {
        const y = this.getTerrainHeight(p.x, p.z, terrain) + 0.3
        return new THREE.Vector3(p.x, y, p.z)
      })
      const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints)
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xffff00,
        dashSize: 1,
        gapSize: 0.5,
        opacity: 0.8,
        transparent: true,
      })
      const line = new THREE.Line(lineGeo, lineMat)
      line.computeLineDistances()
      line.renderOrder = 14
      group.add(line)
    }

    return group
  }

  dispose(): void {
    this.disposeAll()
  }

  private disposeAll(): void {
    const cleanup = (obj: THREE.Object3D) => {
      obj.traverse(child => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach(m => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })
    }

    for (const [, g] of this.segmentMeshes) {
      cleanup(g)
      this.group.remove(g)
    }
    for (const [, m] of this.intersectionMeshes) {
      cleanup(m)
      this.group.remove(m)
    }
    this.segmentMeshes.clear()
    this.intersectionMeshes.clear()
  }

  private createSegmentMesh(segment: RoadSegment, terrain: TerrainData): THREE.Group {
    const group = new THREE.Group()

    // Main road surface
    const ribbon = computeRoadRibbon(segment.waypoints, segment.width, terrain)
    if (ribbon.positions.length > 0) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(ribbon.positions, 3))
      geo.setIndex(ribbon.indices)
      geo.computeVertexNormals()

      const roadColor = segment.type === 'footpath' ? 0x999988 : 0x333333
      const mat = new THREE.MeshBasicMaterial({
        color: roadColor,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.renderOrder = 8
      group.add(mesh)
    }

    // Center line (dashed)
    if (segment.lanes >= 2 && !segment.oneWay) {
      const centerPoints = segment.waypoints.map(p => {
        const y = this.getTerrainHeight(p.x, p.z, terrain) + 0.2
        return new THREE.Vector3(p.x, y, p.z)
      })
      const centerGeo = new THREE.BufferGeometry().setFromPoints(centerPoints)
      const centerMat = new THREE.LineDashedMaterial({
        color: 0xffff00,
        dashSize: 2,
        gapSize: 2,
        opacity: 0.7,
        transparent: true,
      })
      const centerLine = new THREE.Line(centerGeo, centerMat)
      centerLine.computeLineDistances()
      centerLine.renderOrder = 9
      group.add(centerLine)
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
          const geo = new THREE.BufferGeometry()
          geo.setAttribute('position', new THREE.Float32BufferAttribute(swRibbon.positions, 3))
          geo.setIndex(swRibbon.indices)
          geo.computeVertexNormals()

          const mat = new THREE.MeshBasicMaterial({
            color: 0x999999,
            side: THREE.DoubleSide,
          })
          const mesh = new THREE.Mesh(geo, mat)
          mesh.renderOrder = 8
          group.add(mesh)
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
      const angle = Math.atan2(dx, dz)

      const arrowGeo = new THREE.ConeGeometry(0.8, 2, 4)
      arrowGeo.rotateX(Math.PI / 2)
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true })
      const arrow = new THREE.Mesh(arrowGeo, arrowMat)
      arrow.position.set(cx, cy, cz)
      arrow.rotation.y = angle
      arrow.renderOrder = 10
      group.add(arrow)
    }

    return group
  }

  private createIntersectionMesh(ix: RoadIntersection, terrain: TerrainData): THREE.Mesh {
    const y = this.getTerrainHeight(ix.position.x, ix.position.z, terrain) + 0.2
    const radius = ix.type === 'roundabout' ? 5 : 3
    const geo = new THREE.CircleGeometry(radius, ix.type === 'roundabout' ? 24 : 8)
    geo.rotateX(-Math.PI / 2)

    const colorMap: Record<string, number> = {
      stop: 0xff4444,
      signal: 0x44ff44,
      roundabout: 0x4444ff,
      yield: 0xffaa44,
      uncontrolled: 0x888888,
    }
    const mat = new THREE.MeshBasicMaterial({
      color: colorMap[ix.type] || 0x888888,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(ix.position.x, y, ix.position.z)
    mesh.renderOrder = 9
    return mesh
  }

  private getTerrainHeight(wx: number, wz: number, terrain: TerrainData): number {
    const gx = Math.floor(wx / terrain.cellSize)
    const gz = Math.floor(wz / terrain.cellSize)
    if (gx < 0 || gx >= terrain.size || gz < 0 || gz >= terrain.sizeZ) return 0
    return terrain.heights[gz * terrain.size + gx] * terrain.maxHeight
  }
}
