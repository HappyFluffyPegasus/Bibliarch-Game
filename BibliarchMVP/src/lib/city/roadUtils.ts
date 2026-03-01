import { RoadSegment, RoadIntersection, RoadWaypoint, TerrainData, TerrainMaterialId } from '@/types/world'

/** Compute intersections between road segments */
export function computeIntersections(segments: RoadSegment[]): RoadIntersection[] {
  const intersections: RoadIntersection[] = []
  const checked = new Set<string>()

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const key = `${i}-${j}`
      if (checked.has(key)) continue
      checked.add(key)

      const pts = findSegmentIntersections(segments[i], segments[j])
      for (const pt of pts) {
        // Check if there's already a nearby intersection
        const existing = intersections.find(
          ix => Math.hypot(ix.position.x - pt.x, ix.position.z - pt.z) < 2
        )
        if (existing) {
          if (!existing.connectedSegmentIds.includes(segments[i].id)) {
            existing.connectedSegmentIds.push(segments[i].id)
          }
          if (!existing.connectedSegmentIds.includes(segments[j].id)) {
            existing.connectedSegmentIds.push(segments[j].id)
          }
        } else {
          intersections.push({
            id: `ix-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            position: pt,
            connectedSegmentIds: [segments[i].id, segments[j].id],
            type: 'uncontrolled',
          })
        }
      }
    }
  }

  return intersections
}

/** Find intersection points between two polylines */
function findSegmentIntersections(a: RoadSegment, b: RoadSegment): { x: number; z: number }[] {
  const results: { x: number; z: number }[] = []

  for (let i = 0; i < a.waypoints.length - 1; i++) {
    for (let j = 0; j < b.waypoints.length - 1; j++) {
      const pt = lineLineIntersect(
        a.waypoints[i], a.waypoints[i + 1],
        b.waypoints[j], b.waypoints[j + 1]
      )
      if (pt) results.push(pt)
    }
  }

  return results
}

/** 2D line-line intersection */
function lineLineIntersect(
  p1: RoadWaypoint, p2: RoadWaypoint,
  p3: RoadWaypoint, p4: RoadWaypoint
): { x: number; z: number } | null {
  const d1x = p2.x - p1.x
  const d1z = p2.z - p1.z
  const d2x = p4.x - p3.x
  const d2z = p4.z - p3.z

  const denom = d1x * d2z - d1z * d2x
  if (Math.abs(denom) < 1e-10) return null

  const t = ((p3.x - p1.x) * d2z - (p3.z - p1.z) * d2x) / denom
  const u = ((p3.x - p1.x) * d1z - (p3.z - p1.z) * d1x) / denom

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * d1x,
      z: p1.z + t * d1z,
    }
  }
  return null
}

/** Snap a point to an existing road endpoint within snapDist */
export function snapToRoadEndpoint(
  point: RoadWaypoint,
  segments: RoadSegment[],
  snapDist: number
): RoadWaypoint {
  let closest: RoadWaypoint | null = null
  let closestDist = snapDist

  for (const seg of segments) {
    if (seg.waypoints.length === 0) continue
    const first = seg.waypoints[0]
    const last = seg.waypoints[seg.waypoints.length - 1]

    for (const endpoint of [first, last]) {
      const dist = Math.hypot(endpoint.x - point.x, endpoint.z - point.z)
      if (dist < closestDist) {
        closestDist = dist
        closest = endpoint
      }
    }
  }

  return closest || point
}

/** Compute an offset polyline (for sidewalks) */
export function offsetPolyline(points: RoadWaypoint[], offset: number): RoadWaypoint[] {
  if (points.length < 2) return points

  const result: RoadWaypoint[] = []

  for (let i = 0; i < points.length; i++) {
    let nx = 0, nz = 0

    if (i === 0) {
      const dx = points[1].x - points[0].x
      const dz = points[1].z - points[0].z
      const len = Math.hypot(dx, dz) || 1
      nx = -dz / len
      nz = dx / len
    } else if (i === points.length - 1) {
      const dx = points[i].x - points[i - 1].x
      const dz = points[i].z - points[i - 1].z
      const len = Math.hypot(dx, dz) || 1
      nx = -dz / len
      nz = dx / len
    } else {
      // Average of normals from adjacent segments
      const dx1 = points[i].x - points[i - 1].x
      const dz1 = points[i].z - points[i - 1].z
      const len1 = Math.hypot(dx1, dz1) || 1
      const nx1 = -dz1 / len1
      const nz1 = dx1 / len1

      const dx2 = points[i + 1].x - points[i].x
      const dz2 = points[i + 1].z - points[i].z
      const len2 = Math.hypot(dx2, dz2) || 1
      const nx2 = -dz2 / len2
      const nz2 = dx2 / len2

      nx = (nx1 + nx2) * 0.5
      nz = (nz1 + nz2) * 0.5
      const nLen = Math.hypot(nx, nz) || 1
      nx /= nLen
      nz /= nLen
    }

    result.push({
      x: points[i].x + nx * offset,
      z: points[i].z + nz * offset,
    })
  }

  return result
}

/** Compute road ribbon geometry */
export function computeRoadRibbon(
  waypoints: RoadWaypoint[],
  width: number,
  terrain: TerrainData
): { positions: number[]; uvs: number[]; indices: number[] } {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  if (waypoints.length < 2) return { positions, uvs, indices }

  const halfW = width / 2
  let totalLen = 0

  for (let i = 0; i < waypoints.length; i++) {
    const p = waypoints[i]

    // Compute normal (perpendicular to direction)
    let nx = 0, nz = 0
    if (i === 0) {
      const dx = waypoints[1].x - p.x
      const dz = waypoints[1].z - p.z
      const len = Math.hypot(dx, dz) || 1
      nx = -dz / len
      nz = dx / len
    } else if (i === waypoints.length - 1) {
      const dx = p.x - waypoints[i - 1].x
      const dz = p.z - waypoints[i - 1].z
      const len = Math.hypot(dx, dz) || 1
      nx = -dz / len
      nz = dx / len
    } else {
      const dx1 = p.x - waypoints[i - 1].x
      const dz1 = p.z - waypoints[i - 1].z
      const len1 = Math.hypot(dx1, dz1) || 1
      const dx2 = waypoints[i + 1].x - p.x
      const dz2 = waypoints[i + 1].z - p.z
      const len2 = Math.hypot(dx2, dz2) || 1
      nx = ((-dz1 / len1) + (-dz2 / len2)) * 0.5
      nz = ((dx1 / len1) + (dx2 / len2)) * 0.5
      const nLen = Math.hypot(nx, nz) || 1
      nx /= nLen
      nz /= nLen
    }

    if (i > 0) {
      totalLen += Math.hypot(
        waypoints[i].x - waypoints[i - 1].x,
        waypoints[i].z - waypoints[i - 1].z
      )
    }

    const lx = p.x + nx * halfW
    const lz = p.z + nz * halfW
    const rx = p.x - nx * halfW
    const rz = p.z - nz * halfW

    const ly = getTerrainHeight(lx, lz, terrain) + 0.15
    const ry = getTerrainHeight(rx, rz, terrain) + 0.15

    const u = totalLen / width

    // Left vertex
    positions.push(lx, ly, lz)
    uvs.push(0, u)
    // Right vertex
    positions.push(rx, ry, rz)
    uvs.push(1, u)

    // Triangles
    if (i > 0) {
      const base = (i - 1) * 2
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
    }
  }

  return { positions, uvs, indices }
}

/** Auto-paint asphalt material under a road segment */
export function autoMaterialPaint(waypoints: RoadWaypoint[], width: number, terrain: TerrainData): void {
  if (waypoints.length < 2) return

  const halfW = width / 2 + 1 // slight bleed

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i]
    const p2 = waypoints[i + 1]

    const dx = p2.x - p1.x
    const dz = p2.z - p1.z
    const segLen = Math.hypot(dx, dz)
    if (segLen < 0.01) continue

    const steps = Math.ceil(segLen / (terrain.cellSize * 0.5))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = p1.x + dx * t
      const cz = p1.z + dz * t

      // Perpendicular
      const nx = -dz / segLen
      const nz = dx / segLen

      for (let w = -halfW; w <= halfW; w += terrain.cellSize) {
        const wx = cx + nx * w
        const wz = cz + nz * w
        const gx = Math.floor(wx / terrain.cellSize)
        const gz = Math.floor(wz / terrain.cellSize)
        if (gx >= 0 && gx < terrain.size && gz >= 0 && gz < terrain.sizeZ) {
          terrain.materials[gz * terrain.size + gx] = TerrainMaterialId.Asphalt
        }
      }
    }
  }
}

function getTerrainHeight(wx: number, wz: number, terrain: TerrainData): number {
  const gx = Math.floor(wx / terrain.cellSize)
  const gz = Math.floor(wz / terrain.cellSize)
  if (gx < 0 || gx >= terrain.size || gz < 0 || gz >= terrain.sizeZ) return 0
  return terrain.heights[gz * terrain.size + gx] * terrain.maxHeight
}
