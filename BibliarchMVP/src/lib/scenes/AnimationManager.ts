/**
 * AnimationManager - Handles animation playback for scene characters.
 * Babylon.js port: uses AnimationGroup and Scene.beginAnimation.
 */

import {
  Scene,
  SceneLoader,
  TransformNode,
  Skeleton,
  Bone,
  Vector3,
  Quaternion,
  AnimationGroup,
  AbstractMesh,
} from '@babylonjs/core'
import '@babylonjs/loaders'
import '@/lib/registerFBXLoader'
import type { CharacterAnimationState } from '@/types/scenes'
import { getAnimationById, EMOTION_MORPH_TARGETS } from '@/utils/animationCatalog'

// Cache for loaded animation groups
const animationCache: Map<string, AnimationGroup[]> = new Map()
const loadingPromises: Map<string, Promise<AnimationGroup[] | null>> = new Map()

async function loadAnimationClip(path: string, scene: Scene): Promise<AnimationGroup[] | null> {
  if (animationCache.has(path)) {
    return animationCache.get(path)!
  }

  if (loadingPromises.has(path)) {
    return loadingPromises.get(path)!
  }

  const loadPromise = (async () => {
    try {
      const result = await SceneLoader.ImportAnimationsAsync('', path, scene, false)
      // The animations are added to the scene's animation groups
      const groups = scene.animationGroups.slice(-1) // Get the most recently added group
      if (groups.length > 0) {
        animationCache.set(path, groups)
        return groups
      }
      return null
    } catch (error) {
      console.error(`Failed to load animation ${path}:`, error)
      return null
    }
  })()

  loadingPromises.set(path, loadPromise)
  return loadPromise
}

export class AnimationManager {
  private currentAnimGroup: AnimationGroup | null = null
  private targetObject: TransformNode | null = null
  private scene: Scene | null = null

  // Bind pose storage
  private bindPose: Map<string, {
    position: Vector3
    quaternion: Quaternion
    scale: Vector3
  }> = new Map()

  private currentState: CharacterAnimationState = {
    basePose: null,
    emotion: null,
    emotionIntensity: 1,
    clipAnimation: null,
    clipLoop: true,
  }

  // Morph target references
  private morphTargetMeshes: Map<string, AbstractMesh> = new Map()

  constructor() {}

  initialize(target: TransformNode, scene: Scene): void {
    this.targetObject = target
    this.scene = scene

    // Store bind pose from skeleton bones
    target.getChildMeshes(true).forEach(mesh => {
      if ((mesh as any).skeleton) {
        const skeleton = (mesh as any).skeleton as Skeleton
        for (const bone of skeleton.bones) {
          this.bindPose.set(bone.name, {
            position: bone.position.clone(),
            quaternion: bone.rotationQuaternion?.clone() || Quaternion.Identity(),
            scale: bone.scaling.clone(),
          })
        }

        // Collect morph target meshes
        if ((mesh as any).morphTargetManager) {
          this.morphTargetMeshes.set(mesh.name, mesh)
        }
      }
    })
  }

  resetToBindPose(): void {
    if (!this.targetObject) return

    if (this.currentAnimGroup) {
      this.currentAnimGroup.stop()
      this.currentAnimGroup = null
    }

    // Stop all scene animation groups targeting our object
    this.scene?.animationGroups.forEach(group => {
      group.stop()
    })

    // Restore bind pose
    this.targetObject.getChildMeshes(true).forEach(mesh => {
      if ((mesh as any).skeleton) {
        const skeleton = (mesh as any).skeleton as Skeleton
        for (const bone of skeleton.bones) {
          const bind = this.bindPose.get(bone.name)
          if (bind) {
            bone.position = bind.position.clone()
            if (bone.rotationQuaternion) {
              bone.rotationQuaternion = bind.quaternion.clone()
            }
            bone.scaling = bind.scale.clone()
          }
        }
      }
    })
  }

  async applyState(state: CharacterAnimationState): Promise<void> {
    this.currentState = { ...state }

    this.applyEmotion(state.emotion, state.emotionIntensity)

    if (state.clipAnimation) {
      await this.playClip(state.clipAnimation, state.clipLoop)
    } else if (state.basePose) {
      await this.applyPose(state.basePose)
    } else {
      this.resetToBindPose()
    }
  }

  private async applyPose(poseId: string): Promise<void> {
    const entry = getAnimationById(poseId)
    if (!entry) {
      console.warn(`Unknown pose: ${poseId}`)
      return
    }

    if (entry.path) {
      await this.playClip(poseId, false)
      if (this.currentAnimGroup) {
        this.currentAnimGroup.pause()
        this.currentAnimGroup.goToFrame(0)
      }
    } else {
      this.resetToBindPose()
    }
  }

  private applyEmotion(emotionId: string | null, intensity: number): void {
    // Reset all morph targets
    this.morphTargetMeshes.forEach((mesh) => {
      const mtm = (mesh as any).morphTargetManager
      if (mtm) {
        for (let i = 0; i < mtm.numTargets; i++) {
          mtm.getTarget(i).influence = 0
        }
      }
    })

    if (!emotionId) return

    const targets = EMOTION_MORPH_TARGETS[emotionId]
    if (!targets) return

    Object.entries(targets).forEach(([key, value]) => {
      const [meshName, targetName] = key.split(':')
      const mesh = this.morphTargetMeshes.get(meshName)

      if (mesh && (mesh as any).morphTargetManager) {
        const mtm = (mesh as any).morphTargetManager
        for (let i = 0; i < mtm.numTargets; i++) {
          const target = mtm.getTarget(i)
          if (target.name === targetName) {
            target.influence = value * intensity
            break
          }
        }
      }
    })
  }

  private async playClip(clipId: string, loop: boolean): Promise<void> {
    if (!this.scene) return

    const entry = getAnimationById(clipId)
    if (!entry || !entry.path) {
      console.warn(`Unknown or invalid clip: ${clipId}`)
      return
    }

    const groups = await loadAnimationClip(entry.path, this.scene)
    if (!groups || groups.length === 0) return

    if (this.currentAnimGroup) {
      this.currentAnimGroup.stop()
    }

    const group = groups[0]
    group.loopAnimation = loop
    group.start(loop, 1.0, group.from, group.to, false)

    this.currentAnimGroup = group
  }

  update(delta: number): void {
    // Babylon.js animation system updates automatically with scene.render()
    // No manual mixer update needed
  }

  getState(): CharacterAnimationState {
    return { ...this.currentState }
  }

  stop(): void {
    if (this.currentAnimGroup) {
      this.currentAnimGroup.stop()
      this.currentAnimGroup = null
    }
  }

  dispose(): void {
    this.stop()
    this.targetObject = null
    this.scene = null
    this.bindPose.clear()
    this.morphTargetMeshes.clear()
  }
}

export async function preloadAnimations(paths: string[], scene: Scene): Promise<void> {
  await Promise.all(paths.map(path => loadAnimationClip(path, scene)))
}
