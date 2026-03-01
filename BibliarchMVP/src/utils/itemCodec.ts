/**
 * Item export/import codec.
 *
 * Encodes a CustomItem's mesh data (vertices, faces, colors, hitboxes,
 * triggers, metadata) into a compact base64 string for sharing.
 *
 * Format: "BLIB1:<base64-payload>"
 * Payload is JSON with compact representations:
 *   - vertices as flat [x,y,z, x,y,z, ...] number array
 *   - faces as [vertexCount, i0,i1,i2, colorPaletteIdx, ...] with color palette
 */

import {
  CustomItem,
  ItemVertex,
  ItemFace,
  ItemHitbox,
  ActionTrigger,
  ItemCategory,
  createCustomItem,
} from '@/types/items'

const VERSION_PREFIX = 'BLIB1:'

interface CompactPayload {
  n: string                // name
  d: string                // description
  c: ItemCategory          // category
  s: [number, number, number] // defaultScale
  v: number[]              // flat vertex positions [x,y,z, x,y,z, ...]
  f: number[]              // flat face data [vertexCount, i0,i1,..., colorIdx, ...]
  p: string[]              // color palette (unique hex colors)
  h: CompactHitbox[]       // hitboxes
  t: CompactTrigger[]      // triggers
}

interface CompactHitbox {
  s: 'box' | 'sphere' | 'cylinder' | 'none'
  p: [number, number, number]
  z: [number, number, number]  // size
  m: 'blocking' | 'walkable' | 'none'
}

interface CompactTrigger {
  y: string              // type
  l?: string             // customLabel
  p: [number, number, number]  // approachPosition
  r: number              // approachRotation
  a?: string             // animationOverride
}

export function encodeItem(item: CustomItem): string {
  // Build color palette
  const colorSet = new Set<string>()
  for (const face of item.faces) {
    colorSet.add(face.color)
  }
  const palette = Array.from(colorSet)
  const colorIndex = new Map<string, number>()
  palette.forEach((c, i) => colorIndex.set(c, i))

  // Flatten vertices
  const flatVerts: number[] = []
  for (const v of item.vertices) {
    flatVerts.push(
      Math.round(v.position[0] * 10000) / 10000,
      Math.round(v.position[1] * 10000) / 10000,
      Math.round(v.position[2] * 10000) / 10000
    )
  }

  // Flatten faces: [vertCount, idx0, idx1, ..., colorPaletteIdx, ...]
  const flatFaces: number[] = []
  for (const f of item.faces) {
    flatFaces.push(f.vertexIndices.length)
    for (const idx of f.vertexIndices) {
      flatFaces.push(idx)
    }
    flatFaces.push(colorIndex.get(f.color) ?? 0)
  }

  // Compact hitboxes
  const hitboxes: CompactHitbox[] = item.hitboxes.map((h) => ({
    s: h.shape,
    p: h.position,
    z: h.size,
    m: h.collisionMode,
  }))

  // Compact triggers
  const triggers: CompactTrigger[] = item.triggers.map((t) => ({
    y: t.type,
    ...(t.customLabel ? { l: t.customLabel } : {}),
    p: t.approachPosition,
    r: t.approachRotation,
    ...(t.animationOverride ? { a: t.animationOverride } : {}),
  }))

  const payload: CompactPayload = {
    n: item.name,
    d: item.description,
    c: item.category,
    s: item.defaultScale,
    v: flatVerts,
    f: flatFaces,
    p: palette,
    h: hitboxes,
    t: triggers,
  }

  const json = JSON.stringify(payload)
  const base64 = btoa(unescape(encodeURIComponent(json)))
  return VERSION_PREFIX + base64
}

export function decodeItem(code: string, storyId: string): CustomItem | null {
  try {
    if (!code.startsWith(VERSION_PREFIX)) return null
    const base64 = code.slice(VERSION_PREFIX.length)
    const json = decodeURIComponent(escape(atob(base64)))
    const payload: CompactPayload = JSON.parse(json)

    // Reconstruct vertices
    const vertices: ItemVertex[] = []
    for (let i = 0; i < payload.v.length; i += 3) {
      vertices.push({
        position: [payload.v[i], payload.v[i + 1], payload.v[i + 2]],
      })
    }

    // Reconstruct faces
    const faces: ItemFace[] = []
    let fi = 0
    while (fi < payload.f.length) {
      const vertCount = payload.f[fi++]
      const indices: number[] = []
      for (let j = 0; j < vertCount; j++) {
        indices.push(payload.f[fi++])
      }
      const colorIdx = payload.f[fi++]
      faces.push({
        vertexIndices: indices,
        color: payload.p[colorIdx] ?? '#888888',
      })
    }

    // Reconstruct hitboxes
    const hitboxes: ItemHitbox[] = payload.h.map((h) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      shape: h.s,
      position: h.p,
      size: h.z,
      collisionMode: h.m,
    }))

    // Reconstruct triggers
    const triggers: ActionTrigger[] = payload.t.map((t) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: t.y as ActionTrigger['type'],
      customLabel: t.l,
      approachPosition: t.p,
      approachRotation: t.r,
      animationOverride: t.a,
    }))

    const item = createCustomItem(storyId, payload.n)
    item.description = payload.d
    item.category = payload.c
    item.defaultScale = payload.s
    item.vertices = vertices
    item.faces = faces
    item.hitboxes = hitboxes
    item.triggers = triggers

    return item
  } catch {
    return null
  }
}
