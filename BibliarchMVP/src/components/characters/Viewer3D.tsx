'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { createToonMaterial, setToonMaterialColor, createColoredShadowMaterial } from '@/lib/shaders/toonMaterial'
import { getUndertoneTexturePath, getUndertone } from '@/lib/hairTextures'
import { SpringBoneSystem } from '@/lib/SpringBoneSystem'
import { loadShapeKeyData, applyShapeKeysToModel } from '@/lib/characters/shapeKeyLoader'

type Section = 'BODY' | 'HAIR' | 'TOPS' | 'DRESSES' | 'PANTS' | 'SHOES' | 'ACCESSORIES' | 'EXPRESSIONS' | 'POSES' | null

export interface Transform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface CategoryColors {
  hair: string
  hairUndertone?: string  // ID from HAIR_UNDERTONES
  tops: {
    primary: string
    secondary?: string
  }
  pants: string
  dresses: string
  shoes: string
  socks: string
  accessories: string
  body: {
    skinTone: string
    eyeColor: string
  }
}

export interface MorphTargetInfo {
  meshName: string
  targetName: string
  index: number
}

interface Viewer3DProps {
  currentSection: Section
  visibleAssets: string[]
  categoryColors?: CategoryColors
  meshColors?: Record<string, string>
  transforms?: Record<string, Transform>
  onMeshesLoaded?: (meshes: string[]) => void
  onMorphTargetsLoaded?: (morphTargets: MorphTargetInfo[]) => void
  morphTargetValues?: Record<string, number>
  selectedPose?: string | null
  heightScale?: number // 1.0 = normal, 0.8 = shorter, 1.2 = taller
}

const CAMERA_POSITIONS = {
  DEFAULT: { position: new THREE.Vector3(-4, 1.65, 0), target: new THREE.Vector3(0, 1.4, 0), fov: 30 },
  BODY: { position: new THREE.Vector3(-4, 1.65, 0), target: new THREE.Vector3(0, 1.4, 0), fov: 30 },
  HAIR: { position: new THREE.Vector3(-1.2, 1.7, 0), target: new THREE.Vector3(0, 1.65, 0), fov: 40 },
  TOPS: { position: new THREE.Vector3(-1.8, 1.2, 0), target: new THREE.Vector3(0, 1.1, 0), fov: 45 },
  DRESSES: { position: new THREE.Vector3(-2.8, 1.0, 0), target: new THREE.Vector3(0, 1.0, 0), fov: 40 },
  PANTS: { position: new THREE.Vector3(-2.0, 0.8, 0), target: new THREE.Vector3(0, 0.6, 0), fov: 50 },
  SHOES: { position: new THREE.Vector3(-1.5, 0.3, 0.3), target: new THREE.Vector3(0, 0.1, 0), fov: 45 },
  ACCESSORIES: { position: new THREE.Vector3(-5, 1.55, 0), target: new THREE.Vector3(0, 1.1, 0), fov: 28 },
  EXPRESSIONS: { position: new THREE.Vector3(-4, 1.65, 0), target: new THREE.Vector3(0, 1.4, 0), fov: 30 },
  POSES: { position: new THREE.Vector3(-4, 1.65, 0), target: new THREE.Vector3(0, 1.4, 0), fov: 30 },
}

export default function Viewer3D({ currentSection, visibleAssets, categoryColors, meshColors, transforms, onMeshesLoaded, onMorphTargetsLoaded, morphTargetValues, selectedPose, heightScale = 1.0 }: Viewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const skinnedMeshMapRef = useRef<Map<string, THREE.SkinnedMesh>>(new Map())
  const materialMapRef = useRef<Map<string, THREE.Material>>(new Map())
  const sceneObjectsRef = useRef<THREE.Group | null>(null)
  const originalTransformsRef = useRef<Map<string, { position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }>>(new Map())

  // Animation system refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock())
  const bindPoseRef = useRef<Map<string, { position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3 }>>(new Map())
  const modelBonesRef = useRef<string[]>([])
  const heightScaleRef = useRef<number>(1.0)
  const visibleAssetsRef = useRef<string[]>(visibleAssets)
  const hairTextureRef = useRef<THREE.Texture | null>(null)
  const currentHairColorRef = useRef<string | null>(null)
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null)
  const springBonesRef = useRef<SpringBoneSystem | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [currentHairTexture, setCurrentHairTexture] = useState<string | null>(null)

  // Keep ref in sync with prop
  visibleAssetsRef.current = visibleAssets

  useEffect(() => {
    if (!canvasRef.current) return

    let mounted = true
    const canvas = canvasRef.current

    // Clear stale refs from previous mount (React StrictMode double-mount)
    meshMapRef.current.clear()
    skinnedMeshMapRef.current.clear()
    materialMapRef.current.clear()

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x2a2a2a)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      28,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    )
    camera.position.set(-4, 1.65, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true
    })
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, canvas)
    controls.target.set(0, 1.1, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 0.5
    controls.maxDistance = 8
    controls.maxPolarAngle = Math.PI / 1.5
    controls.minPolarAngle = Math.PI / 6
    controls.enablePan = false
    controls.rotateSpeed = 0.8
    controls.zoomSpeed = 0.8
    controlsRef.current = controls

    // Key light - bright white from front
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0)
    directionalLight.position.set(-3, 1.4, 2)
    scene.add(directionalLight)

    // Warm ambient to tint shadow areas orange (not black!)
    const ambientLight = new THREE.AmbientLight(0xff6622, 0.8)
    scene.add(ambientLight)

    const grid = new THREE.GridHelper(10, 10, 0x404040, 0x404040)
    scene.add(grid)

    const textureLoader = new THREE.TextureLoader()
    textureLoaderRef.current = textureLoader

    // Load hair texture based on undertone selection
    const initialHairColor = categoryColors?.hair || '#4a3728' // Default brown
    const initialUndertone = categoryColors?.hairUndertone || 'warm'
    const texturePath = getUndertoneTexturePath(initialUndertone)
    const undertone = getUndertone(initialUndertone)
    currentHairColorRef.current = initialHairColor
    setCurrentHairTexture(undertone?.name || 'Warm')
    console.log('Hair undertone:', initialUndertone, '->', texturePath)

    const hairTexture = textureLoader.load(
      texturePath,
      (tex) => {
        console.log('Hair texture loaded successfully', tex)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        hairTextureRef.current = tex
      },
      undefined,
      (err) => {
        console.error('Failed to load hair texture:', err)
      }
    )

    const fbxLoader = new FBXLoader()
    fbxLoader.load('/models/Bibliarch Maybe.fbx', (fbx) => {
        if (!mounted) return

        fbx.scale.setScalar(0.01)
        fbx.name = 'Character Rig'
        fbx.rotation.y = -Math.PI / 2

        const wrapper = new THREE.Group()
        wrapper.name = 'animationRoot'
        wrapper.add(fbx)
        scene.add(wrapper)
        sceneObjectsRef.current = wrapper

        // Rebind all SkinnedMeshes AFTER adding to scene
        fbx.updateMatrixWorld(true)
        fbx.traverse((node) => {
          if (node instanceof THREE.SkinnedMesh) {
            node.bind(node.skeleton)
          }
        })

        const meshes: string[] = []
        const morphTargets: MorphTargetInfo[] = []
        const boneNames: string[] = []

        const workingMeshes = new Map<string, THREE.SkinnedMesh>()

        // Force all nodes visible first — parent visibility=false blocks child rendering
        fbx.traverse((node) => { node.visible = true })

        fbx.traverse((node) => {
          if (node instanceof THREE.Bone) {
            boneNames.push(node.name)
            bindPoseRef.current.set(node.name, {
              position: node.position.clone(),
              quaternion: node.quaternion.clone(),
              scale: node.scale.clone()
            })
          }

          if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
            const meshName = node.name || 'unnamed_mesh'
            console.log('Found mesh:', meshName)
            meshes.push(meshName)
            meshMapRef.current.set(meshName, node as THREE.Mesh)

            if (node instanceof THREE.SkinnedMesh) {
              skinnedMeshMapRef.current.set(meshName, node)
              workingMeshes.set(meshName, node)
            }

            originalTransformsRef.current.set(meshName, {
              position: node.position.clone(),
              rotation: node.rotation.clone(),
              scale: node.scale.clone()
            })

            const lowerName = meshName.toLowerCase()

            // Check if this is an eye mesh - keep original material completely unchanged
            const isEyeMesh = lowerName === 'eye' || lowerName === 'iris' || lowerName.includes('eye white') || lowerName.includes('eye_white')

            if (!isEyeMesh) {
              // Convert materials to toon shading for non-eye meshes
              const materials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []
              const toonMaterials: THREE.Material[] = []
              const isSkinned = node instanceof THREE.SkinnedMesh

              materials.forEach((mat, matIndex) => {
                let baseColor = new THREE.Color(0xcccccc)
                let map: THREE.Texture | null = null

                if (mat instanceof THREE.MeshStandardMaterial ||
                    mat instanceof THREE.MeshPhongMaterial ||
                    mat instanceof THREE.MeshBasicMaterial ||
                    mat instanceof THREE.MeshLambertMaterial) {
                  baseColor = mat.color.clone()
                  map = mat.map
                  // Ensure FBX-loaded textures use correct color space
                  if (map) {
                    map.colorSpace = THREE.SRGBColorSpace
                    map.needsUpdate = true
                  }
                }

                // For skinned meshes, use MeshToonMaterial (preserves textures)
                let toonMat: THREE.Material
                if (isSkinned) {
                  // Check if this is a skin/body mesh
                  const isSkinMesh = lowerName.includes('body') || lowerName.includes('skin') ||
                                     lowerName.includes('head') || lowerName.includes('face') ||
                                     lowerName.includes('hand') || lowerName.includes('arm') ||
                                     lowerName.includes('leg') || lowerName.includes('foot')

                  // Check if this is a hair mesh
                  const isHairMesh = lowerName.includes('hair') || lowerName.includes('pigtail') ||
                                     lowerName.includes('ponytail') || lowerName.includes('bob') ||
                                     lowerName.includes('bangs') || lowerName.includes('bun') ||
                                     lowerName.includes('braids') || lowerName.includes('luke') ||
                                     lowerName.includes('ahoge')

                  if (isHairMesh) {
                    console.log('Found hair mesh:', meshName, 'applying hair texture with tint')
                  }

                  // Use toon material - warm ambient light tints shadow areas
                  // For hair, use the tint color to adjust texture to desired color
                  const hairTintColor = isHairMesh
                    ? new THREE.Color(initialHairColor)  // Tint texture to target color
                    : new THREE.Color(baseColor)

                  // Determine material role from its name
                  const matNameLower = (mat?.name || '').toLowerCase()
                  const isFaceTextureMat = matNameLower.includes('chill') || (map && isSkinMesh)
                  const isEyeWhiteMat = matNameLower.includes('eye white') || matNameLower.includes('eye_white') || matNameLower.includes('eyewhite')
                  const hasOriginalMap = !isHairMesh && map

                  toonMat = createColoredShadowMaterial({
                    // Face texture: use skin tone as tint (multiply with texture)
                    // Hair: use hair tint color
                    // Eye whites: bright white
                    // Other textured: white to not darken
                    color: isHairMesh ? hairTintColor
                      : isFaceTextureMat ? new THREE.Color(categoryColors?.body?.skinTone || '#ffffff')
                      : isEyeWhiteMat ? new THREE.Color(0xffffff)
                      : (hasOriginalMap ? new THREE.Color(0xffffff) : baseColor),
                    map: isHairMesh ? hairTexture : map,
                  })

                  // Face texture PNG has transparent areas — use alphaTest
                  // to cut them out. High threshold (0.99) ensures only fully
                  // opaque pixels render, so semi-transparent edges don't
                  // get filled with the skin tone multiply color.
                  if (isFaceTextureMat && toonMat instanceof THREE.MeshToonMaterial) {
                    toonMat.alphaTest = 0.99
                  }

                  // Eye whites: double-sided (normals may face inward into socket)
                  if (isEyeWhiteMat) {
                    toonMat.side = THREE.DoubleSide
                  }

                  // Tag skin meshes (but not eye whites or face texture sub-materials)
                  if (isSkinMesh && !isEyeWhiteMat && !isFaceTextureMat) {
                    ;(toonMat as any)._isSkinMesh = true
                  }
                  if (isFaceTextureMat) {
                    ;(toonMat as any)._isFaceTexture = true
                  }
                  if (hasOriginalMap && !isFaceTextureMat) {
                    ;(toonMat as any)._hasImageMap = true
                  }
                  if (isHairMesh) {
                    ;(toonMat as any)._isHairMesh = true
                  }
                } else {
                  // Use MeshToonMaterial for non-skinned meshes too, so textures (UV maps) work
                  // White color when textured to avoid darkening via multiplication
                  toonMat = createColoredShadowMaterial({
                    color: map ? new THREE.Color(0xffffff) : baseColor,
                    map: map ?? undefined,
                  })
                  if (map) {
                    ;(toonMat as any)._hasImageMap = true
                  }
                }

                toonMaterials.push(toonMat)
                const matName = mat?.name || `${meshName}_mat_${matIndex}`
                if (!materialMapRef.current.has(matName)) {
                  materialMapRef.current.set(matName, toonMat)
                }
              })

              // Apply toon materials to mesh
              if (toonMaterials.length === 1) {
                node.material = toonMaterials[0]
              } else if (toonMaterials.length > 1) {
                node.material = toonMaterials
              }

            } else {
              // Eye meshes — fix texture, remove excessive specular/emissive
              const eyeMats = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []
              const newMats = eyeMats.map((mat) => {
                // Eye whites: pure flat white, no shading, no lighting
                if (lowerName.includes('eye white') || lowerName.includes('eye_white')) {
                  const m = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                  })
                  ;(m as any).morphTargets = true
                  m.needsUpdate = true
                  return m
                }
                // Iris: unlit MeshBasicMaterial so texture shows without lighting
                const map = (mat as any).map || null
                if (map) {
                  map.colorSpace = THREE.SRGBColorSpace
                  map.needsUpdate = true
                }
                const m = new THREE.MeshBasicMaterial({
                  map,
                  color: 0xffffff,
                })
                ;(m as any).morphTargets = true
                m.needsUpdate = true
                return m
              })
              node.material = newMats.length === 1 ? newMats[0] : newMats
              // Render eyes after body so they show through face cutouts
              node.renderOrder = 1
            }

            node.visible = true
            node.frustumCulled = false  // SkinnedMesh bounding sphere is unreliable after 0.01 scale + rebind
            node.castShadow = true
            node.receiveShadow = true
          }
        })

        modelBonesRef.current = boneNames
        console.log(`Working model loaded: ${boneNames.length} bones, ${meshes.length} meshes`)

        // Create animation mixer on the fbx model (not wrapper) so it targets bones correctly
        mixerRef.current = new THREE.AnimationMixer(fbx)

        // Collect morph targets from meshes already loaded (same FBX has shape keys)
        {
            // Scan all meshes (including regular Mesh like Iris) for morph targets
            fbx.traverse((node) => {
              if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
                if (node.morphTargetDictionary && node.morphTargetInfluences) {
                  const meshName = node.name
                  console.log(`[ShapeKeys] Found ${Object.keys(node.morphTargetDictionary).length} FBX-native shape keys on "${meshName}"`)

                  // Store regular meshes in meshMap too so morph target effect can find them
                  if (!(node instanceof THREE.SkinnedMesh)) {
                    meshMapRef.current.set(meshName, node)
                  }

                  // Collect morph targets for UI
                  Object.keys(node.morphTargetDictionary).forEach((targetName) => {
                    const index = node.morphTargetDictionary![targetName]
                    morphTargets.push({ meshName, targetName, index })
                  })
                }
              }
            })

            console.log(`[ShapeKeys] FBX-native morph targets: ${morphTargets.length}`)

            // Load external shape keys (exported from Blender via export_shape_keys.py)
            // This handles shape keys that FBX can't export due to modifiers
            loadShapeKeyData().then((shapeKeyData) => {
              if (!mounted) return

              if (shapeKeyData) {
                const externalTargets = applyShapeKeysToModel(fbx, shapeKeyData)
                externalTargets.forEach((t) => {
                  morphTargets.push(t)
                  if (!meshMapRef.current.has(t.meshName)) {
                    fbx.traverse((node) => {
                      if ((node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) && node.name === t.meshName) {
                        meshMapRef.current.set(t.meshName, node as THREE.Mesh)
                      }
                    })
                  }
                })

                // Force materials to recompile with morph target support.
                // Shaders were compiled before morphAttributes existed on the geometry,
                // so the morph target code was not included. Bumping material.version
                // tells the renderer the program is stale.
                fbx.traverse((node) => {
                  if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
                    if (node.geometry?.morphAttributes?.position) {
                      const mats = Array.isArray(node.material) ? node.material : [node.material]
                      mats.forEach((mat) => {
                        mat.needsUpdate = true
                      })
                    }
                  }
                })

                console.log(`[ShapeKeys] Total after external: ${morphTargets.length}`)

                if (onMorphTargetsLoaded && morphTargets.length > 0) {
                  onMorphTargetsLoaded([...morphTargets])
                }
              }
            })

            // Debug: log mesh names vs visibleAssets to diagnose refresh visibility bug
            console.log('[Viewer3D] Model loaded. meshMap keys:', [...meshMapRef.current.keys()])
            console.log('[Viewer3D] visibleAssetsRef:', visibleAssetsRef.current)

            setLoading(false)
            setModelReady(true)

            // Initialize spring bones for hair
            const springBones = new SpringBoneSystem()
            springBones.addBones(fbx, [
              'hair', 'pigtail', 'ponytail', 'braid', 'bangs', 'ahoge', 'bun', 'strand'
            ], 0.25, 0.7)
            springBonesRef.current = springBones

            if (onMeshesLoaded) {
              onMeshesLoaded(meshes)
            }

            // Send morph targets immediately (external ones from JSON come async above)
            if (onMorphTargetsLoaded && morphTargets.length > 0) {
              onMorphTargetsLoaded([...morphTargets])
            }
        }
    }, undefined, (error) => {
      console.error('Error loading model:', error)
      setError('Failed to load 3D model')
      setLoading(false)
    })

    const handleResize = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // Update animation mixer
      const delta = clockRef.current.getDelta()
      if (mixerRef.current) {
        mixerRef.current.update(delta)
      }

      // Update spring bones for hair physics
      if (springBonesRef.current && springBonesRef.current.count > 0) {
        springBonesRef.current.update(delta)
        // Apply subtle gravity effect for natural hair hang
        if (sceneObjectsRef.current) {
          springBonesRef.current.applyGravity(sceneObjectsRef.current, 0.015, delta)
        }
      }

      // Apply visibility every frame from ref — no effect timing issues
      if (meshMapRef.current.size > 0) {
        const visibleSet = new Set(visibleAssetsRef.current)
        meshMapRef.current.forEach((mesh, name) => {
          const lowerName = name.toLowerCase()
          // Body, eyes, and eye whites are always visible
          const isEyeMesh = lowerName === 'eye' || lowerName === 'iris' || lowerName.includes('eye white') || lowerName.includes('eye_white')
          const isVisible = lowerName === 'body' || isEyeMesh || visibleSet.has(name)
          mesh.visible = isVisible
        })
      }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      mounted = false
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
      }
      if (springBonesRef.current) {
        springBonesRef.current.clear()
      }
      renderer.dispose()
      controls.dispose()
    }
  }, [])

  // Animation/Pose control effect - simplified, no manual bone reset
  useEffect(() => {
    if (!modelReady || !mixerRef.current || !sceneObjectsRef.current) return

    const mixer = mixerRef.current

    // No pose selected - just stop any playing animation
    if (!selectedPose) {
      if (currentActionRef.current) {
        currentActionRef.current.fadeOut(0.3)
        currentActionRef.current = null
      }
      return
    }

    // Map pose ID to animation file path
    const poseToPath: Record<string, string> = {
      'hip-hop': '/animations/Hip Hop Dancing (1).fbx',
      'body-block': '/animations/Body Block.fbx'
    }

    const animPath = poseToPath[selectedPose]
    if (!animPath) {
      console.warn('Unknown pose:', selectedPose)
      return
    }

    console.log('Loading animation:', animPath)

    const animLoader = new FBXLoader()
    animLoader.load(
      animPath,
      (animFbx) => {
        if (animFbx.animations.length === 0) {
          console.warn('No animations in file')
          return
        }

        // Fade out current animation if any
        if (currentActionRef.current) {
          currentActionRef.current.fadeOut(0.3)
        }

        // Play the animation clip
        const clip = animFbx.animations[0]
        console.log(`Playing animation: "${clip.name}" with ${clip.tracks.length} tracks`)

        const action = mixer.clipAction(clip)
        action.reset()
        action.fadeIn(0.3)
        action.play()
        currentActionRef.current = action
      },
      undefined,
      (error) => {
        console.error('Failed to load animation:', error)
      }
    )

    return () => {
      if (currentActionRef.current) {
        currentActionRef.current.fadeOut(0.3)
      }
    }
  }, [selectedPose, modelReady])

  // Morph target control effect — checks both skinned and regular meshes
  useEffect(() => {
    if (!morphTargetValues) return

    Object.entries(morphTargetValues).forEach(([key, value]) => {
      const [meshName, targetName] = key.split(':')
      // Check skinned meshes first, then regular meshes
      const mesh = skinnedMeshMapRef.current.get(meshName) || meshMapRef.current.get(meshName)

      if (mesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const index = mesh.morphTargetDictionary[targetName]
        if (index !== undefined) {
          mesh.morphTargetInfluences[index] = value
        }
      }
    })
  }, [morphTargetValues])

  // Height scaling effect - scale uniformly, but counter-scale head
  useEffect(() => {
    // Update ref for animation loop
    heightScaleRef.current = heightScale

    if (!modelReady || !sceneObjectsRef.current) return

    const wrapper = sceneObjectsRef.current
    // Find the metarig (fbx) inside the wrapper
    const metarig = wrapper.getObjectByName('Character Rig')
    if (metarig) {
      console.log('Height scale effect: scaling to', heightScale, 'metarig found:', !!metarig)

      // Preserve rotation while scaling
      const currentRotation = metarig.rotation.y

      // Scale entire model uniformly
      metarig.scale.setScalar(0.01 * heightScale)

      // Ensure rotation is preserved
      metarig.rotation.y = currentRotation

      // No bone counter-scale — just counter-scale hair meshes directly
      const counterScale = 1 / heightScale
      const HAIR_KW = ['hair', 'pigtail', 'ponytail', 'bob', 'bangs', 'bun', 'braids', 'luke', 'ahoge']
      meshMapRef.current.forEach((mesh, name) => {
        const lower = name.toLowerCase()
        if (HAIR_KW.some(kw => lower.includes(kw))) {
          mesh.scale.setScalar(counterScale)
        }
      })

    } else {
      console.warn('Height scale effect: metarig not found!')
    }
  }, [heightScale, modelReady, selectedPose])

  // Camera animation effect
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return

    const camera = cameraRef.current
    const controls = controlsRef.current

    const sectionKey = currentSection || 'DEFAULT'
    const targetPos = CAMERA_POSITIONS[sectionKey]

    if (targetPos) {
      const startPos = camera.position.clone()
      const startTarget = controls.target.clone()
      const startFov = camera.fov

      const duration = 800
      const startTime = Date.now()

      const animateCamera = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

        camera.position.lerpVectors(startPos, targetPos.position, eased)
        controls.target.lerpVectors(startTarget, targetPos.target, eased)

        camera.fov = startFov + (targetPos.fov - startFov) * eased
        camera.updateProjectionMatrix()

        controls.update()

        if (progress < 1) {
          requestAnimationFrame(animateCamera)
        }
      }

      animateCamera()
    }
  }, [currentSection])

  // Extract values for dependency tracking
  const skinTone = categoryColors?.body?.skinTone
  const hairColor = categoryColors?.hair
  const hairUndertone = categoryColors?.hairUndertone || 'warm'

  // Hair undertone change effect - loads new texture
  const currentUndertoneRef = useRef<string | null>(null)
  useEffect(() => {
    if (!modelReady || !textureLoaderRef.current) return
    if (hairUndertone === currentUndertoneRef.current) return

    const texturePath = getUndertoneTexturePath(hairUndertone)
    const undertone = getUndertone(hairUndertone)
    console.log('Hair undertone changed:', hairUndertone, '->', texturePath)
    currentUndertoneRef.current = hairUndertone
    setCurrentHairTexture(undertone?.name || 'Warm')

    // Load the new texture
    textureLoaderRef.current.load(
      texturePath,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        hairTextureRef.current = tex

        // Update all hair materials with new texture
        meshMapRef.current.forEach((mesh) => {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach((mat) => {
            if ((mat as any)._isHairMesh && mat instanceof THREE.MeshToonMaterial) {
              mat.map = tex
              mat.needsUpdate = true
            }
          })
        })

        console.log('Hair texture updated to', undertone?.name)
      },
      undefined,
      (err) => console.error('Failed to load hair texture:', err)
    )
  }, [hairUndertone, modelReady])

  // Hair color change effect - updates tint
  useEffect(() => {
    if (!modelReady || !hairColor) return
    if (hairColor === currentHairColorRef.current) return

    currentHairColorRef.current = hairColor

    // Update all hair materials with new tint color
    meshMapRef.current.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((mat) => {
        if ((mat as any)._isHairMesh && mat instanceof THREE.MeshToonMaterial) {
          mat.color.set(hairColor)
          mat.needsUpdate = true
        }
      })
    })
  }, [hairColor, modelReady])

  // Color application effect
  useEffect(() => {
    if (meshMapRef.current.size === 0) return

    meshMapRef.current.forEach((mesh, name) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

      mats.forEach((mat) => {
        if (!(mat as any)._isToonMaterial) return

        // For skin meshes, use skinTone
        if ((mat as any)._isSkinMesh) {
          if (skinTone && mat instanceof THREE.MeshToonMaterial) {
            mat.color.set(skinTone)
          }
          return
        }

        // For face texture material, tint with skin tone (multiply with texture)
        if ((mat as any)._isFaceTexture) {
          if (skinTone && mat instanceof THREE.MeshToonMaterial) {
            mat.color.set(skinTone)
            mat.needsUpdate = true
          }
          return
        }

        // For other meshes, use meshColors
        const color = meshColors?.[name]
        if (color) {
          setToonMaterialColor(mat, color)
        }
      })
    })
  }, [meshColors, skinTone, modelReady])

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            <p className="mt-4 text-white">Loading model...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90">
          <div className="text-center text-red-400">
            <div className="text-4xl mb-4">⚠</div>
            <p className="text-lg">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {currentHairTexture && currentSection === 'HAIR' && (
        <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded text-xs text-white/70">
          Undertone: {currentHairTexture}
        </div>
      )}
    </div>
  )
}
