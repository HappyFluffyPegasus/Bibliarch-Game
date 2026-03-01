import {
  Bone,
  Skeleton,
  Quaternion,
  Vector3,
  TransformNode,
  type AbstractMesh,
} from '@babylonjs/core'

interface SpringBone {
  bone: Bone
  parentBone: Bone | null
  initialLocalQuaternion: Quaternion
  currentVelocity: Quaternion
  stiffness: number
  damping: number
}

export class SpringBoneSystem {
  private springBones: SpringBone[] = []
  private tempQuat = new Quaternion()
  private tempQuat2 = new Quaternion()

  constructor() {}

  /**
   * Add bones to the spring system from a skeleton
   */
  addBonesFromSkeleton(
    skeleton: Skeleton,
    bonePatterns: string[],
    stiffness: number = 0.3,
    damping: number = 0.6
  ) {
    for (const bone of skeleton.bones) {
      const nameLower = bone.name.toLowerCase()
      const isSpringBone = bonePatterns.some(pattern =>
        nameLower.includes(pattern.toLowerCase())
      )

      if (isSpringBone) {
        const parentBone = bone.getParent()

        this.springBones.push({
          bone,
          parentBone: parentBone as Bone | null,
          initialLocalQuaternion: bone.getRotationQuaternion().clone(),
          currentVelocity: new Quaternion(0, 0, 0, 1),
          stiffness,
          damping,
        })

        console.log(`[SpringBone] Added: ${bone.name}`)
      }
    }

    console.log(`[SpringBone] Total spring bones: ${this.springBones.length}`)
  }

  /**
   * Add bones from a mesh hierarchy (for non-skeleton bones)
   */
  addBones(
    root: TransformNode,
    bonePatterns: string[],
    stiffness: number = 0.3,
    damping: number = 0.6
  ) {
    // Check if the root has a skeleton
    const meshes = root.getChildMeshes(false)
    for (const mesh of meshes) {
      if ((mesh as any).skeleton) {
        this.addBonesFromSkeleton((mesh as any).skeleton, bonePatterns, stiffness, damping)
        return
      }
    }

    // Fallback: traverse transform nodes looking for bone-like names
    const traverse = (node: TransformNode) => {
      const nameLower = node.name.toLowerCase()
      const isSpringBone = bonePatterns.some(pattern =>
        nameLower.includes(pattern.toLowerCase())
      )

      if (isSpringBone) {
        // This path won't have Bone objects, but we can still track transform nodes
        console.log(`[SpringBone] Found transform node: ${node.name} (no skeleton)`)
      }

      for (const child of node.getChildren()) {
        if (child instanceof TransformNode) {
          traverse(child)
        }
      }
    }
    traverse(root)
  }

  /**
   * Update spring bones - call this each frame after animation update
   */
  update(deltaTime: number) {
    const dt = Math.min(deltaTime, 0.05)

    for (const spring of this.springBones) {
      const { bone, initialLocalQuaternion, stiffness, damping } = spring

      // Get current rotation as target
      this.tempQuat.copyFrom(bone.getRotationQuaternion())

      // Slerp current velocity toward target
      Quaternion.SlerpToRef(spring.currentVelocity, this.tempQuat, stiffness * dt * 60, spring.currentVelocity)

      // Apply damping toward rest pose
      Quaternion.SlerpToRef(spring.currentVelocity, initialLocalQuaternion, (1 - damping) * dt * 10, spring.currentVelocity)
    }
  }

  /**
   * Apply gravity/pendulum effect to hair bones
   */
  applyGravity(
    root: TransformNode,
    gravityStrength: number = 0.02,
    deltaTime: number
  ) {
    const dt = Math.min(deltaTime, 0.05)

    for (const spring of this.springBones) {
      const { bone } = spring

      // Apply subtle gravity rotation
      const gravX = 0 * dt
      const gravZ = -gravityStrength * dt

      const gravQuat = Quaternion.FromEulerAngles(gravZ, 0, -gravX)
      const current = bone.getRotationQuaternion()
      current.multiplyInPlace(gravQuat)
      bone.setRotationQuaternion(current)
    }
  }

  reset() {
    for (const spring of this.springBones) {
      spring.bone.setRotationQuaternion(spring.initialLocalQuaternion.clone())
      spring.currentVelocity = new Quaternion(0, 0, 0, 1)
    }
  }

  clear() {
    this.springBones = []
  }

  get count() {
    return this.springBones.length
  }
}

/**
 * Simpler secondary motion using velocity-based lag
 */
export class SimpleSpringBones {
  private bones: {
    bone: Bone
    prevWorldQuat: Quaternion
    velocity: Vector3
  }[] = []

  addBonesFromSkeleton(skeleton: Skeleton, patterns: string[]) {
    for (const bone of skeleton.bones) {
      const nameLower = bone.name.toLowerCase()
      if (patterns.some(p => nameLower.includes(p.toLowerCase()))) {
        const worldQuat = bone.getRotationQuaternion().clone()

        this.bones.push({
          bone,
          prevWorldQuat: worldQuat,
          velocity: Vector3.Zero(),
        })
        console.log(`[SimpleSpring] Added: ${bone.name}`)
      }
    }
    console.log(`[SimpleSpring] Total: ${this.bones.length} bones`)
  }

  update(deltaTime: number, stiffness = 0.1, damping = 0.8) {
    const dt = Math.min(deltaTime, 0.033)

    for (const entry of this.bones) {
      const { bone, prevWorldQuat, velocity } = entry

      const currentWorldQuat = bone.getRotationQuaternion().clone()

      // Calculate angular difference
      const diff = prevWorldQuat.conjugate().multiply(currentWorldQuat)

      // Convert to axis-angle for velocity
      const angle = 2 * Math.acos(Math.min(1, Math.abs(diff.w)))
      if (angle > 0.001) {
        const axis = new Vector3(diff.x, diff.y, diff.z).normalize()
        velocity.addInPlace(axis.scale(angle * stiffness))
      }

      // Apply damping
      velocity.scaleInPlace(damping)

      // Apply velocity as additional rotation
      if (velocity.length() > 0.001) {
        const additionalRot = Quaternion.RotationAxis(velocity.clone().normalize(), velocity.length() * dt)
        const current = bone.getRotationQuaternion()
        current.multiplyInPlace(additionalRot)
        bone.setRotationQuaternion(current)
      }

      // Store for next frame
      entry.prevWorldQuat = bone.getRotationQuaternion().clone()
    }
  }

  clear() {
    this.bones = []
  }
}
