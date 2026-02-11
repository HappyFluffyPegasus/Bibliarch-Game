/**
 * Scene types for the scene authoring system.
 * Defines camera keyframes, scene characters, and dialogue.
 */

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
// CAMERA KEYFRAMES
// ============================================================

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export interface CameraKeyframe {
  id: string
  time: number  // Seconds from scene start
  position: [number, number, number]
  rotation: [number, number, number]  // Euler XYZ in radians
  fov: number
  easing: EasingType
}

// ============================================================
// SCENE
// ============================================================

export interface Scene {
  id: string
  title: string
  characters: SceneCharacter[]
  dialogue: DialogueLine[]
  duration: number  // Total duration in seconds

  // World backdrop (Phase 3)
  locationId?: string  // Reference to WorldLocation.id

  // Camera animation (Phase 4)
  cameraKeyframes?: CameraKeyframe[]

  // Timeline linking
  linkedTimelineEventId?: string
}

// ============================================================
// GIZMO/TRANSFORM STATE
// ============================================================

export type TransformGizmoMode = 'translate' | 'rotate' | 'scale'
