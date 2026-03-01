/**
 * Scene types for the scene authoring system.
 * Defines camera keyframes, scene characters, and dialogue.
 */

// ============================================================
// COMMON TYPES
// ============================================================

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export type TransformGizmoMode = 'translate' | 'rotate' | 'scale'

// ============================================================
// CHARACTER ANIMATION STATE
// ============================================================

export interface CharacterAnimationState {
  basePose: string | null       // Pose preset ID
  emotion: string | null        // Emotion ID (morph targets)
  emotionIntensity: number      // 0-1
  clipAnimation: string | null  // Mixamo clip ID
  clipLoop: boolean
}

// ============================================================
// CHARACTER APPEARANCE DATA
// ============================================================

export interface CategoryColors {
  hair: string
  hairUndertone?: string
  tops: { primary: string; secondary?: string }
  pants: string
  dresses: string
  shoes: string
  socks: string
  accessories: string
  body: { skinTone: string; eyeColor: string }
}

export interface Transform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

/**
 * Full character data as stored in the character creator.
 * Used to render real 3D models in scenes.
 */
export interface CharacterData {
  id: string
  name: string
  visibleAssets: string[]
  colors: CategoryColors
  transforms?: Record<string, Transform>
  heightScale?: number
  morphTargets?: Record<string, number>
}

// ============================================================
// SCENE CHARACTER PLACEMENT
// ============================================================

/**
 * Reference to a character placed in a scene.
 * Contains position/rotation in the scene, not appearance data.
 */
export interface SceneCharacter {
  id: string
  characterId: string  // Reference to CharacterData.id
  name: string
  position: [number, number, number]
  rotation: number  // Y-axis rotation in radians
  animation?: CharacterAnimationState  // Current animation state
}

// ============================================================
// KEYFRAMES
// ============================================================

/**
 * Camera keyframe - position, rotation, FOV at a point in time
 */
export interface CameraKeyframe {
  id: string
  time: number  // Seconds from scene start
  position: [number, number, number]
  rotation: [number, number, number]  // Euler XYZ in radians
  fov: number
  easing: EasingType
}

/**
 * Movement keyframe - character position/rotation at a point in time
 */
export interface MovementKeyframe {
  id: string
  characterId: string  // Which character this keyframe is for
  time: number
  position: [number, number, number]
  rotation: number  // Y-axis rotation
  easing: EasingType
}

/**
 * Animation keyframe - character animation state at a point in time
 */
export interface AnimationKeyframe {
  id: string
  characterId: string
  time: number
  animation: CharacterAnimationState
  easing: EasingType
}

// ============================================================
// DIALOGUE
// ============================================================

export interface DialogueLine {
  id: string
  characterId: string  // Reference to SceneCharacter.id (not CharacterData.id)
  characterName: string
  text: string
  startTime: number  // Seconds from scene start
  duration: number   // Duration in seconds
}

// ============================================================
// SCENE PROPS
// ============================================================

export type PropShape = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'plane' | 'torus'

export interface SceneProp {
  id: string
  name: string
  shape: PropShape
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string // hex color
}

// ============================================================
// SCENE
// ============================================================

export interface Scene {
  id: string
  storyId: string
  title: string
  characters: SceneCharacter[]
  dialogue: DialogueLine[]
  duration: number  // Total duration in seconds

  // World backdrop
  locationId?: string  // Reference to WorldLocation.id

  // Keyframe tracks
  cameraKeyframes?: CameraKeyframe[]
  movementKeyframes?: MovementKeyframe[]
  animationKeyframes?: AnimationKeyframe[]

  // Props
  props?: SceneProp[]

  // Thumbnail
  thumbnail?: string  // Base64 data URL

  // Background music
  backgroundMusic?: string // Preset name or URL

  // Lighting preset
  lightingPreset?: string

  // Timeline linking
  linkedTimelineEventId?: string

  createdAt: Date
  updatedAt: Date
}
