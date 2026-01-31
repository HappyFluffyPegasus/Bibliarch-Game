'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

type Section = 'BODY' | 'HAIR' | 'TOPS' | 'DRESSES' | 'PANTS' | 'SHOES' | 'ACCESSORIES' | 'EXPRESSIONS' | 'POSES' | null

export interface Transform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface CategoryColors {
  hair: string
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
  const materialMapRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map())
  const sceneObjectsRef = useRef<THREE.Group | null>(null)
  const originalTransformsRef = useRef<Map<string, { position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }>>(new Map())

  // Animation system refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock())
  const bindPoseRef = useRef<Map<string, { position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3 }>>(new Map())
  const modelBonesRef = useRef<string[]>([])
  const heightScaleRef = useRef<number>(1.0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 10, 5)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4)
    scene.add(hemiLight)

    const fillLight = new THREE.PointLight(0xffffff, 30, 20, 1)
    fillLight.position.set(-3, 1.5, 0)
    scene.add(fillLight)

    const grid = new THREE.GridHelper(10, 10, 0x404040, 0x404040)
    scene.add(grid)

    const loader = new FBXLoader()

    // Load the working model (no shape keys, good for animation)
    loader.load(
      '/models/Bibliarch Maybe.fbx',
      (fbx) => {
        fbx.scale.setScalar(0.01)
        fbx.name = 'Character Rig'
        fbx.rotation.y = -Math.PI / 2

        const wrapper = new THREE.Group()
        wrapper.name = 'animationRoot'
        wrapper.add(fbx)
        scene.add(wrapper)
        sceneObjectsRef.current = wrapper

        // Rebind all SkinnedMeshes AFTER adding to scene.
        // Calling bind() without a second argument forces Three.js to
        // recompute bind matrices from the current (scaled) world matrices.
        // Without this, the 0.01 scale causes armatures to collapse.
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

            const materials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []
            materials.forEach((mat, matIndex) => {
              if (mat && mat instanceof THREE.MeshStandardMaterial) {
                const matName = mat.name || `${meshName}_mat_${matIndex}`
                if (!materialMapRef.current.has(matName)) {
                  materialMapRef.current.set(matName, mat)
                }
              } else if (mat && mat instanceof THREE.MeshPhongMaterial) {
                const stdMat = new THREE.MeshStandardMaterial({
                  color: mat.color,
                  map: mat.map,
                  normalMap: mat.normalMap,
                  emissive: mat.emissive,
                  emissiveMap: mat.emissiveMap,
                  emissiveIntensity: mat.emissiveIntensity,
                  aoMap: mat.aoMap,
                  bumpMap: mat.bumpMap,
                  bumpScale: mat.bumpScale,
                  alphaMap: mat.alphaMap,
                  opacity: mat.opacity,
                  transparent: mat.transparent,
                  side: mat.side,
                  roughness: 0.8,
                  metalness: 0.0,
                })
                node.material = stdMat
                const matName = mat.name || `${meshName}_mat_${matIndex}`
                if (!materialMapRef.current.has(matName)) {
                  materialMapRef.current.set(matName, stdMat)
                }
              }
            })

            node.visible = true
            node.castShadow = true
            node.receiveShadow = true
          }
        })

        modelBonesRef.current = boneNames
        console.log(`Working model loaded: ${boneNames.length} bones, ${meshes.length} meshes`)

        // Create animation mixer on the fbx model (not wrapper) so it targets bones correctly
        mixerRef.current = new THREE.AnimationMixer(fbx)

        // Now load the shape keys model and transfer morph targets
        loader.load(
          '/models/Bibliarch Maybe.fbx',
          (shapeKeysFbx) => {
            console.log('Loading shape keys from BibliarchMaybe.fbx...')

            shapeKeysFbx.traverse((node) => {
              if (node instanceof THREE.SkinnedMesh && node.morphTargetDictionary && node.morphTargetInfluences) {
                const meshName = node.name
                const targetMesh = workingMeshes.get(meshName)

                if (targetMesh) {
                  // Transfer morph target data
                  const geometry = targetMesh.geometry as THREE.BufferGeometry
                  const sourceGeometry = node.geometry as THREE.BufferGeometry

                  // Copy morph attributes
                  if (sourceGeometry.morphAttributes.position) {
                    geometry.morphAttributes.position = sourceGeometry.morphAttributes.position
                  }
                  if (sourceGeometry.morphAttributes.normal) {
                    geometry.morphAttributes.normal = sourceGeometry.morphAttributes.normal
                  }

                  // Copy morph target dictionary and influences
                  targetMesh.morphTargetDictionary = { ...node.morphTargetDictionary }
                  targetMesh.morphTargetInfluences = new Array(node.morphTargetInfluences.length).fill(0)

                  // Update geometry morph targets count
                  geometry.morphTargetsRelative = sourceGeometry.morphTargetsRelative

                  console.log(`Transferred ${Object.keys(node.morphTargetDictionary).length} shape keys to ${meshName}`)

                  // Collect morph targets for UI
                  Object.keys(node.morphTargetDictionary).forEach((targetName) => {
                    const index = node.morphTargetDictionary![targetName]
                    morphTargets.push({ meshName, targetName, index })
                  })
                }
              }
            })

            console.log(`Shape keys transferred. Total morph targets: ${morphTargets.length}`)

            setLoading(false)
            setModelReady(true)

            if (onMeshesLoaded) {
              onMeshesLoaded(meshes)
            }

            if (onMorphTargetsLoaded && morphTargets.length > 0) {
              onMorphTargetsLoaded(morphTargets)
            }
          },
          undefined,
          (error) => {
            console.error('Error loading shape keys model:', error)
            // Still continue with working model, just without shape keys
            setLoading(false)
            setModelReady(true)
            if (onMeshesLoaded) {
              onMeshesLoaded(meshes)
            }
          }
        )
      },
      (progress) => {
        console.log('Loading:', (progress.loaded / progress.total * 100).toFixed(0) + '%')
      },
      (error) => {
        console.error('Error loading model:', error)
        setError('Failed to load 3D model')
        setLoading(false)
      }
    )

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

      // DISABLED - bone movement causes collapse after rebind
      // const delta = clockRef.current.getDelta()
      // if (mixerRef.current) {
      //   mixerRef.current.update(delta)
      // }
      // if (sceneObjectsRef.current && heightScaleRef.current !== 1.0) {
      //   sceneObjectsRef.current.traverse((node) => {
      //     if (node instanceof THREE.Bone && node.name === 'spine005') {
      //       node.scale.setScalar(1 / heightScaleRef.current)
      //     }
      //   })
      // }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
      }
      renderer.dispose()
      controls.dispose()
    }
  }, [])

  // DISABLED - pose/animation system moves bones and causes collapse after rebind
  // Will need to re-capture bind pose AFTER rebind to fix this properly
  // useEffect(() => {
  //   if (!modelReady || !mixerRef.current || !sceneObjectsRef.current) return
  //   ...
  // }, [selectedPose, modelReady])

  // Morph target control effect
  useEffect(() => {
    if (!morphTargetValues || skinnedMeshMapRef.current.size === 0) return

    Object.entries(morphTargetValues).forEach(([key, value]) => {
      const [meshName, targetName] = key.split(':')
      const mesh = skinnedMeshMapRef.current.get(meshName)

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
      const HAIR_KW = ['hair', 'pigtail', 'ponytail', 'bob', 'bangs', 'bun', 'braids', 'luke']
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

  // Asset visibility effect
  useEffect(() => {
    if (meshMapRef.current.size === 0) return
    const visibleSet = new Set(visibleAssets)
    meshMapRef.current.forEach((mesh, name) => {
      if (name.toLowerCase() === 'body') {
        mesh.visible = true // base body always visible
      } else {
        mesh.visible = visibleSet.has(name)
      }
    })
  }, [visibleAssets, modelReady])

  // Color application effect
  useEffect(() => {
    if (!meshColors || meshMapRef.current.size === 0) return
    meshMapRef.current.forEach((mesh, name) => {
      const color = meshColors[name]
      if (!color) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial && !mat.map) {
          mat.color.setStyle(color)
        }
      })
    })
  }, [meshColors])

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
    </div>
  )
}
