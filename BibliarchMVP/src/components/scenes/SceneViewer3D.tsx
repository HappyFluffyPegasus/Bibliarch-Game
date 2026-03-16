'use client'

import { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SceneCharacterManager } from '@/lib/scenes/SceneCharacterManager'
import { ChunkManager } from '@/lib/terrain/ChunkManager'
import { idbGet } from '@/services/worldStorage'
import { deserializeWorld, type SerializedWorld } from '@/types/world'
import type { SceneCharacter, DialogueLine, CharacterData, TransformGizmoMode, CameraKeyframe, MovementKeyframe, AnimationKeyframe, CharacterAnimationState, SceneProp } from '@/types/scenes'

// Re-export types for backward compatibility
export type { SceneCharacter, DialogueLine }

// Dynamic import type for TransformControls
type TransformControlsType = import('three-stdlib').TransformControls

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
  ambient: { color: number; intensity: number }
  main: { color: number; intensity: number; position: [number, number, number] }
  fill: { color: number; intensity: number; position: [number, number, number] }
  bg: number
}> = {
  default: {
    ambient: { color: 0xffffff, intensity: 0.5 },
    main: { color: 0xffffff, intensity: 0.8, position: [10, 20, 10] },
    fill: { color: 0x8888ff, intensity: 0.3, position: [-10, 10, -10] },
    bg: 0x1a1a2e
  },
  day: {
    ambient: { color: 0xc8e0ff, intensity: 0.7 },
    main: { color: 0xffeedd, intensity: 1.0, position: [15, 30, 10] },
    fill: { color: 0x87ceeb, intensity: 0.4, position: [-10, 10, -10] },
    bg: 0x87ceeb
  },
  night: {
    ambient: { color: 0x222244, intensity: 0.2 },
    main: { color: 0x6666aa, intensity: 0.3, position: [5, 20, 5] },
    fill: { color: 0x222255, intensity: 0.1, position: [-10, 10, -10] },
    bg: 0x0a0a1a
  },
  sunset: {
    ambient: { color: 0xff8844, intensity: 0.4 },
    main: { color: 0xff6633, intensity: 0.9, position: [-20, 5, 10] },
    fill: { color: 0x4444aa, intensity: 0.3, position: [10, 10, -10] },
    bg: 0x2d1b4e
  },
  dramatic: {
    ambient: { color: 0x111122, intensity: 0.15 },
    main: { color: 0xffffff, intensity: 1.2, position: [5, 15, 0] },
    fill: { color: 0x000000, intensity: 0.0, position: [-10, 10, -10] },
    bg: 0x0a0a0a
  },
  studio: {
    ambient: { color: 0xffffff, intensity: 0.6 },
    main: { color: 0xffffff, intensity: 1.0, position: [8, 15, 8] },
    fill: { color: 0xffffff, intensity: 0.5, position: [-8, 10, -5] },
    bg: 0x2a2a3a
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
  // World backdrop
  storyId?: string
  locationId?: string | null
}

// Create a simple camera mesh (looks like a movie camera)
function createCameraMesh(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'sceneCamera'
  group.userData.isSceneCamera = true

  // Camera body
  const bodyGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.8)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.set(0, 0, 0)
  group.add(body)

  // Lens (faces -Z so the mesh visually points in the same direction the camera looks)
  const lensGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 16)
  const lensMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 })
  const lens = new THREE.Mesh(lensGeometry, lensMaterial)
  lens.rotation.x = Math.PI / 2
  lens.position.set(0, 0, -0.55)
  group.add(lens)

  // Lens glass
  const glassGeometry = new THREE.CircleGeometry(0.14, 16)
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a9eff,
    metalness: 0.1,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7
  })
  const glass = new THREE.Mesh(glassGeometry, glassMaterial)
  glass.rotation.y = Math.PI
  glass.position.set(0, 0, -0.71)
  group.add(glass)

  // Viewfinder (on the back, where the operator stands)
  const viewfinderGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.2)
  const viewfinder = new THREE.Mesh(viewfinderGeometry, bodyMaterial)
  viewfinder.position.set(0.15, 0.25, 0.2)
  group.add(viewfinder)

  // Film reels (decorative)
  const reelGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16)
  const reelMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 })
  const reel1 = new THREE.Mesh(reelGeometry, reelMaterial)
  reel1.rotation.x = Math.PI / 2
  reel1.position.set(-0.2, 0.3, 0)
  group.add(reel1)

  const reel2 = new THREE.Mesh(reelGeometry, reelMaterial)
  reel2.rotation.x = Math.PI / 2
  reel2.position.set(0.2, 0.3, 0)
  group.add(reel2)

  // Invisible hitbox for easier selection (camera mesh is small)
  const hitboxGeometry = new THREE.BoxGeometry(1.2, 0.8, 1.2)
  const hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false })
  const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial)
  hitbox.userData.isSceneCamera = true
  group.add(hitbox)

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
const _quatFrom = new THREE.Quaternion()
const _quatTo = new THREE.Quaternion()
const _quatResult = new THREE.Quaternion()
const _eulerFrom = new THREE.Euler()
const _eulerTo = new THREE.Euler()
const _eulerResult = new THREE.Euler()

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
  _eulerFrom.set(fromKf.rotation[0], fromKf.rotation[1], fromKf.rotation[2])
  _eulerTo.set(toKf.rotation[0], toKf.rotation[1], toKf.rotation[2])
  _quatFrom.setFromEuler(_eulerFrom)
  _quatTo.setFromEuler(_eulerTo)
  _quatResult.slerpQuaternions(_quatFrom, _quatTo, t)
  _eulerResult.setFromQuaternion(_quatResult)

  return {
    position: [
      fromKf.position[0] + (toKf.position[0] - fromKf.position[0]) * t,
      fromKf.position[1] + (toKf.position[1] - fromKf.position[1]) * t,
      fromKf.position[2] + (toKf.position[2] - fromKf.position[2]) * t,
    ],
    rotation: [_eulerResult.x, _eulerResult.y, _eulerResult.z],
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
  isRecording = false,
  storyId,
  locationId
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const viewCameraRef = useRef<THREE.PerspectiveCamera | null>(null)  // The camera we render from
  const sceneCameraRef = useRef<THREE.Group | null>(null)  // The physical camera object
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const transformControlsRef = useRef<TransformControlsType | null>(null)
  const characterManagerRef = useRef<SceneCharacterManager | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const clockRef = useRef<THREE.Clock>(new THREE.Clock())

  const animationFrameRef = useRef<number | null>(null)
  const viewThroughCameraRef = useRef(viewThroughCamera)
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false)

  // Saved user camera position for restore after exiting camera view
  const savedUserCameraRef = useRef<{position: [number,number,number], target: [number,number,number]} | null>(null)

  // Light refs for preset switching
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null)
  const mainLightRef = useRef<THREE.DirectionalLight | null>(null)
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null)

  // Props group ref
  const propsGroupRef = useRef<THREE.Group | null>(null)
  const propMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())

  // Backdrop refs
  const backdropGroupRef = useRef<THREE.Group | null>(null)
  const chunkManagerRef = useRef<ChunkManager | null>(null)

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
      const cam = sceneCameraRef.current
      if (!cam) return { position: [0, 8, 12], rotation: [0, 0, 0], fov: 50 }
      return {
        position: [cam.position.x, cam.position.y, cam.position.z] as [number, number, number],
        rotation: [cam.rotation.x, cam.rotation.y, cam.rotation.z] as [number, number, number],
        fov: viewCameraRef.current?.fov || 50
      }
    },
    setCameraState: (state) => {
      const cam = sceneCameraRef.current
      if (!cam) return
      cam.position.set(state.position[0], state.position[1], state.position[2])
      cam.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2])
      if (viewCameraRef.current) {
        viewCameraRef.current.fov = state.fov
        viewCameraRef.current.updateProjectionMatrix()
      }
    },
    captureThumbnail: () => {
      if (!rendererRef.current || !sceneRef.current || !viewCameraRef.current) return null
      rendererRef.current.render(sceneRef.current, viewCameraRef.current)
      return rendererRef.current.domElement.toDataURL('image/jpeg', 0.6)
    },
    saveUserCamera: () => {
      const cam = viewCameraRef.current
      const controls = controlsRef.current
      if (!cam || !controls) return
      savedUserCameraRef.current = {
        position: [cam.position.x, cam.position.y, cam.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      }
    },
    restoreUserCamera: () => {
      const saved = savedUserCameraRef.current
      const cam = viewCameraRef.current
      const controls = controlsRef.current
      if (!saved || !cam || !controls) return
      cam.position.set(saved.position[0], saved.position[1], saved.position[2])
      controls.target.set(saved.target[0], saved.target[1], saved.target[2])
      controls.update()
      savedUserCameraRef.current = null
    },
  }), [])

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    // View camera (what we render from)
    const viewCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    viewCamera.position.set(0, 8, 12)
    viewCamera.lookAt(0, 1, 0)
    viewCameraRef.current = viewCamera

    // Physical scene camera (can be selected and moved)
    const sceneCamera = createCameraMesh()
    sceneCamera.position.set(0, 2, 8)
    // Lens faces -Z by default, which points toward origin from z=8 — no rotation needed
    scene.add(sceneCamera)
    sceneCameraRef.current = sceneCamera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = false
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(viewCamera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2.1
    controls.minDistance = 3
    controls.maxDistance = 50
    controls.target.set(0, 1, 0)
    controlsRef.current = controls

    // Transform controls
    let transformControls: TransformControlsType | null = null

    const initTransformControls = async () => {
      try {
        const { TransformControls } = await import('three-stdlib')
        transformControls = new TransformControls(viewCamera, renderer.domElement)
        transformControls.setMode('translate')
        transformControls.setSpace('world')
        scene.add(transformControls as unknown as THREE.Object3D)
        transformControlsRef.current = transformControls

        const tc = transformControls as any

        tc.addEventListener('dragging-changed', (event: { value: boolean }) => {
          controls.enabled = !event.value
          setIsDraggingGizmo(event.value)
        })

        tc.addEventListener('change', () => {
          const obj = tc.object as THREE.Object3D | undefined
          if (!obj) return

          if (obj.userData.isSceneCamera) {
            const pos: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z]
            const rot: [number, number, number] = [obj.rotation.x, obj.rotation.y, obj.rotation.z]
            onMoveCameraRef.current(pos, rot)
          } else if (obj.userData.sceneCharacterId) {
            const pos: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z]
            const rot = obj.rotation.y
            onMoveCharacterRef.current(obj.userData.sceneCharacterId, pos, rot)
          }
        })
      } catch (error) {
        console.warn('Failed to initialize TransformControls:', error)
      }
    }

    initTransformControls()

    // Lighting (using preset)
    const preset = LIGHTING_PRESETS[lightingPreset] || LIGHTING_PRESETS.default
    const ambientLight = new THREE.AmbientLight(preset.ambient.color, preset.ambient.intensity)
    scene.add(ambientLight)
    ambientLightRef.current = ambientLight

    const mainLight = new THREE.DirectionalLight(preset.main.color, preset.main.intensity)
    mainLight.position.set(...preset.main.position)
    mainLight.castShadow = false
    scene.add(mainLight)
    mainLightRef.current = mainLight

    const fillLight = new THREE.DirectionalLight(preset.fill.color, preset.fill.intensity)
    fillLight.position.set(...preset.fill.position)
    scene.add(fillLight)
    fillLightRef.current = fillLight

    scene.background = new THREE.Color(preset.bg)

    // Floor
    const floorGeometry = new THREE.CircleGeometry(10, 64)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2d44,
      roughness: 0.8,
      metalness: 0.1,
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    floor.name = 'floor'
    scene.add(floor)

    // Props group
    const propsGroup = new THREE.Group()
    propsGroup.name = 'propsGroup'
    scene.add(propsGroup)
    propsGroupRef.current = propsGroup

    // Stage edge glow
    const ringGeometry = new THREE.RingGeometry(9.8, 10, 64)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a9eff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.01
    scene.add(ring)

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x444466, 0x333355)
    gridHelper.position.y = 0.02
    scene.add(gridHelper)

    // Character manager
    const characterGroup = new THREE.Group()
    characterGroup.name = 'characters'
    scene.add(characterGroup)
    characterManagerRef.current = new SceneCharacterManager(characterGroup)

    // Animation loop (single loop handles rendering + camera sync)
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)
      const delta = clockRef.current.getDelta()
      characterManagerRef.current?.update(delta)

      const tc = transformControlsRef.current as any
      if (tc?.object && !tc.object.parent) {
        tc.detach()
      }

      // When viewing through scene camera, skip orbit controls and sync directly
      if (viewThroughCameraRef.current && sceneCameraRef.current) {
        // Camera looks in -Z direction (lens faces -Z in local space)
        sceneCamera.updateMatrixWorld(true)
        const forward = new THREE.Vector3(0, 0, -1)
        forward.applyQuaternion(sceneCamera.getWorldQuaternion(new THREE.Quaternion()))
        viewCamera.position.copy(sceneCamera.getWorldPosition(new THREE.Vector3()))
        const lookTarget = viewCamera.position.clone().add(forward)
        viewCamera.lookAt(lookTarget)
      } else {
        controls.update()
      }

      // Disable frustum culling on all meshes to avoid NaN bounding sphere errors
      // from scaled SkinnedMeshes and morph targets
      scene.traverse((node) => {
        if ((node as THREE.Mesh).isMesh && node.frustumCulled) {
          node.frustumCulled = false
        }
      })

      renderer.render(scene, viewCamera)
    }
    animationFrameRef.current = requestAnimationFrame(animate)

    // Resize handler
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      viewCamera.aspect = w / h
      viewCamera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const tc = transformControlsRef.current
      switch (e.key.toLowerCase()) {
        case 'g':
          tc?.setMode('translate')
          onGizmoModeChangeRef.current?.('translate')
          break
        case 'r':
          tc?.setMode('rotate')
          onGizmoModeChangeRef.current?.('rotate')
          break
        case 's':
          tc?.setMode('scale')
          onGizmoModeChangeRef.current?.('scale')
          break
        case 'escape':
          onSelectRef.current(null, null)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      characterManagerRef.current?.dispose()
      transformControlsRef.current?.dispose()
      controls.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  // Update gizmo mode
  useEffect(() => {
    if (transformControlsRef.current && gizmoMode) {
      transformControlsRef.current.setMode(gizmoMode)
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

  // Update transform controls attachment
  useEffect(() => {
    const transformControls = transformControlsRef.current
    if (!transformControls) return

    const tc = transformControls as any
    let retryCount = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const tryAttach = (): boolean => {
      if (!selectedId || !selectionType) {
        tc.detach()
        return true
      }

      let targetObject: THREE.Object3D | null = null

      if (selectionType === 'camera') {
        targetObject = sceneCameraRef.current
      } else if (selectionType === 'character') {
        targetObject = characterManagerRef.current?.getCharacterGroup(selectedId) || null
      }

      if (targetObject) {
        let obj: THREE.Object3D | null = targetObject
        let isInScene = false
        while (obj) {
          if (obj === sceneRef.current) {
            isInScene = true
            break
          }
          obj = obj.parent
        }

        if (isInScene) {
          try {
            tc.attach(targetObject)
            return true
          } catch {
            // Retry
          }
        }
      }

      tc.detach()
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
    if (transformControlsRef.current) {
      (transformControlsRef.current as any).enabled = !isPlaying
    }
  }, [isPlaying])

  // Animate camera from keyframes during playback or when viewing through camera
  useEffect(() => {
    if (cameraKeyframes.length === 0 || isDraggingGizmo) return
    // Apply during playback, or during scrubbing when viewing through camera
    if (!isPlaying && !viewThroughCamera) return

    const state = interpolateCameraKeyframes(cameraKeyframes, currentTime)
    if (state && sceneCameraRef.current) {
      sceneCameraRef.current.position.set(state.position[0], state.position[1], state.position[2])
      sceneCameraRef.current.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2])
      if (viewCameraRef.current) {
        viewCameraRef.current.fov = state.fov
        viewCameraRef.current.updateProjectionMatrix()
      }
    }
  }, [isPlaying, viewThroughCamera, currentTime, cameraKeyframes, isDraggingGizmo])

  // Sync props with scene
  useEffect(() => {
    if (!propsGroupRef.current) return
    const group = propsGroupRef.current
    const existing = propMeshesRef.current
    const propIds = new Set(scenePropsProp.map(p => p.id))

    // Remove props no longer in scene
    existing.forEach((mesh, id) => {
      if (!propIds.has(id)) {
        group.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        existing.delete(id)
      }
    })

    // Add/update props
    for (const prop of scenePropsProp) {
      let mesh = existing.get(prop.id)
      if (!mesh) {
        // Create geometry based on shape
        let geometry: THREE.BufferGeometry
        switch (prop.shape) {
          case 'sphere': geometry = new THREE.SphereGeometry(0.5, 16, 16); break
          case 'cylinder': geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 16); break
          case 'cone': geometry = new THREE.ConeGeometry(0.4, 1, 16); break
          case 'plane': geometry = new THREE.PlaneGeometry(1, 1); break
          case 'torus': geometry = new THREE.TorusGeometry(0.4, 0.15, 12, 24); break
          default: geometry = new THREE.BoxGeometry(1, 1, 1); break
        }
        const material = new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.5, metalness: 0.2 })
        mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.propId = prop.id
        group.add(mesh)
        existing.set(prop.id, mesh)
      }

      // Update transform
      mesh.position.set(...prop.position)
      mesh.rotation.set(...prop.rotation)
      mesh.scale.set(...prop.scale)
      ;(mesh.material as THREE.MeshStandardMaterial).color.set(prop.color)
    }
  }, [scenePropsProp])

  // Update lighting when preset changes
  useEffect(() => {
    const preset = LIGHTING_PRESETS[lightingPreset] || LIGHTING_PRESETS.default
    if (ambientLightRef.current) {
      ambientLightRef.current.color.setHex(preset.ambient.color)
      ambientLightRef.current.intensity = preset.ambient.intensity
    }
    if (mainLightRef.current) {
      mainLightRef.current.color.setHex(preset.main.color)
      mainLightRef.current.intensity = preset.main.intensity
      mainLightRef.current.position.set(...preset.main.position)
    }
    if (fillLightRef.current) {
      fillLightRef.current.color.setHex(preset.fill.color)
      fillLightRef.current.intensity = preset.fill.intensity
      fillLightRef.current.position.set(...preset.fill.position)
    }
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(preset.bg)
    }
  }, [lightingPreset])

  // Load world terrain backdrop when storyId + locationId are set
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !storyId || !locationId) {
      // Clean up existing backdrop
      if (backdropGroupRef.current) {
        scene?.remove(backdropGroupRef.current)
        backdropGroupRef.current = null
      }
      if (chunkManagerRef.current) {
        chunkManagerRef.current.dispose()
        chunkManagerRef.current = null
      }
      return
    }

    const loadBackdrop = async () => {
      try {
        const data = await idbGet<SerializedWorld>(`bibliarch-world-${storyId}`)
        if (!data) return

        const world = deserializeWorld(data)
        const location = world.locations?.find(l => l.id === locationId)
        if (!location) return

        // Clean up previous
        if (backdropGroupRef.current) {
          scene.remove(backdropGroupRef.current)
        }
        if (chunkManagerRef.current) {
          chunkManagerRef.current.dispose()
        }

        // Create terrain group
        const terrainGroup = new THREE.Group()
        terrainGroup.name = 'SceneBackdrop'
        scene.add(terrainGroup)
        backdropGroupRef.current = terrainGroup

        // Create chunk manager and render terrain
        if (world.terrain && world.terrain.heights && world.terrain.heights.length > 0) {
          const chunkManager = new ChunkManager()
          terrainGroup.add(chunkManager.getGroup())
          chunkManager.setTerrain(world.terrain)
          chunkManagerRef.current = chunkManager
        }
      } catch (e) {
        console.error('Failed to load world backdrop:', e)
      }
    }

    loadBackdrop()

    return () => {
      if (chunkManagerRef.current) {
        chunkManagerRef.current.dispose()
        chunkManagerRef.current = null
      }
      if (backdropGroupRef.current) {
        scene.remove(backdropGroupRef.current)
        backdropGroupRef.current = null
      }
    }
  }, [storyId, locationId])

  // View through camera effect - toggle visibility/controls (sync happens in main loop)
  useEffect(() => {
    if (!sceneCameraRef.current) return

    sceneCameraRef.current.visible = !viewThroughCamera

    if (controlsRef.current) {
      controlsRef.current.enabled = !viewThroughCamera
    }

    return () => {
      if (sceneCameraRef.current) sceneCameraRef.current.visible = true
      if (controlsRef.current) controlsRef.current.enabled = true
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
    if (!characterManagerRef.current) return

    characters.forEach(char => {
      if (animationKeyframes.length === 0) {
        // No keyframes — reset to bind pose if something was previously applied
        const lastKey = lastAppliedAnimRef.current.get(char.id)
        if (lastKey) {
          lastAppliedAnimRef.current.delete(char.id)
          characterManagerRef.current?.applyAnimationState(char.id, {
            basePose: null, emotion: null, emotionIntensity: 1, clipAnimation: null, clipLoop: false
          })
        }
        return
      }

      const charAnimKfs = animationKeyframes
        .filter(kf => kf.characterId === char.id && kf.time <= currentTime)
        .sort((a, b) => b.time - a.time) // Most recent first

      if (charAnimKfs.length > 0) {
        const activeKf = charAnimKfs[0]
        // Build a fingerprint of id + animation content to detect both new keyframes AND updated ones
        const fingerprint = `${activeKf.id}:${activeKf.animation.basePose}:${activeKf.animation.clipAnimation}`
        const lastFingerprint = lastAppliedAnimRef.current.get(char.id)
        if (lastFingerprint !== fingerprint) {
          lastAppliedAnimRef.current.set(char.id, fingerprint)
          characterManagerRef.current?.applyAnimationState(char.id, activeKf.animation)
        }
      }
    })
  }, [currentTime, animationKeyframes, characters])

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !viewCameraRef.current || !sceneRef.current) return
    if ((isPlaying && !isRecording) || isDraggingGizmo) return

    const rect = containerRef.current.getBoundingClientRect()
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    raycasterRef.current.setFromCamera(mouseRef.current, viewCameraRef.current)

    // Collect all clickable meshes
    const allMeshes: THREE.Mesh[] = []

    // Add scene camera meshes
    if (sceneCameraRef.current) {
      sceneCameraRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          allMeshes.push(obj)
        }
      })
    }

    // Add character HITBOX meshes (not SkinnedMeshes - those raycast against bind-pose)
    const mgr = characterManagerRef.current
    if (mgr?.getAllHitboxes) {
      allMeshes.push(...mgr.getAllHitboxes())
    } else if (mgr) {
      // Fallback: traverse character groups for any mesh (less reliable for SkinnedMesh)
      mgr.getAllCharacterGroups().forEach(group => {
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) allMeshes.push(obj)
        })
      })
    }

    // Also add prop meshes
    if (propsGroupRef.current) {
      propsGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          allMeshes.push(obj)
        }
      })
    }

    const intersects = raycasterRef.current.intersectObjects(allMeshes)

    if (intersects.length > 0) {
      const hit = intersects[0].object

      // Check if it's the camera
      let parent: THREE.Object3D | null = hit.parent
      while (parent) {
        if (parent.userData.isSceneCamera) {
          onSelectRef.current('camera', 'camera')
          return
        }
        parent = parent.parent
      }

      // Check if it's a character hitbox
      const sceneCharId = characterManagerRef.current?.findCharacterByIntersection(hit)
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
    if (!containerRef.current || !viewCameraRef.current || !onContextMenuRef.current) return
    if (isPlaying) return

    const rect = containerRef.current.getBoundingClientRect()
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    raycasterRef.current.setFromCamera(mouseRef.current, viewCameraRef.current)

    // Use hitbox meshes for reliable raycasting
    const ctxMgr = characterManagerRef.current
    const ctxMeshes: THREE.Mesh[] = []
    if (ctxMgr?.getAllHitboxes) {
      ctxMeshes.push(...ctxMgr.getAllHitboxes())
    } else if (ctxMgr) {
      ctxMgr.getAllCharacterGroups().forEach(group => {
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) ctxMeshes.push(obj)
        })
      })
    }
    const intersects = raycasterRef.current.intersectObjects(ctxMeshes)
    let hitCharId: string | null = null
    if (intersects.length > 0) {
      hitCharId = characterManagerRef.current?.findCharacterByIntersection(intersects[0].object) ?? null
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
    />
  )
})

export default SceneViewer3D
