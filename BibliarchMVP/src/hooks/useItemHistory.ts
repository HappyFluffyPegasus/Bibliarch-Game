/**
 * Undo/redo command stack for item mesh editing.
 * Stores before/after snapshots of vertices+faces, max 50 steps.
 * Uses refs to avoid re-renders — exposes canUndo/canRedo as state for toolbar.
 */

import { useRef, useCallback, useState } from 'react'
import { ItemVertex, ItemFace, CustomItem } from '@/types/items'

interface HistoryCommand {
  label: string
  before: { vertices: ItemVertex[]; faces: ItemFace[] }
  after: { vertices: ItemVertex[]; faces: ItemFace[] }
}

const MAX_HISTORY = 50

export interface UseItemHistoryReturn {
  /** Push a new edit — captures 'before' from current item, applies 'after' via onUpdateItem */
  pushEdit: (label: string, newVertices: ItemVertex[], newFaces: ItemFace[]) => void
  /** Undo the last edit */
  undo: () => void
  /** Redo the last undone edit */
  redo: () => void
  /** Whether undo is available */
  canUndo: boolean
  /** Whether redo is available */
  canRedo: boolean
}

export function useItemHistory(
  itemRef: React.RefObject<CustomItem>,
  onUpdateItem: (updates: Partial<CustomItem>) => void
): UseItemHistoryReturn {
  const undoStackRef = useRef<HistoryCommand[]>([])
  const redoStackRef = useRef<HistoryCommand[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const updateFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(redoStackRef.current.length > 0)
  }, [])

  const pushEdit = useCallback((
    label: string,
    newVertices: ItemVertex[],
    newFaces: ItemFace[]
  ) => {
    const current = itemRef.current
    if (!current) return

    const command: HistoryCommand = {
      label,
      before: {
        vertices: current.vertices.map((v) => ({ position: [...v.position] as [number, number, number] })),
        faces: current.faces.map((f) => ({ vertexIndices: [...f.vertexIndices], color: f.color })),
      },
      after: {
        vertices: newVertices.map((v) => ({ position: [...v.position] as [number, number, number] })),
        faces: newFaces.map((f) => ({ vertexIndices: [...f.vertexIndices], color: f.color })),
      },
    }

    undoStackRef.current.push(command)
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift()
    }

    // Clear redo stack on new edit
    redoStackRef.current = []

    onUpdateItem({ vertices: newVertices, faces: newFaces })
    updateFlags()
  }, [itemRef, onUpdateItem, updateFlags])

  const undo = useCallback(() => {
    const command = undoStackRef.current.pop()
    if (!command) return

    redoStackRef.current.push(command)

    // Restore deep copies
    const vertices = command.before.vertices.map((v) => ({ position: [...v.position] as [number, number, number] }))
    const faces = command.before.faces.map((f) => ({ vertexIndices: [...f.vertexIndices], color: f.color }))
    onUpdateItem({ vertices, faces })
    updateFlags()
  }, [onUpdateItem, updateFlags])

  const redo = useCallback(() => {
    const command = redoStackRef.current.pop()
    if (!command) return

    undoStackRef.current.push(command)

    const vertices = command.after.vertices.map((v) => ({ position: [...v.position] as [number, number, number] }))
    const faces = command.after.faces.map((f) => ({ vertexIndices: [...f.vertexIndices], color: f.color }))
    onUpdateItem({ vertices, faces })
    updateFlags()
  }, [onUpdateItem, updateFlags])

  return { pushEdit, undo, redo, canUndo, canRedo }
}
