'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  TransformNode,
  Mesh,
  SceneLoader,
  Texture,
  AnimationGroup,
  Skeleton,
  type AbstractMesh,
  type ISceneLoaderAsyncResult,
  type Nullable,
  Space,
} from '@babylonjs/core'
import '@babylonjs/loaders'
import '@/lib/registerFBXLoader'
import { GridMaterial, CustomMaterial } from '@babylonjs/materials'
import { getUndertoneTexturePath, getUndertone } from '@/lib/hairTextures'
import { SpringBoneSystem } from '@/lib/SpringBoneSystem'

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
  DEFAULT: { position: new Vector3(-4, 1.65, 0), target: new Vector3(0, 1.4, 0), fov: 30 },
  BODY: { position: new Vector3(-4, 1.65, 0), target: new Vector3(0, 1.4, 0), fov: 30 },
  HAIR: { position: new Vector3(-1.2, 1.7, 0), target: new Vector3(0, 1.65, 0), fov: 40 },
  TOPS: { position: new Vector3(-1.8, 1.2, 0), target: new Vector3(0, 1.1, 0), fov: 45 },
  DRESSES: { position: new Vector3(-2.8, 1.0, 0), target: new Vector3(0, 1.0, 0), fov: 40 },
  PANTS: { position: new Vector3(-2.0, 0.8, 0), target: new Vector3(0, 0.6, 0), fov: 50 },
  SHOES: { position: new Vector3(-1.5, 0.3, 0.3), target: new Vector3(0, 0.1, 0), fov: 45 },
  ACCESSORIES: { position: new Vector3(-5, 1.55, 0), target: new Vector3(0, 1.1, 0), fov: 28 },
  EXPRESSIONS: { position: new Vector3(-4, 1.65, 0), target: new Vector3(0, 1.4, 0), fov: 30 },
  POSES: { position: new Vector3(-4, 1.65, 0), target: new Vector3(0, 1.4, 0), fov: 30 },
}

/** Convert a vertical FOV in degrees to ArcRotateCamera radius approximation */
function fovToRadius(fov: number, targetDistance: number): number {
  // Approximate: smaller FOV = camera further away, larger = closer
  // The Three.js default was fov=28 at distance ~4.3
  const baseFov = 28
  const baseRadius = 4.3
  return baseRadius * (baseFov / fov)
}

export default function Viewer3D({ currentSection, visibleAssets, categoryColors, meshColors, transforms, onMeshesLoaded, onMorphTargetsLoaded, morphTargetValues, selectedPose, heightScale = 1.0 }: Viewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<ArcRotateCamera | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const meshMapRef = useRef<Map<string, AbstractMesh>>(new Map())
  const skinnedMeshMapRef = useRef<Map<string, AbstractMesh>>(new Map())
  const materialMapRef = useRef<Map<string, any>>(new Map())
  const sceneObjectsRef = useRef<TransformNode | null>(null)
  const originalTransformsRef = useRef<Map<string, { position: Vector3, rotation: Vector3, scale: Vector3 }>>(new Map())

  // Animation system refs
  const animationGroupsRef = useRef<AnimationGroup[]>([])
  const currentAnimGroupRef = useRef<AnimationGroup | null>(null)
  const skeletonRef = useRef<Skeleton | null>(null)
  const bindPoseRef = useRef<Map<string, { position: Vector3, rotationQuaternion: any, scale: Vector3 }>>(new Map())
  const modelBonesRef = useRef<string[]>([])
  const heightScaleRef = useRef<number>(1.0)
  const visibleAssetsRef = useRef<string[]>(visibleAssets)
  const hairTextureRef = useRef<Texture | null>(null)
  const currentHairColorRef = useRef<string | null>(null)
  const springBonesRef = useRef<SpringBoneSystem | null>(null)
  const lastTimeRef = useRef<number>(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [currentHairTexture, setCurrentHairTexture] = useState<string | null>(null)
  // TODO: Hair meshes don't show — likely FBX armature parenting issue. Hair is parented to a different armature in Blender.

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

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    engineRef.current = engine

    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.165, 0.165, 0.165, 1) // 0x2a2a2a
    sceneRef.current = scene

    // ArcRotateCamera: alpha = horizontal rotation, beta = vertical rotation, radius = distance
    // Position (-4, 1.65, 0) looking at (0, 1.1, 0) means camera is along negative X
    const camera = new ArcRotateCamera(
      'camera',
      Math.PI,  // alpha: camera on -X side (facing character front)
      Math.PI / 2.5,  // beta: slightly above horizontal
      4.3,        // radius: distance from target
      new Vector3(0, 1.1, 0), // target
      scene
    )
    camera.fov = 28 * (Math.PI / 180) // Convert degrees to radians for Babylon.js
    camera.minZ = 0.1
    camera.maxZ = 1000
    camera.attachControl(canvas, true)

    // Orbit controls are built into ArcRotateCamera
    camera.useBouncingBehavior = false
    camera.panningSensibility = 0 // Disable panning (equivalent to enablePan = false)
    camera.lowerRadiusLimit = 0.5
    camera.upperRadiusLimit = 8
    camera.upperBetaLimit = Math.PI / 1.5
    camera.lowerBetaLimit = Math.PI / 6
    camera.angularSensibilityX = 1250 // Lower = faster rotation (inverse of rotateSpeed)
    camera.angularSensibilityY = 1250
    camera.wheelPrecision = 125 // Inverse of zoomSpeed
    camera.inertia = 0.92 // Damping equivalent

    cameraRef.current = camera

    // Key light - white from front-left (matches Three.js directional light)
    const directionalLight = new DirectionalLight('dirLight', new Vector3(3, -1.4, -2).normalize(), scene)
    directionalLight.intensity = 1.0
    directionalLight.diffuse = Color3.White()

    // Warm ambient — just enough to keep shadow areas warm, not bright
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.3
    ambientLight.diffuse = new Color3(0.4, 0.35, 0.3)
    ambientLight.groundColor = new Color3(0.4, 0.35, 0.3) // Same as diffuse so tint is uniform

    // Grid
    const gridMesh = Mesh.CreateGround('grid', 10, 10, 10, scene)
    const gridMaterial = new GridMaterial('gridMaterial', scene)
    gridMaterial.majorUnitFrequency = 1
    gridMaterial.gridRatio = 1
    gridMaterial.mainColor = Color3.FromHexString('#404040')
    gridMaterial.lineColor = Color3.FromHexString('#404040')
    gridMaterial.opacity = 0.99
    gridMesh.material = gridMaterial

    // Load hair texture based on undertone selection
    const initialHairColor = categoryColors?.hair || '#4a3728' // Default brown
    const initialUndertone = categoryColors?.hairUndertone || 'warm'
    const texturePath = getUndertoneTexturePath(initialUndertone)
    const undertone = getUndertone(initialUndertone)
    currentHairColorRef.current = initialHairColor
    setCurrentHairTexture(undertone?.name || 'Warm')
    console.log('Hair undertone:', initialUndertone, '->', texturePath)

    const hairTexture = new Texture(texturePath, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE, () => {
      console.log('Hair texture loaded successfully')
      hairTextureRef.current = hairTexture
    }, (message, exception) => {
      console.error('Failed to load hair texture:', message, exception)
    })
    hairTextureRef.current = hairTexture

    // Load the working model
    const loadModel = async () => {
      try {
        const result: ISceneLoaderAsyncResult = await SceneLoader.ImportMeshAsync(
          '',
          '/models/',
          'Bibliarch Maybe.fbx',
          scene
        )

        if (!mounted) return

        // Create wrapper transform node
        const wrapper = new TransformNode('animationRoot', scene)
        sceneObjectsRef.current = wrapper

        // Create a parent node for the FBX content
        const fbxRoot = new TransformNode('Character Rig', scene)
        fbxRoot.scaling.setAll(0.01)
        fbxRoot.rotation.y = -Math.PI / 2
        fbxRoot.parent = wrapper

        // Parent all loaded meshes and transform nodes to fbxRoot
        for (const mesh of result.meshes) {
          if (!mesh.parent || mesh.parent.name === '__root__') {
            mesh.parent = fbxRoot
          }
        }
        for (const tnode of result.transformNodes) {
          if (!tnode.parent || tnode.parent.name === '__root__') {
            tnode.parent = fbxRoot
          }
        }

        // Store skeleton reference
        if (result.skeletons.length > 0) {
          skeletonRef.current = result.skeletons[0]
        }

        // Force compute world matrices after reparenting
        fbxRoot.computeWorldMatrix(true)

        const meshes: string[] = []
        const morphTargets: MorphTargetInfo[] = []
        const boneNames: string[] = []

        const workingMeshes = new Map<string, AbstractMesh>()

        // Collect bone names from skeleton
        if (result.skeletons.length > 0) {
          const skeleton = result.skeletons[0]
          for (const bone of skeleton.bones) {
            boneNames.push(bone.name)
            bindPoseRef.current.set(bone.name, {
              position: bone.getPosition(Space.LOCAL).clone(),
              rotationQuaternion: bone.getRotationQuaternion(Space.LOCAL).clone(),
              scale: bone.getScale().clone()
            })
          }
        }

        // Process all loaded meshes
        for (const node of result.meshes) {
          const meshName = node.name || 'unnamed_mesh'
          console.log('Found mesh:', meshName)
          meshes.push(meshName)
          meshMapRef.current.set(meshName, node)

          const hasSkeleton = !!node.skeleton
          if (hasSkeleton) {
            skinnedMeshMapRef.current.set(meshName, node)
            workingMeshes.set(meshName, node)
          }

          originalTransformsRef.current.set(meshName, {
            position: node.position.clone(),
            rotation: node.rotation.clone(),
            scale: node.scaling.clone()
          })

          const lowerName = meshName.toLowerCase()

          // Replace FBX loader materials with StandardMaterial (FBX loader materials are broken)
          {
            const isEyeMesh = lowerName.includes('eye') || meshName === 'Eyes' || meshName === 'Eyes_3'

            const isSkinMesh = lowerName.includes('body') || lowerName.includes('skin') ||
                               lowerName.includes('head') || lowerName.includes('face') ||
                               lowerName.includes('hand') || lowerName.includes('arm') ||
                               lowerName.includes('leg') || lowerName.includes('foot') ||
                               lowerName === 'plane072' || lowerName.includes('base')

            const isHairMesh = lowerName.includes('hair') || lowerName.includes('pigtail') ||
                               lowerName.includes('ponytail') || lowerName.includes('bob') ||
                               lowerName.includes('bangs') || lowerName.includes('bun') ||
                               lowerName.includes('braids') || lowerName.includes('luke') ||
                               lowerName.includes('ahoge')

            // Try to salvage texture from original material
            const origMat = node.material as any
            let origTexture: Texture | null = null
            let origColor: Color3 | null = null
            if (origMat) {
              origTexture = origMat.diffuseTexture || origMat.albedoTexture || null
              origColor = origMat.diffuseColor || origMat.albedoColor || null
            }

            // Create CustomMaterial (extends StandardMaterial — bones work automatically)
            // with cel-shading GLSL injected into the fragment shader
            const mat = new CustomMaterial(`${meshName}_mat`, scene)
            mat.backFaceCulling = false
            mat.specularColor = Color3.Black()
            mat.transparencyMode = 0 // MATERIAL_OPAQUE — force fully opaque

            // Hard 2-tone cel shading using world normal + single light direction
            mat.Fragment_Before_FragColor(`
              vec3 n = normalize(vNormalW);
              vec3 ld = normalize(vec3(-3.0, 1.4, 2.0));
              float NdotL = dot(n, ld) * 0.5 + 0.5;
              float toon = NdotL > 0.5 ? 1.0 : 0.706;
              color = vec4(vDiffuseColor.rgb * toon, 1.0);
            `)

            if (isEyeMesh) {
              // Eyes: keep original FBX material (has embedded texture)
              // Don't replace it — skip to next mesh
            } else if (isHairMesh) {
              mat.diffuseColor = Color3.FromHexString(initialHairColor.startsWith('#') ? initialHairColor : `#${initialHairColor}`)
              if (hairTexture) mat.diffuseTexture = hairTexture
              ;(mat as any)._isHairMesh = true
            } else if (isSkinMesh) {
              mat.diffuseColor = origColor || Color3.FromHexString('#e8beac')
              if (origTexture) mat.diffuseTexture = origTexture
              ;(mat as any)._isSkinMesh = true
            } else {
              mat.diffuseColor = origColor || Color3.FromHexString('#cccccc')
              if (origTexture) mat.diffuseTexture = origTexture
            }

            if (!isEyeMesh) {
              ;(mat as any)._isToonMaterial = true
              ;(mat as any)._toonColor = mat.diffuseColor.clone()
              node.material = mat
              materialMapRef.current.set(`${meshName}_mat`, mat)
            }
          }

          node.setEnabled(true)
          node.isVisible = true
          node.visibility = 1.0
          node.hasVertexAlpha = false
          node.isPickable = true

          // Equivalent of frustumCulled = false
          node.alwaysSelectAsActiveMesh = true
        }

        modelBonesRef.current = boneNames
        console.log(`Working model loaded: ${boneNames.length} bones, ${meshes.length} meshes`)

        // Store animation groups from the loaded result
        animationGroupsRef.current = result.animationGroups || []

        // Now load the shape keys model from FBX
        try {
          const shapeKeysResult = await SceneLoader.ImportMeshAsync(
            '',
            '/models/',
            'Bibliarch Maybe.fbx',
            scene
          )

          if (!mounted) return
          console.log('Loading shape keys from Bibliarch Maybe.fbx...')

          console.log('[ShapeKeys] FBX loaded, traversing meshes...')
          let meshCount = 0
          for (const skNode of shapeKeysResult.meshes) {
            meshCount++
            const hasMorphManager = !!skNode.morphTargetManager
            const morphCount = hasMorphManager ? skNode.morphTargetManager!.numTargets : 0
            console.log(`[ShapeKeys] Mesh #${meshCount}: "${skNode.name}", hasMorphManager: ${hasMorphManager}, morphCount: ${morphCount}`)

            if (skNode.morphTargetManager && skNode.morphTargetManager.numTargets > 0) {
              const meshName = skNode.name
              const targetMesh = workingMeshes.get(meshName)
              const mtm = skNode.morphTargetManager

              if (targetMesh) {
                // Transfer morph target manager to the working mesh
                targetMesh.morphTargetManager = mtm

                const transferredCount = mtm.numTargets
                console.log(`Transferred ${transferredCount} shape keys to ${meshName}`)

                // Collect morph targets for UI
                for (let i = 0; i < mtm.numTargets; i++) {
                  const target = mtm.getTarget(i)
                  morphTargets.push({ meshName, targetName: target.name, index: i })
                }
              } else {
                // No matching mesh, but still collect the morph targets for UI
                console.log(`[ShapeKeys] No matching FBX mesh for ${meshName}, adding morph targets directly`)
                for (let i = 0; i < mtm.numTargets; i++) {
                  const target = mtm.getTarget(i)
                  morphTargets.push({ meshName, targetName: target.name, index: i })
                }
              }
            }

            // Dispose the shape keys meshes — we only needed the morph data
            skNode.dispose()
          }
          // Also dispose shape keys transform nodes and skeletons
          for (const tnode of shapeKeysResult.transformNodes) {
            tnode.dispose()
          }
          for (const skel of shapeKeysResult.skeletons) {
            skel.dispose()
          }
          for (const ag of shapeKeysResult.animationGroups) {
            ag.dispose()
          }

          console.log(`[ShapeKeys] Total meshes in FBX: ${meshCount}`)
          console.log(`Shape keys transferred. Total morph targets: ${morphTargets.length}`)

          // Debug: log mesh names vs visibleAssets to diagnose refresh visibility bug
          console.log('[Viewer3D] Model loaded. meshMap keys:', [...meshMapRef.current.keys()])
          console.log('[Viewer3D] visibleAssetsRef:', visibleAssetsRef.current)
          const debugVisibleSet = new Set(visibleAssetsRef.current)
          meshMapRef.current.forEach((mesh, name) => {
            const shouldBeVisible = name.toLowerCase() === 'body' || debugVisibleSet.has(name)
            console.log(`[Viewer3D] mesh="${name}" visible=${mesh.isEnabled()} shouldBe=${shouldBeVisible} hasMaterial=${!!mesh.material}`)
          })

          setLoading(false)
          setModelReady(true)

          // Initialize spring bones for hair
          const springBones = new SpringBoneSystem()
          // Add all hair-related bones with springy physics
          // Stiffness: 0.3 = moderate spring, Damping: 0.7 = moderate bounce
          springBones.addBones(fbxRoot, [
            'hair', 'pigtail', 'ponytail', 'braid', 'bangs', 'ahoge', 'bun', 'strand'
          ], 0.25, 0.7)
          springBonesRef.current = springBones

          if (onMeshesLoaded) {
            onMeshesLoaded(meshes)
          }

          if (onMorphTargetsLoaded && morphTargets.length > 0) {
            onMorphTargetsLoaded(morphTargets)
          }

        } catch (shapeKeysError) {
          if (!mounted) return
          console.error('Error loading shape keys model:', shapeKeysError)
          // Still continue with working model, just without shape keys
          setLoading(false)
          setModelReady(true)
          if (onMeshesLoaded) {
            onMeshesLoaded(meshes)
          }
        }

      } catch (loadError) {
        console.error('Error loading model:', loadError)
        setError('Failed to load 3D model')
        setLoading(false)
      }
    }

    loadModel()

    const handleResize = () => {
      engine.resize()
    }

    window.addEventListener('resize', handleResize)

    // Initialize time tracking
    lastTimeRef.current = performance.now()

    // Render loop
    engine.runRenderLoop(() => {
      // Calculate delta time
      const now = performance.now()
      const delta = (now - lastTimeRef.current) / 1000 // Convert to seconds
      lastTimeRef.current = now

      // Update spring bones for hair physics
      if (springBonesRef.current && springBonesRef.current.count > 0) {
        springBonesRef.current.update(delta)
        // Apply subtle gravity effect for natural hair hang
        if (sceneObjectsRef.current) {
          springBonesRef.current.applyGravity(sceneObjectsRef.current, 0.015, delta)
        }
      }

      scene.render()
    })

    return () => {
      mounted = false
      window.removeEventListener('resize', handleResize)
      engine.stopRenderLoop()
      if (currentAnimGroupRef.current) {
        currentAnimGroupRef.current.stop()
      }
      if (springBonesRef.current) {
        springBonesRef.current.clear()
      }
      scene.dispose()
      engine.dispose()
    }
  }, [])

  // Mesh visibility effect — runs when visibleAssets prop changes
  useEffect(() => {
    if (!modelReady || meshMapRef.current.size === 0) return

    const visibleSet = new Set(visibleAssets)
    // DEBUG: show all mesh names and which ones are in visibleAssets
    // Build a set that matches both "Model::Foo Bar" and "Foo_Bar" formats
    const visibleSetClean = new Set<string>()
    visibleAssets.forEach(a => {
      visibleSetClean.add(a)
      visibleSetClean.add(a.replace('Model::', ''))
      visibleSetClean.add(a.replace(/_/g, ' '))
      visibleSetClean.add('Model::' + a.replace(/_/g, ' '))
    })

    const hairDebug: string[] = []
    meshMapRef.current.forEach((mesh, name) => {
      const lowerName = name.toLowerCase()
      const nameNoPrefix = name.replace('Model::', '')
      const isEyeMesh = lowerName.includes('eye') || nameNoPrefix === 'Eyes' || nameNoPrefix === 'Eyes_3'
      const isBaseMesh = lowerName.includes('body') ||
        lowerName === 'plane072' || lowerName.includes('skin') ||
        lowerName.includes('base')
      const inSet = visibleSetClean.has(name) || visibleSetClean.has(nameNoPrefix)
      const shouldShow = isBaseMesh || isEyeMesh || inSet

      mesh.setEnabled(shouldShow)
      mesh.isVisible = shouldShow

      // Force-enable entire parent chain
      if (shouldShow) {
        let p: any = mesh.parent
        while (p) {
          if (typeof p.setEnabled === 'function') p.setEnabled(true)
          if ('isVisible' in p) p.isVisible = true
          p = p.parent
        }
      }

      // Log hair meshes for debugging
      const isHairKw = ['hair', 'bangs', 'ahoge', 'pigtail', 'ponytail', 'bun', 'braid']
      if (isHairKw.some(k => lowerName.includes(k))) {
        // Build parent chain string
        const parents: string[] = []
        let pp: any = mesh.parent
        while (pp) {
          parents.push(`${pp.name}(en=${pp.isEnabled?.() ?? '?'})`)
          pp = pp.parent
        }
        hairDebug.push(`${nameNoPrefix}: show=${shouldShow} en=${mesh.isEnabled()} vis=${mesh.isVisible} verts=${mesh.getTotalVertices()} parents=[${parents.join(' > ')}]`)
      }
    })
  }, [visibleAssets, modelReady])

  // Animation/Pose control effect - load animation FBX and play
  useEffect(() => {
    if (!modelReady || !sceneRef.current || !sceneObjectsRef.current) return

    const scene = sceneRef.current

    // No pose selected - just stop any playing animation
    if (!selectedPose) {
      if (currentAnimGroupRef.current) {
        currentAnimGroupRef.current.stop()
        currentAnimGroupRef.current = null
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

    // Parse path into directory and filename for SceneLoader
    const lastSlash = animPath.lastIndexOf('/')
    const animDir = animPath.substring(0, lastSlash + 1)
    const animFile = animPath.substring(lastSlash + 1)

    const loadAnimation = async () => {
      try {
        const animResult = await SceneLoader.ImportMeshAsync('', animDir, animFile, scene)

        if (animResult.animationGroups.length === 0) {
          console.warn('No animations in file')
          // Dispose loaded meshes since we only need animations
          for (const m of animResult.meshes) m.dispose()
          for (const t of animResult.transformNodes) t.dispose()
          for (const s of animResult.skeletons) s.dispose()
          return
        }

        // Stop current animation if any
        if (currentAnimGroupRef.current) {
          currentAnimGroupRef.current.stop()
        }

        // Play the first animation group
        const animGroup = animResult.animationGroups[0]
        console.log(`Playing animation: "${animGroup.name}" with ${animGroup.targetedAnimations.length} tracks`)

        // If we have a skeleton, retarget the animation to it
        if (skeletonRef.current) {
          animGroup.start(true, 1.0) // loop = true, speed = 1.0
        } else {
          animGroup.start(true, 1.0)
        }

        currentAnimGroupRef.current = animGroup

        // Dispose loaded meshes since we only need animations
        for (const m of animResult.meshes) m.dispose()
        for (const t of animResult.transformNodes) t.dispose()
        for (const s of animResult.skeletons) s.dispose()

      } catch (animError) {
        console.error('Failed to load animation:', animError)
      }
    }

    loadAnimation()

    return () => {
      if (currentAnimGroupRef.current) {
        currentAnimGroupRef.current.stop()
      }
    }
  }, [selectedPose, modelReady])

  // Morph target control effect
  useEffect(() => {
    if (!morphTargetValues || skinnedMeshMapRef.current.size === 0) return

    Object.entries(morphTargetValues).forEach(([key, value]) => {
      const [meshName, targetName] = key.split(':')
      const mesh = skinnedMeshMapRef.current.get(meshName)

      if (mesh && mesh.morphTargetManager) {
        const mtm = mesh.morphTargetManager
        for (let i = 0; i < mtm.numTargets; i++) {
          const target = mtm.getTarget(i)
          if (target.name === targetName) {
            target.influence = value
            break
          }
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
    const metarig = sceneRef.current ? sceneRef.current.getTransformNodeByName('Character Rig') : null
    if (metarig) {
      console.log('Height scale effect: scaling to', heightScale, 'metarig found:', !!metarig)

      // Preserve rotation while scaling
      const currentRotation = metarig.rotation.y

      // Scale entire model uniformly
      metarig.scaling.setAll(0.01 * heightScale)

      // Ensure rotation is preserved
      metarig.rotation.y = currentRotation

      // No bone counter-scale -- just counter-scale hair meshes directly
      const counterScale = 1 / heightScale
      const HAIR_KW = ['hair', 'pigtail', 'ponytail', 'bob', 'bangs', 'bun', 'braids', 'luke', 'ahoge']
      meshMapRef.current.forEach((mesh, name) => {
        const lower = name.toLowerCase()
        if (HAIR_KW.some(kw => lower.includes(kw))) {
          mesh.scaling.setAll(counterScale)
        }
      })

    } else {
      console.warn('Height scale effect: metarig not found!')
    }
  }, [heightScale, modelReady, selectedPose])

  // Camera animation effect
  useEffect(() => {
    if (!cameraRef.current) return

    const camera = cameraRef.current

    const sectionKey = currentSection || 'DEFAULT'
    const targetPos = CAMERA_POSITIONS[sectionKey]

    if (targetPos) {
      // Capture current camera state
      const startAlpha = camera.alpha
      const startBeta = camera.beta
      const startRadius = camera.radius
      const startTarget = camera.target.clone()
      const startFov = camera.fov

      // Compute target camera parameters from the Three.js-style position + target
      // Convert Cartesian position to spherical coordinates relative to target
      const diff = targetPos.position.subtract(targetPos.target)
      const targetRadius = diff.length()
      const targetAlpha = Math.atan2(diff.z, diff.x)
      const targetBeta = Math.acos(diff.y / targetRadius)
      const targetFov = targetPos.fov * (Math.PI / 180)

      const duration = 800
      const startTime = Date.now()

      const animateCamera = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

        camera.alpha = startAlpha + (targetAlpha - startAlpha) * eased
        camera.beta = startBeta + (targetBeta - startBeta) * eased
        camera.radius = startRadius + (targetRadius - startRadius) * eased
        camera.target = Vector3.Lerp(startTarget, targetPos.target, eased)
        camera.fov = startFov + (targetFov - startFov) * eased

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
    if (!modelReady || !sceneRef.current) return
    if (hairUndertone === currentUndertoneRef.current) return

    const scene = sceneRef.current
    const texturePath = getUndertoneTexturePath(hairUndertone)
    const undertone = getUndertone(hairUndertone)
    console.log('Hair undertone changed:', hairUndertone, '->', texturePath)
    currentUndertoneRef.current = hairUndertone
    setCurrentHairTexture(undertone?.name || 'Warm')

    // Load the new texture
    const tex = new Texture(texturePath, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE, () => {
      hairTextureRef.current = tex

      // Update all hair materials with new texture
      meshMapRef.current.forEach((mesh) => {
        const mat = mesh.material as any
        if (mat && (mat as any)._isHairMesh) {
          // For ShaderMaterial, set the texture uniform
          if (typeof mat.setTexture === 'function') {
            mat.setTexture('uMap', tex)
            mat.setFloat('uHasMap', 1.0)
          }
        }
      })

      console.log('Hair texture updated to', undertone?.name)
    }, (message, exception) => {
      console.error('Failed to load hair texture:', message, exception)
    })
  }, [hairUndertone, modelReady])

  // Hair color change effect - updates tint
  useEffect(() => {
    if (!modelReady || !hairColor) return
    if (hairColor === currentHairColorRef.current) return

    currentHairColorRef.current = hairColor

    // Update all hair materials with new tint color
    meshMapRef.current.forEach((mesh) => {
      const mat = mesh.material as any
      if (mat && mat._isHairMesh) {
        const hexColor = hairColor.startsWith('#') ? hairColor : `#${hairColor}`
        const color = Color3.FromHexString(hexColor)
        mat.diffuseColor = color
        mat._toonColor = color
      }
    })
  }, [hairColor, modelReady])

  // Color application effect
  useEffect(() => {
    if (meshMapRef.current.size === 0) return

    meshMapRef.current.forEach((mesh, name) => {
      const mat = mesh.material as any
      if (!mat) return

      if (!mat._isToonMaterial) return

      // For skin meshes, use skinTone
      if (mat._isSkinMesh) {
        if (skinTone) {
          const hexColor = skinTone.startsWith('#') ? skinTone : `#${skinTone}`
          const c = Color3.FromHexString(hexColor)
          mat.diffuseColor = c
          mat._toonColor = c
        }
        return
      }

      // For other meshes, use meshColors
      const color = meshColors?.[name]
      if (color) {
        const c = Color3.FromHexString(color.startsWith('#') ? color : `#${color}`)
        mat.diffuseColor = c
        mat._toonColor = c
      }
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
