'use client'

import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Cache for loaded models
const modelCache = new Map<string, THREE.Object3D>()
const textureCache = new Map<string, THREE.Texture>()

// Loaders (shared instances)
let fbxLoader: FBXLoader | null = null
let gltfLoader: GLTFLoader | null = null
let textureLoader: THREE.TextureLoader | null = null

function getFBXLoader(): FBXLoader {
  if (!fbxLoader) {
    fbxLoader = new FBXLoader()
  }
  return fbxLoader
}

function getGLTFLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }
  return gltfLoader
}

function getTextureLoader(): THREE.TextureLoader {
  if (!textureLoader) {
    textureLoader = new THREE.TextureLoader()
  }
  return textureLoader
}

export interface LoadedModel {
  scene: THREE.Object3D
  animations?: THREE.AnimationClip[]
}

/**
 * Load an FBX model
 */
export async function loadFBXModel(url: string, useCache = true): Promise<LoadedModel> {
  if (useCache && modelCache.has(url)) {
    const cached = modelCache.get(url)!
    return { scene: cached.clone(), animations: [] }
  }

  return new Promise((resolve, reject) => {
    getFBXLoader().load(
      url,
      (object) => {
        if (useCache) {
          modelCache.set(url, object.clone())
        }
        resolve({
          scene: object,
          animations: object.animations || []
        })
      },
      undefined,
      (error) => {
        console.error('Error loading FBX:', error)
        reject(error)
      }
    )
  })
}

/**
 * Load a GLTF/GLB model
 */
export async function loadGLTFModel(url: string, useCache = true): Promise<LoadedModel> {
  if (useCache && modelCache.has(url)) {
    const cached = modelCache.get(url)!
    return { scene: cached.clone(), animations: [] }
  }

  return new Promise((resolve, reject) => {
    getGLTFLoader().load(
      url,
      (gltf) => {
        if (useCache) {
          modelCache.set(url, gltf.scene.clone())
        }
        resolve({
          scene: gltf.scene,
          animations: gltf.animations || []
        })
      },
      undefined,
      (error) => {
        console.error('Error loading GLTF:', error)
        reject(error)
      }
    )
  })
}

/**
 * Load a texture
 */
export async function loadTexture(url: string, useCache = true): Promise<THREE.Texture> {
  if (useCache && textureCache.has(url)) {
    return textureCache.get(url)!
  }

  return new Promise((resolve, reject) => {
    getTextureLoader().load(
      url,
      (texture) => {
        if (useCache) {
          textureCache.set(url, texture)
        }
        resolve(texture)
      },
      undefined,
      (error) => {
        console.error('Error loading texture:', error)
        reject(error)
      }
    )
  })
}

/**
 * Load a model based on file extension
 */
export async function loadModel(url: string, useCache = true): Promise<LoadedModel> {
  const extension = url.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'fbx':
      return loadFBXModel(url, useCache)
    case 'glb':
    case 'gltf':
      return loadGLTFModel(url, useCache)
    default:
      throw new Error(`Unsupported model format: ${extension}`)
  }
}

/**
 * Preload multiple models
 */
export async function preloadModels(urls: string[]): Promise<Map<string, LoadedModel>> {
  const results = new Map<string, LoadedModel>()

  await Promise.all(
    urls.map(async (url) => {
      try {
        const model = await loadModel(url)
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
  modelCache.forEach((model) => {
    model.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material?.dispose()
        }
      }
    })
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
  createHouse: (color: string): THREE.Mesh => {
    const group = new THREE.Group()

    // Base
    const baseGeometry = new THREE.BoxGeometry(4, 3, 4)
    const baseMaterial = new THREE.MeshStandardMaterial({ color })
    const base = new THREE.Mesh(baseGeometry, baseMaterial)
    base.position.y = 1.5
    base.castShadow = true
    base.receiveShadow = true
    group.add(base)

    // Roof
    const roofGeometry = new THREE.ConeGeometry(3.5, 2, 4)
    const roofMaterial = new THREE.MeshStandardMaterial({ color: '#8B4513' })
    const roof = new THREE.Mesh(roofGeometry, roofMaterial)
    roof.position.y = 4
    roof.rotation.y = Math.PI / 4
    roof.castShadow = true
    group.add(roof)

    // Return as single mesh (simplified)
    const mesh = new THREE.Mesh(baseGeometry, baseMaterial)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  },

  createShop: (color: string): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(5, 3, 4)
    const material = new THREE.MeshStandardMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = 1.5
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  },

  createTower: (color: string): THREE.Mesh => {
    const geometry = new THREE.CylinderGeometry(1.5, 2, 8, 8)
    const material = new THREE.MeshStandardMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = 4
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  },

  createBarn: (color: string): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(6, 4, 8)
    const material = new THREE.MeshStandardMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  },

  // Decorations
  createTree: (color: string): THREE.Group => {
    const group = new THREE.Group()

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#8B4513' })
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
    trunk.position.y = 0.75
    trunk.castShadow = true
    group.add(trunk)

    // Foliage
    const foliageGeometry = new THREE.ConeGeometry(1.2, 2.5, 8)
    const foliageMaterial = new THREE.MeshStandardMaterial({ color })
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial)
    foliage.position.y = 2.5
    foliage.castShadow = true
    group.add(foliage)

    return group
  },

  createRock: (color: string): THREE.Mesh => {
    const geometry = new THREE.DodecahedronGeometry(0.8, 0)
    const material = new THREE.MeshStandardMaterial({ color, flatShading: true })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = 0.4
    mesh.scale.set(1, 0.6, 1)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  },

  createBush: (color: string): THREE.Mesh => {
    const geometry = new THREE.SphereGeometry(0.6, 8, 6)
    const material = new THREE.MeshStandardMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = 0.5
    mesh.scale.set(1.2, 0.8, 1.2)
    mesh.castShadow = true
    return mesh
  },

  createLamp: (color: string): THREE.Group => {
    const group = new THREE.Group()

    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 3, 8)
    const poleMaterial = new THREE.MeshStandardMaterial({ color: '#333333' })
    const pole = new THREE.Mesh(poleGeometry, poleMaterial)
    pole.position.y = 1.5
    pole.castShadow = true
    group.add(pole)

    // Light
    const lightGeometry = new THREE.SphereGeometry(0.25, 16, 16)
    const lightMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5
    })
    const light = new THREE.Mesh(lightGeometry, lightMaterial)
    light.position.y = 3.2
    group.add(light)

    return group
  },

  // Character placeholder (capsule shape)
  createCharacterCapsule: (color: string, height = 1.8): THREE.Group => {
    const group = new THREE.Group()

    // Body (cylinder)
    const bodyHeight = height * 0.5
    const radius = height * 0.15
    const bodyGeometry = new THREE.CylinderGeometry(radius, radius, bodyHeight, 16)
    const material = new THREE.MeshStandardMaterial({ color })
    const body = new THREE.Mesh(bodyGeometry, material)
    body.position.y = height * 0.35
    body.castShadow = true
    group.add(body)

    // Head (sphere)
    const headRadius = radius * 1.2
    const headGeometry = new THREE.SphereGeometry(headRadius, 16, 16)
    const head = new THREE.Mesh(headGeometry, material)
    head.position.y = height * 0.75
    head.castShadow = true
    group.add(head)

    // Direction indicator (small cone for facing)
    const noseGeometry = new THREE.ConeGeometry(radius * 0.3, radius * 0.5, 8)
    const noseMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff' })
    const nose = new THREE.Mesh(noseGeometry, noseMaterial)
    nose.position.set(0, height * 0.75, headRadius)
    nose.rotation.x = Math.PI / 2
    group.add(nose)

    return group
  }
}
