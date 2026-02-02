export interface AnimationData {
  id: string
  name: string
  path: string
}

// Available poses/animations
export const AVAILABLE_POSES: AnimationData[] = [
  { id: 'defeated', name: 'Defeated', path: '/animations/Defeated.fbx' }
]
