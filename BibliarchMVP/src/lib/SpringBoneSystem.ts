import * as THREE from 'three'

interface SpringBone {
  bone: THREE.Bone
  parentBone: THREE.Bone | null
  initialLocalQuaternion: THREE.Quaternion
  currentVelocity: THREE.Quaternion
  stiffness: number
  damping: number
}

export class SpringBoneSystem {
  private springBones: SpringBone[] = []
  private tempQuat = new THREE.Quaternion()
  private tempQuat2 = new THREE.Quaternion()
  private tempEuler = new THREE.Euler()

  constructor() {}

  /**
   * Add bones to the spring system
   * @param root - The root object to search for bones
   * @param bonePatterns - Array of patterns to match bone names (e.g., ['hair', 'pigtail'])
   * @param stiffness - How quickly bones snap to target (0.1 = very loose, 0.9 = very stiff)
   * @param damping - How quickly oscillation dies down (0.1 = very bouncy, 0.9 = no bounce)
   */
  addBones(
    root: THREE.Object3D,
    bonePatterns: string[],
    stiffness: number = 0.3,
    damping: number = 0.6
  ) {
    root.traverse((node) => {
      if (node instanceof THREE.Bone) {
        const nameLower = node.name.toLowerCase()
        const isSpringBone = bonePatterns.some(pattern =>
          nameLower.includes(pattern.toLowerCase())
        )

        if (isSpringBone) {
          // Find parent bone
          let parentBone: THREE.Bone | null = null
          let parent = node.parent
          while (parent) {
            if (parent instanceof THREE.Bone) {
              parentBone = parent
              break
            }
            parent = parent.parent
          }

          this.springBones.push({
            bone: node,
            parentBone,
            initialLocalQuaternion: node.quaternion.clone(),
            currentVelocity: new THREE.Quaternion(0, 0, 0, 1),
            stiffness,
            damping
          })

          console.log(`[SpringBone] Added: ${node.name}`)
        }
      }
    })

    console.log(`[SpringBone] Total spring bones: ${this.springBones.length}`)
  }

  /**
   * Update spring bones - call this each frame after animation update
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number) {
    // Clamp delta to avoid instability
    const dt = Math.min(deltaTime, 0.05)

    for (const spring of this.springBones) {
      const { bone, initialLocalQuaternion, stiffness, damping } = spring

      // Get the target quaternion (where the bone "wants" to be based on animation/rest)
      // For now, we use the initial rest pose as target
      // The bone's current quaternion is being driven by animation

      // Store current animated quaternion as target
      this.tempQuat.copy(bone.quaternion)

      // Calculate spring force toward rest pose with slight lag
      // This creates a "follow with delay" effect

      // Slerp current velocity toward target
      spring.currentVelocity.slerp(this.tempQuat, stiffness * dt * 60)

      // Apply damping
      spring.currentVelocity.slerp(initialLocalQuaternion, (1 - damping) * dt * 10)

      // Don't override animation completely - blend spring effect on top
      // This is a simplified approach - just add some rotational lag
    }
  }

  /**
   * Apply gravity/pendulum effect to hair bones
   * Makes hair hang down naturally and swing
   */
  applyGravity(
    root: THREE.Object3D,
    gravityStrength: number = 0.02,
    deltaTime: number
  ) {
    const dt = Math.min(deltaTime, 0.05)
    const gravity = new THREE.Vector3(0, -1, 0)

    for (const spring of this.springBones) {
      const { bone, stiffness, damping } = spring

      // Get world position of bone
      const worldPos = new THREE.Vector3()
      bone.getWorldPosition(worldPos)

      // Get world position of parent
      if (bone.parent) {
        const parentWorldPos = new THREE.Vector3()
        bone.parent.getWorldPosition(parentWorldPos)

        // Direction from parent to bone
        const boneDir = worldPos.clone().sub(parentWorldPos).normalize()

        // Calculate how much the bone should rotate toward gravity
        const gravityInfluence = gravity.clone().multiplyScalar(gravityStrength)

        // Apply subtle rotation toward gravity
        this.tempEuler.set(
          gravityInfluence.z * dt,
          0,
          -gravityInfluence.x * dt
        )
        this.tempQuat.setFromEuler(this.tempEuler)

        // Blend with current rotation
        bone.quaternion.multiply(this.tempQuat)
      }
    }
  }

  /**
   * Reset all spring bones to their initial state
   */
  reset() {
    for (const spring of this.springBones) {
      spring.bone.quaternion.copy(spring.initialLocalQuaternion)
      spring.currentVelocity.set(0, 0, 0, 1)
    }
  }

  /**
   * Clear all spring bones
   */
  clear() {
    this.springBones = []
  }

  /**
   * Get count of spring bones
   */
  get count() {
    return this.springBones.length
  }
}

/**
 * Simpler approach: Secondary motion using velocity-based lag
 * This creates a "follow with delay" effect without complex physics
 */
export class SimpleSpringBones {
  private bones: {
    bone: THREE.Bone
    prevWorldQuat: THREE.Quaternion
    velocity: THREE.Vector3
  }[] = []

  addBones(root: THREE.Object3D, patterns: string[]) {
    root.traverse((node) => {
      if (node instanceof THREE.Bone) {
        const nameLower = node.name.toLowerCase()
        if (patterns.some(p => nameLower.includes(p.toLowerCase()))) {
          // Get initial world quaternion
          const worldQuat = new THREE.Quaternion()
          node.getWorldQuaternion(worldQuat)

          this.bones.push({
            bone: node,
            prevWorldQuat: worldQuat,
            velocity: new THREE.Vector3()
          })
          console.log(`[SimpleSpring] Added: ${node.name}`)
        }
      }
    })
    console.log(`[SimpleSpring] Total: ${this.bones.length} bones`)
  }

  update(deltaTime: number, stiffness = 0.1, damping = 0.8) {
    const dt = Math.min(deltaTime, 0.033)

    for (const entry of this.bones) {
      const { bone, prevWorldQuat, velocity } = entry

      // Get current world quaternion from animation
      const currentWorldQuat = new THREE.Quaternion()
      bone.getWorldQuaternion(currentWorldQuat)

      // Calculate angular difference
      const diff = new THREE.Quaternion()
      diff.copy(prevWorldQuat).invert().multiply(currentWorldQuat)

      // Convert to axis-angle for velocity
      const axis = new THREE.Vector3()
      const angle = 2 * Math.acos(Math.min(1, Math.abs(diff.w)))
      if (angle > 0.001) {
        axis.set(diff.x, diff.y, diff.z).normalize()

        // Add to velocity (spring force)
        velocity.addScaledVector(axis, angle * stiffness)
      }

      // Apply damping
      velocity.multiplyScalar(damping)

      // Apply velocity as additional rotation
      if (velocity.length() > 0.001) {
        const additionalRot = new THREE.Quaternion()
        additionalRot.setFromAxisAngle(velocity.clone().normalize(), velocity.length() * dt)
        bone.quaternion.multiply(additionalRot)
      }

      // Store for next frame
      bone.getWorldQuaternion(prevWorldQuat)
    }
  }

  clear() {
    this.bones = []
  }
}
