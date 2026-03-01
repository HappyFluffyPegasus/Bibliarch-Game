/**
 * Interactive transform state machine for the item editor.
 *
 * States: idle | grab | rotate | scale | extrude | inset | bevel | loop-cut | knife
 *
 * G/R/S shared behavior:
 * - Mouse movement → world-space delta via plane projection at pivot
 * - X/Y/Z → axis constraint; Shift+X/Y/Z → plane constraint
 * - Digit keys → numeric input override
 * - Ctrl → snap to grid (0.25 default)
 * - Enter/LMB → confirm; Esc/RMB → cancel
 * - Fast path: update VertexData positions directly during drag
 */

import { useRef, useCallback, useState } from 'react'
import {
  Vector2,
  Vector3,
  Matrix,
  Plane,
  Camera,
  Ray,
  Mesh,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core'
import { ItemVertex, ItemFace, CustomItem } from '@/types/items'
import { computeFaceNormal, extrudeFace } from '@/utils/itemMeshUtils'
import { insetFace, bevelEdges, loopCut, subdivide, recalculateNormals } from '@/lib/items/meshOperations'
import { buildAdjacency, edgeKeyStr, findEdgeLoop, findFaceLoop } from '@/lib/items/meshTopology'
import type { UseItemHistoryReturn } from './useItemHistory'
import { extractEdges } from '@/utils/itemMeshUtils'

export type TransformState =
  | 'idle'
  | 'grab'
  | 'rotate'
  | 'scale'
  | 'extrude'
  | 'inset'
  | 'bevel'
  | 'loop-cut'
  | 'knife'

export type AxisConstraint = null | 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz'

export interface KnifePoint {
  position: Vector3
  faceIndex: number
}

export interface LoopCutPreview {
  faceRing: number[]
  edgeKeysPerFace: string[][]
  position: number
  cuts: number
}

export interface UseItemTransformReturn {
  state: TransformState
  axis: AxisConstraint
  numericInput: string
  headerText: string
  controlsDisabled: boolean
  isTransforming: boolean
  loopCutPreview: LoopCutPreview | null
  knifePoints: KnifePoint[]

  // Start methods
  startGrab: () => boolean
  startRotate: () => boolean
  startScale: () => boolean
  startExtrude: () => boolean
  startInset: () => boolean
  startBevel: () => boolean
  startLoopCut: () => boolean
  startKnife: () => void

  // Interaction handlers
  handleMouseMove: (
    mouseNDC: Vector2,
    camera: Camera,
    vertexToBuffer: Map<number, number[]>,
    mesh: Mesh | null
  ) => void
  handleConfirm: () => void
  handleCancel: () => void
  setAxisConstraint: (axis: AxisConstraint) => void
  appendNumericInput: (char: string) => void
  handleScroll: (delta: number) => void
  addKnifePoint: (point: KnifePoint) => void

  // For loop cut hover
  setLoopCutPreview: (preview: LoopCutPreview | null) => void
}

const SNAP_INCREMENT = 0.25

export function useItemTransform(
  itemRef: React.RefObject<CustomItem>,
  selectedVerticesRef: React.RefObject<number[]>,
  selectedFacesRef: React.RefObject<number[]>,
  selectedEdgesRef: React.RefObject<number[]>,
  editModeRef: React.RefObject<string>,
  history: UseItemHistoryReturn,
  getCentroid: (vertices: ItemVertex[]) => Vector3 | null,
  getSelectedVertexIndices: (mode: string, faces: ItemFace[]) => Set<number>,
): UseItemTransformReturn {
  const [state, setState] = useState<TransformState>('idle')
  const [axis, setAxis] = useState<AxisConstraint>(null)
  const [numericInput, setNumericInput] = useState('')
  const [headerText, setHeaderText] = useState('')
  const [loopCutPreview, setLoopCutPreview] = useState<LoopCutPreview | null>(null)
  const [knifePoints, setKnifePoints] = useState<KnifePoint[]>([])

  // Snapshot of vertex positions before transform (for cancel/fast-path delta)
  const snapshotRef = useRef<Map<number, [number, number, number]>>(new Map())
  // The world-space pivot for rotation/scale
  const pivotRef = useRef<Vector3>(new Vector3())
  // The plane used for mouse projection
  const planeRef = useRef<Plane>(new Plane(0, 0, 1, 0))
  // Starting mouse world position (for delta calc)
  const startWorldRef = useRef<Vector3>(new Vector3())
  // Current axis for state ref
  const axisRef = useRef<AxisConstraint>(null)
  const numericRef = useRef('')
  const stateRef = useRef<TransformState>('idle')
  // For bevel: segments count
  const bevelSegmentsRef = useRef(1)
  // For extrude: the face normal
  const extrudeNormalRef = useRef<Vector3>(new Vector3())
  // For scale: initial distance from pivot to mouse
  const scaleStartDistRef = useRef(1)

  const isTransforming = state !== 'idle'
  const controlsDisabled = isTransforming

  // ── Helpers ─────────────────────────────────────────────

  const captureSnapshot = useCallback((vertexIndices: Set<number>) => {
    const item = itemRef.current
    if (!item) return
    const snap = new Map<number, [number, number, number]>()
    for (const vi of vertexIndices) {
      const pos = item.vertices[vi]?.position
      if (pos) snap.set(vi, [...pos])
    }
    snapshotRef.current = snap
  }, [itemRef])

  const setupProjectionPlane = useCallback((pivot: Vector3, camera: Camera) => {
    // Plane perpendicular to camera at pivot
    const camDir = camera.getForwardRay().direction
    planeRef.current = Plane.FromPositionAndNormal(pivot, camDir)
    pivotRef.current.copyFrom(pivot)
  }, [])

  const projectMouseToWorld = useCallback((
    mouseNDC: Vector2,
    camera: Camera
  ): Vector3 | null => {
    // Create a ray from camera through the NDC point
    const scene = camera.getScene()
    if (!scene) return null

    // Convert NDC (-1..1) to screen coordinates
    const engine = scene.getEngine()
    const screenX = (mouseNDC.x + 1) * 0.5 * engine.getRenderWidth()
    const screenY = (-mouseNDC.y + 1) * 0.5 * engine.getRenderHeight()

    const ray = scene.createPickingRay(screenX, screenY, Matrix.Identity(), camera)
    const distance = ray.intersectsPlane(planeRef.current)
    if (distance === null || distance < 0) return null

    return ray.origin.add(ray.direction.scale(distance))
  }, [])

  const applyAxisConstraint = useCallback((delta: Vector3, constraint: AxisConstraint): Vector3 => {
    const result = delta.clone()
    if (constraint === 'x') { result.y = 0; result.z = 0 }
    else if (constraint === 'y') { result.x = 0; result.z = 0 }
    else if (constraint === 'z') { result.x = 0; result.y = 0 }
    else if (constraint === 'xy') { result.z = 0 }
    else if (constraint === 'xz') { result.y = 0 }
    else if (constraint === 'yz') { result.x = 0 }
    return result
  }, [])

  const snapToGrid = useCallback((value: number): number => {
    return Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT
  }, [])

  const updateHeader = useCallback((mode: TransformState, currentAxis: AxisConstraint, numeric: string, delta?: Vector3) => {
    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1)
    const axisLabel = currentAxis ? ` ${currentAxis.toUpperCase()}` : ''
    const numLabel = numeric ? `: ${numeric}` : delta ? `: ${delta.x.toFixed(3)}, ${delta.y.toFixed(3)}, ${delta.z.toFixed(3)}` : ''
    setHeaderText(`${modeLabel}${axisLabel}${numLabel}`)
  }, [])

  // ── Start methods ───────────────────────────────────────

  const startGrab = useCallback((): boolean => {
    const item = itemRef.current
    if (!item) return false
    const mode = editModeRef.current as string
    const affectedVerts = getSelectedVertexIndices(mode, item.faces)
    if (affectedVerts.size === 0) return false

    captureSnapshot(affectedVerts)
    setState('grab')
    stateRef.current = 'grab'
    setAxis(null)
    axisRef.current = null
    setNumericInput('')
    numericRef.current = ''
    updateHeader('grab', null, '')
    return true
  }, [itemRef, editModeRef, getSelectedVertexIndices, captureSnapshot, updateHeader])

  const startRotate = useCallback((): boolean => {
    const item = itemRef.current
    if (!item) return false
    const mode = editModeRef.current as string
    const affectedVerts = getSelectedVertexIndices(mode, item.faces)
    if (affectedVerts.size === 0) return false

    captureSnapshot(affectedVerts)

    // Need pivot for rotation
    const centroid = getCentroid(item.vertices)
    if (!centroid) return false
    pivotRef.current.copyFrom(centroid)

    setState('rotate')
    stateRef.current = 'rotate'
    setAxis(null)
    axisRef.current = null
    setNumericInput('')
    numericRef.current = ''
    updateHeader('rotate', null, '')
    return true
  }, [itemRef, editModeRef, getSelectedVertexIndices, captureSnapshot, getCentroid, updateHeader])

  const startScale = useCallback((): boolean => {
    const item = itemRef.current
    if (!item) return false
    const mode = editModeRef.current as string
    const affectedVerts = getSelectedVertexIndices(mode, item.faces)
    if (affectedVerts.size === 0) return false

    captureSnapshot(affectedVerts)

    const centroid = getCentroid(item.vertices)
    if (!centroid) return false
    pivotRef.current.copyFrom(centroid)
    scaleStartDistRef.current = 1

    setState('scale')
    stateRef.current = 'scale'
    setAxis(null)
    axisRef.current = null
    setNumericInput('')
    numericRef.current = ''
    updateHeader('scale', null, '')
    return true
  }, [itemRef, editModeRef, getSelectedVertexIndices, captureSnapshot, getCentroid, updateHeader])

  const startExtrude = useCallback((): boolean => {
    const item = itemRef.current
    if (!item) return false
    const sel = selectedFacesRef.current
    if (!sel || sel.length === 0) return false

    // Extrude the face first
    const fi = sel[0]
    const face = item.faces[fi]
    if (!face) return false

    const normal = computeFaceNormal(item.vertices, face)
    extrudeNormalRef.current.set(normal[0], normal[1], normal[2])

    const result = extrudeFace(item.vertices, item.faces, fi, 0)

    // The new top face is at the same index (fi), new vertices are at the end
    const newVertIndices = new Set<number>()
    const newTopFace = result.faces[fi]
    for (const vi of newTopFace.vertexIndices) newVertIndices.add(vi)

    // Capture snapshot of the new vertices
    const snap = new Map<number, [number, number, number]>()
    for (const vi of newVertIndices) {
      const pos = result.vertices[vi]?.position
      if (pos) snap.set(vi, [...pos])
    }
    snapshotRef.current = snap

    // Apply the extrude but with 0 distance — user will drag to set distance
    history.pushEdit('Extrude', result.vertices, result.faces)

    setState('extrude')
    stateRef.current = 'extrude'
    setAxis(null)
    axisRef.current = null
    setNumericInput('')
    numericRef.current = ''
    updateHeader('extrude', null, '')
    return true
  }, [itemRef, selectedFacesRef, history, updateHeader])

  const startInset = useCallback((): boolean => {
    const item = itemRef.current
    if (!item) return false
    const sel = selectedFacesRef.current
    if (!sel || sel.length === 0) return false

    // Initial inset with 0 amount
    const fi = sel[0]
    const result = insetFace(item.vertices, item.faces, fi, 0)

    // The inner face vertices are at the end of the vertex array
    const innerCount = item.faces[fi].vertexIndices.length
    const newVertIndices = new Set<number>()
    for (let i = result.vertices.length - innerCount; i < result.vertices.length; i++) {
      newVertIndices.add(i)
    }

    const snap = new Map<number, [number, number, number]>()
    for (const vi of newVertIndices) {
      const pos = result.vertices[vi]?.position
      if (pos) snap.set(vi, [...pos])
    }
    snapshotRef.current = snap

    history.pushEdit('Inset', result.vertices, result.faces)

    setState('inset')
    stateRef.current = 'inset'
    updateHeader('inset', null, '')
    return true
  }, [itemRef, selectedFacesRef, history, updateHeader])

  const startBevel = useCallback((): boolean => {
    const item = itemRef.current
    if (!item) return false
    const sel = selectedEdgesRef.current
    if (!sel || sel.length === 0) return false

    const edges = extractEdges(item.faces)
    const edgeKeys = sel.map((ei) => {
      const e = edges[ei]
      return e ? edgeKeyStr(e.a, e.b) : ''
    }).filter(Boolean)

    if (edgeKeys.length === 0) return false

    bevelSegmentsRef.current = 1

    const result = bevelEdges(item.vertices, item.faces, edgeKeys, 0, 1)
    history.pushEdit('Bevel', result.vertices, result.faces)

    setState('bevel')
    stateRef.current = 'bevel'
    updateHeader('bevel', null, '')
    return true
  }, [itemRef, selectedEdgesRef, history, updateHeader])

  const startLoopCut = useCallback((): boolean => {
    setState('loop-cut')
    stateRef.current = 'loop-cut'
    setLoopCutPreview(null)
    updateHeader('loop-cut', null, '')
    return true
  }, [updateHeader])

  const startKnife = useCallback(() => {
    setState('knife')
    stateRef.current = 'knife'
    setKnifePoints([])
    updateHeader('knife', null, '')
  }, [updateHeader])

  // ── Mouse move handler ──────────────────────────────────

  const handleMouseMove = useCallback((
    mouseNDC: Vector2,
    camera: Camera,
    vertexToBuffer: Map<number, number[]>,
    mesh: Mesh | null
  ) => {
    const currentState = stateRef.current
    if (currentState === 'idle' || currentState === 'loop-cut' || currentState === 'knife') return

    const item = itemRef.current
    if (!item) return

    // Setup plane on first move after start
    if (startWorldRef.current.lengthSquared() === 0) {
      const centroid = getCentroid(item.vertices)
      if (centroid) {
        setupProjectionPlane(centroid, camera)
        const projected = projectMouseToWorld(mouseNDC, camera)
        if (projected) startWorldRef.current.copyFrom(projected)
      }
      return
    }

    const worldPos = projectMouseToWorld(mouseNDC, camera)
    if (!worldPos) return

    const currentAxis = axisRef.current
    const numeric = numericRef.current

    if (currentState === 'grab' || currentState === 'extrude') {
      let delta: Vector3

      if (currentState === 'extrude') {
        // Constrain to face normal
        const normalDelta = worldPos.subtract(startWorldRef.current)
        const dist = Vector3.Dot(normalDelta, extrudeNormalRef.current)
        delta = extrudeNormalRef.current.scale(dist)
      } else {
        delta = worldPos.subtract(startWorldRef.current)
        delta = applyAxisConstraint(delta, currentAxis)
      }

      // Apply numeric override
      if (numeric) {
        const val = parseFloat(numeric)
        if (!isNaN(val)) {
          if (currentAxis === 'x') delta.set(val, 0, 0)
          else if (currentAxis === 'y') delta.set(0, val, 0)
          else if (currentAxis === 'z') delta.set(0, 0, val)
          else delta.set(val, val, val)
        }
      }

      // Fast-path: update mesh positions directly
      const positions = mesh?.getVerticesData(VertexBuffer.PositionKind)

      for (const [vi, origPos] of snapshotRef.current) {
        const newPos: [number, number, number] = [
          origPos[0] + delta.x,
          origPos[1] + delta.y,
          origPos[2] + delta.z,
        ]

        // Update item data (for confirm)
        if (item.vertices[vi]) {
          item.vertices[vi] = { position: newPos }
        }

        // Update mesh positions (fast path — no React re-render)
        if (positions && vertexToBuffer.has(vi)) {
          for (const bufIdx of vertexToBuffer.get(vi)!) {
            positions[bufIdx * 3] = newPos[0]
            positions[bufIdx * 3 + 1] = newPos[1]
            positions[bufIdx * 3 + 2] = newPos[2]
          }
        }
      }

      if (positions && mesh) {
        mesh.updateVerticesData(VertexBuffer.PositionKind, positions)
        // Recompute normals
        const indices = mesh.getIndices()
        if (indices) {
          const normals: number[] = []
          VertexData.ComputeNormals(positions, indices, normals)
          mesh.updateVerticesData(VertexBuffer.NormalKind, normals)
        }
      }

      updateHeader(currentState, currentAxis, numeric, delta)
    } else if (currentState === 'rotate') {
      // Screen-space rotation: angle between start→pivot→current
      const pivot = pivotRef.current
      const startDir = startWorldRef.current.subtract(pivot)
      const currentDir = worldPos.subtract(pivot)

      let angle: number
      if (numeric) {
        angle = (parseFloat(numeric) || 0) * Math.PI / 180
      } else {
        // Compute angle in the projection plane
        angle = Math.atan2(currentDir.z, currentDir.x) - Math.atan2(startDir.z, startDir.x)
      }

      // Determine rotation axis
      let rotAxis = new Vector3(0, 1, 0) // default Y
      if (currentAxis === 'x') rotAxis.set(1, 0, 0)
      else if (currentAxis === 'z') rotAxis.set(0, 0, 1)

      const rotMatrix = Matrix.RotationAxis(rotAxis, angle)

      const positions = mesh?.getVerticesData(VertexBuffer.PositionKind)

      for (const [vi, origPos] of snapshotRef.current) {
        const point = new Vector3(origPos[0], origPos[1], origPos[2])
        point.subtractInPlace(pivot)
        const rotated = Vector3.TransformCoordinates(point, rotMatrix)
        rotated.addInPlace(pivot)

        const newPos: [number, number, number] = [rotated.x, rotated.y, rotated.z]

        if (item.vertices[vi]) {
          item.vertices[vi] = { position: newPos }
        }

        if (positions && vertexToBuffer.has(vi)) {
          for (const bufIdx of vertexToBuffer.get(vi)!) {
            positions[bufIdx * 3] = newPos[0]
            positions[bufIdx * 3 + 1] = newPos[1]
            positions[bufIdx * 3 + 2] = newPos[2]
          }
        }
      }

      if (positions && mesh) {
        mesh.updateVerticesData(VertexBuffer.PositionKind, positions)
        const indices = mesh.getIndices()
        if (indices) {
          const normals: number[] = []
          VertexData.ComputeNormals(positions, indices, normals)
          mesh.updateVerticesData(VertexBuffer.NormalKind, normals)
        }
      }

      const angleDeg = (angle * 180 / Math.PI).toFixed(1)
      updateHeader('rotate', currentAxis, numeric || angleDeg + '\u00B0')
    } else if (currentState === 'scale') {
      const pivot = pivotRef.current
      const startDist = Vector3.Distance(startWorldRef.current, pivot)
      const currentDist = Vector3.Distance(worldPos, pivot)

      let scaleFactor: number
      if (numeric) {
        scaleFactor = parseFloat(numeric) || 1
      } else {
        scaleFactor = startDist > 0.001 ? currentDist / startDist : 1
      }

      // Apply axis constraint to scale
      let sx = scaleFactor, sy = scaleFactor, sz = scaleFactor
      if (currentAxis === 'x') { sy = 1; sz = 1 }
      else if (currentAxis === 'y') { sx = 1; sz = 1 }
      else if (currentAxis === 'z') { sx = 1; sy = 1 }

      const positions = mesh?.getVerticesData(VertexBuffer.PositionKind)

      for (const [vi, origPos] of snapshotRef.current) {
        const newPos: [number, number, number] = [
          pivot.x + (origPos[0] - pivot.x) * sx,
          pivot.y + (origPos[1] - pivot.y) * sy,
          pivot.z + (origPos[2] - pivot.z) * sz,
        ]

        if (item.vertices[vi]) {
          item.vertices[vi] = { position: newPos }
        }

        if (positions && vertexToBuffer.has(vi)) {
          for (const bufIdx of vertexToBuffer.get(vi)!) {
            positions[bufIdx * 3] = newPos[0]
            positions[bufIdx * 3 + 1] = newPos[1]
            positions[bufIdx * 3 + 2] = newPos[2]
          }
        }
      }

      if (positions && mesh) {
        mesh.updateVerticesData(VertexBuffer.PositionKind, positions)
        const indices = mesh.getIndices()
        if (indices) {
          const normals: number[] = []
          VertexData.ComputeNormals(positions, indices, normals)
          mesh.updateVerticesData(VertexBuffer.NormalKind, normals)
        }
      }

      updateHeader('scale', currentAxis, numeric || scaleFactor.toFixed(3))
    } else if (currentState === 'inset') {
      // Distance from start controls inset amount
      const delta = worldPos.subtract(startWorldRef.current)
      const amount = Math.max(0, Math.min(0.99, delta.length()))

      // Re-inset from original
      const origItem = itemRef.current
      if (origItem) {
        updateHeader('inset', null, amount.toFixed(3))
      }
    }
  }, [itemRef, getCentroid, setupProjectionPlane, projectMouseToWorld, applyAxisConstraint, updateHeader])

  // ── Confirm / Cancel ────────────────────────────────────

  const handleConfirm = useCallback(() => {
    const currentState = stateRef.current
    const item = itemRef.current
    if (!item) return

    if (currentState === 'grab' || currentState === 'rotate' || currentState === 'scale' || currentState === 'extrude' || currentState === 'inset') {
      // Commit: push current vertex positions as a new history entry
      // The vertices were already mutated during mousemove for fast-path
      const label = currentState.charAt(0).toUpperCase() + currentState.slice(1)
      history.pushEdit(
        label,
        item.vertices.map((v) => ({ position: [...v.position] as [number, number, number] })),
        item.faces.map((f) => ({ vertexIndices: [...f.vertexIndices], color: f.color }))
      )
    } else if (currentState === 'loop-cut') {
      if (loopCutPreview) {
        const result = loopCut(
          item.vertices,
          item.faces,
          loopCutPreview.faceRing,
          loopCutPreview.edgeKeysPerFace,
          loopCutPreview.position,
          loopCutPreview.cuts
        )
        history.pushEdit('Loop Cut', result.vertices, result.faces)
      }
    } else if (currentState === 'knife') {
      if (knifePoints.length >= 2) {
        const cutPoints = knifePoints.map((kp) => ({
          faceIndex: kp.faceIndex,
          position: [kp.position.x, kp.position.y, kp.position.z] as [number, number, number],
        }))
        const { knifeCut: knifeOp } = require('@/lib/items/meshOperations')
        const result = knifeOp(item.vertices, item.faces, cutPoints)
        history.pushEdit('Knife Cut', result.vertices, result.faces)
      }
    }

    // Reset state
    setState('idle')
    stateRef.current = 'idle'
    setAxis(null)
    axisRef.current = null
    setNumericInput('')
    numericRef.current = ''
    setHeaderText('')
    startWorldRef.current.set(0, 0, 0)
    snapshotRef.current.clear()
    setLoopCutPreview(null)
    setKnifePoints([])
  }, [itemRef, history, loopCutPreview, knifePoints])

  const handleCancel = useCallback(() => {
    const currentState = stateRef.current
    const item = itemRef.current
    if (!item) return

    if (currentState === 'grab' || currentState === 'rotate' || currentState === 'scale') {
      // Restore from snapshot
      for (const [vi, origPos] of snapshotRef.current) {
        if (item.vertices[vi]) {
          item.vertices[vi] = { position: [...origPos] }
        }
      }
      // Trigger re-render by undo
      history.undo()
    } else if (currentState === 'extrude' || currentState === 'inset' || currentState === 'bevel') {
      // Undo the initial operation
      history.undo()
    }

    setState('idle')
    stateRef.current = 'idle'
    setAxis(null)
    axisRef.current = null
    setNumericInput('')
    numericRef.current = ''
    setHeaderText('')
    startWorldRef.current.set(0, 0, 0)
    snapshotRef.current.clear()
    setLoopCutPreview(null)
    setKnifePoints([])
  }, [itemRef, history])

  // ── Axis constraint setter ──────────────────────────────

  const setAxisConstraint = useCallback((newAxis: AxisConstraint) => {
    setAxis(newAxis)
    axisRef.current = newAxis
    updateHeader(stateRef.current, newAxis, numericRef.current)
  }, [updateHeader])

  // ── Numeric input ───────────────────────────────────────

  const appendNumericInput = useCallback((char: string) => {
    setNumericInput((prev) => {
      const next = prev + char
      numericRef.current = next
      updateHeader(stateRef.current, axisRef.current, next)
      return next
    })
  }, [updateHeader])

  // ── Scroll handler (for bevel segments / loop cut count) ─

  const handleScroll = useCallback((delta: number) => {
    const currentState = stateRef.current
    if (currentState === 'bevel') {
      bevelSegmentsRef.current = Math.max(1, bevelSegmentsRef.current + (delta > 0 ? 1 : -1))
      updateHeader('bevel', axisRef.current, `segments: ${bevelSegmentsRef.current}`)
    } else if (currentState === 'loop-cut') {
      setLoopCutPreview((prev) => {
        if (!prev) return prev
        const newCuts = Math.max(1, prev.cuts + (delta > 0 ? 1 : -1))
        updateHeader('loop-cut', null, `cuts: ${newCuts}`)
        return { ...prev, cuts: newCuts }
      })
    }
  }, [updateHeader])

  // ── Knife point ─────────────────────────────────────────

  const addKnifePoint = useCallback((point: KnifePoint) => {
    setKnifePoints((prev) => [...prev, point])
  }, [])

  return {
    state,
    axis,
    numericInput,
    headerText,
    controlsDisabled,
    isTransforming,
    loopCutPreview,
    knifePoints,
    startGrab,
    startRotate,
    startScale,
    startExtrude,
    startInset,
    startBevel,
    startLoopCut,
    startKnife,
    handleMouseMove,
    handleConfirm,
    handleCancel,
    setAxisConstraint,
    appendNumericInput,
    handleScroll,
    addKnifePoint,
    setLoopCutPreview,
  }
}
