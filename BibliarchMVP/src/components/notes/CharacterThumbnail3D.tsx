'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
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
let cachedBaseModel: THREE.Group | null = null
let modelLoadPromise: Promise<THREE.Group> | null = null

async function loadBaseModel(): Promise<THREE.Group> {
  if (cachedBaseModel) return cachedBaseModel

  if (!modelLoadPromise) {
    modelLoadPromise = new Promise((resolve, reject) => {
      const loader = new GLTFLoader()
      loader.load(
        '/models/Neighbor Base V16.glb',
        (gltf) => {
          cachedBaseModel = gltf.scene
          resolve(cachedBaseModel)
        },
        undefined,
        (error) => {
          console.error('Failed to load character model for thumbnails:', error)
          reject(error)
        }
      )
    })
  }

  return modelLoadPromise
}

export default function CharacterThumbnail3D({ character, size = 48 }: CharacterThumbnail3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let mounted = true

    async function renderThumbnail() {
      try {
        const baseModel = await loadBaseModel()

        if (!mounted || !canvas) return

        // Create renderer with the actual canvas element
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true
        })
        renderer.setSize(size, size)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setClearColor(0x000000, 0) // Transparent background
        rendererRef.current = renderer

        // Create scene
        const scene = new THREE.Scene()

        // Camera - focused on head/upper body
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
        camera.position.set(0, 1.5, 2.5)
        camera.lookAt(0, 1.2, 0)

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
        scene.add(ambientLight)

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.9)
        keyLight.position.set(2, 3, 2)
        scene.add(keyLight)

        const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4)
        fillLight.position.set(-2, 1, 1)
        scene.add(fillLight)

        // Clone and customize model
        const modelClone = baseModel.clone(true)

        // Apply character customization
        modelClone.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const meshName = obj.name
            const lowerName = meshName.toLowerCase()

            // Check visibility - show body parts by default
            const visibleAssets = character.visibleAssets || []
            const isBodyPart = lowerName.includes('body') || lowerName === 'body'
            const isVisible = visibleAssets.includes(meshName) || isBodyPart

            obj.visible = isVisible

            // Apply colors with toon shading
            if (character.colors) {
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

              obj.material = createToonMaterial({
                color: baseColor,
                steps: 4,
                ambient: 0.35,
              })
            }
          }
        })

        // Center model
        const box = new THREE.Box3().setFromObject(modelClone)
        const center = box.getCenter(new THREE.Vector3())
        modelClone.position.x = -center.x
        modelClone.position.z = -center.z
        modelClone.position.y = -box.min.y

        scene.add(modelClone)

        // Render
        renderer.render(scene, camera)

        if (!mounted) return
        setIsLoading(false)

        // Cleanup model clone
        scene.remove(modelClone)
        modelClone.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose())
            } else {
              obj.material.dispose()
            }
          }
        })

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
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
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
