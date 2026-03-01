'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Engine,
  Scene,
  FreeCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  SceneLoader,
  TransformNode,
  AbstractMesh,
  StandardMaterial,
  Mesh,
} from '@babylonjs/core'
import '@babylonjs/loaders'
import { createToonMaterial } from '@/lib/shaders/toonMaterial'

interface CharacterColors {
  hair?: string
  tops?: { primary: string; secondary?: string }
  pants?: string
  dresses?: string
  shoes?: string
  socks?: string
  accessories?: string
  body?: { skinTone: string; eyeColor: string }
}

interface CharacterData {
  id: string
  name: string
  visibleAssets?: string[]
  colors?: CharacterColors
}

interface CharacterThumbnail3DProps {
  character: CharacterData
  size?: number
}

// Cache the loaded model
let cachedBaseModel: TransformNode | null = null
let modelLoadPromise: Promise<TransformNode> | null = null
let cacheScene: Scene | null = null

async function loadBaseModel(scene: Scene): Promise<TransformNode> {
  if (cachedBaseModel && cacheScene === scene) return cachedBaseModel

  if (!modelLoadPromise || cacheScene !== scene) {
    cacheScene = scene
    modelLoadPromise = (async () => {
      const result = await SceneLoader.ImportMeshAsync('', '/models/', 'Neighbor Base V16.glb', scene)
      const root = new TransformNode('cached-char-model', scene)
      for (const mesh of result.meshes) {
        if (!mesh.parent || mesh.parent.name === '__root__') {
          mesh.parent = root
        }
      }
      cachedBaseModel = root
      return root
    })()
  }

  return modelLoadPromise
}

export default function CharacterThumbnail3D({ character, size = 48 }: CharacterThumbnail3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let mounted = true

    async function renderThumbnail() {
      try {
        // Create engine and scene
        const engine = new Engine(canvas!, true, { preserveDrawingBuffer: true })
        const scene = new Scene(engine)
        scene.clearColor = new Color4(0, 0, 0, 0) // Transparent background
        engineRef.current = engine

        // Camera - focused on head/upper body
        const camera = new FreeCamera('thumbCam', new Vector3(0, 1.5, 2.5), scene)
        camera.setTarget(new Vector3(0, 1.2, 0))
        camera.fov = 35 * Math.PI / 180

        // Lighting
        const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
        ambient.intensity = 0.8

        const keyLight = new DirectionalLight('keyLight', new Vector3(-2, -3, -2).normalize(), scene)
        keyLight.intensity = 0.9

        const fillLight = new DirectionalLight('fillLight', new Vector3(2, -1, -1).normalize(), scene)
        fillLight.intensity = 0.4
        fillLight.diffuse = Color3.FromHexString('#8888ff')

        // Load base model
        const baseModel = await loadBaseModel(scene)

        if (!mounted || !canvas) return

        // Clone and customize model
        const modelClone = baseModel.clone('char-clone', null)!

        // Apply character customization
        modelClone.getChildMeshes().forEach((mesh) => {
          const meshName = mesh.name
          const lowerName = meshName.toLowerCase()

          // Check visibility - show body parts by default
          const visibleAssets = character.visibleAssets || []
          const isBodyPart = lowerName.includes('body') || lowerName === 'body'
          const isVisible = visibleAssets.includes(meshName) || isBodyPart

          mesh.setEnabled(isVisible)

          // Apply colors with toon shading
          if (character.colors && isVisible) {
            let baseColor = '#888888'
            const colors = character.colors

            if (lowerName.includes('hair') || lowerName.includes('brow')) {
              if (colors.hair) baseColor = colors.hair
            } else if (lowerName.includes('body') || lowerName.includes('skin')) {
              if (colors.body?.skinTone) baseColor = colors.body.skinTone
            } else if (lowerName.includes('eye')) {
              if (colors.body?.eyeColor) baseColor = colors.body.eyeColor
            } else if (lowerName.includes('shirt') || lowerName.includes('top')) {
              if (colors.tops?.primary) baseColor = colors.tops.primary
            } else if (lowerName.includes('pants') || lowerName.includes('jean')) {
              if (colors.pants) baseColor = colors.pants
            } else if (lowerName.includes('shoe')) {
              if (colors.shoes) baseColor = colors.shoes
            } else if (lowerName.includes('dress')) {
              if (colors.dresses) baseColor = colors.dresses
            }

            mesh.material = createToonMaterial(scene, {
              color: baseColor,
              steps: 4,
              ambient: 0.35,
            })
          }
        })

        // Center model - compute bounding box
        const childMeshes = modelClone.getChildMeshes()
        if (childMeshes.length > 0) {
          let min = childMeshes[0].getBoundingInfo().boundingBox.minimumWorld.clone()
          let max = childMeshes[0].getBoundingInfo().boundingBox.maximumWorld.clone()
          for (const m of childMeshes) {
            if (!m.isEnabled()) continue
            const bb = m.getBoundingInfo().boundingBox
            min = Vector3.Minimize(min, bb.minimumWorld)
            max = Vector3.Maximize(max, bb.maximumWorld)
          }
          const center = Vector3.Center(min, max)
          modelClone.position.x = -center.x
          modelClone.position.z = -center.z
          modelClone.position.y = -min.y
        }

        // Render single frame
        scene.render()

        if (!mounted) return
        setIsLoading(false)

        // Cleanup model clone
        modelClone.dispose()

      } catch (error) {
        console.error('Error rendering character thumbnail:', error)
        if (mounted) {
          setHasError(true)
          setIsLoading(false)
        }
      }
    }

    renderThumbnail()

    return () => {
      mounted = false
      if (engineRef.current) {
        engineRef.current.dispose()
        engineRef.current = null
      }
    }
  }, [character.id, character.colors, character.visibleAssets, size])

  // Show fallback while loading or on error
  if (hasError) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white text-xs font-bold shadow-inner"
        style={{
          width: size,
          height: size,
          backgroundColor: character.colors?.body?.skinTone || '#6b7280',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        {character.name.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    <div
      className="relative rounded-full overflow-hidden"
      style={{ width: size, height: size, backgroundColor: '#1a1a2e' }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="w-full h-full"
      />
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-full"
          style={{ backgroundColor: character.colors?.body?.skinTone || '#6b7280' }}
        >
          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
