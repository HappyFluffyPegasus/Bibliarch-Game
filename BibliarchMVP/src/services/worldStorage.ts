/**
 * IndexedDB-based world storage.
 *
 * localStorage has a ~5 MB quota which terrain data easily exceeds.
 * IndexedDB supports hundreds of MB and structured-clone, so typed
 * arrays (Float32Array, Uint8Array) are stored natively without
 * JSON-stringify overhead.
 */

const DB_NAME = 'bibliarch'
const DB_VERSION = 1
const STORE_NAME = 'worlds'

/** Persistent singleton IDB connection — avoids per-op open/close overhead */
let dbInstance: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => {
      dbInstance = request.result
      dbInstance.onclose = () => { dbInstance = null }
      resolve(dbInstance)
    }
    request.onerror = () => reject(request.error)
  })
}

/** Store a value in IndexedDB under the given key. */
export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Retrieve a value from IndexedDB. Returns undefined if not found. */
export async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

/** Delete a key from IndexedDB. */
export async function idbDelete(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ============================================================
// HIERARCHICAL WORLD: Per-Node Storage
// ============================================================
//
// Metadata key:  "bibliarch-hw-{storyId}"       → hierarchy structure (nodes sans terrain)
// Per-node key:  "bibliarch-node-{storyId}-{nodeId}" → full serialized node with terrain
//

import {
  SerializedHierarchicalWorld,
  SerializedWorldNode,
  serializeTerrainForIDB,
  IDBTerrainData,
} from '@/types/world'

/** Save the full hierarchy metadata (without terrain data in each node) */
export async function saveHierarchyMeta(
  storyId: string,
  hw: SerializedHierarchicalWorld
): Promise<void> {
  // Strip terrain from nodes to keep the metadata key small
  const meta = {
    ...hw,
    nodes: Object.fromEntries(
      Object.entries(hw.nodes).map(([id, node]) => [
        id,
        {
          ...node,
          terrain: { size: node.terrain.size, sizeZ: node.terrain.sizeZ, cellSize: node.terrain.cellSize, heights: [], materials: [], seaLevel: node.terrain.seaLevel, maxHeight: node.terrain.maxHeight },
        },
      ])
    ),
  }
  await idbSet(`bibliarch-hw-${storyId}`, meta)
}

/** Load hierarchy metadata */
export async function loadHierarchyMeta(
  storyId: string
): Promise<SerializedHierarchicalWorld | undefined> {
  return idbGet<SerializedHierarchicalWorld>(`bibliarch-hw-${storyId}`)
}

/** Save a single node's full data (including terrain).
 *  Uses IDB-native typed arrays for terrain to avoid memory-doubling from Array.from(). */
export async function saveNodeData(
  storyId: string,
  node: SerializedWorldNode
): Promise<void> {
  // Store terrain as native typed arrays via structured clone (IndexedDB handles this natively)
  const idbNode = {
    ...node,
    terrain: {
      size: node.terrain.size,
      sizeZ: node.terrain.sizeZ,
      cellSize: node.terrain.cellSize,
      // Convert number[] back to typed arrays for IDB storage
      heights: node.terrain.heights instanceof Float32Array
        ? node.terrain.heights
        : new Float32Array(node.terrain.heights),
      materials: node.terrain.materials instanceof Uint8Array
        ? node.terrain.materials
        : new Uint8Array(node.terrain.materials),
      seaLevel: node.terrain.seaLevel,
      maxHeight: node.terrain.maxHeight,
    },
  }
  await idbSet(`bibliarch-node-${storyId}-${node.id}`, idbNode)
}

/** Load a single node's full data.
 *  Handles both IDB-native typed arrays and legacy number[] terrain formats. */
export async function loadNodeData(
  storyId: string,
  nodeId: string
): Promise<SerializedWorldNode | undefined> {
  const data = await idbGet<SerializedWorldNode>(`bibliarch-node-${storyId}-${nodeId}`)
  if (!data) return undefined

  // Normalize terrain: IDB may have stored typed arrays directly
  if (data.terrain) {
    const t = data.terrain as any
    if (t.heights instanceof Float32Array) {
      t.heights = Array.from(t.heights as Float32Array)
    }
    if (t.materials instanceof Uint8Array) {
      t.materials = Array.from(t.materials as Uint8Array)
    }
  }
  return data
}

/** Delete a node's stored data */
export async function deleteNodeData(
  storyId: string,
  nodeId: string
): Promise<void> {
  await idbDelete(`bibliarch-node-${storyId}-${nodeId}`)
}

/** Delete the entire hierarchy metadata */
export async function deleteHierarchyMeta(storyId: string): Promise<void> {
  await idbDelete(`bibliarch-hw-${storyId}`)
}
