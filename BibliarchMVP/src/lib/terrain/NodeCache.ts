import type { SerializedWorldNode } from '@/types/world'

/**
 * LRU cache for serialized world nodes.
 * Prevents redundant IDB reads during navigation.
 */
export class NodeCache {
  private cache = new Map<string, SerializedWorldNode>()
  private order: string[] = []
  private maxSize: number

  constructor(maxSize: number = 5) {
    this.maxSize = maxSize
  }

  get(nodeId: string): SerializedWorldNode | undefined {
    const entry = this.cache.get(nodeId)
    if (entry) {
      // Move to end (most recently used)
      this.order = this.order.filter(id => id !== nodeId)
      this.order.push(nodeId)
    }
    return entry
  }

  set(nodeId: string, data: SerializedWorldNode): void {
    if (this.cache.has(nodeId)) {
      this.order = this.order.filter(id => id !== nodeId)
    } else if (this.order.length >= this.maxSize) {
      // Evict least recently used
      const evicted = this.order.shift()
      if (evicted) this.cache.delete(evicted)
    }
    this.cache.set(nodeId, data)
    this.order.push(nodeId)
  }

  invalidate(nodeId: string): void {
    this.cache.delete(nodeId)
    this.order = this.order.filter(id => id !== nodeId)
  }

  clear(): void {
    this.cache.clear()
    this.order = []
  }
}
