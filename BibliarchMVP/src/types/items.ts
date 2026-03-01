// ============================================================
// CUSTOM ITEMS TYPE SYSTEM
// ============================================================

// ── Mesh Data (vertex-level modeling) ────────────────────────

/** A vertex in 3D space */
export interface ItemVertex {
  position: [number, number, number]
}

/** A face connecting 3-4 vertices */
export interface ItemFace {
  vertexIndices: number[]   // 3 (triangle) or 4 (quad) indices into vertices array
  color: string             // hex color per face
}

// ── Hitboxes ─────────────────────────────────────────────────

export interface ItemHitbox {
  id: string
  shape: 'box' | 'sphere' | 'cylinder' | 'none'
  position: [number, number, number]  // relative to item origin
  size: [number, number, number]      // width, height, depth (or radius for sphere)
  collisionMode: 'blocking' | 'walkable' | 'none'
}

// ── Action Triggers ──────────────────────────────────────────

export type ActionTriggerType =
  | 'sit' | 'use' | 'pickup' | 'open'
  | 'enter' | 'sleep' | 'eat' | 'custom'

export interface ActionTrigger {
  id: string
  type: ActionTriggerType
  customLabel?: string
  approachPosition: [number, number, number]  // where character stands relative to item
  approachRotation: number                     // Y-rotation character faces
  animationOverride?: string                   // optional Mixamo animation ID
}

// ── Custom Item ──────────────────────────────────────────────

export type ItemCategory =
  | 'furniture' | 'decoration' | 'structure'
  | 'vehicle' | 'food' | 'tool' | 'custom'

export interface CustomItem {
  id: string
  storyId: string
  name: string
  description: string            // for AI understanding
  category: ItemCategory

  // Vertex-level mesh data
  vertices: ItemVertex[]
  faces: ItemFace[]

  // Collision & interaction
  hitboxes: ItemHitbox[]
  triggers: ActionTrigger[]

  defaultScale: [number, number, number]
  thumbnail?: string
  createdAt: Date
  updatedAt: Date
}

// ── Serialization ────────────────────────────────────────────

export interface SerializedCustomItem {
  id: string
  storyId: string
  name: string
  description: string
  category: ItemCategory
  vertices: ItemVertex[]
  faces: ItemFace[]
  hitboxes: ItemHitbox[]
  triggers: ActionTrigger[]
  defaultScale: [number, number, number]
  thumbnail?: string
  createdAt: string
  updatedAt: string
}

export function serializeCustomItem(item: CustomItem): SerializedCustomItem {
  return {
    ...item,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : new Date().toISOString(),
  }
}

export function deserializeCustomItem(data: SerializedCustomItem): CustomItem {
  return {
    ...data,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  }
}

// ── Factory ──────────────────────────────────────────────────

export function createCustomItem(storyId: string, name: string): CustomItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    storyId,
    name,
    description: '',
    category: 'decoration',
    vertices: [],
    faces: [],
    hitboxes: [],
    triggers: [],
    defaultScale: [1, 1, 1],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
