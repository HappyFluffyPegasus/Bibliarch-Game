'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface ThreeSceneConfig {
  backgroundColor?: number | string
  cameraPosition?: [number, number, number]
  cameraTarget?: [number, number, number]
  cameraFov?: number
  enableShadows?: boolean
  orbitControlsConfig?: {
    enableDamping?: boolean
    dampingFactor?: number
    maxPolarAngle?: number
    minDistance?: number
    maxDistance?: number
  }
  lighting?: {
    ambient?: { color: number; intensity: number }
    directional?: { color: number; intensity: number; position: [number, number, number]; castShadow?: boolean }
  }
}

export interface ThreeSceneRefs {
  scene: THREE.Scene | null
  camera: THREE.PerspectiveCamera | null
  renderer: THREE.WebGLRenderer | null
  controls: OrbitControls | null
  raycaster: THREE.Raycaster
  mouse: THREE.Vector2
}

const DEFAULT_CONFIG: ThreeSceneConfig = {
  backgroundColor: 0x1a1a2e,
  cameraPosition: [0, 8, 12],
  cameraTarget: [0, 1, 0],
  cameraFov: 50,
  enableShadows: true,
  orbitControlsConfig: {
    enableDamping: true,
    dampingFactor: 0.05,
    maxPolarAngle: Math.PI / 2.1,
    minDistance: 5,
    maxDistance: 30
  },
  lighting: {
    ambient: { color: 0xffffff, intensity: 0.5 },
    directional: { color: 0xffffff, intensity: 0.8, position: [10, 20, 10], castShadow: true }
  }
}

export function useThreeScene(
  containerRef: React.RefObject<HTMLDivElement | HTMLCanvasElement | null>,
  config: ThreeSceneConfig = {}
) {
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const animationFrameRef = useRef<number | null>(null)
  const onRenderRef = useRef<(() => void) | null>(null)

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  // Animation loop callback
  const setOnRender = useCallback((callback: (() => void) | null) => {
    onRenderRef.current = callback
  }, [])

  // Initialize scene
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const isCanvas = container instanceof HTMLCanvasElement
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    const bgColor = typeof mergedConfig.backgroundColor === 'string'
      ? new THREE.Color(mergedConfig.backgroundColor)
      : new THREE.Color(mergedConfig.backgroundColor)
    scene.background = bgColor
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(
      mergedConfig.cameraFov,
      width / height,
      0.1,
      1000
    )
    const [cx, cy, cz] = mergedConfig.cameraPosition!
    camera.position.set(cx, cy, cz)
    const [tx, ty, tz] = mergedConfig.cameraTarget!
    camera.lookAt(tx, ty, tz)
    cameraRef.current = camera

    // Renderer
    const rendererOptions: THREE.WebGLRendererParameters = { antialias: true }
    if (isCanvas) {
      rendererOptions.canvas = container
    }
    const renderer = new THREE.WebGLRenderer(rendererOptions)
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    if (mergedConfig.enableShadows) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }
    if (!isCanvas) {
      (container as HTMLDivElement).appendChild(renderer.domElement)
    }
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    const orbitConfig = mergedConfig.orbitControlsConfig!
    controls.enableDamping = orbitConfig.enableDamping ?? true
    controls.dampingFactor = orbitConfig.dampingFactor ?? 0.05
    if (orbitConfig.maxPolarAngle !== undefined) {
      controls.maxPolarAngle = orbitConfig.maxPolarAngle
    }
    if (orbitConfig.minDistance !== undefined) {
      controls.minDistance = orbitConfig.minDistance
    }
    if (orbitConfig.maxDistance !== undefined) {
      controls.maxDistance = orbitConfig.maxDistance
    }
    controls.target.set(tx, ty, tz)
    controlsRef.current = controls

    // Lighting
    if (mergedConfig.lighting?.ambient) {
      const { color, intensity } = mergedConfig.lighting.ambient
      const ambientLight = new THREE.AmbientLight(color, intensity)
      scene.add(ambientLight)
    }
    if (mergedConfig.lighting?.directional) {
      const { color, intensity, position, castShadow } = mergedConfig.lighting.directional
      const directionalLight = new THREE.DirectionalLight(color, intensity)
      directionalLight.position.set(...position)
      if (castShadow) {
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.width = 2048
        directionalLight.shadow.mapSize.height = 2048
        directionalLight.shadow.camera.near = 0.5
        directionalLight.shadow.camera.far = 50
        directionalLight.shadow.camera.left = -20
        directionalLight.shadow.camera.right = 20
        directionalLight.shadow.camera.top = 20
        directionalLight.shadow.camera.bottom = -20
      }
      scene.add(directionalLight)
    }

    // Animation loop
    function animate() {
      animationFrameRef.current = requestAnimationFrame(animate)
      controls.update()
      onRenderRef.current?.()
      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
    function handleResize() {
      const currentContainer = containerRef.current
      if (!currentContainer) return
      const newWidth = currentContainer.clientWidth
      const newHeight = currentContainer.clientHeight
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      controls.dispose()
      renderer.dispose()
      if (!isCanvas && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      // Dispose scene objects
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((m) => m.dispose())
          } else {
            object.material?.dispose()
          }
        }
      })
    }
  }, []) // Only run once on mount

  // Update mouse position helper
  const updateMouse = useCallback((event: MouseEvent, container: HTMLElement) => {
    const rect = container.getBoundingClientRect()
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }, [])

  // Raycast helper
  const raycast = useCallback((objects: THREE.Object3D[]): THREE.Intersection[] => {
    if (!cameraRef.current) return []
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)
    return raycasterRef.current.intersectObjects(objects, true)
  }, [])

  return {
    refs: {
      scene: sceneRef,
      camera: cameraRef,
      renderer: rendererRef,
      controls: controlsRef,
      raycaster: raycasterRef,
      mouse: mouseRef
    },
    setOnRender,
    updateMouse,
    raycast
  }
}
