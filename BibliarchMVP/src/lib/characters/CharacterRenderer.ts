/**
 * CharacterRenderer - Reusable character model renderer for scenes.
 * Extracts model loading logic from Viewer3D.tsx to be used in SceneViewer3D.
 */

import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { createColoredShadowMaterial } from '@/lib/shaders/toonMaterial'
import { SpringBoneSystem } from '@/lib/SpringBoneSystem'
import { getUndertoneTexturePath } from '@/lib/hairTextures'
import { loadShapeKeyData, applyShapeKeysToModel } from '@/lib/characters/shapeKeyLoader'
import type { CharacterData, CategoryColors } from '@/types/scenes'

const FBX_PATH = '/models/Bibliarch Maybe.fbx'

// Keywords for identifying mesh types
const HAIR_KEYWORDS = ['hair', 'pigtail', 'ponytail', 'bob', 'bangs', 'bun', 'braids', 'luke', 'ahoge']
const SKIN_KEYWORDS = ['body', 'skin', 'head', 'face', 'hand', 'arm', 'leg', 'foot']
const EYE_KEYWORDS = ['eye', 'iris', 'eye white', 'eye_white']

// Shared model cache to avoid reloading for each character
let modelCache: THREE.Group | null = null
let modelLoadingPromise: Promise<THREE.Group> | null = null

/**
 * Load the FBX character model with caching.
 * Uses SkeletonUtils.clone() for proper skinned mesh cloning.
 */
async function loadCharacterModel(): Promise<THREE.Group> {
  if (modelCache) {
    return SkeletonUtils.clone(modelCache) as THREE.Group
  }

  if (modelLoadingPromise) {
    const cached = await modelLoadingPromise
    return SkeletonUtils.clone(cached) as THREE.Group
  }

  modelLoadingPromise = new Promise((resolve, reject) => {
    const fbxLoader = new FBXLoader()
    fbxLoader.load(
      FBX_PATH,
      (fbx) => {
        modelCache = fbx
        resolve(fbx)
      },
      undefined,
      reject
    )
  })

  return modelLoadingPromise.then((result) => {
    return SkeletonUtils.clone(result) as THREE.Group
  })
}

// Base rotation offset for the FBX model (facing direction)
export const CHARACTER_BASE_ROTATION_Y = -Math.PI / 2

export class CharacterRenderer {
  private group: THREE.Group  // Wrapper group that contains the FBX
  private fbxModel: THREE.Group | null = null
  private meshMap: Map<string, THREE.SkinnedMesh> = new Map()
  private allMeshMap: Map<string, THREE.Mesh> = new Map()  // Includes regular Mesh (for morph targets)
  private springBones: SpringBoneSystem | null = null
  private hairTexture: THREE.Texture | null = null
  private textureLoader: THREE.TextureLoader
  private loaded: boolean = false
  private disposed: boolean = false

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'CharacterRenderer'
    this.textureLoader = new THREE.TextureLoader()
  }

  /**
   * Load the character model
   */
  async load(): Promise<void> {
    if (this.loaded || this.disposed) return

    const fbx = await loadCharacterModel()
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
    fbx.rotation.y = CHARACTER_BASE_ROTATION_Y

    // Force matrix world update and rebind skinned meshes
    fbx.updateMatrixWorld(true)
    fbx.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) {
        node.bind(node.skeleton)
        this.meshMap.set(node.name, node)
      }

      // Track all meshes (for morph target application)
      if (node instanceof THREE.Mesh) {
        this.allMeshMap.set(node.name, node)
        const lowerName = node.name.toLowerCase()
        const isBody = lowerName === 'body'
        const isEye = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || node.name === kw)
        node.visible = isBody || isEye
      }
    })

    this.fbxModel = fbx
    this.group.add(fbx)

    // Load external shape keys (from Blender export script)
    const shapeKeyData = await loadShapeKeyData()
    if (shapeKeyData && !this.disposed) {
      applyShapeKeysToModel(fbx, shapeKeyData)
      // Force material recompile so morph target shader code is included
      fbx.traverse((node) => {
        if (node instanceof THREE.Mesh && node.geometry?.morphAttributes?.position) {
          const mats = Array.isArray(node.material) ? node.material : [node.material]
          mats.forEach((mat) => { mat.needsUpdate = true })
        }
      })
    }

    // Initialize spring bones for hair physics
    this.springBones = new SpringBoneSystem()
    this.springBones.addBones(fbx, HAIR_KEYWORDS, 0.25, 0.7)

    this.loaded = true
  }

  /**
   * Apply appearance data to the character
   */
  applyAppearance(data: CharacterData): void {
    if (!this.loaded || !this.fbxModel) return

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
    this.fbxModel.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const name = node.name
        const lowerName = name.toLowerCase()
        const isBody = lowerName === 'body'
        const isEye = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || name === kw)
        node.visible = isBody || isEye || visibleSet.has(name)
      }
    })

    // Apply height scale to the FBX model (not the wrapper group)
    if (this.fbxModel) {
      this.fbxModel.scale.setScalar(0.01 * heightScale)

      // Counter-scale hair to keep consistent size
      const counterScale = 1 / heightScale
      this.meshMap.forEach((mesh, name) => {
        const lower = name.toLowerCase()
        if (HAIR_KEYWORDS.some(kw => lower.includes(kw))) {
          mesh.scale.setScalar(counterScale)
        }
      })
    }

    // Apply morph targets (check skinned meshes first, then all meshes)
    // Body shape keys propagate to all clothing meshes that share the same target
    if (data.morphTargets) {
      const setMorphTarget = (mesh: THREE.Mesh, targetName: string, value: number) => {
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          const index = mesh.morphTargetDictionary[targetName]
          if (index !== undefined) {
            mesh.morphTargetInfluences[index] = value
          }
        }
      }

      Object.entries(data.morphTargets).forEach(([key, value]) => {
        const [meshName, targetName] = key.split(':')
        const mesh = this.meshMap.get(meshName) || this.allMeshMap.get(meshName)
        if (mesh) setMorphTarget(mesh, targetName, value)

        // Propagate body shape keys to all other meshes
        if (meshName === 'Body') {
          this.meshMap.forEach((m, name) => {
            if (name !== 'Body') setMorphTarget(m, targetName, value)
          })
          this.allMeshMap.forEach((m, name) => {
            if (name !== 'Body') setMorphTarget(m, targetName, value)
          })
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
    if (!this.fbxModel) return

    this.fbxModel.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return

      const meshName = node.name
      const lowerName = meshName.toLowerCase()

      // Skip eye meshes - keep original material completely unchanged
      const isEyeMesh = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || meshName === kw)
      if (isEyeMesh) {
        return
      }

      const isHairMesh = HAIR_KEYWORDS.some(kw => lowerName.includes(kw))
      const isSkinMesh = SKIN_KEYWORDS.some(kw => lowerName.includes(kw))

      // Convert each sub-material individually to preserve multi-material meshes
      const currentMats = Array.isArray(node.material) ? node.material : [node.material]
      const toonMaterials: THREE.Material[] = currentMats.map((mat) => {
        let baseColor = new THREE.Color(0xcccccc)
        let map: THREE.Texture | null = null
        const matNameLower = ((mat as any).name || '').toLowerCase()

        if (mat instanceof THREE.MeshStandardMaterial ||
            mat instanceof THREE.MeshPhongMaterial ||
            mat instanceof THREE.MeshToonMaterial ||
            mat instanceof THREE.MeshLambertMaterial ||
            mat instanceof THREE.MeshBasicMaterial) {
          baseColor = mat.color.clone()
          if (mat.map) {
            map = mat.map
            map.colorSpace = THREE.SRGBColorSpace
            map.needsUpdate = true
          }
        }

        const isFaceTextureMat = matNameLower.includes('chill') || (map && isSkinMesh)
        const isEyeWhiteMat = matNameLower.includes('eye white')

        if (isHairMesh) {
          baseColor = new THREE.Color(colors.hair)
          map = this.hairTexture  // Override with hair texture for hair
        } else if (isFaceTextureMat) {
          // Face texture: tint with skin tone (multiply)
          baseColor = new THREE.Color(colors.body.skinTone)
        } else if (isEyeWhiteMat) {
          baseColor = new THREE.Color(0xffffff)
        } else if (isSkinMesh && !map) {
          baseColor = new THREE.Color(colors.body.skinTone)
        } else if (!isSkinMesh && !isHairMesh && !map) {
          baseColor = new THREE.Color(colors.tops?.primary || 0xcccccc)
        }

        const toonMat = createColoredShadowMaterial({
          color: (map && !isHairMesh && !isFaceTextureMat) ? new THREE.Color(0xffffff) : baseColor,
          map: map ?? undefined,
        })

        // Face texture PNG has transparent eye holes — alphaTest cuts them out
        if (isFaceTextureMat) {
          toonMat.alphaTest = 0.99
        }

        // Eye whites: double-sided (normals may face inward into socket)
        if (isEyeWhiteMat) {
          toonMat.side = THREE.DoubleSide
        }

        return toonMat
      })

      node.material = toonMaterials.length === 1 ? toonMaterials[0] : toonMaterials
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
    // User rotation is applied to the wrapper group
    // The FBX's base rotation is handled internally
    this.group.rotation.y = rotation
    // Force update matrices to ensure skinned meshes move correctly
    this.group.updateMatrixWorld(true)
  }

  /**
   * Update spring bones - call each frame
   */
  update(delta: number): void {
    if (!this.springBones || this.springBones.count === 0) return

    this.springBones.update(delta)
    if (this.fbxModel) {
      this.springBones.applyGravity(this.fbxModel, 0.015, delta)
    }
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

    this.fbxModel?.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry?.dispose()
        const mats = Array.isArray(node.material) ? node.material : [node.material]
        mats.forEach(m => m?.dispose())
      }
    })

    this.group.clear()
    this.meshMap.clear()
    this.fbxModel = null
  }
}
