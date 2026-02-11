'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// Using standard materials instead of custom toon shader for stability
import { SceneCharacterManager } from '@/lib/scenes/SceneCharacterManager'
import type { SceneCharacter, DialogueLine, CharacterData, TransformGizmoMode } from '@/types/scenes'

// Re-export types for backward compatibility
export type { SceneCharacter, DialogueLine }

// Dynamic import type for TransformControls
type TransformControlsType = import('three-stdlib').TransformControls

interface SceneViewer3DProps {
  characters: SceneCharacter[]
  characterDataMap: Map<string, CharacterData>  // Full character appearance data
  selectedCharacterId: string | null
  onSelectCharacter: (id: string | null) => void
  onMoveCharacter: (id: string, position: [number, number, number], rotation: number) => void
  isPlaying: boolean
  currentTime: number
  gizmoMode?: TransformGizmoMode
  onGizmoModeChange?: (mode: TransformGizmoMode) => void
}

export default function SceneViewer3D({
  characters,
  characterDataMap,
  selectedCharacterId,
  onSelectCharacter,
  onMoveCharacter,
  isPlaying,
  currentTime,
  gizmoMode = 'translate',
  onGizmoModeChange
}: SceneViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const transformControlsRef = useRef<TransformControlsType | null>(null)
  const characterManagerRef = useRef<SceneCharacterManager | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const floorRef = useRef<THREE.Mesh | null>(null)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock())

  // Placeholder meshes for characters without loaded models (fallback)
  const placeholderMeshesRef = useRef<Map<string, THREE.Group>>(new Map())

  // Track if we're in gizmo drag mode
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false)

  // Store callbacks in refs to avoid recreating the scene when they change
  const onMoveCharacterRef = useRef(onMoveCharacter)
  const onSelectCharacterRef = useRef(onSelectCharacter)
  const onGizmoModeChangeRef = useRef(onGizmoModeChange)

  // Keep refs updated
  useEffect(() => {
    onMoveCharacterRef.current = onMoveCharacter
    onSelectCharacterRef.current = onSelectCharacter
    onGizmoModeChangeRef.current = onGizmoModeChange
  })

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e) // Dark blue-ish background
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 8, 12)
    camera.lookAt(0, 1, 0)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2.1
    controls.minDistance = 5
    controls.maxDistance = 30
    controls.target.set(0, 1, 0)
    controlsRef.current = controls

    // Transform controls (gizmo) - loaded dynamically to avoid module resolution issues
    let transformControls: TransformControlsType | null = null

    const initTransformControls = async () => {
      try {
        // Use three-stdlib for better bundler compatibility
        const { TransformControls } = await import('three-stdlib')
        transformControls = new TransformControls(camera, renderer.domElement)
        transformControls.setMode('translate')
        transformControls.setSpace('world')

        // Add to scene
        scene.add(transformControls as unknown as THREE.Object3D)

        transformControlsRef.current = transformControls

        // Use type assertion for event listeners due to three-stdlib type issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tc = transformControls as any

        // Disable orbit controls when using gizmo
        tc.addEventListener('dragging-changed', (event: { value: boolean }) => {
          controls.enabled = !event.value
          setIsDraggingGizmo(event.value)
        })

        // Update character position when gizmo changes
        tc.addEventListener('change', () => {
          const obj = tc.object as THREE.Object3D | undefined
          if (!obj) return
          const sceneCharId = obj.userData.sceneCharacterId
          if (sceneCharId) {
            const pos: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z]
            const rot = obj.rotation.y
            onMoveCharacterRef.current(sceneCharId, pos, rot)
          }
        })
      } catch (error) {
        console.warn('Failed to initialize TransformControls:', error)
      }
    }

    initTransformControls()

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(10, 20, 10)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 2048
    mainLight.shadow.mapSize.height = 2048
    mainLight.shadow.camera.near = 0.5
    mainLight.shadow.camera.far = 100
    mainLight.shadow.camera.left = -20
    mainLight.shadow.camera.right = 20
    mainLight.shadow.camera.top = 20
    mainLight.shadow.camera.bottom = -20
    scene.add(mainLight)

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    fillLight.position.set(-10, 10, -10)
    scene.add(fillLight)

    // Create stage floor with standard material
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
    floorRef.current = floor

    // Add stage edge glow
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

    // Grid helper on floor
    const gridHelper = new THREE.GridHelper(20, 20, 0x444466, 0x333355)
    gridHelper.position.y = 0.02
    scene.add(gridHelper)

    // Character manager
    const characterGroup = new THREE.Group()
    characterGroup.name = 'characters'
    scene.add(characterGroup)
    characterManagerRef.current = new SceneCharacterManager(characterGroup)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)

      const delta = clockRef.current.getDelta()

      // Update character animations
      characterManagerRef.current?.update(delta)

      // Check if TransformControls attached object is still in scene
      const tc = transformControlsRef.current as any
      if (tc?.object && !tc.object.parent) {
        tc.detach()
      }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Keyboard shortcuts for gizmo modes
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
          onSelectCharacterRef.current(null)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      characterManagerRef.current?.dispose()
      transformControlsRef.current?.dispose()
      controls.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, []) // Empty deps - scene created once, callbacks accessed via refs

  // Update gizmo mode when prop changes
  useEffect(() => {
    if (transformControlsRef.current && gizmoMode) {
      transformControlsRef.current.setMode(gizmoMode)
    }
  }, [gizmoMode])

  // Update character data map
  useEffect(() => {
    characterManagerRef.current?.setCharacterDataMap(characterDataMap)
  }, [characterDataMap])

  // Sync characters with scene
  useEffect(() => {
    if (!characterManagerRef.current) return

    characterManagerRef.current.syncCharacters(characters)
  }, [characters])

  // Update transform controls attachment when selection changes
  useEffect(() => {
    const transformControls = transformControlsRef.current
    if (!transformControls || !characterManagerRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tc = transformControls as any
    let retryCount = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const tryAttach = (): boolean => {
      if (!selectedCharacterId) {
        tc.detach()
        return true
      }

      const group = characterManagerRef.current?.getCharacterGroup(selectedCharacterId)

      // Check if group exists and is in scene graph (traverse up to find scene)
      if (group) {
        let obj: THREE.Object3D | null = group
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
            tc.attach(group)
            return true
          } catch {
            // Attachment failed, will retry
          }
        }
      }

      tc.detach()
      return false
    }

    // Try immediately
    if (!tryAttach() && selectedCharacterId) {
      // Retry with increasing delays up to 5 times
      const scheduleRetry = () => {
        if (retryCount >= 5) return
        retryCount++
        timeoutId = setTimeout(() => {
          if (!tryAttach() && selectedCharacterId) {
            scheduleRetry()
          }
        }, 50 * retryCount)
      }
      scheduleRetry()
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [selectedCharacterId, characters])

  // Disable gizmo during playback
  useEffect(() => {
    if (transformControlsRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transformControlsRef.current as any).enabled = !isPlaying
    }
  }, [isPlaying])

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return
    if (isPlaying || isDraggingGizmo) return

    const rect = containerRef.current.getBoundingClientRect()
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)

    // Get all character meshes for intersection
    const characterGroups = characterManagerRef.current?.getAllCharacterGroups() ?? []
    const allMeshes: THREE.Mesh[] = []
    characterGroups.forEach(group => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          allMeshes.push(obj)
        }
      })
    })

    // Also check placeholder meshes
    placeholderMeshesRef.current.forEach(group => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          allMeshes.push(obj)
        }
      })
    })

    const intersects = raycasterRef.current.intersectObjects(allMeshes)

    if (intersects.length > 0) {
      // Find the character this mesh belongs to
      const sceneCharId = characterManagerRef.current?.findCharacterByIntersection(intersects[0].object)

      // Also check placeholder meshes
      let foundId = sceneCharId
      if (!foundId) {
        let parent = intersects[0].object.parent
        while (parent && !parent.userData.sceneCharacterId) {
          parent = parent.parent
        }
        if (parent?.userData.sceneCharacterId) {
          foundId = parent.userData.sceneCharacterId
        }
      }

      if (foundId) {
        onSelectCharacterRef.current(foundId)
        return
      }
    }

    // Click on empty space - deselect
    onSelectCharacterRef.current(null)
  }, [isPlaying, isDraggingGizmo])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onMouseDown={handleMouseDown}
    />
  )
}
