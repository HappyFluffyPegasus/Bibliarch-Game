/**
 * CharacterRenderer - Reusable character model renderer for scenes.
 * Babylon.js port: uses SceneLoader for GLB/FBX loading.
 */

import {
  Scene,
  SceneLoader,
  TransformNode,
  Mesh,
  AbstractMesh,
  Skeleton,
  Vector3,
  Color3,
  Texture,
  ShaderMaterial,
} from '@babylonjs/core'
import '@babylonjs/loaders' // Register GLTF/GLB loader
import { createColoredShadowMaterial } from '@/lib/shaders/toonMaterial'
import { SpringBoneSystem } from '@/lib/SpringBoneSystem'
import { getUndertoneTexturePath } from '@/lib/hairTextures'
import type { CharacterData, CategoryColors } from '@/types/scenes'

const MODEL_PATH = '/models/Bibliarch Maybe.glb'

// Keywords for identifying mesh types
const HAIR_KEYWORDS = ['hair', 'pigtail', 'ponytail', 'bob', 'bangs', 'bun', 'braids', 'luke', 'ahoge']
const SKIN_KEYWORDS = ['body', 'skin', 'head', 'face', 'hand', 'arm', 'leg', 'foot']
const EYE_KEYWORDS = ['eye', 'Eyes', 'Eyes_3']

// Shared model cache
const modelCache: Map<string, { meshes: AbstractMesh[], skeletons: Skeleton[] }> = new Map()
const loadingPromises: Map<string, Promise<{ meshes: AbstractMesh[], skeletons: Skeleton[] }>> = new Map()

async function loadModel(scene: Scene): Promise<TransformNode> {
  // Load via SceneLoader — imports meshes into the scene
  const result = await SceneLoader.ImportMeshAsync('', '/models/', 'Bibliarch Maybe.glb', scene)

  // Create a parent node
  const parent = new TransformNode('character-model', scene)
  for (const mesh of result.meshes) {
    if (!mesh.parent || mesh.parent.name === '__root__') {
      mesh.parent = parent
    }
  }

  return parent
}

// Base rotation offset for the model
export const CHARACTER_BASE_ROTATION_Y = -Math.PI / 2

export class CharacterRenderer {
  private group: TransformNode
  private model: TransformNode | null = null
  private meshMap: Map<string, AbstractMesh> = new Map()
  private springBones: SpringBoneSystem | null = null
  private hairTexture: Texture | null = null
  private scene: Scene
  private loaded: boolean = false
  private disposed: boolean = false

  constructor(scene: Scene) {
    this.scene = scene
    this.group = new TransformNode('CharacterRenderer', scene)
  }

  async load(): Promise<void> {
    if (this.loaded || this.disposed) return

    const model = await loadModel(this.scene)
    if (this.disposed) {
      model.dispose()
      return
    }

    model.scaling.setAll(0.01)
    model.rotation.y = CHARACTER_BASE_ROTATION_Y

    // Force matrix world update
    model.computeWorldMatrix(true)
    model.getChildMeshes(true).forEach(mesh => {
      mesh.computeWorldMatrix(true)
      this.meshMap.set(mesh.name, mesh)

      // Hide all meshes except body and eyes
      const lowerName = mesh.name.toLowerCase()
      const isBody = lowerName === 'body'
      const isEye = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || mesh.name === kw)
      mesh.setEnabled(isBody || isEye)
    })

    this.model = model
    model.parent = this.group

    // Initialize spring bones
    this.springBones = new SpringBoneSystem()
    this.springBones.addBones(model, HAIR_KEYWORDS, 0.25, 0.7)

    this.loaded = true
  }

  applyAppearance(data: CharacterData): void {
    if (!this.loaded || !this.model) return

    const { visibleAssets, colors, heightScale = 1.0 } = data

    // Load hair texture
    const hairUndertone = colors.hairUndertone || 'warm'
    const texturePath = getUndertoneTexturePath(hairUndertone)

    const tex = new Texture(texturePath, this.scene)
    tex.onLoadObservable.addOnce(() => {
      if (this.disposed) return
      this.hairTexture = tex
      this.applyMaterials(colors)
    })

    // Apply visibility
    const visibleSet = new Set(visibleAssets)
    this.model.getChildMeshes(true).forEach(mesh => {
      const name = mesh.name
      const lowerName = name.toLowerCase()
      const isBody = lowerName === 'body'
      const isEye = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || name === kw)
      mesh.setEnabled(isBody || isEye || visibleSet.has(name))
    })

    // Apply height scale
    if (this.model) {
      this.model.scaling.setAll(0.01 * heightScale)

      // Counter-scale hair
      const counterScale = 1 / heightScale
      this.meshMap.forEach((mesh, name) => {
        const lower = name.toLowerCase()
        if (HAIR_KEYWORDS.some(kw => lower.includes(kw))) {
          mesh.scaling.setAll(counterScale)
        }
      })
    }

    // Apply morph targets
    if (data.morphTargets) {
      Object.entries(data.morphTargets).forEach(([key, value]) => {
        const [meshName, targetName] = key.split(':')
        const mesh = this.meshMap.get(meshName)
        if (mesh && (mesh as any).morphTargetManager) {
          const mtm = (mesh as any).morphTargetManager
          for (let i = 0; i < mtm.numTargets; i++) {
            const target = mtm.getTarget(i)
            if (target.name === targetName) {
              target.influence = value
              break
            }
          }
        }
      })
    }

    this.applyMaterials(colors)
  }

  private applyMaterials(colors: CategoryColors): void {
    if (!this.model) return

    this.model.getChildMeshes(true).forEach(mesh => {
      const meshName = mesh.name
      const lowerName = meshName.toLowerCase()

      // Skip eye meshes
      const isEyeMesh = EYE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()) || meshName === kw)
      if (isEyeMesh) return

      const isHairMesh = HAIR_KEYWORDS.some(kw => lowerName.includes(kw))
      const isSkinMesh = SKIN_KEYWORDS.some(kw => lowerName.includes(kw))

      let baseColor: Color3
      let map: Texture | null = null

      if (isHairMesh) {
        baseColor = Color3.FromHexString(colors.hair)
        map = this.hairTexture
      } else if (isSkinMesh) {
        baseColor = Color3.FromHexString(colors.body.skinTone)
      } else {
        baseColor = Color3.FromHexString(colors.tops?.primary || '#cccccc')
      }

      const toonMat = createColoredShadowMaterial(this.scene, {
        color: baseColor,
        map: map ?? undefined,
      })

      mesh.material = toonMat
    })
  }

  setWorldTransform(position: [number, number, number], rotation: number): void {
    this.group.position = new Vector3(position[0], position[1], position[2])
    this.group.rotation.y = rotation
    this.group.computeWorldMatrix(true)
  }

  update(delta: number): void {
    if (!this.springBones || this.springBones.count === 0) return

    this.springBones.update(delta)
    if (this.model) {
      this.springBones.applyGravity(this.model, 0.015, delta)
    }
  }

  getGroup(): TransformNode {
    return this.group
  }

  isLoaded(): boolean {
    return this.loaded
  }

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

    this.model?.dispose()
    this.group.dispose()
    this.meshMap.clear()
    this.model = null
  }
}
