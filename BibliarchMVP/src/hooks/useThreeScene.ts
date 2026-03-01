'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  ShadowGenerator,
  type Nullable,
} from '@babylonjs/core'
import '@babylonjs/core/Culling/ray'

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

export interface BabylonSceneRefs {
  scene: Scene | null
  camera: ArcRotateCamera | null
  engine: Engine | null
  shadowGenerator: ShadowGenerator | null
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
    maxDistance: 30,
  },
  lighting: {
    ambient: { color: 0xffffff, intensity: 0.5 },
    directional: { color: 0xffffff, intensity: 0.8, position: [10, 20, 10], castShadow: true },
  },
}

function numToColor3(c: number | string | undefined): Color3 {
  if (c === undefined) return new Color3(0.1, 0.1, 0.18)
  if (typeof c === 'string') return Color3.FromHexString(c.startsWith('#') ? c : `#${c}`)
  const hex = '#' + c.toString(16).padStart(6, '0')
  return Color3.FromHexString(hex)
}

export function useThreeScene(
  containerRef: React.RefObject<HTMLDivElement | HTMLCanvasElement | null>,
  config: ThreeSceneConfig = {}
) {
  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef<ArcRotateCamera | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const shadowGenRef = useRef<ShadowGenerator | null>(null)
  const onRenderRef = useRef<(() => void) | null>(null)

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  const setOnRender = useCallback((callback: (() => void) | null) => {
    onRenderRef.current = callback
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const isCanvas = container instanceof HTMLCanvasElement
    const canvas = isCanvas ? container : document.createElement('canvas')

    if (!isCanvas) {
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      ;(container as HTMLDivElement).appendChild(canvas)
    }

    // Engine
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    })
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2))
    engineRef.current = engine

    // Scene
    const scene = new Scene(engine)
    const bgColor = numToColor3(mergedConfig.backgroundColor)
    scene.clearColor = new Color4(bgColor.r, bgColor.g, bgColor.b, 1)
    sceneRef.current = scene

    // Camera — ArcRotateCamera replaces OrbitControls
    const [tx, ty, tz] = mergedConfig.cameraTarget!
    const target = new Vector3(tx, ty, tz)
    const [cx, cy, cz] = mergedConfig.cameraPosition!
    const camPos = new Vector3(cx, cy, cz)

    // Calculate alpha, beta, radius from position and target
    const diff = camPos.subtract(target)
    const radius = diff.length()
    const beta = Math.acos(diff.y / radius)
    const alpha = Math.atan2(diff.x, diff.z)

    const camera = new ArcRotateCamera('camera', alpha, beta, radius, target, scene)
    camera.fov = (mergedConfig.cameraFov! * Math.PI) / 180
    camera.minZ = 0.1
    camera.maxZ = 1000
    camera.attachControl(canvas, true)

    const orbitConfig = mergedConfig.orbitControlsConfig!
    if (orbitConfig.maxPolarAngle !== undefined) {
      camera.upperBetaLimit = orbitConfig.maxPolarAngle
    }
    if (orbitConfig.minDistance !== undefined) {
      camera.lowerRadiusLimit = orbitConfig.minDistance
    }
    if (orbitConfig.maxDistance !== undefined) {
      camera.upperRadiusLimit = orbitConfig.maxDistance
    }
    // Damping / inertia
    camera.inertia = orbitConfig.enableDamping ? (orbitConfig.dampingFactor ?? 0.05) : 0

    cameraRef.current = camera

    // Lighting
    if (mergedConfig.lighting?.ambient) {
      const { color, intensity } = mergedConfig.lighting.ambient
      const light = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene)
      light.diffuse = numToColor3(color)
      light.intensity = intensity
    }

    let shadowGen: ShadowGenerator | null = null
    if (mergedConfig.lighting?.directional) {
      const { color, intensity, position, castShadow } = mergedConfig.lighting.directional
      const light = new DirectionalLight('directionalLight', new Vector3(-position[0], -position[1], -position[2]).normalize(), scene)
      light.position = new Vector3(position[0], position[1], position[2])
      light.diffuse = numToColor3(color)
      light.intensity = intensity

      if (castShadow && mergedConfig.enableShadows) {
        shadowGen = new ShadowGenerator(2048, light)
        shadowGen.useBlurExponentialShadowMap = true
        shadowGenRef.current = shadowGen
      }
    }

    // Render loop
    scene.registerBeforeRender(() => {
      onRenderRef.current?.()
    })

    engine.runRenderLoop(() => {
      scene.render()
    })

    // Resize
    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
      if (!isCanvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
      sceneRef.current = null
      cameraRef.current = null
      engineRef.current = null
      shadowGenRef.current = null
    }
  }, [])

  // Raycast helper — uses Babylon.js scene.pick
  const raycast = useCallback((predicate?: (mesh: any) => boolean) => {
    const scene = sceneRef.current
    if (!scene) return null
    return scene.pick(scene.pointerX, scene.pointerY, predicate)
  }, [])

  return {
    refs: {
      scene: sceneRef,
      camera: cameraRef,
      engine: engineRef,
      shadowGenerator: shadowGenRef,
    },
    setOnRender,
    raycast,
  }
}
