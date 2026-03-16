/**
 * AnimationManager - Handles animation playback for scene characters.
 * Manages poses, emotions, and animation clips with layered blending.
 */

import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { CharacterAnimationState } from '@/types/scenes'
import { getAnimationById, EMOTION_MORPH_TARGETS } from '@/utils/animationCatalog'

// Cache for loaded animation clips
const animationCache: Map<string, THREE.AnimationClip> = new Map()
const loadingPromises: Map<string, Promise<THREE.AnimationClip | null>> = new Map()

/**
 * Load an animation clip from an FBX file
 */
async function loadAnimationClip(path: string): Promise<THREE.AnimationClip | null> {
  // Check cache
  if (animationCache.has(path)) {
    return animationCache.get(path)!
  }

  // Check if already loading
  if (loadingPromises.has(path)) {
    return loadingPromises.get(path)!
  }

  // Load the animation
  const loadPromise = new Promise<THREE.AnimationClip | null>((resolve) => {
    const loader = new FBXLoader()
    loader.load(
      path,
      (fbx) => {
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0]
          animationCache.set(path, clip)
          resolve(clip)
        } else {
          console.warn(`No animations found in ${path}`)
          resolve(null)
        }
      },
      undefined,
      (error) => {
        console.error(`Failed to load animation ${path}:`, error)
        resolve(null)
      }
    )
  })

  loadingPromises.set(path, loadPromise)
  return loadPromise
}

export class AnimationManager {
  private mixer: THREE.AnimationMixer | null = null
  private currentAction: THREE.AnimationAction | null = null
  private targetObject: THREE.Object3D | null = null

  // Bind pose storage for resetting
  private bindPose: Map<string, {
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    scale: THREE.Vector3
  }> = new Map()

  // Current state
  private currentState: CharacterAnimationState = {
    basePose: null,
    emotion: null,
    emotionIntensity: 1,
    clipAnimation: null,
    clipLoop: true
  }

  // Morph target references
  private morphTargetMeshes: Map<string, THREE.SkinnedMesh> = new Map()

  constructor() {}

  /**
   * Initialize the animation manager with a target object
   */
  initialize(target: THREE.Object3D): void {
    this.targetObject = target
    this.mixer = new THREE.AnimationMixer(target)

    // Store bind pose
    target.traverse((node) => {
      if (node instanceof THREE.Bone) {
        this.bindPose.set(node.name, {
          position: node.position.clone(),
          quaternion: node.quaternion.clone(),
          scale: node.scale.clone()
        })
      }

      // Collect morph target meshes
      if (node instanceof THREE.SkinnedMesh && node.morphTargetDictionary) {
        this.morphTargetMeshes.set(node.name, node)
      }
    })
  }

  /**
   * Reset to bind pose
   */
  resetToBindPose(): void {
    if (!this.targetObject) return

    if (this.currentAction) {
      this.currentAction.stop()
      this.currentAction = null
    }

    this.mixer?.stopAllAction()

    this.targetObject.traverse((node) => {
      if (node instanceof THREE.Bone) {
        const bind = this.bindPose.get(node.name)
        if (bind) {
          node.position.copy(bind.position)
          node.quaternion.copy(bind.quaternion)
          node.scale.copy(bind.scale)
        }
      }
    })
  }

  /**
   * Apply animation state
   */
  async applyState(state: CharacterAnimationState): Promise<void> {
    this.currentState = { ...state }

    // Apply emotion (morph targets)
    this.applyEmotion(state.emotion, state.emotionIntensity)

    // Apply clip animation
    if (state.clipAnimation) {
      await this.playClip(state.clipAnimation, state.clipLoop)
    } else if (state.basePose) {
      // Apply base pose
      await this.applyPose(state.basePose)
    } else {
      // Reset to bind pose
      this.resetToBindPose()
    }
  }

  /**
   * Apply a pose
   */
  private async applyPose(poseId: string): Promise<void> {
    const entry = getAnimationById(poseId)
    if (!entry) {
      console.warn(`Unknown pose: ${poseId}`)
      return
    }

    if (entry.path) {
      // Pose has an animation file - play it (usually paused at frame 0)
      await this.playClip(poseId, false)
      // Pause at first frame for static pose
      if (this.currentAction) {
        this.currentAction.paused = true
      }
    } else {
      // No animation file — just stop current animation and let character hold last pose
      if (this.currentAction) {
        this.currentAction.fadeOut(0.5)
        this.currentAction = null
      }
    }
  }

  /**
   * Apply emotion via morph targets
   */
  private applyEmotion(emotionId: string | null, intensity: number): void {
    // Reset all morph targets first
    this.morphTargetMeshes.forEach((mesh) => {
      if (mesh.morphTargetInfluences) {
        for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
          mesh.morphTargetInfluences[i] = 0
        }
      }
    })

    if (!emotionId) return

    // Get morph target values for this emotion
    const targets = EMOTION_MORPH_TARGETS[emotionId]
    if (!targets) return

    // Apply morph targets
    Object.entries(targets).forEach(([key, value]) => {
      const [meshName, targetName] = key.split(':')
      const mesh = this.morphTargetMeshes.get(meshName)

      if (mesh?.morphTargetDictionary && mesh.morphTargetInfluences) {
        const index = mesh.morphTargetDictionary[targetName]
        if (index !== undefined) {
          mesh.morphTargetInfluences[index] = value * intensity
        }
      }
    })
  }

  /**
   * Play an animation clip
   */
  private async playClip(clipId: string, loop: boolean): Promise<void> {
    if (!this.mixer) return

    const entry = getAnimationById(clipId)
    if (!entry || !entry.path) {
      console.warn(`Unknown or invalid clip: ${clipId}`)
      return
    }

    const clip = await loadAnimationClip(entry.path)
    if (!clip) return

    // Stop current action
    if (this.currentAction) {
      this.currentAction.fadeOut(0.3)
    }

    // Play new action
    const action = this.mixer.clipAction(clip)
    action.reset()
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    action.clampWhenFinished = !loop
    action.fadeIn(0.3)
    action.play()

    this.currentAction = action
  }

  /**
   * Update the animation mixer - call each frame
   */
  update(delta: number): void {
    this.mixer?.update(delta)
  }

  /**
   * Get current animation state
   */
  getState(): CharacterAnimationState {
    return { ...this.currentState }
  }

  /**
   * Stop all animations
   */
  stop(): void {
    if (this.currentAction) {
      this.currentAction.stop()
      this.currentAction = null
    }
    this.mixer?.stopAllAction()
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop()
    this.mixer = null
    this.targetObject = null
    this.bindPose.clear()
    this.morphTargetMeshes.clear()
  }
}

/**
 * Preload commonly used animations
 */
export async function preloadAnimations(paths: string[]): Promise<void> {
  await Promise.all(paths.map(path => loadAnimationClip(path)))
}
