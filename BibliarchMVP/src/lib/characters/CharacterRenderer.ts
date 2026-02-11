/**
 * CharacterRenderer - Reusable character model renderer for scenes.
 * Extracts model loading logic from Viewer3D.tsx to be used in SceneViewer3D.
 */

import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { createColoredShadowMaterial } from '@/lib/shaders/toonMaterial'
import { SpringBoneSystem } from '@/lib/SpringBoneSystem'
import { getUndertoneTexturePath } from '@/lib/hairTextures'
import type { CharacterData, CategoryColors } from '@/types/scenes'

const MODEL_PATH = '/models/Bibliarch Maybe.fbx'

// Keywords for identifying mesh types
const HAIR_KEYWORDS = ['hair', 'pigtail', 'ponytail', 'bob', 'bangs', 'bun', 'braids', 'luke', 'ahoge']
const SKIN_KEYWORDS = ['body', 'skin', 'head', 'face', 'hand', 'arm', 'leg', 'foot']
const EYE_KEYWORDS = ['eye', 'Eyes', 'Eyes_3']

// Shared FBX cache to avoid reloading for each character
const fbxCache: Map<string, THREE.Group> = new Map()
const loadingPromises: Map<string, Promise<THREE.Group>> = new Map()

/**
 * Load the FBX model with caching
 */
async function loadFBXModel(): Promise<THREE.Group> {
  // Check cache first
  if (fbxCache.has(MODEL_PATH)) {
    return fbxCache.get(MODEL_PATH)!.clone()
  }

  // Check if already loading
  if (loadingPromises.has(MODEL_PATH)) {
    const cached = await loadingPromises.get(MODEL_PATH)!
    return cached.clone()
  }

  // Load the model
  const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
    const loader = new FBXLoader()
    loader.load(
      MODEL_PATH,
      (fbx) => {
        fbxCache.set(MODEL_PATH, fbx)
        resolve(fbx.clone())
      },
      undefined,
      reject
    )
  })

  loadingPromises.set(MODEL_PATH, loadPromise)
  return loadPromise
}

export class CharacterRenderer {
  private group: THREE.Group  // This will BE the FBX model after loading
  private meshMap: Map<string, THREE.SkinnedMesh> = new Map()
  private springBones: SpringBoneSystem | null = null
  private hairTexture: THREE.Texture | null = null
  private textureLoader: THREE.TextureLoader
  private loaded: boolean = false
  private disposed: boolean = false
  private baseRotationY: number = -Math.PI / 2  // Store base rotation offset

  constructor() {
    // Create a temporary placeholder group until FBX loads
    this.group = new THREE.Group()
    this.group.name = 'CharacterRenderer'
    this.textureLoader = new THREE.TextureLoader()
  }

  /**
   * Load the character model
   */
  async load(): Promise<void> {
    if (this.loaded || this.disposed) return

    const fbx = await loadFBXModel()
    if (this.disposed) {
      fbx.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry?.dispose()
          const mats = Array.isArray(node.material) ? node.material : [node.material]
          mats.forEach(m => m?.dispose())
        }
      })
      return
    }

    fbx.scale.setScalar(0.01)
    fbx.rotation.y = this.baseRotationY
    fbx.name = 'CharacterRenderer'

    // Force matrix world update and rebind skinned meshes
    fbx.updateMatrixWorld(true)
    fbx.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) {
        node.bind(node.skeleton)
        this.meshMap.set(node.name, node)
      }

      // Hide ALL meshes initially except body and eyes (catches both Mesh and SkinnedMesh)
      if (node instanceof THREE.Mesh) {
        const lowerName = node.name.toLowerCase()
        const isBody = lowerName === 'body'
        const isEye = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || node.name === kw)
        node.visible = isBody || isEye
      }
    })

    // Replace the placeholder group with the actual FBX
    // Transfer any existing parent relationship
    const parent = this.group.parent
    const oldPosition = this.group.position.clone()
    const oldRotationY = this.group.rotation.y

    if (parent) {
      parent.remove(this.group)
      parent.add(fbx)
    }

    // Transfer position and add rotation offset
    fbx.position.copy(oldPosition)
    fbx.rotation.y = this.baseRotationY + oldRotationY

    // Copy userData
    fbx.userData = { ...this.group.userData }

    // Now use the FBX as our main group
    this.group = fbx

    // Initialize spring bones for hair physics
    this.springBones = new SpringBoneSystem()
    this.springBones.addBones(fbx, HAIR_KEYWORDS, 0.25, 0.7)

    this.loaded = true
  }

  /**
   * Apply appearance data to the character
   */
  applyAppearance(data: CharacterData): void {
    if (!this.loaded || !this.group) return

    const { visibleAssets, colors, heightScale = 1.0 } = data

    // Load hair texture based on undertone
    const hairUndertone = colors.hairUndertone || 'warm'
    const texturePath = getUndertoneTexturePath(hairUndertone)

    this.textureLoader.load(texturePath, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      this.hairTexture = tex
      this.applyMaterials(colors)
    })

    // Apply visibility to ALL meshes (not just skinned meshes in the map)
    const visibleSet = new Set(visibleAssets)
    this.group.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const name = node.name
        const lowerName = name.toLowerCase()
        const isBody = lowerName === 'body'
        const isEye = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || name === kw)
        node.visible = isBody || isEye || visibleSet.has(name)
      }
    })

    // Apply height scale
    if (this.group) {
      this.group.scale.setScalar(0.01 * heightScale)

      // Counter-scale hair to keep consistent size
      const counterScale = 1 / heightScale
      this.meshMap.forEach((mesh, name) => {
        const lower = name.toLowerCase()
        if (HAIR_KEYWORDS.some(kw => lower.includes(kw))) {
          mesh.scale.setScalar(counterScale)
        }
      })
    }

    // Apply morph targets
    if (data.morphTargets) {
      Object.entries(data.morphTargets).forEach(([key, value]) => {
        const [meshName, targetName] = key.split(':')
        const mesh = this.meshMap.get(meshName)
        if (mesh?.morphTargetDictionary && mesh.morphTargetInfluences) {
          const index = mesh.morphTargetDictionary[targetName]
          if (index !== undefined) {
            mesh.morphTargetInfluences[index] = value
          }
        }
      })
    }

    // Apply materials
    this.applyMaterials(colors)
  }

  /**
   * Apply materials with colors
   */
  private applyMaterials(colors: CategoryColors): void {
    if (!this.group) return

    this.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return

      const meshName = node.name
      const lowerName = meshName.toLowerCase()

      // Skip eye meshes - keep original material
      const isEyeMesh = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || meshName === kw)
      if (isEyeMesh) return

      const isHairMesh = HAIR_KEYWORDS.some(kw => lowerName.includes(kw))
      const isSkinMesh = SKIN_KEYWORDS.some(kw => lowerName.includes(kw))

      // Create toon material
      let baseColor: THREE.Color
      let map: THREE.Texture | null = null

      if (isHairMesh) {
        baseColor = new THREE.Color(colors.hair)
        map = this.hairTexture
      } else if (isSkinMesh) {
        baseColor = new THREE.Color(colors.body.skinTone)
      } else {
        // Use clothing color or neutral gray
        baseColor = new THREE.Color(colors.tops?.primary || 0xcccccc)
      }

      const toonMat = createColoredShadowMaterial({
        color: baseColor,
        map: map ?? undefined,
      })

      node.material = toonMat
      node.castShadow = true
      node.receiveShadow = true
      node.frustumCulled = false
    })
  }

  /**
   * Set the world transform of the character
   */
  setWorldTransform(position: [number, number, number], rotation: number): void {
    this.group.position.set(position[0], position[1], position[2])
    // Add base rotation offset to the user rotation
    this.group.rotation.y = this.baseRotationY + rotation
  }

  /**
   * Update spring bones - call each frame
   */
  update(delta: number): void {
    if (!this.springBones || this.springBones.count === 0) return

    this.springBones.update(delta)
    // The group IS the FBX model now
    this.springBones.applyGravity(this.group, 0.015, delta)
  }

  /**
   * Get the Three.js group for adding to scene
   */
  getGroup(): THREE.Group {
    return this.group
  }

  /**
   * Check if loaded
   */
  isLoaded(): boolean {
    return this.loaded
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.disposed = true

    if (this.springBones) {
      this.springBones.clear()
      this.springBones = null
    }

    if (this.hairTexture) {
      this.hairTexture.dispose()
      this.hairTexture = null
    }

    this.group?.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry?.dispose()
        const mats = Array.isArray(node.material) ? node.material : [node.material]
        mats.forEach(m => m?.dispose())
      }
    })

    this.group.clear()
    this.meshMap.clear()
  }
}
