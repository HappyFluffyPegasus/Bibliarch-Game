/**
 * Animation Catalog - Defines available poses, emotions, and animation clips.
 * Used by the scene editor to select animations for characters.
 */

export interface AnimationEntry {
  id: string
  name: string
  path: string | null  // null for morph-target emotions or built-in poses
  type: 'pose' | 'emotion' | 'clip'
  category: string
  duration?: number  // Duration in seconds (for clips)
  looping?: boolean  // Whether the animation loops
  thumbnail?: string  // Optional thumbnail image path
}

// ============================================================
// POSES - Static body positions (can be combined with emotions)
// ============================================================

export const POSES: AnimationEntry[] = [
  // Idle poses
  { id: 'idle-neutral', name: 'Neutral', path: null, type: 'pose', category: 'idle' },
  { id: 'idle-relaxed', name: 'Relaxed', path: null, type: 'pose', category: 'idle' },
  { id: 'idle-confident', name: 'Confident', path: null, type: 'pose', category: 'idle' },
  { id: 'idle-crossed-arms', name: 'Crossed Arms', path: null, type: 'pose', category: 'idle' },
  { id: 'idle-hands-hips', name: 'Hands on Hips', path: null, type: 'pose', category: 'idle' },

  // Conversational poses
  { id: 'talking-gesture', name: 'Gesturing', path: null, type: 'pose', category: 'talking' },
  { id: 'talking-thinking', name: 'Thinking', path: null, type: 'pose', category: 'talking' },
  { id: 'talking-explaining', name: 'Explaining', path: null, type: 'pose', category: 'talking' },

  // Action poses
  { id: 'action-pointing', name: 'Pointing', path: null, type: 'pose', category: 'action' },
  { id: 'action-waving', name: 'Waving', path: null, type: 'pose', category: 'action' },
  { id: 'action-shrugging', name: 'Shrugging', path: null, type: 'pose', category: 'action' },

  // Emotional poses
  { id: 'pose-sad', name: 'Sad Stance', path: null, type: 'pose', category: 'emotional' },
  { id: 'pose-defensive', name: 'Defensive', path: null, type: 'pose', category: 'emotional' },
  { id: 'pose-defeated', name: 'Defeated', path: '/animations/Defeated.fbx', type: 'pose', category: 'emotional' },
]

// ============================================================
// EMOTIONS - Facial expressions via morph targets
// ============================================================

export const EMOTIONS: AnimationEntry[] = [
  // Positive emotions
  { id: 'happy', name: 'Happy', path: null, type: 'emotion', category: 'positive' },
  { id: 'joyful', name: 'Joyful', path: null, type: 'emotion', category: 'positive' },
  { id: 'smiling', name: 'Smiling', path: null, type: 'emotion', category: 'positive' },
  { id: 'excited', name: 'Excited', path: null, type: 'emotion', category: 'positive' },

  // Negative emotions
  { id: 'sad', name: 'Sad', path: null, type: 'emotion', category: 'negative' },
  { id: 'angry', name: 'Angry', path: null, type: 'emotion', category: 'negative' },
  { id: 'frustrated', name: 'Frustrated', path: null, type: 'emotion', category: 'negative' },
  { id: 'disappointed', name: 'Disappointed', path: null, type: 'emotion', category: 'negative' },

  // Neutral emotions
  { id: 'neutral', name: 'Neutral', path: null, type: 'emotion', category: 'neutral' },
  { id: 'surprised', name: 'Surprised', path: null, type: 'emotion', category: 'neutral' },
  { id: 'confused', name: 'Confused', path: null, type: 'emotion', category: 'neutral' },
  { id: 'thoughtful', name: 'Thoughtful', path: null, type: 'emotion', category: 'neutral' },

  // Complex emotions
  { id: 'embarrassed', name: 'Embarrassed', path: null, type: 'emotion', category: 'complex' },
  { id: 'nervous', name: 'Nervous', path: null, type: 'emotion', category: 'complex' },
  { id: 'determined', name: 'Determined', path: null, type: 'emotion', category: 'complex' },
  { id: 'skeptical', name: 'Skeptical', path: null, type: 'emotion', category: 'complex' },
]

// ============================================================
// ANIMATION CLIPS - Full body animations from FBX files
// ============================================================

export const ANIMATION_CLIPS: AnimationEntry[] = [
  // Dance animations
  {
    id: 'hip-hop',
    name: 'Hip Hop',
    path: '/animations/Hip Hop Dancing (1).fbx',
    type: 'clip',
    category: 'dance',
    looping: true
  },

  // Action animations
  {
    id: 'body-block',
    name: 'Body Block',
    path: '/animations/Body Block.fbx',
    type: 'clip',
    category: 'action',
    looping: false
  },

  // Idle animations (looping)
  {
    id: 'breathing-idle',
    name: 'Breathing Idle',
    path: '/animations/Breathing Idle.fbx',
    type: 'clip',
    category: 'idle',
    looping: true
  },

  // Conversational animations
  {
    id: 'talking-1',
    name: 'Talking',
    path: '/animations/Talking.fbx',
    type: 'clip',
    category: 'talking',
    looping: true
  },
]

// ============================================================
// COMBINED CATALOG
// ============================================================

export const ANIMATION_CATALOG: AnimationEntry[] = [
  ...POSES,
  ...EMOTIONS,
  ...ANIMATION_CLIPS,
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get animations by type
 */
export function getAnimationsByType(type: 'pose' | 'emotion' | 'clip'): AnimationEntry[] {
  return ANIMATION_CATALOG.filter(a => a.type === type)
}

/**
 * Get animations by category
 */
export function getAnimationsByCategory(category: string): AnimationEntry[] {
  return ANIMATION_CATALOG.filter(a => a.category === category)
}

/**
 * Get animation by ID
 */
export function getAnimationById(id: string): AnimationEntry | undefined {
  return ANIMATION_CATALOG.find(a => a.id === id)
}

/**
 * Get unique categories for a type
 */
export function getCategoriesForType(type: 'pose' | 'emotion' | 'clip'): string[] {
  const animations = getAnimationsByType(type)
  return [...new Set(animations.map(a => a.category))]
}

/**
 * Emotion to morph target mapping
 * Maps emotion IDs to specific morph target values
 */
export const EMOTION_MORPH_TARGETS: Record<string, Record<string, number>> = {
  'happy': {
    'Body:Smile': 0.8,
    'Body:EyesClosed': 0.2,
  },
  'sad': {
    'Body:Frown': 0.7,
    'Body:EyebrowsSad': 0.6,
  },
  'angry': {
    'Body:Frown': 0.9,
    'Body:EyebrowsAngry': 0.8,
  },
  'surprised': {
    'Body:MouthOpen': 0.5,
    'Body:EyebrowsRaised': 0.7,
  },
  'neutral': {
    // Reset all to 0
  },
  // Add more emotion mappings as needed
}
