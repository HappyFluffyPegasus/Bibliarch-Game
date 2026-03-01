import * as THREE from 'three'
import { WorldObjectCategory } from '@/types/world'

export interface ObjectCatalogEntry {
  type: string
  name: string
  category: WorldObjectCategory
  defaultColor: string // hex
  defaultScale: [number, number, number]
  createMesh: (color: string) => THREE.Group
}

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex)
}

// ── Mesh Factories ──────────────────────────────────────────

function createPrimitiveCube(color: string): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshLambertMaterial({ color: hexToColor(color) })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.5
  group.add(mesh)
  return group
}

function createPrimitivePlane(color: string): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.PlaneGeometry(2, 2)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshLambertMaterial({ color: hexToColor(color), side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.02
  group.add(mesh)
  return group
}

function createPresetHouse(color: string): THREE.Group {
  const group = new THREE.Group()
  const c = hexToColor(color)

  // Box body
  const bodyGeo = new THREE.BoxGeometry(2, 1.5, 2)
  const bodyMat = new THREE.MeshLambertMaterial({ color: c })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 0.75
  group.add(body)

  // Pyramid roof
  const roofGeo = new THREE.ConeGeometry(1.6, 1, 4)
  const roofMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x8B4513) })
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.y = 2
  roof.rotation.y = Math.PI / 4
  group.add(roof)

  return group
}

function createPresetShop(color: string): THREE.Group {
  const group = new THREE.Group()
  const c = hexToColor(color)

  // Wide box body
  const bodyGeo = new THREE.BoxGeometry(3, 1.2, 2)
  const bodyMat = new THREE.MeshLambertMaterial({ color: c })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 0.6
  group.add(body)

  // Overhang (flat roof extension)
  const overhangGeo = new THREE.BoxGeometry(3.5, 0.1, 2.8)
  const overhangMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x654321) })
  const overhang = new THREE.Mesh(overhangGeo, overhangMat)
  overhang.position.y = 1.25
  group.add(overhang)

  return group
}

function createTree(color: string): THREE.Group {
  const group = new THREE.Group()

  // Cylinder trunk
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.15, 1, 8)
  const trunkMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x8B5A2B) })
  const trunk = new THREE.Mesh(trunkGeo, trunkMat)
  trunk.position.y = 0.5
  group.add(trunk)

  // Cone foliage
  const foliageGeo = new THREE.ConeGeometry(0.7, 1.5, 8)
  const foliageMat = new THREE.MeshLambertMaterial({ color: hexToColor(color) })
  const foliage = new THREE.Mesh(foliageGeo, foliageMat)
  foliage.position.y = 1.6
  group.add(foliage)

  return group
}

function createRock(color: string): THREE.Group {
  const group = new THREE.Group()

  // Irregular sphere (icosahedron for rock-like shape)
  const geo = new THREE.IcosahedronGeometry(0.5, 1)
  // Slightly randomize vertices for irregularity
  const posAttr = geo.getAttribute('position')
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i)
    const y = posAttr.getY(i)
    const z = posAttr.getZ(i)
    const offset = 0.85 + Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 45.164)) * 0.3
    posAttr.setXYZ(i, x * offset, y * offset * 0.7, z * offset)
  }
  geo.computeVertexNormals()

  const mat = new THREE.MeshLambertMaterial({ color: hexToColor(color) })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.3
  group.add(mesh)

  return group
}

function createBush(color: string): THREE.Group {
  const group = new THREE.Group()

  // Squashed sphere
  const geo = new THREE.SphereGeometry(0.5, 8, 6)
  const mat = new THREE.MeshLambertMaterial({ color: hexToColor(color) })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.scale.set(1, 0.6, 1)
  mesh.position.y = 0.3
  group.add(mesh)

  return group
}

function createLamp(color: string): THREE.Group {
  const group = new THREE.Group()

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2, 6)
  const poleMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x333333) })
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.position.y = 1
  group.add(pole)

  // Emissive sphere
  const bulbGeo = new THREE.SphereGeometry(0.15, 8, 8)
  const bulbMat = new THREE.MeshLambertMaterial({
    color: hexToColor(color),
    emissive: hexToColor(color),
    emissiveIntensity: 0.8,
  })
  const bulb = new THREE.Mesh(bulbGeo, bulbMat)
  bulb.position.y = 2.1
  group.add(bulb)

  return group
}

// ── Custom Item Runtime Registry ────────────────────────────

const customRegistry = new Map<string, ObjectCatalogEntry>()

/** Register a custom item so it appears in the catalog */
export function registerCustomItem(item: {
  id: string
  name: string
  category: string
  defaultScale: [number, number, number]
  vertices: { position: [number, number, number] }[]
  faces: { vertexIndices: number[]; color: string }[]
}): void {
  const key = `custom:${item.id}`
  customRegistry.set(key, {
    type: key,
    name: item.name,
    category: (item.category === 'furniture' || item.category === 'structure')
      ? 'building'
      : (item.category === 'vehicle' ? 'prop' : 'decoration') as WorldObjectCategory,
    defaultColor: item.faces[0]?.color ?? '#888888',
    defaultScale: item.defaultScale,
    createMesh: (color: string) => {
      const group = new THREE.Group()

      // Build mesh from vertex/face data
      const positions: number[] = []
      const colors: number[] = []
      const indices: number[] = []

      let vertIdx = 0
      const c = hexToColor(color)

      for (const face of item.faces) {
        const faceColor = hexToColor(face.color || color)
        const baseIdx = vertIdx

        for (const vi of face.vertexIndices) {
          const pos = item.vertices[vi]?.position ?? [0, 0, 0]
          positions.push(pos[0], pos[1], pos[2])
          colors.push(faceColor.r, faceColor.g, faceColor.b)
          vertIdx++
        }

        // Fan triangulation
        for (let i = 1; i < face.vertexIndices.length - 1; i++) {
          indices.push(baseIdx, baseIdx + i, baseIdx + i + 1)
        }
      }

      if (positions.length > 0) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
        geo.setIndex(indices)
        geo.computeVertexNormals()

        const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
        const mesh = new THREE.Mesh(geo, mat)
        group.add(mesh)
      }

      return group
    },
  })
}

/** Unregister a custom item */
export function unregisterCustomItem(itemId: string): void {
  customRegistry.delete(`custom:${itemId}`)
}

/** Get all registered custom items */
export function getCustomCatalogEntries(): ObjectCatalogEntry[] {
  return Array.from(customRegistry.values())
}

// ── Catalog ─────────────────────────────────────────────────

export const OBJECT_CATALOG: Record<string, ObjectCatalogEntry> = {
  'primitive-cube': {
    type: 'primitive-cube',
    name: 'Cube',
    category: 'building',
    defaultColor: '#888888',
    defaultScale: [1, 1, 1],
    createMesh: createPrimitiveCube,
  },
  'primitive-plane': {
    type: 'primitive-plane',
    name: 'Plane',
    category: 'building',
    defaultColor: '#aaaaaa',
    defaultScale: [1, 1, 1],
    createMesh: createPrimitivePlane,
  },
  'preset-house': {
    type: 'preset-house',
    name: 'House',
    category: 'building',
    defaultColor: '#d4a574',
    defaultScale: [1, 1, 1],
    createMesh: createPresetHouse,
  },
  'preset-shop': {
    type: 'preset-shop',
    name: 'Shop',
    category: 'building',
    defaultColor: '#c4956a',
    defaultScale: [1, 1, 1],
    createMesh: createPresetShop,
  },
  'tree': {
    type: 'tree',
    name: 'Tree',
    category: 'vegetation',
    defaultColor: '#2d7a2d',
    defaultScale: [1, 1, 1],
    createMesh: createTree,
  },
  'rock': {
    type: 'rock',
    name: 'Rock',
    category: 'decoration',
    defaultColor: '#777777',
    defaultScale: [1, 1, 1],
    createMesh: createRock,
  },
  'bush': {
    type: 'bush',
    name: 'Bush',
    category: 'vegetation',
    defaultColor: '#3a8a3a',
    defaultScale: [1, 1, 1],
    createMesh: createBush,
  },
  'lamp': {
    type: 'lamp',
    name: 'Lamp',
    category: 'decoration',
    defaultColor: '#ffdd88',
    defaultScale: [1, 1, 1],
    createMesh: createLamp,
  },
}

export function getCatalogEntry(type: string): ObjectCatalogEntry | null {
  // Check custom registry first (for "custom:xxx" keys)
  if (customRegistry.has(type)) return customRegistry.get(type)!
  return OBJECT_CATALOG[type] ?? null
}

export function getCatalogByCategory(category: WorldObjectCategory): ObjectCatalogEntry[] {
  const builtIn = Object.values(OBJECT_CATALOG).filter((e) => e.category === category)
  const custom = Array.from(customRegistry.values()).filter((e) => e.category === category)
  return [...builtIn, ...custom]
}
