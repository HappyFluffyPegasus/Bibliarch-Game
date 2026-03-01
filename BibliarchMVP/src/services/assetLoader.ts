'use client'

import {
  TransformNode,
  Texture,
  Mesh,
  Scene,
  SceneLoader,
  StandardMaterial,
  MeshBuilder,
  Color3,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders'

// Cache for loaded models
const modelCache = new Map<string, TransformNode>()
const textureCache = new Map<string, Texture>()

export interface LoadedModel {
  root: TransformNode
  animationGroups?: any[]
}

/**
 * Load a GLTF/GLB model
 */
export async function loadGLTFModel(url: string, scene: Scene, useCache = true): Promise<LoadedModel> {
  if (useCache && modelCache.has(url)) {
    const cached = modelCache.get(url)!
    return { root: cached.clone(`${cached.name}-clone`, null)!, animationGroups: [] }
  }

  // Split url into directory and filename
  const lastSlash = url.lastIndexOf('/')
  const directory = url.substring(0, lastSlash + 1)
  const filename = url.substring(lastSlash + 1)

  const result = await SceneLoader.ImportMeshAsync('', directory, filename, scene)

  const root = new TransformNode('model-root', scene)
  for (const mesh of result.meshes) {
    if (!mesh.parent || mesh.parent.name === '__root__') {
      mesh.parent = root
    }
  }

  if (useCache) {
    modelCache.set(url, root)
  }

  return {
    root,
    animationGroups: result.animationGroups || [],
  }
}

/**
 * Load a texture
 */
export async function loadTexture(url: string, scene: Scene, useCache = true): Promise<Texture> {
  if (useCache && textureCache.has(url)) {
    return textureCache.get(url)!
  }

  return new Promise((resolve, reject) => {
    const texture = new Texture(url, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE,
      () => {
        if (useCache) {
          textureCache.set(url, texture)
        }
        resolve(texture)
      },
      (msg, err) => {
        console.error('Error loading texture:', msg)
        reject(err || new Error(msg || 'Texture load failed'))
      }
    )
  })
}

/**
 * Load a model based on file extension
 */
export async function loadModel(url: string, scene: Scene, useCache = true): Promise<LoadedModel> {
  const extension = url.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'glb':
    case 'gltf':
      return loadGLTFModel(url, scene, useCache)
    default:
      throw new Error(`Unsupported model format: ${extension}. Convert FBX to GLB.`)
  }
}

/**
 * Preload multiple models
 */
export async function preloadModels(urls: string[], scene: Scene): Promise<Map<string, LoadedModel>> {
  const results = new Map<string, LoadedModel>()

  await Promise.all(
    urls.map(async (url) => {
      try {
        const model = await loadModel(url, scene)
        results.set(url, model)
      } catch (error) {
        console.warn(`Failed to preload model: ${url}`, error)
      }
    })
  )

  return results
}

/**
 * Clear the model cache
 */
export function clearModelCache(): void {
  modelCache.forEach((root) => {
    root.getChildMeshes().forEach((mesh) => {
      mesh.dispose()
    })
    root.dispose()
  })
  modelCache.clear()
}

/**
 * Clear the texture cache
 */
export function clearTextureCache(): void {
  textureCache.forEach((texture) => {
    texture.dispose()
  })
  textureCache.clear()
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  clearModelCache()
  clearTextureCache()
}

// Built-in primitive geometries for world building
export const WorldPrimitives = {
  // Buildings
  createHouse: (color: string, scene: Scene): Mesh => {
    const mat = new StandardMaterial('house-mat', scene)
    mat.diffuseColor = Color3.FromHexString(color)
    mat.specularColor = Color3.Black()

    const base = MeshBuilder.CreateBox('house', { width: 4, height: 3, depth: 4 }, scene)
    base.position.y = 1.5
    base.material = mat
    return base
  },

  createShop: (color: string, scene: Scene): Mesh => {
    const mat = new StandardMaterial('shop-mat', scene)
    mat.diffuseColor = Color3.FromHexString(color)
    mat.specularColor = Color3.Black()

    const mesh = MeshBuilder.CreateBox('shop', { width: 5, height: 3, depth: 4 }, scene)
    mesh.position.y = 1.5
    mesh.material = mat
    return mesh
  },

  createTower: (color: string, scene: Scene): Mesh => {
    const mat = new StandardMaterial('tower-mat', scene)
    mat.diffuseColor = Color3.FromHexString(color)
    mat.specularColor = Color3.Black()

    const mesh = MeshBuilder.CreateCylinder('tower', {
      diameterTop: 3, diameterBottom: 4, height: 8, tessellation: 8
    }, scene)
    mesh.position.y = 4
    mesh.material = mat
    return mesh
  },

  createBarn: (color: string, scene: Scene): Mesh => {
    const mat = new StandardMaterial('barn-mat', scene)
    mat.diffuseColor = Color3.FromHexString(color)
    mat.specularColor = Color3.Black()

    const mesh = MeshBuilder.CreateBox('barn', { width: 6, height: 4, depth: 8 }, scene)
    mesh.position.y = 2
    mesh.material = mat
    return mesh
  },

  // Decorations
  createTree: (color: string, scene: Scene): TransformNode => {
    const group = new TransformNode('tree', scene)

    const trunkMat = new StandardMaterial('trunk-mat', scene)
    trunkMat.diffuseColor = Color3.FromHexString('#8B4513')
    trunkMat.specularColor = Color3.Black()

    const trunk = MeshBuilder.CreateCylinder('trunk', {
      diameterTop: 0.4, diameterBottom: 0.6, height: 1.5, tessellation: 8
    }, scene)
    trunk.position.y = 0.75
    trunk.material = trunkMat
    trunk.parent = group

    const foliageMat = new StandardMaterial('foliage-mat', scene)
    foliageMat.diffuseColor = Color3.FromHexString(color)
    foliageMat.specularColor = Color3.Black()

    const foliage = MeshBuilder.CreateCylinder('foliage', {
      diameterTop: 0, diameterBottom: 2.4, height: 2.5, tessellation: 8
    }, scene)
    foliage.position.y = 2.5
    foliage.material = foliageMat
    foliage.parent = group

    return group
  },

  createRock: (color: string, scene: Scene): Mesh => {
    const mat = new StandardMaterial('rock-mat', scene)
    mat.diffuseColor = Color3.FromHexString(color)
    mat.specularColor = Color3.Black()

    const mesh = MeshBuilder.CreateIcoSphere('rock', { radius: 0.8, subdivisions: 1, flat: true }, scene)
    mesh.position.y = 0.4
    mesh.scaling.set(1, 0.6, 1)
    mesh.material = mat
    return mesh
  },

  createBush: (color: string, scene: Scene): Mesh => {
    const mat = new StandardMaterial('bush-mat', scene)
    mat.diffuseColor = Color3.FromHexString(color)
    mat.specularColor = Color3.Black()

    const mesh = MeshBuilder.CreateSphere('bush', { diameter: 1.2, segments: 8 }, scene)
    mesh.position.y = 0.5
    mesh.scaling.set(1.2, 0.8, 1.2)
    mesh.material = mat
    return mesh
  },

  createLamp: (color: string, scene: Scene): TransformNode => {
    const group = new TransformNode('lamp', scene)

    const poleMat = new StandardMaterial('pole-mat', scene)
    poleMat.diffuseColor = Color3.FromHexString('#333333')
    poleMat.specularColor = Color3.Black()

    const pole = MeshBuilder.CreateCylinder('pole', {
      diameter: 0.16, height: 3, tessellation: 8
    }, scene)
    pole.position.y = 1.5
    pole.material = poleMat
    pole.parent = group

    const lightMat = new StandardMaterial('light-mat', scene)
    lightMat.diffuseColor = Color3.FromHexString(color)
    lightMat.emissiveColor = Color3.FromHexString(color)
    lightMat.specularColor = Color3.Black()

    const light = MeshBuilder.CreateSphere('light', { diameter: 0.5, segments: 16 }, scene)
    light.position.y = 3.2
    light.material = lightMat
    light.parent = group

    return group
  },

  // Character placeholder (capsule shape)
  createCharacterCapsule: (color: string, scene: Scene, height = 1.8): TransformNode => {
    const group = new TransformNode('character-capsule', scene)

    const mat = new StandardMaterial('capsule-mat', scene)
    mat.diffuseColor = Color3.FromHexString(color)
    mat.specularColor = Color3.Black()

    // Body (cylinder)
    const bodyHeight = height * 0.5
    const radius = height * 0.15
    const body = MeshBuilder.CreateCylinder('body', {
      diameter: radius * 2, height: bodyHeight, tessellation: 16
    }, scene)
    body.position.y = height * 0.35
    body.material = mat
    body.parent = group

    // Head (sphere)
    const headRadius = radius * 1.2
    const head = MeshBuilder.CreateSphere('head', { diameter: headRadius * 2, segments: 16 }, scene)
    head.position.y = height * 0.75
    head.material = mat
    head.parent = group

    // Direction indicator (small cone for facing)
    const noseMat = new StandardMaterial('nose-mat', scene)
    noseMat.diffuseColor = Color3.White()
    noseMat.specularColor = Color3.Black()

    const nose = MeshBuilder.CreateCylinder('nose', {
      diameterTop: 0, diameterBottom: radius * 0.6, height: radius * 0.5, tessellation: 8
    }, scene)
    nose.position.set(0, height * 0.75, headRadius)
    nose.rotation.x = Math.PI / 2
    nose.material = noseMat
    nose.parent = group

    return group
  }
}
