export interface Story {
  id: string
  title: string
  description: string
  coverImage?: string
  createdAt: Date
  updatedAt: Date
}

export interface MasterDoc {
  id: string
  storyId: string
  filename: string
  content: string
  uploadedAt: Date
}

export interface CanvasNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  type: 'text' | 'character' | 'event' | 'location' | 'folder' | 'list' | 'image' | 'table' | 'relationship-canvas' | 'line' | 'compact-text'
  text?: string
  content?: string
  color?: string
  imageUrl?: string
  profileImageUrl?: string
  linkedCanvasId?: string
  parentId?: string
  childIds?: string[]
  zIndex?: number
  // Additional properties as needed
  [key: string]: unknown
}

export interface CanvasConnection {
  id: string
  from: string
  to: string
  type?: 'leads-to' | 'conflicts-with' | 'relates-to' | 'relationship'
  label?: string
}

export interface CanvasData {
  id: string
  storyId: string
  canvasType: string
  nodes: CanvasNode[]
  connections: CanvasConnection[]
}
