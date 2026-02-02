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
  const mat = new THREE.MeshStandardMaterial({ color: hexToColor(color), roughness: 0.8 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.5
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}

function createPrimitivePlane(color: string): THREE.Group {
  const group = new THREE.Group()
  const geo = new THREE.PlaneGeometry(2, 2)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshStandardMaterial({ color: hexToColor(color), roughness: 0.9, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.02
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}

function createPresetHouse(color: string): THREE.Group {
  const group = new THREE.Group()
  const c = hexToColor(color)

  // Box body
  const bodyGeo = new THREE.BoxGeometry(2, 1.5, 2)
  const bodyMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 0.75
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Pyramid roof
  const roofGeo = new THREE.ConeGeometry(1.6, 1, 4)
  const roofMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x8B4513), roughness: 0.9 })
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.y = 2
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  group.add(roof)

  return group
}

function createPresetShop(color: string): THREE.Group {
  const group = new THREE.Group()
  const c = hexToColor(color)

  // Wide box body
  const bodyGeo = new THREE.BoxGeometry(3, 1.2, 2)
  const bodyMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 0.6
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Overhang (flat roof extension)
  const overhangGeo = new THREE.BoxGeometry(3.5, 0.1, 2.8)
  const overhangMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x654321), roughness: 0.9 })
  const overhang = new THREE.Mesh(overhangGeo, overhangMat)
  overhang.position.y = 1.25
  overhang.castShadow = true
  group.add(overhang)

  return group
}

function createTree(color: string): THREE.Group {
  const group = new THREE.Group()

  // Cylinder trunk
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.15, 1, 8)
  const trunkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x8B5A2B), roughness: 0.9 })
  const trunk = new THREE.Mesh(trunkGeo, trunkMat)
  trunk.position.y = 0.5
  trunk.castShadow = true
  group.add(trunk)

  // Cone foliage
  const foliageGeo = new THREE.ConeGeometry(0.7, 1.5, 8)
  const foliageMat = new THREE.MeshStandardMaterial({ color: hexToColor(color), roughness: 0.9 })
  const foliage = new THREE.Mesh(foliageGeo, foliageMat)
  foliage.position.y = 1.6
  foliage.castShadow = true
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

  const mat = new THREE.MeshStandardMaterial({ color: hexToColor(color), roughness: 0.95 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.3
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  return group
}

function createBush(color: string): THREE.Group {
  const group = new THREE.Group()

  // Squashed sphere
  const geo = new THREE.SphereGeometry(0.5, 8, 6)
  const mat = new THREE.MeshStandardMaterial({ color: hexToColor(color), roughness: 0.9 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.scale.set(1, 0.6, 1)
  mesh.position.y = 0.3
  mesh.castShadow = true
  group.add(mesh)

  return group
}

function createLamp(color: string): THREE.Group {
  const group = new THREE.Group()

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2, 6)
  const poleMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x333333), roughness: 0.5, metalness: 0.6 })
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.position.y = 1
  pole.castShadow = true
  group.add(pole)

  // Emissive sphere
  const bulbGeo = new THREE.SphereGeometry(0.15, 8, 8)
  const bulbMat = new THREE.MeshStandardMaterial({
    color: hexToColor(color),
    emissive: hexToColor(color),
    emissiveIntensity: 0.8,
    roughness: 0.2,
  })
  const bulb = new THREE.Mesh(bulbGeo, bulbMat)
  bulb.position.y = 2.1
  group.add(bulb)

  return group
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
    category: 'decoration',
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
    category: 'decoration',
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
  return OBJECT_CATALOG[type] ?? null
}

export function getCatalogByCategory(category: WorldObjectCategory): ObjectCatalogEntry[] {
  return Object.values(OBJECT_CATALOG).filter((e) => e.category === category)
}
