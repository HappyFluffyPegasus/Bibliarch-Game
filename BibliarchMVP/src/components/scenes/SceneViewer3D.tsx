'use client'

import { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react'
import {
  Engine,
  Scene as BabylonScene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  Quaternion,
  TransformNode,
  Mesh,
  ShadowGenerator,
  GizmoManager,
  UtilityLayerRenderer,
} from '@babylonjs/core'
import { SceneCharacterManager } from '@/lib/scenes/SceneCharacterManager'
import type { SceneCharacter, DialogueLine, CharacterData, TransformGizmoMode, CameraKeyframe, MovementKeyframe, AnimationKeyframe, CharacterAnimationState, SceneProp } from '@/types/scenes'

// Re-export types for backward compatibility
export type { SceneCharacter, DialogueLine }

// Selection types
export type SelectionType = 'character' | 'camera' | null

export interface SceneViewer3DRef {
  getCameraState: () => { position: [number, number, number]; rotation: [number, number, number]; fov: number }
  setCameraState: (state: { position: [number, number, number]; rotation: [number, number, number]; fov: number }) => void
  captureThumbnail: () => string | null
  saveUserCamera: () => void
  restoreUserCamera: () => void
}

export interface ContextMenuEvent {
  x: number
  y: number
  characterId: string | null
}

export type LightingPreset = 'default' | 'day' | 'night' | 'sunset' | 'dramatic' | 'studio'

const LIGHTING_PRESETS: Record<LightingPreset, {
  ambient: { color: string; intensity: number }
  main: { color: string; intensity: number; position: [number, number, number] }
  fill: { color: string; intensity: number; position: [number, number, number] }
  bg: string
}> = {
  default: {
    ambient: { color: '#ffffff', intensity: 0.5 },
    main: { color: '#ffffff', intensity: 0.8, position: [10, 20, 10] },
    fill: { color: '#8888ff', intensity: 0.3, position: [-10, 10, -10] },
    bg: '#1a1a2e'
  },
  day: {
    ambient: { color: '#c8e0ff', intensity: 0.7 },
    main: { color: '#ffeedd', intensity: 1.0, position: [15, 30, 10] },
    fill: { color: '#87ceeb', intensity: 0.4, position: [-10, 10, -10] },
    bg: '#87ceeb'
  },
  night: {
    ambient: { color: '#222244', intensity: 0.2 },
    main: { color: '#6666aa', intensity: 0.3, position: [5, 20, 5] },
    fill: { color: '#222255', intensity: 0.1, position: [-10, 10, -10] },
    bg: '#0a0a1a'
  },
  sunset: {
    ambient: { color: '#ff8844', intensity: 0.4 },
    main: { color: '#ff6633', intensity: 0.9, position: [-20, 5, 10] },
    fill: { color: '#4444aa', intensity: 0.3, position: [10, 10, -10] },
    bg: '#2d1b4e'
  },
  dramatic: {
    ambient: { color: '#111122', intensity: 0.15 },
    main: { color: '#ffffff', intensity: 1.2, position: [5, 15, 0] },
    fill: { color: '#000000', intensity: 0.0, position: [-10, 10, -10] },
    bg: '#0a0a0a'
  },
  studio: {
    ambient: { color: '#ffffff', intensity: 0.6 },
    main: { color: '#ffffff', intensity: 1.0, position: [8, 15, 8] },
    fill: { color: '#ffffff', intensity: 0.5, position: [-8, 10, -5] },
    bg: '#2a2a3a'
  }
}

interface SceneViewer3DProps {
  characters: SceneCharacter[]
  characterDataMap: Map<string, CharacterData>
  selectedId: string | null  // Can be character ID or 'camera'
  selectionType: SelectionType
  onSelect: (id: string | null, type: SelectionType) => void
  onMoveCharacter: (id: string, position: [number, number, number], rotation: number) => void
  onMoveCamera: (position: [number, number, number], rotation: [number, number, number]) => void
  isPlaying: boolean
  currentTime: number
  gizmoMode?: TransformGizmoMode
  onGizmoModeChange?: (mode: TransformGizmoMode) => void
  // Keyframes for playback
  cameraKeyframes?: CameraKeyframe[]
  movementKeyframes?: MovementKeyframe[]
  animationKeyframes?: AnimationKeyframe[]
  // View through scene camera
  viewThroughCamera?: boolean
  // Right-click context menu
  onContextMenu?: (event: ContextMenuEvent) => void
  // Lighting preset
  lightingPreset?: LightingPreset
  // Scene props
  props?: SceneProp[]
  // Record mode (allows interaction during playback)
  isRecording?: boolean
}

// Create a simple camera mesh (looks like a movie camera)
function createCameraMesh(scene: BabylonScene): TransformNode {
  const group = new TransformNode('sceneCamera', scene)
  group.metadata = { isSceneCamera: true }

  // Camera body
  const body = MeshBuilder.CreateBox('cameraBody', { width: 0.6, height: 0.4, depth: 0.8 }, scene)
  const bodyMaterial = new StandardMaterial('cameraBodyMat', scene)
  bodyMaterial.diffuseColor = Color3.FromHexString('#333333')
  bodyMaterial.specularColor = new Color3(0.8, 0.8, 0.8)
  body.material = bodyMaterial
  body.position = new Vector3(0, 0, 0)
  body.parent = group

  // Lens (faces -Z so the mesh visually points in the same direction the camera looks)
  const lens = MeshBuilder.CreateCylinder('cameraLens', { diameterTop: 0.3, diameterBottom: 0.4, height: 0.3, tessellation: 16 }, scene)
  const lensMaterial = new StandardMaterial('cameraLensMat', scene)
  lensMaterial.diffuseColor = Color3.FromHexString('#111111')
  lensMaterial.specularColor = new Color3(0.9, 0.9, 0.9)
  lens.material = lensMaterial
  lens.rotation.x = Math.PI / 2
  lens.position = new Vector3(0, 0, -0.55)
  lens.parent = group

  // Lens glass
  const glass = MeshBuilder.CreateDisc('cameraGlass', { radius: 0.14, tessellation: 16 }, scene)
  const glassMaterial = new StandardMaterial('cameraGlassMat', scene)
  glassMaterial.diffuseColor = Color3.FromHexString('#4a9eff')
  glassMaterial.specularColor = new Color3(0.1, 0.1, 0.1)
  glassMaterial.alpha = 0.7
  glass.material = glassMaterial
  glass.rotation.y = Math.PI
  glass.position = new Vector3(0, 0, -0.71)
  glass.parent = group

  // Viewfinder (on the back, where the operator stands)
  const viewfinder = MeshBuilder.CreateBox('cameraViewfinder', { width: 0.15, height: 0.15, depth: 0.2 }, scene)
  viewfinder.material = bodyMaterial
  viewfinder.position = new Vector3(0.15, 0.25, 0.2)
  viewfinder.parent = group

  // Film reels (decorative)
  const reelMaterial = new StandardMaterial('cameraReelMat', scene)
  reelMaterial.diffuseColor = Color3.FromHexString('#444444')
  reelMaterial.specularColor = new Color3(0.9, 0.9, 0.9)

  const reel1 = MeshBuilder.CreateCylinder('cameraReel1', { diameter: 0.24, height: 0.1, tessellation: 16 }, scene)
  reel1.material = reelMaterial
  reel1.rotation.x = Math.PI / 2
  reel1.position = new Vector3(-0.2, 0.3, 0)
  reel1.parent = group

  const reel2 = MeshBuilder.CreateCylinder('cameraReel2', { diameter: 0.24, height: 0.1, tessellation: 16 }, scene)
  reel2.material = reelMaterial
  reel2.rotation.x = Math.PI / 2
  reel2.position = new Vector3(0.2, 0.3, 0)
  reel2.parent = group

  // Invisible hitbox for easier selection (camera mesh is small)
  const hitbox = MeshBuilder.CreateBox('cameraHitbox', { width: 1.2, height: 0.8, depth: 1.2 }, scene)
  hitbox.visibility = 0
  hitbox.isPickable = true
  hitbox.metadata = { isSceneCamera: true }
  hitbox.parent = group

  // Mark all child meshes as camera meshes for picking
  group.getChildMeshes().forEach(m => {
    if (!m.metadata) m.metadata = {}
    m.metadata.isSceneCamera = true
  })

  return group
}

// Apply easing function
function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'ease-in': return t * t
    case 'ease-out': return t * (2 - t)
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    default: return t // linear
  }
}

// Reusable quaternions to avoid allocation in hot path
const _quatFrom = new Quaternion()
const _quatTo = new Quaternion()
const _quatResult = new Quaternion()
const _vecResult = new Vector3()

// Interpolate between camera keyframes using quaternion slerp for rotation
function interpolateCameraKeyframes(
  keyframes: CameraKeyframe[],
  time: number
): { position: [number, number, number]; rotation: [number, number, number]; fov: number } | null {
  if (keyframes.length === 0) return null

  const sorted = [...keyframes].sort((a, b) => a.time - b.time)

  if (time <= sorted[0].time) {
    return {
      position: [...sorted[0].position] as [number, number, number],
      rotation: [...sorted[0].rotation] as [number, number, number],
      fov: sorted[0].fov
    }
  }

  if (time >= sorted[sorted.length - 1].time) {
    const last = sorted[sorted.length - 1]
    return {
      position: [...last.position] as [number, number, number],
      rotation: [...last.rotation] as [number, number, number],
      fov: last.fov
    }
  }

  let fromKf = sorted[0]
  let toKf = sorted[1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time < sorted[i + 1].time) {
      fromKf = sorted[i]
      toKf = sorted[i + 1]
      break
    }
  }

  const duration = toKf.time - fromKf.time
  const elapsed = time - fromKf.time
  let t = duration > 0 ? elapsed / duration : 0
  t = applyEasing(t, toKf.easing)

  // Quaternion slerp for rotation (avoids gimbal lock)
  // Convert Euler rotations to quaternions
  Quaternion.FromEulerAnglesToRef(fromKf.rotation[0], fromKf.rotation[1], fromKf.rotation[2], _quatFrom)
  Quaternion.FromEulerAnglesToRef(toKf.rotation[0], toKf.rotation[1], toKf.rotation[2], _quatTo)
  Quaternion.SlerpToRef(_quatFrom, _quatTo, t, _quatResult)
  _quatResult.toEulerAnglesToRef(_vecResult)

  return {
    position: [
      fromKf.position[0] + (toKf.position[0] - fromKf.position[0]) * t,
      fromKf.position[1] + (toKf.position[1] - fromKf.position[1]) * t,
      fromKf.position[2] + (toKf.position[2] - fromKf.position[2]) * t,
    ],
    rotation: [_vecResult.x, _vecResult.y, _vecResult.z],
    fov: fromKf.fov + (toKf.fov - fromKf.fov) * t
  }
}

// Interpolate movement keyframes for a specific character
function interpolateMovementKeyframes(
  keyframes: MovementKeyframe[],
  characterId: string,
  time: number,
  defaultPosition: [number, number, number],
  defaultRotation: number
): { position: [number, number, number]; rotation: number } | null {
  // Filter keyframes for this character
  const charKeyframes = keyframes.filter(kf => kf.characterId === characterId)
  if (charKeyframes.length === 0) return null

  // Sort by time
  const sorted = [...charKeyframes].sort((a, b) => a.time - b.time)

  // Before first keyframe - use default position
  if (time < sorted[0].time) {
    return {
      position: defaultPosition,
      rotation: defaultRotation
    }
  }

  // At or after first keyframe but before it completes
  if (time <= sorted[0].time) {
    return {
      position: [...sorted[0].position] as [number, number, number],
      rotation: sorted[0].rotation
    }
  }

  // After last keyframe
  if (time >= sorted[sorted.length - 1].time) {
    const last = sorted[sorted.length - 1]
    return {
      position: [...last.position] as [number, number, number],
      rotation: last.rotation
    }
  }

  // Find surrounding keyframes
  let fromKf = sorted[0]
  let toKf = sorted[1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time < sorted[i + 1].time) {
      fromKf = sorted[i]
      toKf = sorted[i + 1]
      break
    }
  }

  // Calculate interpolation factor
  const duration = toKf.time - fromKf.time
  const elapsed = time - fromKf.time
  let t = duration > 0 ? elapsed / duration : 0
  t = applyEasing(t, toKf.easing)

  // Interpolate position
  const position: [number, number, number] = [
    fromKf.position[0] + (toKf.position[0] - fromKf.position[0]) * t,
    fromKf.position[1] + (toKf.position[1] - fromKf.position[1]) * t,
    fromKf.position[2] + (toKf.position[2] - fromKf.position[2]) * t,
  ]

  // Interpolate rotation (handle wrap-around)
  let fromRot = fromKf.rotation
  let toRot = toKf.rotation
  // Shortest path interpolation for rotation
  let delta = toRot - fromRot
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  const rotation = fromRot + delta * t

  return { position, rotation }
}

const SceneViewer3D = forwardRef<SceneViewer3DRef, SceneViewer3DProps>(function SceneViewer3D({
  characters,
  characterDataMap,
  selectedId,
  selectionType,
  onSelect,
  onMoveCharacter,
  onMoveCamera,
  isPlaying,
  currentTime,
  gizmoMode = 'translate',
  onGizmoModeChange,
  cameraKeyframes = [],
  movementKeyframes = [],
  animationKeyframes = [],
  viewThroughCamera = false,
  onContextMenu: onContextMenuProp,
  lightingPreset = 'default',
  props: scenePropsProp = [],
  isRecording = false
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const sceneRef = useRef<BabylonScene | null>(null)
  const viewCameraRef = useRef<ArcRotateCamera | null>(null)  // The orbit camera we render from normally
  const sceneCameraNodeRef = useRef<TransformNode | null>(null)  // The physical camera object (movie camera mesh)
  const characterManagerRef = useRef<SceneCharacterManager | null>(null)
  const gizmoManagerRef = useRef<GizmoManager | null>(null)
  const lastDeltaRef = useRef<number>(0)

  const viewThroughCameraRef = useRef(viewThroughCamera)
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false)

  // Saved user camera position for restore after exiting camera view
  const savedUserCameraRef = useRef<{alpha: number, beta: number, radius: number, target: [number,number,number]} | null>(null)

  // Light refs for preset switching
  const ambientLightRef = useRef<HemisphericLight | null>(null)
  const mainLightRef = useRef<DirectionalLight | null>(null)
  const fillLightRef = useRef<DirectionalLight | null>(null)
  const shadowGeneratorRef = useRef<ShadowGenerator | null>(null)

  // Props parent node ref
  const propsNodeRef = useRef<TransformNode | null>(null)
  const propMeshesRef = useRef<Map<string, Mesh>>(new Map())

  // Keep viewThroughCamera ref in sync
  useEffect(() => {
    viewThroughCameraRef.current = viewThroughCamera
  }, [viewThroughCamera])

  // Store callbacks in refs
  const onMoveCharacterRef = useRef(onMoveCharacter)
  const onMoveCameraRef = useRef(onMoveCamera)
  const onSelectRef = useRef(onSelect)
  const onGizmoModeChangeRef = useRef(onGizmoModeChange)
  const onContextMenuRef = useRef(onContextMenuProp)

  useEffect(() => {
    onMoveCharacterRef.current = onMoveCharacter
    onMoveCameraRef.current = onMoveCamera
    onSelectRef.current = onSelect
    onGizmoModeChangeRef.current = onGizmoModeChange
    onContextMenuRef.current = onContextMenuProp
  })

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getCameraState: () => {
      const cam = sceneCameraNodeRef.current
      if (!cam) return { position: [0, 8, 12], rotation: [0, 0, 0], fov: 50 }
      return {
        position: [cam.position.x, cam.position.y, cam.position.z] as [number, number, number],
        rotation: [cam.rotation.x, cam.rotation.y, cam.rotation.z] as [number, number, number],
        fov: viewCameraRef.current?.fov || 50
      }
    },
    setCameraState: (state) => {
      const cam = sceneCameraNodeRef.current
      if (!cam) return
      cam.position.set(state.position[0], state.position[1], state.position[2])
      cam.rotation = new Vector3(state.rotation[0], state.rotation[1], state.rotation[2])
      if (viewCameraRef.current) {
        viewCameraRef.current.fov = state.fov
      }
    },
    captureThumbnail: () => {
      const engine = engineRef.current
      const scene = sceneRef.current
      if (!engine || !scene) return null
      scene.render()
      const canvas = engine.getRenderingCanvas()
      if (!canvas) return null
      return canvas.toDataURL('image/jpeg', 0.6)
    },
    saveUserCamera: () => {
      const cam = viewCameraRef.current
      if (!cam) return
      savedUserCameraRef.current = {
        alpha: cam.alpha,
        beta: cam.beta,
        radius: cam.radius,
        target: [cam.target.x, cam.target.y, cam.target.z],
      }
    },
    restoreUserCamera: () => {
      const saved = savedUserCameraRef.current
      const cam = viewCameraRef.current
      if (!saved || !cam) return
      cam.alpha = saved.alpha
      cam.beta = saved.beta
      cam.radius = saved.radius
      cam.target = new Vector3(saved.target[0], saved.target[1], saved.target[2])
      savedUserCameraRef.current = null
    },
  }), [])

  // Initialize Babylon.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Engine
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true })
    engine.setSize(width, height)
    engineRef.current = engine

    // Scene
    const scene = new BabylonScene(engine)
    const presetInit = LIGHTING_PRESETS[lightingPreset] || LIGHTING_PRESETS.default
    scene.clearColor = Color4.FromHexString(presetInit.bg + 'ff')
    sceneRef.current = scene

    // View camera (ArcRotateCamera replaces PerspectiveCamera + OrbitControls)
    // ArcRotateCamera(name, alpha, beta, radius, target, scene)
    // alpha = rotation around Y, beta = rotation around X (elevation)
    // We want position roughly at (0, 8, 12) looking at (0, 1, 0)
    const viewCamera = new ArcRotateCamera('viewCamera', -Math.PI / 2, Math.PI / 3, 15, new Vector3(0, 1, 0), scene)
    viewCamera.minZ = 0.1
    viewCamera.maxZ = 1000
    viewCamera.fov = 50 * (Math.PI / 180) // Convert degrees to radians for Babylon
    viewCamera.lowerRadiusLimit = 3
    viewCamera.upperRadiusLimit = 50
    viewCamera.upperBetaLimit = Math.PI / 2.1
    viewCamera.inertia = 0.95 // Damping equivalent
    viewCamera.attachControl(canvas, true)
    scene.activeCamera = viewCamera
    viewCameraRef.current = viewCamera

    // Physical scene camera (can be selected and moved)
    const sceneCamera = createCameraMesh(scene)
    sceneCamera.position = new Vector3(0, 2, 8)
    // Lens faces -Z by default, which points toward origin from z=8 -- no rotation needed
    sceneCameraNodeRef.current = sceneCamera

    // GizmoManager (replaces TransformControls)
    const utilLayer = new UtilityLayerRenderer(scene)
    const gizmoManager = new GizmoManager(scene, 1, utilLayer)
    gizmoManager.positionGizmoEnabled = false
    gizmoManager.rotationGizmoEnabled = false
    gizmoManager.scaleGizmoEnabled = false
    gizmoManager.usePointerToAttachGizmos = false  // We attach manually
    gizmoManagerRef.current = gizmoManager

    // Track gizmo dragging to disable camera
    const onDragStartObserver = () => {
      setIsDraggingGizmo(true)
      viewCamera.detachControl()
    }
    const onDragEndObserver = () => {
      setIsDraggingGizmo(false)
      viewCamera.attachControl(canvas, true)

      // Report final position after gizmo drag ends
      const attached = gizmoManager.attachedNode as TransformNode | null
      if (attached) {
        if (attached.metadata?.isSceneCamera) {
          const pos: [number, number, number] = [attached.position.x, attached.position.y, attached.position.z]
          const rot: [number, number, number] = [attached.rotation.x, attached.rotation.y, attached.rotation.z]
          onMoveCameraRef.current(pos, rot)
        } else if (attached.metadata?.sceneCharacterId) {
          const pos: [number, number, number] = [attached.position.x, attached.position.y, attached.position.z]
          const rot = attached.rotation.y
          onMoveCharacterRef.current(attached.metadata.sceneCharacterId, pos, rot)
        }
      }
    }

    // Attach drag observers to each gizmo type
    const attachDragObservers = () => {
      if (gizmoManager.gizmos.positionGizmo) {
        gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(onDragStartObserver)
        gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(onDragEndObserver)
      }
      if (gizmoManager.gizmos.rotationGizmo) {
        gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(onDragStartObserver)
        gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(onDragEndObserver)
      }
      if (gizmoManager.gizmos.scaleGizmo) {
        gizmoManager.gizmos.scaleGizmo.onDragStartObservable.add(onDragStartObserver)
        gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(onDragEndObserver)
      }
    }

    // Lighting (using preset)
    const preset = LIGHTING_PRESETS[lightingPreset] || LIGHTING_PRESETS.default
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene)
    ambientLight.diffuse = Color3.FromHexString(preset.ambient.color)
    ambientLight.intensity = preset.ambient.intensity
    ambientLight.groundColor = Color3.FromHexString(preset.ambient.color).scale(0.3)
    ambientLightRef.current = ambientLight

    const mainLight = new DirectionalLight('mainLight', new Vector3(-preset.main.position[0], -preset.main.position[1], -preset.main.position[2]).normalize(), scene)
    mainLight.position = new Vector3(preset.main.position[0], preset.main.position[1], preset.main.position[2])
    mainLight.diffuse = Color3.FromHexString(preset.main.color)
    mainLight.intensity = preset.main.intensity
    mainLightRef.current = mainLight

    // Shadow generator
    const shadowGenerator = new ShadowGenerator(2048, mainLight)
    shadowGenerator.useBlurExponentialShadowMap = true
    shadowGenerator.blurKernel = 32
    shadowGeneratorRef.current = shadowGenerator

    const fillLight = new DirectionalLight('fillLight', new Vector3(-preset.fill.position[0], -preset.fill.position[1], -preset.fill.position[2]).normalize(), scene)
    fillLight.position = new Vector3(preset.fill.position[0], preset.fill.position[1], preset.fill.position[2])
    fillLight.diffuse = Color3.FromHexString(preset.fill.color)
    fillLight.intensity = preset.fill.intensity
    fillLightRef.current = fillLight

    // Floor
    const floor = MeshBuilder.CreateDisc('floor', { radius: 10, tessellation: 64 }, scene)
    const floorMaterial = new StandardMaterial('floorMat', scene)
    floorMaterial.diffuseColor = Color3.FromHexString('#2d2d44')
    floorMaterial.specularColor = new Color3(0.1, 0.1, 0.1)
    floor.material = floorMaterial
    floor.rotation.x = Math.PI / 2  // Babylon disc faces +Y by default, rotate to be flat on ground
    floor.receiveShadows = true
    floor.name = 'floor'

    // Props group
    const propsNode = new TransformNode('propsGroup', scene)
    propsNodeRef.current = propsNode

    // Stage edge glow (ring)
    const ring = MeshBuilder.CreateTorus('stageRing', { diameter: 19.8, thickness: 0.2, tessellation: 64 }, scene)
    const ringMaterial = new StandardMaterial('ringMat', scene)
    ringMaterial.diffuseColor = Color3.FromHexString('#4a9eff')
    ringMaterial.alpha = 0.5
    ringMaterial.disableLighting = true
    ring.material = ringMaterial
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.01

    // Grid (Babylon.js has a built-in GridMaterial, but we can use CreateGround with a grid material
    // or simply create lines. For simplicity, use the ground with grid-like appearance)
    const grid = MeshBuilder.CreateGround('grid', { width: 20, height: 20, subdivisions: 20 }, scene)
    const gridMaterial = new StandardMaterial('gridMat', scene)
    gridMaterial.wireframe = true
    gridMaterial.diffuseColor = Color3.FromHexString('#444466')
    gridMaterial.disableLighting = true
    gridMaterial.alpha = 0.4
    grid.material = gridMaterial
    grid.position.y = 0.02
    grid.isPickable = false

    // Character manager
    const characterNode = new TransformNode('characters', scene)
    characterManagerRef.current = new SceneCharacterManager(characterNode, scene)

    // After gizmo manager is created, set initial mode and attach observers
    attachDragObservers()

    // Render loop
    let lastTime = performance.now()
    engine.runRenderLoop(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now
      lastDeltaRef.current = delta

      characterManagerRef.current?.update(delta)

      // Check if gizmo attached node was removed
      const gm = gizmoManagerRef.current
      if (gm?.attachedNode) {
        // Verify node is still in scene by checking if it has a valid scene reference
        const node = gm.attachedNode as TransformNode
        if (!node.getScene || node.isDisposed()) {
          gm.attachToNode(null)
        }
      }

      // When viewing through scene camera, position a temporary view override
      if (viewThroughCameraRef.current && sceneCameraNodeRef.current) {
        const scCam = sceneCameraNodeRef.current
        scCam.computeWorldMatrix(true)
        // Camera looks in -Z direction (lens faces -Z in local space)
        const forward = new Vector3(0, 0, -1)
        const worldMatrix = scCam.getWorldMatrix()
        const worldForward = Vector3.TransformNormal(forward, worldMatrix)
        const worldPos = scCam.getAbsolutePosition()
        // Move the orbit camera target to scene camera position, and set minimal radius
        viewCamera.target.copyFrom(worldPos.add(worldForward.scale(0.1)))
        viewCamera.alpha = Math.atan2(-worldForward.x, -worldForward.z)
        viewCamera.beta = Math.acos(Math.max(-1, Math.min(1, -worldForward.y)))
        viewCamera.radius = 0.01
      }

      scene.render()
    })

    // Resize handler
    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const gm = gizmoManagerRef.current
      switch (e.key.toLowerCase()) {
        case 'g':
          if (gm) {
            gm.positionGizmoEnabled = true
            gm.rotationGizmoEnabled = false
            gm.scaleGizmoEnabled = false
            attachDragObservers()
          }
          onGizmoModeChangeRef.current?.('translate')
          break
        case 'r':
          if (gm) {
            gm.positionGizmoEnabled = false
            gm.rotationGizmoEnabled = true
            gm.scaleGizmoEnabled = false
            attachDragObservers()
          }
          onGizmoModeChangeRef.current?.('rotate')
          break
        case 's':
          if (gm) {
            gm.positionGizmoEnabled = false
            gm.rotationGizmoEnabled = false
            gm.scaleGizmoEnabled = true
            attachDragObservers()
          }
          onGizmoModeChangeRef.current?.('scale')
          break
        case 'escape':
          onSelectRef.current(null, null)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      characterManagerRef.current?.dispose()
      gizmoManager.dispose()
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
    }
  }, [])

  // Update gizmo mode
  useEffect(() => {
    const gm = gizmoManagerRef.current
    if (!gm) return

    gm.positionGizmoEnabled = gizmoMode === 'translate'
    gm.rotationGizmoEnabled = gizmoMode === 'rotate'
    gm.scaleGizmoEnabled = gizmoMode === 'scale'

    // Re-attach drag observers when gizmo mode changes
    const onDragStartObserver = () => {
      setIsDraggingGizmo(true)
      if (viewCameraRef.current && canvasRef.current) {
        viewCameraRef.current.detachControl()
      }
    }
    const onDragEndObserver = () => {
      setIsDraggingGizmo(false)
      if (viewCameraRef.current && canvasRef.current) {
        viewCameraRef.current.attachControl(canvasRef.current, true)
      }

      const attached = gm.attachedNode as TransformNode | null
      if (attached) {
        if (attached.metadata?.isSceneCamera) {
          const pos: [number, number, number] = [attached.position.x, attached.position.y, attached.position.z]
          const rot: [number, number, number] = [attached.rotation.x, attached.rotation.y, attached.rotation.z]
          onMoveCameraRef.current(pos, rot)
        } else if (attached.metadata?.sceneCharacterId) {
          const pos: [number, number, number] = [attached.position.x, attached.position.y, attached.position.z]
          const rot = attached.rotation.y
          onMoveCharacterRef.current(attached.metadata.sceneCharacterId, pos, rot)
        }
      }
    }

    if (gm.gizmos.positionGizmo) {
      gm.gizmos.positionGizmo.onDragStartObservable.clear()
      gm.gizmos.positionGizmo.onDragEndObservable.clear()
      gm.gizmos.positionGizmo.onDragStartObservable.add(onDragStartObserver)
      gm.gizmos.positionGizmo.onDragEndObservable.add(onDragEndObserver)
    }
    if (gm.gizmos.rotationGizmo) {
      gm.gizmos.rotationGizmo.onDragStartObservable.clear()
      gm.gizmos.rotationGizmo.onDragEndObservable.clear()
      gm.gizmos.rotationGizmo.onDragStartObservable.add(onDragStartObserver)
      gm.gizmos.rotationGizmo.onDragEndObservable.add(onDragEndObserver)
    }
    if (gm.gizmos.scaleGizmo) {
      gm.gizmos.scaleGizmo.onDragStartObservable.clear()
      gm.gizmos.scaleGizmo.onDragEndObservable.clear()
      gm.gizmos.scaleGizmo.onDragStartObservable.add(onDragStartObserver)
      gm.gizmos.scaleGizmo.onDragEndObservable.add(onDragEndObserver)
    }
  }, [gizmoMode])

  // Update character data map
  useEffect(() => {
    characterManagerRef.current?.setCharacterDataMap(characterDataMap)
  }, [characterDataMap])

  // Sync characters
  useEffect(() => {
    if (!characterManagerRef.current) return
    characterManagerRef.current.syncCharacters(characters)
  }, [characters])

  // Update gizmo attachment
  useEffect(() => {
    const gm = gizmoManagerRef.current
    if (!gm) return

    let retryCount = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const tryAttach = (): boolean => {
      if (!selectedId || !selectionType) {
        gm.attachToNode(null)
        return true
      }

      let targetNode: TransformNode | null = null

      if (selectionType === 'camera') {
        targetNode = sceneCameraNodeRef.current
      } else if (selectionType === 'character') {
        targetNode = characterManagerRef.current?.getCharacterGroup(selectedId) || null
      }

      if (targetNode) {
        // Verify node is in scene
        if (!targetNode.isDisposed()) {
          try {
            gm.attachToNode(targetNode)
            return true
          } catch {
            // Retry
          }
        }
      }

      gm.attachToNode(null)
      return false
    }

    if (!tryAttach() && selectedId) {
      const scheduleRetry = () => {
        if (retryCount >= 5) return
        retryCount++
        timeoutId = setTimeout(() => {
          if (!tryAttach() && selectedId) {
            scheduleRetry()
          }
        }, 50 * retryCount)
      }
      scheduleRetry()
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [selectedId, selectionType, characters])

  // Disable gizmo during playback
  useEffect(() => {
    const gm = gizmoManagerRef.current
    if (!gm) return

    if (isPlaying) {
      gm.attachToNode(null)
    }
  }, [isPlaying])

  // Animate camera from keyframes during playback or when viewing through camera
  useEffect(() => {
    if (cameraKeyframes.length === 0 || isDraggingGizmo) return
    // Apply during playback, or during scrubbing when viewing through camera
    if (!isPlaying && !viewThroughCamera) return

    const state = interpolateCameraKeyframes(cameraKeyframes, currentTime)
    if (state && sceneCameraNodeRef.current) {
      sceneCameraNodeRef.current.position.set(state.position[0], state.position[1], state.position[2])
      sceneCameraNodeRef.current.rotation = new Vector3(state.rotation[0], state.rotation[1], state.rotation[2])
      if (viewCameraRef.current) {
        viewCameraRef.current.fov = state.fov * (Math.PI / 180) // Convert degrees to radians
      }
    }
  }, [isPlaying, viewThroughCamera, currentTime, cameraKeyframes, isDraggingGizmo])

  // Sync props with scene
  useEffect(() => {
    if (!propsNodeRef.current || !sceneRef.current) return
    const parentNode = propsNodeRef.current
    const scene = sceneRef.current
    const existing = propMeshesRef.current
    const propIds = new Set(scenePropsProp.map(p => p.id))

    // Remove props no longer in scene
    existing.forEach((mesh, id) => {
      if (!propIds.has(id)) {
        mesh.dispose()
        existing.delete(id)
      }
    })

    // Add/update props
    for (const prop of scenePropsProp) {
      let mesh = existing.get(prop.id)
      if (!mesh) {
        // Create geometry based on shape
        switch (prop.shape) {
          case 'sphere':
            mesh = MeshBuilder.CreateSphere(`prop-${prop.id}`, { diameter: 1, segments: 16 }, scene)
            break
          case 'cylinder':
            mesh = MeshBuilder.CreateCylinder(`prop-${prop.id}`, { diameter: 0.6, height: 1, tessellation: 16 }, scene)
            break
          case 'cone':
            mesh = MeshBuilder.CreateCylinder(`prop-${prop.id}`, { diameterTop: 0, diameterBottom: 0.8, height: 1, tessellation: 16 }, scene)
            break
          case 'plane':
            mesh = MeshBuilder.CreatePlane(`prop-${prop.id}`, { width: 1, height: 1 }, scene)
            break
          case 'torus':
            mesh = MeshBuilder.CreateTorus(`prop-${prop.id}`, { diameter: 0.8, thickness: 0.3, tessellation: 24 }, scene)
            break
          default: // cube
            mesh = MeshBuilder.CreateBox(`prop-${prop.id}`, { size: 1 }, scene)
            break
        }
        const material = new StandardMaterial(`propMat-${prop.id}`, scene)
        material.diffuseColor = Color3.FromHexString(prop.color)
        material.specularColor = new Color3(0.2, 0.2, 0.2)
        mesh.material = material

        // Add to shadow generator
        if (shadowGeneratorRef.current) {
          shadowGeneratorRef.current.addShadowCaster(mesh)
        }
        mesh.receiveShadows = true
        mesh.metadata = { propId: prop.id }
        mesh.parent = parentNode
        existing.set(prop.id, mesh)
      }

      // Update transform
      mesh.position = new Vector3(prop.position[0], prop.position[1], prop.position[2])
      mesh.rotation = new Vector3(prop.rotation[0], prop.rotation[1], prop.rotation[2])
      mesh.scaling = new Vector3(prop.scale[0], prop.scale[1], prop.scale[2])
      if (mesh.material) {
        ;(mesh.material as StandardMaterial).diffuseColor = Color3.FromHexString(prop.color)
      }
    }
  }, [scenePropsProp])

  // Update lighting when preset changes
  useEffect(() => {
    const preset = LIGHTING_PRESETS[lightingPreset] || LIGHTING_PRESETS.default
    if (ambientLightRef.current) {
      ambientLightRef.current.diffuse = Color3.FromHexString(preset.ambient.color)
      ambientLightRef.current.intensity = preset.ambient.intensity
      ambientLightRef.current.groundColor = Color3.FromHexString(preset.ambient.color).scale(0.3)
    }
    if (mainLightRef.current) {
      mainLightRef.current.diffuse = Color3.FromHexString(preset.main.color)
      mainLightRef.current.intensity = preset.main.intensity
      mainLightRef.current.position = new Vector3(preset.main.position[0], preset.main.position[1], preset.main.position[2])
      mainLightRef.current.direction = new Vector3(-preset.main.position[0], -preset.main.position[1], -preset.main.position[2]).normalize()
    }
    if (fillLightRef.current) {
      fillLightRef.current.diffuse = Color3.FromHexString(preset.fill.color)
      fillLightRef.current.intensity = preset.fill.intensity
      fillLightRef.current.position = new Vector3(preset.fill.position[0], preset.fill.position[1], preset.fill.position[2])
      fillLightRef.current.direction = new Vector3(-preset.fill.position[0], -preset.fill.position[1], -preset.fill.position[2]).normalize()
    }
    if (sceneRef.current) {
      sceneRef.current.clearColor = Color4.FromHexString(preset.bg + 'ff')
    }
  }, [lightingPreset])

  // View through camera effect - toggle visibility/controls (sync happens in main loop)
  useEffect(() => {
    if (!sceneCameraNodeRef.current) return

    // Hide/show the scene camera mesh when viewing through it
    sceneCameraNodeRef.current.getChildMeshes().forEach(m => m.setEnabled(!viewThroughCamera))

    if (viewCameraRef.current && canvasRef.current) {
      if (viewThroughCamera) {
        viewCameraRef.current.detachControl()
      } else {
        viewCameraRef.current.attachControl(canvasRef.current, true)
      }
    }

    return () => {
      if (sceneCameraNodeRef.current) {
        sceneCameraNodeRef.current.getChildMeshes().forEach(m => m.setEnabled(true))
      }
      if (viewCameraRef.current && canvasRef.current) {
        viewCameraRef.current.attachControl(canvasRef.current, true)
      }
    }
  }, [viewThroughCamera])

  // Animate characters from movement keyframes (works for both playback and scrubbing)
  useEffect(() => {
    if (!characterManagerRef.current) return

    characters.forEach(char => {
      const charKeyframes = movementKeyframes.filter(kf => kf.characterId === char.id)

      if (charKeyframes.length > 0) {
        // Has keyframes - show interpolated position based on currentTime
        const state = interpolateMovementKeyframes(
          movementKeyframes,
          char.id,
          currentTime,
          char.position,
          char.rotation
        )

        if (state) {
          const group = characterManagerRef.current?.getCharacterGroup(char.id)
          if (group) {
            group.position.set(state.position[0], state.position[1], state.position[2])
            group.rotation.y = state.rotation
          }
        }
      } else {
        // No keyframes - use base position from scene data
        const group = characterManagerRef.current?.getCharacterGroup(char.id)
        if (group) {
          group.position.set(char.position[0], char.position[1], char.position[2])
          group.rotation.y = char.rotation
        }
      }
    })
  }, [currentTime, movementKeyframes, characters])

  // Apply animation keyframes - find the most recent keyframe at or before currentTime for each character
  const lastAppliedAnimRef = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    if (!characterManagerRef.current || animationKeyframes.length === 0) return

    characters.forEach(char => {
      const charAnimKfs = animationKeyframes
        .filter(kf => kf.characterId === char.id && kf.time <= currentTime)
        .sort((a, b) => b.time - a.time) // Most recent first

      if (charAnimKfs.length > 0) {
        const activeKf = charAnimKfs[0]
        // Only apply if this is a different keyframe than last applied (avoid re-triggering)
        const lastAppliedId = lastAppliedAnimRef.current.get(char.id)
        if (lastAppliedId !== activeKf.id) {
          lastAppliedAnimRef.current.set(char.id, activeKf.id)
          characterManagerRef.current?.applyAnimationState(char.id, activeKf.animation)
        }
      }
    })
  }, [currentTime, animationKeyframes, characters])

  // Handle mouse events (picking)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!sceneRef.current || !canvasRef.current) return
    if ((isPlaying && !isRecording) || isDraggingGizmo) return

    const scene = sceneRef.current

    // Use Babylon.js scene.pick for raycasting
    const pickResult = scene.pick(
      e.nativeEvent.offsetX,
      e.nativeEvent.offsetY,
      (mesh) => mesh.isPickable
    )

    if (pickResult?.hit && pickResult.pickedMesh) {
      const hit = pickResult.pickedMesh

      // Check if it's the camera - walk up the parent chain
      let parent: TransformNode | null = hit as TransformNode
      while (parent) {
        if (parent.metadata?.isSceneCamera) {
          onSelectRef.current('camera', 'camera')
          return
        }
        parent = parent.parent as TransformNode | null
      }

      // Check if it's a character hitbox
      const sceneCharId = characterManagerRef.current?.findCharacterByMesh(hit)
      if (sceneCharId) {
        onSelectRef.current(sceneCharId, 'character')
        return
      }
    }

    // Click on empty space - deselect
    onSelectRef.current(null, null)
  }, [isPlaying, isRecording, isDraggingGizmo])

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!sceneRef.current || !onContextMenuRef.current) return
    if (isPlaying) return

    const scene = sceneRef.current

    const pickResult = scene.pick(
      e.nativeEvent.offsetX,
      e.nativeEvent.offsetY,
      (mesh) => mesh.isPickable
    )

    let hitCharId: string | null = null
    if (pickResult?.hit && pickResult.pickedMesh) {
      hitCharId = characterManagerRef.current?.findCharacterByMesh(pickResult.pickedMesh) ?? null
    }

    onContextMenuRef.current({
      x: e.clientX,
      y: e.clientY,
      characterId: hitCharId
    })
  }, [isPlaying])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
})

export default SceneViewer3D
