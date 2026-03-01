export interface AnimationData {
  id: string
  name: string
  path: string
}

// Available poses/animations
export const AVAILABLE_POSES: AnimationData[] = [
  { id: 'hip-hop', name: 'Hip Hop Dancing', path: '/animations/Hip Hop Dancing (1).fbx' },
  { id: 'body-block', name: 'Body Block', path: '/animations/Body Block.fbx' }
]
