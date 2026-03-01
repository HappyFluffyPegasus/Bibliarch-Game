/**
 * Centralized selection engine for the item editor.
 * Handles click, shift-click, box select, loop select, linked select,
 * grow/shrink, hover detection, and selection queries.
 */

import { useRef, useCallback, useState, useMemo } from 'react'
import { Vector3 } from '@babylonjs/core'
import { ItemVertex, ItemFace } from '@/types/items'
import {
  buildAdjacency,
  findEdgeLoop,
  findLinkedVertices,
  growSelection as topoGrow,
  shrinkSelection as topoShrink,
  getVerticesFromFaces,
  edgeKeyStr,
  type AdjacencyData,
} from '@/lib/items/meshTopology'
import { extractEdges, type Edge } from '@/utils/itemMeshUtils'

export type EditMode = 'vertex' | 'edge' | 'face'

export interface HoverInfo {
  type: 'vertex' | 'edge' | 'face'
  index: number
}

export interface UseItemSelectionReturn {
  // Selection state
  selectedVertices: number[]
  selectedEdges: number[]
  selectedFaces: number[]
  hovered: HoverInfo | null

  // Selection actions
  selectVertex: (index: number, additive: boolean) => void
  selectEdge: (index: number, additive: boolean) => void
  selectFace: (index: number, additive: boolean) => void
  toggleSelectAll: (mode: EditMode, vertices: ItemVertex[], faces: ItemFace[]) => void
  boxSelect: (indices: number[], mode: EditMode, additive: boolean) => void
  loopSelect: (index: number, mode: EditMode, faces: ItemFace[]) => void
  selectLinked: (index: number, vertices: ItemVertex[], faces: ItemFace[]) => void
  growSelectionAction: (vertices: ItemVertex[], faces: ItemFace[]) => void
  shrinkSelectionAction: (vertices: ItemVertex[], faces: ItemFace[]) => void
  setHovered: (info: HoverInfo | null) => void
  clearSelection: () => void
  setSelectedVertices: React.Dispatch<React.SetStateAction<number[]>>
  setSelectedFaces: React.Dispatch<React.SetStateAction<number[]>>
  setSelectedEdges: React.Dispatch<React.SetStateAction<number[]>>

  // Selection queries
  getSelectionCentroid: (vertices: ItemVertex[]) => Vector3 | null
  getSelectedVertexIndices: (mode: EditMode, faces: ItemFace[]) => Set<number>

  // Adjacency (rebuilt when mesh changes)
  edges: Edge[]

  // Hidden vertices
  hiddenVertices: Set<number>
  hiddenFaces: Set<number>
  hideSelected: () => void
  unhideAll: () => void
}

export function useItemSelection(): UseItemSelectionReturn {
  const [selectedVertices, setSelectedVertices] = useState<number[]>([])
  const [selectedEdges, setSelectedEdges] = useState<number[]>([])
  const [selectedFaces, setSelectedFaces] = useState<number[]>([])
  const [hovered, setHovered] = useState<HoverInfo | null>(null)
  const [hiddenVertices, setHiddenVertices] = useState<Set<number>>(new Set())
  const [hiddenFaces, setHiddenFaces] = useState<Set<number>>(new Set())

  const edgesRef = useRef<Edge[]>([])

  // Single vertex select
  const selectVertex = useCallback((index: number, additive: boolean) => {
    if (additive) {
      setSelectedVertices((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      )
    } else {
      setSelectedVertices([index])
    }
  }, [])

  // Single edge select
  const selectEdge = useCallback((index: number, additive: boolean) => {
    if (additive) {
      setSelectedEdges((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      )
    } else {
      setSelectedEdges([index])
    }
  }, [])

  // Single face select
  const selectFace = useCallback((index: number, additive: boolean) => {
    if (additive) {
      setSelectedFaces((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      )
    } else {
      setSelectedFaces([index])
    }
  }, [])

  // Toggle select all / none (A key)
  const toggleSelectAll = useCallback((mode: EditMode, vertices: ItemVertex[], faces: ItemFace[]) => {
    if (mode === 'vertex') {
      setSelectedVertices((prev) => {
        if (prev.length === vertices.length) return []
        return vertices.map((_, i) => i)
      })
    } else if (mode === 'edge') {
      const edges = extractEdges(faces)
      setSelectedEdges((prev) => {
        if (prev.length === edges.length) return []
        return edges.map((_, i) => i)
      })
    } else if (mode === 'face') {
      setSelectedFaces((prev) => {
        if (prev.length === faces.length) return []
        return faces.map((_, i) => i)
      })
    }
  }, [])

  // Box select — receives indices from 2D projection test
  const boxSelect = useCallback((indices: number[], mode: EditMode, additive: boolean) => {
    if (mode === 'vertex') {
      if (additive) {
        setSelectedVertices((prev) => [...new Set([...prev, ...indices])])
      } else {
        setSelectedVertices(indices)
      }
    } else if (mode === 'edge') {
      if (additive) {
        setSelectedEdges((prev) => [...new Set([...prev, ...indices])])
      } else {
        setSelectedEdges(indices)
      }
    } else if (mode === 'face') {
      if (additive) {
        setSelectedFaces((prev) => [...new Set([...prev, ...indices])])
      } else {
        setSelectedFaces(indices)
      }
    }
  }, [])

  // Loop select (Alt+click)
  const loopSelect = useCallback((index: number, mode: EditMode, faces: ItemFace[]) => {
    const edges = extractEdges(faces)
    const adjacency = buildAdjacency([], faces) // vertices not needed for edge loop

    if (mode === 'edge' && edges[index]) {
      const edge = edges[index]
      const ek = edgeKeyStr(edge.a, edge.b)

      // Rebuild adjacency with proper vertex count
      const maxVert = Math.max(...faces.flatMap((f) => f.vertexIndices)) + 1
      const dummyVerts: ItemVertex[] = Array.from({ length: maxVert }, () => ({ position: [0, 0, 0] }))
      const fullAdj = buildAdjacency(dummyVerts, faces)

      const loop = findEdgeLoop(ek, faces, fullAdj)

      // Map loop edge keys back to edge indices
      const loopIndices: number[] = []
      for (const lek of loop) {
        const ei = edges.findIndex((e) => edgeKeyStr(e.a, e.b) === lek)
        if (ei !== -1) loopIndices.push(ei)
      }
      setSelectedEdges(loopIndices)
    } else if (mode === 'vertex') {
      // Select edge loop vertices
      if (edges[index]) {
        const edge = edges[index]
        const ek = edgeKeyStr(edge.a, edge.b)
        const maxVert = Math.max(...faces.flatMap((f) => f.vertexIndices)) + 1
        const dummyVerts: ItemVertex[] = Array.from({ length: maxVert }, () => ({ position: [0, 0, 0] }))
        const fullAdj = buildAdjacency(dummyVerts, faces)
        const loop = findEdgeLoop(ek, faces, fullAdj)

        const vertSet = new Set<number>()
        for (const lek of loop) {
          const [a, b] = lek.split('-').map(Number)
          vertSet.add(a)
          vertSet.add(b)
        }
        setSelectedVertices(Array.from(vertSet))
      }
    }
  }, [])

  // Select linked (L key) — flood fill
  const selectLinked = useCallback((index: number, vertices: ItemVertex[], faces: ItemFace[]) => {
    const adjacency = buildAdjacency(vertices, faces)
    const linked = findLinkedVertices(index, adjacency)
    setSelectedVertices(Array.from(linked))
  }, [])

  // Grow selection (Ctrl+Numpad+)
  const growSelectionAction = useCallback((vertices: ItemVertex[], faces: ItemFace[]) => {
    setSelectedVertices((prev) => {
      const adjacency = buildAdjacency(vertices, faces)
      const grown = topoGrow(new Set(prev), adjacency)
      return Array.from(grown)
    })
  }, [])

  // Shrink selection (Ctrl+Numpad-)
  const shrinkSelectionAction = useCallback((vertices: ItemVertex[], faces: ItemFace[]) => {
    setSelectedVertices((prev) => {
      const adjacency = buildAdjacency(vertices, faces)
      const shrunk = topoShrink(new Set(prev), adjacency)
      return Array.from(shrunk)
    })
  }, [])

  // Clear all selection
  const clearSelection = useCallback(() => {
    setSelectedVertices([])
    setSelectedEdges([])
    setSelectedFaces([])
  }, [])

  // Get centroid of selected vertices (for transform pivot)
  const getSelectionCentroid = useCallback((vertices: ItemVertex[]): Vector3 | null => {
    const sel = selectedVertices
    if (sel.length === 0) return null

    const center = new Vector3(0, 0, 0)
    let count = 0
    for (const vi of sel) {
      const pos = vertices[vi]?.position
      if (pos) {
        center.addInPlace(new Vector3(pos[0], pos[1], pos[2]))
        count++
      }
    }
    if (count === 0) return null
    center.scaleInPlace(1 / count)
    return center
  }, [selectedVertices])

  // Resolve current selection to affected vertex indices
  const getSelectedVertexIndices = useCallback((mode: EditMode, faces: ItemFace[]): Set<number> => {
    if (mode === 'vertex') {
      return new Set(selectedVertices)
    } else if (mode === 'edge') {
      const edges = extractEdges(faces)
      const verts = new Set<number>()
      for (const ei of selectedEdges) {
        const edge = edges[ei]
        if (edge) {
          verts.add(edge.a)
          verts.add(edge.b)
        }
      }
      return verts
    } else {
      return getVerticesFromFaces(selectedFaces, faces)
    }
  }, [selectedVertices, selectedEdges, selectedFaces])

  // Hide/unhide
  const hideSelected = useCallback(() => {
    setHiddenVertices((prev) => {
      const next = new Set(prev)
      for (const vi of selectedVertices) next.add(vi)
      return next
    })
    setHiddenFaces((prev) => {
      const next = new Set(prev)
      for (const fi of selectedFaces) next.add(fi)
      return next
    })
    setSelectedVertices([])
    setSelectedFaces([])
    setSelectedEdges([])
  }, [selectedVertices, selectedFaces])

  const unhideAll = useCallback(() => {
    setHiddenVertices(new Set())
    setHiddenFaces(new Set())
  }, [])

  return {
    selectedVertices,
    selectedEdges,
    selectedFaces,
    hovered,
    selectVertex,
    selectEdge,
    selectFace,
    toggleSelectAll,
    boxSelect,
    loopSelect,
    selectLinked,
    growSelectionAction,
    shrinkSelectionAction,
    setHovered,
    clearSelection,
    setSelectedVertices,
    setSelectedFaces,
    setSelectedEdges,
    getSelectionCentroid,
    getSelectedVertexIndices,
    edges: edgesRef.current,
    hiddenVertices,
    hiddenFaces,
    hideSelected,
    unhideAll,
  }
}
