import {
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
  VertexData,
  Scene,
} from '@babylonjs/core'
import { WorldObjectCategory } from '@/types/world'

export interface ObjectCatalogEntry {
  type: string
  name: string
  category: WorldObjectCategory
  defaultColor: string
  defaultScale: [number, number, number]
  createMesh: (color: string, scene: Scene) => TransformNode
}

function hexToColor3(hex: string): Color3 {
  return Color3.FromHexString(hex.startsWith('#') ? hex : `#${hex}`)
}

function createLambertMaterial(name: string, color: Color3, scene: Scene): StandardMaterial {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = color
  mat.specularColor = Color3.Black()
  return mat
}

// ── Mesh Factories ──────────────────────────────────────────

function createPrimitiveCube(color: string, scene: Scene): TransformNode {
  const parent = new TransformNode('cube-group', scene)
  const mesh = MeshBuilder.CreateBox('cube', { size: 1 }, scene)
  mesh.position.y = 0.5
  mesh.material = createLambertMaterial('cube-mat', hexToColor3(color), scene)
  mesh.parent = parent
  return parent
}

function createPrimitivePlane(color: string, scene: Scene): TransformNode {
  const parent = new TransformNode('plane-group', scene)
  const mesh = MeshBuilder.CreateGround('plane', { width: 2, height: 2 }, scene)
  mesh.position.y = 0.02
  const mat = createLambertMaterial('plane-mat', hexToColor3(color), scene)
  mat.backFaceCulling = false
  mesh.material = mat
  mesh.parent = parent
  return parent
}

function createPresetHouse(color: string, scene: Scene): TransformNode {
  const parent = new TransformNode('house-group', scene)
  const c = hexToColor3(color)

  const body = MeshBuilder.CreateBox('house-body', { width: 2, height: 1.5, depth: 2 }, scene)
  body.position.y = 0.75
  body.material = createLambertMaterial('house-body-mat', c, scene)
  body.parent = parent

  const roof = MeshBuilder.CreateCylinder('house-roof', { height: 1, diameterTop: 0, diameterBottom: 3.2, tessellation: 4 }, scene)
  roof.position.y = 2
  roof.rotation.y = Math.PI / 4
  roof.material = createLambertMaterial('house-roof-mat', new Color3(0.545, 0.271, 0.075), scene)
  roof.parent = parent

  return parent
}

function createPresetShop(color: string, scene: Scene): TransformNode {
  const parent = new TransformNode('shop-group', scene)
  const c = hexToColor3(color)

  const body = MeshBuilder.CreateBox('shop-body', { width: 3, height: 1.2, depth: 2 }, scene)
  body.position.y = 0.6
  body.material = createLambertMaterial('shop-body-mat', c, scene)
  body.parent = parent

  const overhang = MeshBuilder.CreateBox('shop-overhang', { width: 3.5, height: 0.1, depth: 2.8 }, scene)
  overhang.position.y = 1.25
  overhang.material = createLambertMaterial('shop-overhang-mat', new Color3(0.396, 0.263, 0.129), scene)
  overhang.parent = parent

  return parent
}

function createTree(color: string, scene: Scene): TransformNode {
  const parent = new TransformNode('tree-group', scene)

  const trunk = MeshBuilder.CreateCylinder('tree-trunk', { height: 1, diameterTop: 0.24, diameterBottom: 0.3, tessellation: 8 }, scene)
  trunk.position.y = 0.5
  trunk.material = createLambertMaterial('tree-trunk-mat', new Color3(0.545, 0.353, 0.169), scene)
  trunk.parent = parent

  const foliage = MeshBuilder.CreateCylinder('tree-foliage', { height: 1.5, diameterTop: 0, diameterBottom: 1.4, tessellation: 8 }, scene)
  foliage.position.y = 1.6
  foliage.material = createLambertMaterial('tree-foliage-mat', hexToColor3(color), scene)
  foliage.parent = parent

  return parent
}

function createRock(color: string, scene: Scene): TransformNode {
  const parent = new TransformNode('rock-group', scene)

  const mesh = MeshBuilder.CreateIcoSphere('rock', { radius: 0.5, subdivisions: 1 }, scene)
  // Randomize vertices for irregular rock shape
  const positions = mesh.getVerticesData('position')
  if (positions) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2]
      const offset = 0.85 + Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 45.164)) * 0.3
      positions[i] = x * offset
      positions[i + 1] = y * offset * 0.7
      positions[i + 2] = z * offset
    }
    mesh.updateVerticesData('position', positions)
    mesh.createNormals(false)
  }
  mesh.position.y = 0.3
  mesh.material = createLambertMaterial('rock-mat', hexToColor3(color), scene)
  mesh.parent = parent

  return parent
}

function createBush(color: string, scene: Scene): TransformNode {
  const parent = new TransformNode('bush-group', scene)

  const mesh = MeshBuilder.CreateSphere('bush', { diameter: 1, segments: 8 }, scene)
  mesh.scaling.set(1, 0.6, 1)
  mesh.position.y = 0.3
  mesh.material = createLambertMaterial('bush-mat', hexToColor3(color), scene)
  mesh.parent = parent

  return parent
}

function createLamp(color: string, scene: Scene): TransformNode {
  const parent = new TransformNode('lamp-group', scene)

  const pole = MeshBuilder.CreateCylinder('lamp-pole', { height: 2, diameter: 0.08, tessellation: 6 }, scene)
  pole.position.y = 1
  pole.material = createLambertMaterial('lamp-pole-mat', new Color3(0.2, 0.2, 0.2), scene)
  pole.parent = parent

  const bulb = MeshBuilder.CreateSphere('lamp-bulb', { diameter: 0.3, segments: 8 }, scene)
  bulb.position.y = 2.1
  const bulbMat = createLambertMaterial('lamp-bulb-mat', hexToColor3(color), scene)
  bulbMat.emissiveColor = hexToColor3(color)
  bulb.material = bulbMat
  bulb.parent = parent

  return parent
}

// ── Custom Item Runtime Registry ────────────────────────────

const customRegistry = new Map<string, ObjectCatalogEntry>()

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
    createMesh: (color: string, scene: Scene) => {
      const parent = new TransformNode('custom-group', scene)

      const positions: number[] = []
      const colors: number[] = []
      const indices: number[] = []
      let vertIdx = 0

      for (const face of item.faces) {
        const faceColor = hexToColor3(face.color || color)
        const baseIdx = vertIdx

        for (const vi of face.vertexIndices) {
          const pos = item.vertices[vi]?.position ?? [0, 0, 0]
          positions.push(pos[0], pos[1], pos[2])
          colors.push(faceColor.r, faceColor.g, faceColor.b, 1)
          vertIdx++
        }

        for (let i = 1; i < face.vertexIndices.length - 1; i++) {
          indices.push(baseIdx, baseIdx + i, baseIdx + i + 1)
        }
      }

      if (positions.length > 0) {
        const mesh = new Mesh('custom-mesh', scene)
        const vertexData = new VertexData()
        vertexData.positions = positions
        vertexData.colors = colors
        vertexData.indices = indices
        VertexData.ComputeNormals(positions, indices, vertexData.normals = [])
        vertexData.applyToMesh(mesh)

        const mat = new StandardMaterial('custom-mat', scene)
        mat.specularColor = Color3.Black()
        // Use vertex colors - Babylon.js does this automatically when color attribute is present
        mesh.material = mat
        mesh.parent = parent
      }

      return parent
    },
  })
}

export function unregisterCustomItem(itemId: string): void {
  customRegistry.delete(`custom:${itemId}`)
}

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
  if (customRegistry.has(type)) return customRegistry.get(type)!
  return OBJECT_CATALOG[type] ?? null
}

export function getCatalogByCategory(category: WorldObjectCategory): ObjectCatalogEntry[] {
  const builtIn = Object.values(OBJECT_CATALOG).filter((e) => e.category === category)
  const custom = Array.from(customRegistry.values()).filter((e) => e.category === category)
  return [...builtIn, ...custom]
}
