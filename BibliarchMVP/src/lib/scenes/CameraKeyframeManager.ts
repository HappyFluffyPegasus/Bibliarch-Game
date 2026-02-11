/**
 * CameraKeyframeManager - Manages camera keyframes for scene animation.
 * Provides interpolation using Catmull-Rom splines for smooth camera paths.
 */

import * as THREE from 'three'
import type { CameraKeyframe, EasingType } from '@/types/scenes'

// Easing functions
function easeLinear(t: number): number {
  return t
}

function easeIn(t: number): number {
  return t * t
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function getEasingFunction(easing: EasingType): (t: number) => number {
  switch (easing) {
    case 'ease-in': return easeIn
    case 'ease-out': return easeOut
    case 'ease-in-out': return easeInOut
    default: return easeLinear
  }
}

export class CameraKeyframeManager {
  private keyframes: CameraKeyframe[] = []
  private positionCurve: THREE.CatmullRomCurve3 | null = null
  private rotationCurve: THREE.CatmullRomCurve3 | null = null
  private fovValues: number[] = []
  private timeValues: number[] = []
  private duration: number = 0

  /**
   * Set keyframes from an array
   */
  setKeyframes(keyframes: CameraKeyframe[]): void {
    // Sort by time
    this.keyframes = [...keyframes].sort((a, b) => a.time - b.time)

    if (this.keyframes.length < 2) {
      this.positionCurve = null
      this.rotationCurve = null
      this.duration = 0
      return
    }

    // Build position curve
    const positions = this.keyframes.map(
      kf => new THREE.Vector3(kf.position[0], kf.position[1], kf.position[2])
    )
    this.positionCurve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.5)

    // Build rotation "curve" (we'll interpolate via vectors for simplicity)
    const rotations = this.keyframes.map(
      kf => new THREE.Vector3(kf.rotation[0], kf.rotation[1], kf.rotation[2])
    )
    this.rotationCurve = new THREE.CatmullRomCurve3(rotations, false, 'catmullrom', 0.5)

    // Store FOV and time values
    this.fovValues = this.keyframes.map(kf => kf.fov)
    this.timeValues = this.keyframes.map(kf => kf.time)

    // Calculate duration
    this.duration = this.keyframes[this.keyframes.length - 1].time
  }

  /**
   * Add a keyframe
   */
  addKeyframe(keyframe: CameraKeyframe): void {
    this.setKeyframes([...this.keyframes, keyframe])
  }

  /**
   * Remove a keyframe by ID
   */
  removeKeyframe(id: string): void {
    this.setKeyframes(this.keyframes.filter(kf => kf.id !== id))
  }

  /**
   * Update a keyframe
   */
  updateKeyframe(id: string, updates: Partial<CameraKeyframe>): void {
    this.setKeyframes(
      this.keyframes.map(kf => kf.id === id ? { ...kf, ...updates } : kf)
    )
  }

  /**
   * Get all keyframes
   */
  getKeyframes(): CameraKeyframe[] {
    return [...this.keyframes]
  }

  /**
   * Get total duration
   */
  getDuration(): number {
    return this.duration
  }

  /**
   * Find the keyframe indices surrounding a given time
   */
  private findKeyframeIndices(time: number): { before: number; after: number; t: number } {
    if (this.keyframes.length === 0) {
      return { before: 0, after: 0, t: 0 }
    }

    if (time <= this.keyframes[0].time) {
      return { before: 0, after: 0, t: 0 }
    }

    if (time >= this.keyframes[this.keyframes.length - 1].time) {
      const last = this.keyframes.length - 1
      return { before: last, after: last, t: 1 }
    }

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      const kfBefore = this.keyframes[i]
      const kfAfter = this.keyframes[i + 1]

      if (time >= kfBefore.time && time < kfAfter.time) {
        const segmentDuration = kfAfter.time - kfBefore.time
        const localT = (time - kfBefore.time) / segmentDuration
        return { before: i, after: i + 1, t: localT }
      }
    }

    return { before: 0, after: 0, t: 0 }
  }

  /**
   * Get camera state at a specific time
   */
  getCameraState(time: number): {
    position: THREE.Vector3
    rotation: THREE.Euler
    fov: number
  } | null {
    if (this.keyframes.length === 0) {
      return null
    }

    if (this.keyframes.length === 1) {
      const kf = this.keyframes[0]
      return {
        position: new THREE.Vector3(kf.position[0], kf.position[1], kf.position[2]),
        rotation: new THREE.Euler(kf.rotation[0], kf.rotation[1], kf.rotation[2]),
        fov: kf.fov,
      }
    }

    const { before, after, t } = this.findKeyframeIndices(time)
    const kfBefore = this.keyframes[before]
    const kfAfter = this.keyframes[after]

    // Apply easing from the "before" keyframe
    const easeFunc = getEasingFunction(kfBefore.easing)
    const easedT = easeFunc(t)

    // Get position from curve
    // Convert local t to global curve parameter
    const globalT = (before + easedT) / (this.keyframes.length - 1)
    const position = this.positionCurve?.getPointAt(Math.min(1, Math.max(0, globalT)))
      ?? new THREE.Vector3(kfBefore.position[0], kfBefore.position[1], kfBefore.position[2])

    // Interpolate rotation (simple lerp for Euler angles)
    const rotation = new THREE.Euler(
      THREE.MathUtils.lerp(kfBefore.rotation[0], kfAfter.rotation[0], easedT),
      THREE.MathUtils.lerp(kfBefore.rotation[1], kfAfter.rotation[1], easedT),
      THREE.MathUtils.lerp(kfBefore.rotation[2], kfAfter.rotation[2], easedT)
    )

    // Interpolate FOV
    const fov = THREE.MathUtils.lerp(kfBefore.fov, kfAfter.fov, easedT)

    return { position, rotation, fov }
  }

  /**
   * Apply camera state at a specific time to a camera
   */
  applyCameraState(camera: THREE.PerspectiveCamera, time: number): boolean {
    const state = this.getCameraState(time)
    if (!state) return false

    camera.position.copy(state.position)
    camera.rotation.copy(state.rotation)
    camera.fov = state.fov
    camera.updateProjectionMatrix()

    return true
  }

  /**
   * Get the camera path as a series of points (for visualization)
   */
  getCameraPath(segments: number = 100): THREE.Vector3[] {
    if (!this.positionCurve || this.keyframes.length < 2) {
      return this.keyframes.map(
        kf => new THREE.Vector3(kf.position[0], kf.position[1], kf.position[2])
      )
    }

    const points: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      points.push(this.positionCurve.getPointAt(t))
    }
    return points
  }

  /**
   * Create keyframe from current camera state
   */
  static createKeyframeFromCamera(
    camera: THREE.PerspectiveCamera,
    time: number,
    easing: EasingType = 'ease-in-out'
  ): CameraKeyframe {
    return {
      id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time,
      position: [camera.position.x, camera.position.y, camera.position.z],
      rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z],
      fov: camera.fov,
      easing,
    }
  }

  /**
   * Clear all keyframes
   */
  clear(): void {
    this.keyframes = []
    this.positionCurve = null
    this.rotationCurve = null
    this.fovValues = []
    this.timeValues = []
    this.duration = 0
  }
}
