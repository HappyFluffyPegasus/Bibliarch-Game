'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TerrainData, EditorTool, BrushSettings, MaterialBrushSettings, WorldObject, LevelBounds, PolygonBorder, CityLot, RoadNetwork, BuildingData, RoadWaypoint, WorldLevel, isPointInPolygon } from '@/types/world'
import { ChunkManager, worldToGrid } from '@/lib/terrain/ChunkManager'

import { ObjectManager } from '@/lib/terrain/ObjectManager'
import { getCatalogEntry } from '@/lib/terrain/objectCatalog'
import { FirstPersonController } from '@/lib/terrain/FirstPersonController'
import { BorderManager } from '@/lib/borders/BorderManager'
import { LotManager } from '@/lib/city/LotManager'
import { RoadNetworkManager } from '@/lib/city/RoadNetworkManager'
import { computeRoadRibbon } from '@/lib/city/roadUtils'
import { WallManager } from '@/lib/building/WallManager'

export interface WorldViewport3DProps {
  terrain: TerrainData
  activeTool: EditorTool
  sculptBrush: BrushSettings
  materialBrush: MaterialBrushSettings
  showGrid: boolean
  showWater: boolean

  objects: WorldObject[]
  selectedObjectIds: string[]
  selectedObjectType: string | null

  cameraMode: 'orbit' | 'first-person'
  firstPersonSubMode: 'walk' | 'fly'
  firstPersonSpeed: number
  onCameraModeChange: (mode: 'orbit' | 'first-person') => void
  onSubModeChange: (mode: 'walk' | 'fly') => void

  onTerrainSculpt: (centerX: number, centerZ: number, brush: BrushSettings) => void
  onTerrainPaint: (centerX: number, centerZ: number, brush: MaterialBrushSettings) => void
  onTerrainChanged: () => void
  onCursorMove: (worldPos: [number, number, number] | null, gridPos: { x: number; z: number } | null) => void
  onFpsUpdate: (fps: number) => void
  onObjectPlace: (worldPos: [number, number, number]) => void
  onObjectSelect: (objectId: string | null, additive: boolean) => void
  onObjectMove: (objectId: string, newPos: [number, number, number]) => void
  onObjectMoveEnd?: (objectId: string, newPos: [number, number, number]) => void
  onCameraUpdate?: (position: [number, number, number], yaw: number) => void
  sunAngle?: number     // azimuth in degrees, default 160
  sunElevation?: number // elevation in degrees, default 45
  skyColor?: string          // hex color, default '#87CEEB'
  fogEnabled?: boolean       // default true
  weatherType?: 'clear' | 'rain' | 'snow' | 'fog' | 'cloudy'  // default 'clear'
  waterColor?: string          // hex color, default '#2980b9'

  // Hierarchy / region props
  childRegions?: { id: string; name: string; bounds: LevelBounds; color?: string; polygonVertices?: { x: number; z: number }[] }[]
  onRegionClick?: (worldPos: [number, number, number]) => void
  onRegionDoubleClick?: (regionId: string) => void

  // New feature props
  currentLevel?: WorldLevel
  polygonBoundary?: { x: number; z: number }[]
  polygonBorders?: PolygonBorder[]
  showBorders?: boolean
  borderDrawMode?: 'idle' | 'drawing'
  borderVertices?: { x: number; z: number }[]
  borderColor?: string
  onBorderClick?: (worldPos: [number, number, number]) => void
  lots?: CityLot[]
  showLots?: boolean
  onLotClick?: (worldPos: [number, number, number]) => void
  onLotSelect?: (lotId: string | null) => void
  onLotDoubleClick?: (lotId: string) => void
  roadNetwork?: RoadNetwork
  showRoads?: boolean
  roadDrawMode?: 'idle' | 'drawing'
  roadWaypoints?: RoadWaypoint[]
  roadWidth?: number
  onRoadClick?: (worldPos: [number, number, number]) => void
  buildingData?: BuildingData
  activeFloor?: number
  wallDrawMode?: 'idle' | 'drawing'
  wallStartPoint?: { x: number; z: number } | null
  wallHeight?: number
  wallMaterial?: string
  floorVisibility?: 'active-only' | 'transparent' | 'all'
  onWallClick?: (worldPos: [number, number, number]) => void
  onFloorPaint?: (worldPos: [number, number, number], endPos?: [number, number, number]) => void
  onFurniturePlace?: (worldPos: [number, number, number]) => void

  // Lot preview (two-click sizing)
  lotCorner1?: { x: number; z: number } | null

  // Transform mode for selected objects
  transformMode?: 'translate' | 'scale' | 'rotate'
  // Camera preset trigger
  cameraPreset?: 'top' | 'front' | 'side' | 'perspective' | null
  cameraPresetCounter?: number
}

export default function WorldViewport3D({
  terrain,
  activeTool,
  sculptBrush,
  materialBrush,
  showGrid,
  showWater,

  objects,
  selectedObjectIds,
  selectedObjectType,

  cameraMode,
  firstPersonSubMode,
  firstPersonSpeed,
  onCameraModeChange,
  onSubModeChange,

  onTerrainSculpt,
  onTerrainPaint,
  onTerrainChanged,
  onCursorMove,
  onFpsUpdate,
  onObjectPlace,
  onObjectSelect,
  onObjectMove,
  onObjectMoveEnd,
  onCameraUpdate,
  sunAngle = 160,
  sunElevation = 45,
  skyColor = '#87CEEB',
  fogEnabled = true,
  weatherType = 'clear',
  waterColor = '#2980b9',
  childRegions,
  onRegionClick,
  onRegionDoubleClick,

  currentLevel = 'world',
  polygonBoundary,
  polygonBorders,
  showBorders = true,
  borderDrawMode = 'idle',
  borderVertices = [],
  borderColor = '#ff6b35',
  onBorderClick,
  lots,
  showLots = true,
  onLotClick,
  onLotSelect,
  onLotDoubleClick,
  roadNetwork,
  showRoads = true,
  roadDrawMode = 'idle',
  roadWaypoints = [],
  roadWidth = 10,
  onRoadClick,
  buildingData,
  activeFloor = 0,
  wallDrawMode = 'idle',
  wallStartPoint,
  wallHeight = 3,
  wallMaterial = 'drywall',
  floorVisibility = 'transparent',
  onWallClick,
  onFloorPaint,
  onFurniturePlace,
  lotCorner1,
  transformMode = 'translate',
  cameraPreset,
  cameraPresetCounter,
}: WorldViewport3DProps) {
  const [isPointerLocked, setIsPointerLocked] = useState(false)
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const fpControllerRef = useRef<FirstPersonController | null>(null)
  const chunkManagerRef = useRef<ChunkManager | null>(null)

  const objectManagerRef = useRef<ObjectManager | null>(null)
  const borderManagerRef = useRef<BorderManager | null>(null)
  const lotManagerRef = useRef<LotManager | null>(null)
  const roadManagerRef = useRef<RoadNetworkManager | null>(null)
  const wallManagerRef = useRef<WallManager | null>(null)
  const borderPreviewRef = useRef<THREE.Object3D | null>(null)
  const roadPreviewRef = useRef<THREE.Group | null>(null)
  // Marquee select refs
  const isMarqueeRef = useRef(false)
  const marqueeStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const marqueeEndRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const gridHelperRef = useRef<THREE.GridHelper | null>(null)
  const sunRef = useRef<THREE.DirectionalLight | null>(null)
  const ambientRef = useRef<THREE.AmbientLight | null>(null)
  const waterMeshRef = useRef<THREE.Mesh | null>(null)
  const boundaryOutlineRef = useRef<THREE.Line | null>(null)
  const polygonBoundaryRef = useRef(polygonBoundary)
  polygonBoundaryRef.current = polygonBoundary
  const boundaryLineRef = useRef<THREE.Line | null>(null)
  const brushCursorRef = useRef<THREE.Mesh | null>(null)
  const ghostMeshRef = useRef<THREE.Group | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(-999, -999))
  const weatherParticlesRef = useRef<THREE.Points | null>(null)
  const weatherVelocitiesRef = useRef<Float32Array | null>(null)
  const animFrameRef = useRef<number>(0)
  const isPaintingRef = useRef(false)
  const isDraggingObjectRef = useRef(false)
  const dragObjectIdRef = useRef<string | null>(null)
  const dragLastPosRef = useRef<[number, number, number] | null>(null)
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const lastPaintTimeRef = useRef(0)
  const fpsFramesRef = useRef(0)
  const fpsTimeRef = useRef(performance.now())

  // Keep props in refs for event handlers
  const terrainRef = useRef(terrain)
  const activeToolRef = useRef(activeTool)
  const sculptBrushRef = useRef(sculptBrush)
  const materialBrushRef = useRef(materialBrush)
  const objectsRef = useRef(objects)
  const selectedObjectIdsRef = useRef(selectedObjectIds)
  const selectedObjectTypeRef = useRef(selectedObjectType)
  terrainRef.current = terrain
  activeToolRef.current = activeTool
  sculptBrushRef.current = sculptBrush
  materialBrushRef.current = materialBrush
  objectsRef.current = objects
  selectedObjectIdsRef.current = selectedObjectIds
  selectedObjectTypeRef.current = selectedObjectType

  // Camera mode ref
  const cameraModeRef = useRef(cameraMode)
  cameraModeRef.current = cameraMode

  // Stable callback refs
  const onObjectPlaceRef = useRef(onObjectPlace)
  const onObjectSelectRef = useRef(onObjectSelect)
  const onObjectMoveRef = useRef(onObjectMove)
  const onObjectMoveEndRef = useRef(onObjectMoveEnd)
  const onCameraModeChangeRef = useRef(onCameraModeChange)
  const onSubModeChangeRef = useRef(onSubModeChange)
  onObjectPlaceRef.current = onObjectPlace
  onObjectSelectRef.current = onObjectSelect
  onObjectMoveRef.current = onObjectMove
  onObjectMoveEndRef.current = onObjectMoveEnd
  onCameraModeChangeRef.current = onCameraModeChange
  onSubModeChangeRef.current = onSubModeChange
  const onRegionClickRef = useRef(onRegionClick)
  const onRegionDoubleClickRef = useRef(onRegionDoubleClick)
  onRegionClickRef.current = onRegionClick
  onRegionDoubleClickRef.current = onRegionDoubleClick
  const childRegionsRef = useRef(childRegions)
  childRegionsRef.current = childRegions
  const regionGroupRef = useRef<THREE.Group | null>(null)
  const lastClickTimeRef = useRef(0)
  const lastClickRegionRef = useRef<string | null>(null)
  const onCameraUpdateRef = useRef(onCameraUpdate)
  onCameraUpdateRef.current = onCameraUpdate
  const onBorderClickRef = useRef(onBorderClick)
  onBorderClickRef.current = onBorderClick
  const onLotClickRef = useRef(onLotClick)
  onLotClickRef.current = onLotClick
  const onLotSelectRef = useRef(onLotSelect)
  onLotSelectRef.current = onLotSelect
  const onLotDoubleClickRef = useRef(onLotDoubleClick)
  onLotDoubleClickRef.current = onLotDoubleClick
  const onRoadClickRef = useRef(onRoadClick)
  onRoadClickRef.current = onRoadClick
  const onWallClickRef = useRef(onWallClick)
  onWallClickRef.current = onWallClick
  const onFloorPaintRef = useRef(onFloorPaint)
  onFloorPaintRef.current = onFloorPaint
  const onFurniturePlaceRef = useRef(onFurniturePlace)
  onFurniturePlaceRef.current = onFurniturePlace
  const lastLotClickTimeRef = useRef(0)
  const lastLotClickIdRef = useRef<string | null>(null)
  const lotCorner1Ref = useRef(lotCorner1)
  lotCorner1Ref.current = lotCorner1
  const lotsRef = useRef(lots)
  lotsRef.current = lots

  // Building tool refs (for use inside event handlers)
  const wallDrawModeRef = useRef(wallDrawMode)
  wallDrawModeRef.current = wallDrawMode
  const wallStartPointRef = useRef(wallStartPoint)
  wallStartPointRef.current = wallStartPoint
  const wallHeightRef = useRef(wallHeight)
  wallHeightRef.current = wallHeight
  const wallMaterialRef = useRef(wallMaterial)
  wallMaterialRef.current = wallMaterial
  const activeFloorRef = useRef(activeFloor)
  activeFloorRef.current = activeFloor
  const buildingDataRef = useRef(buildingData)
  buildingDataRef.current = buildingData
  const currentLevelRef = useRef(currentLevel)
  currentLevelRef.current = currentLevel

  // Floor drag-to-fill ref
  const floorDragStartRef = useRef<[number, number, number] | null>(null)

  // ── Initialize Three.js scene ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87CEEB)
    sceneRef.current = scene

    // Camera
    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const worldSize = Math.max(worldSizeX, worldSizeZ)
    scene.fog = new THREE.Fog(0x87CEEB, Math.max(worldSize * 0.5, 100), Math.max(worldSize * 1.5, 400))
    const terrainTop = terrain.maxHeight || worldSize * 0.12
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.5, worldSize * 3)
    const camHeight = Math.max(terrainTop * 0.5 + worldSize * 0.08, worldSize * 0.3)
    camera.position.set(worldSizeX * 0.15, camHeight, worldSizeZ * 0.15)
    camera.lookAt(worldSizeX * 0.4, Math.min(terrainTop * 0.2, camHeight * 0.5), worldSizeZ * 0.4)
    cameraRef.current = camera

    // Renderer — no antialias, no shadows, capped pixel ratio for performance
    const renderer = new THREE.WebGLRenderer({ antialias: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(1)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 5
    controls.maxDistance = worldSize * 2
    controls.target.set(worldSizeX * 0.4, 0, worldSizeZ * 0.4)
    controls.mouseButtons = {
      LEFT: -1 as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    }
    controls.update()
    controlsRef.current = controls

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    ambientRef.current = ambient

    const sun = new THREE.DirectionalLight(0xffffff, 0.9)
    sunRef.current = sun
    sun.position.set(worldSize * 0.5, worldSize * 0.8, worldSize * 0.3)
    scene.add(sun)

    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x556B2F, 0.3)
    scene.add(hemi)

    // Chunk manager
    const chunkManager = new ChunkManager()
    scene.add(chunkManager.getGroup())
    chunkManager.setTerrain(terrain)
    chunkManagerRef.current = chunkManager

    // Object manager
    const objectManager = new ObjectManager()
    scene.add(objectManager.getGroup())
    objectManagerRef.current = objectManager

    // Border manager
    const borderManager = new BorderManager()
    scene.add(borderManager.getGroup())
    borderManagerRef.current = borderManager

    // Lot manager
    const lotManager = new LotManager()
    scene.add(lotManager.getGroup())
    lotManagerRef.current = lotManager

    // Road network manager
    const roadManager = new RoadNetworkManager()
    scene.add(roadManager.getGroup())
    roadManagerRef.current = roadManager

    // Wall manager (building level)
    const wallManager = new WallManager()
    scene.add(wallManager.getGroup())
    wallManagerRef.current = wallManager

    // First-person controller
    const fpController = new FirstPersonController(camera, renderer.domElement)
    fpController.onSubModeChange = (mode) => {
      onSubModeChangeRef.current(mode)
    }
    fpController.onShiftLockChange = (locked) => {
      setIsPointerLocked(locked)
    }
    fpControllerRef.current = fpController

    // Brush cursor
    const cursorGeo = new THREE.RingGeometry(0.8, 1, 32)
    cursorGeo.rotateX(-Math.PI / 2)
    const cursorMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const cursorMesh = new THREE.Mesh(cursorGeo, cursorMat)
    cursorMesh.visible = false
    cursorMesh.renderOrder = 999
    scene.add(cursorMesh)
    brushCursorRef.current = cursorMesh

    // Camera position reporting (throttled ~10fps)
    let lastCameraUpdate = 0
    const camDir = new THREE.Vector3()

    // Animation loop
    const clock = new THREE.Clock()
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      const delta = clock.getDelta()

      if (cameraModeRef.current === 'first-person') {
        fpController.update(delta, terrainRef.current)
      } else {
        controls.update()
      }

      // FPS counter
      fpsFramesRef.current++
      const now = performance.now()
      if (now - fpsTimeRef.current >= 1000) {
        onFpsUpdate(fpsFramesRef.current)
        fpsFramesRef.current = 0
        fpsTimeRef.current = now
      }

      // Camera position reporting (throttled ~4fps to avoid React re-render spam)
      if (now - lastCameraUpdate > 250) {
        lastCameraUpdate = now
        camera.getWorldDirection(camDir)
        const yaw = Math.atan2(camDir.x, camDir.z)
        onCameraUpdateRef.current?.(
          [camera.position.x, camera.position.y, camera.position.z],
          yaw
        )
      }

      // Frustum cull terrain chunks before rendering
      chunkManagerRef.current?.cullChunks(camera)

      // Update weather particles — follow camera + fall, scale with distance
      const wp = weatherParticlesRef.current
      const wv = weatherVelocitiesRef.current
      if (wp && wv) {
        const cameraDistance = camera.position.length()
        const spread = Math.max(200, cameraDistance * 0.5)
        const posAttr = wp.geometry.getAttribute('position') as THREE.BufferAttribute
        const arr = posAttr.array as Float32Array
        const count = wv.length
        for (let i = 0; i < count; i++) {
          arr[i * 3 + 1] -= wv[i] * delta
          // Respawn at top when below camera
          if (arr[i * 3 + 1] < camera.position.y - spread * 0.5) {
            arr[i * 3] = camera.position.x + (Math.random() - 0.5) * spread
            arr[i * 3 + 1] = camera.position.y + spread * 0.5 + Math.random() * spread * 0.5
            arr[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * spread
          }
        }
        // Scale particle size with distance
        const mat = wp.material as THREE.PointsMaterial
        mat.size = Math.max(0.4, cameraDistance * 0.003)
        wp.position.set(0, 0, 0)
        posAttr.needsUpdate = true
      }

      renderer.render(scene, camera)
    }
    animate()

    // Resize
    function handleResize() {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animFrameRef.current)
      fpController.dispose()
      chunkManager.dispose()
      objectManager.dispose()
      borderManager.dispose()
      lotManager.dispose()
      roadManager.dispose()
      wallManager.dispose()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry?.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material?.dispose()
          }
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Saved orbit camera state for restoring when exiting first-person
  const savedOrbitRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)

  // ── Camera mode switching ─────────────────────────────────
  useEffect(() => {
    const controls = controlsRef.current
    const fpController = fpControllerRef.current
    if (!controls || !fpController) return

    const camera = cameraRef.current
    const tr = terrainRef.current

    if (cameraMode === 'first-person') {
      // Save orbit state before switching
      savedOrbitRef.current = {
        pos: camera ? camera.position.clone() : new THREE.Vector3(),
        target: controls.target.clone(),
      }

      controls.enabled = false
      fpController.bindEvents()

      if (camera && tr) {
        // Place camera at the orbit target (where user was looking) at ground level
        const targetX = controls.target.x
        const targetZ = controls.target.z

        // Clamp to world bounds
        const worldSizeX = tr.size * tr.cellSize
        const worldSizeZ = tr.sizeZ * tr.cellSize
        const px = Math.max(0, Math.min(worldSizeX, targetX))
        const pz = Math.max(0, Math.min(worldSizeZ, targetZ))

        // Sample terrain height (bilinear)
        const gx = px / tr.cellSize
        const gz = pz / tr.cellSize
        const gx0 = Math.floor(gx), gz0 = Math.floor(gz)
        const fx = gx - gx0, fz = gz - gz0
        const sample = (x: number, z: number) => {
          if (x < 0 || x >= tr.size || z < 0 || z >= tr.sizeZ) return 0
          return tr.heights[z * tr.size + x] * tr.maxHeight
        }
        const h00 = sample(gx0, gz0), h10 = sample(gx0 + 1, gz0)
        const h01 = sample(gx0, gz0 + 1), h11 = sample(gx0 + 1, gz0 + 1)
        const terrainY = (h00 + (h10 - h00) * fx) + ((h01 + (h11 - h01) * fx) - (h00 + (h10 - h00) * fx)) * fz
        const eyeHeight = 1.65

        camera.position.set(px, terrainY + eyeHeight, pz)
        // Look forward along the direction from old camera to target (horizontal)
        const lookDir = new THREE.Vector3(targetX - savedOrbitRef.current.pos.x, 0, targetZ - savedOrbitRef.current.pos.z)
        if (lookDir.lengthSq() > 0.01) {
          lookDir.normalize()
          camera.lookAt(px + lookDir.x * 10, terrainY + eyeHeight, pz + lookDir.z * 10)
        }

        camera.fov = 110
        camera.updateProjectionMatrix()
      }
    } else {
      fpController.resetShiftLock()
      fpController.unbindEvents()
      controls.enabled = true

      if (camera) {
        // Restore saved orbit camera state
        if (savedOrbitRef.current) {
          camera.position.copy(savedOrbitRef.current.pos)
          controls.target.copy(savedOrbitRef.current.target)
          savedOrbitRef.current = null
        }
        camera.fov = 60
        camera.updateProjectionMatrix()
        controls.update()
      }
    }
  }, [cameraMode])

  // ── Sync FP controller settings ──────────────────────────
  useEffect(() => {
    const fpController = fpControllerRef.current
    if (!fpController) return
    fpController.subMode = firstPersonSubMode
    fpController.speed = firstPersonSpeed
  }, [firstPersonSubMode, firstPersonSpeed])

  // ── Reactive camera far plane and orbit distance ────
  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    const worldSize = Math.max(terrain.size, terrain.sizeZ) * terrain.cellSize

    if (cameraMode === 'first-person') {
      const fogFar = Math.max(600, Math.min(worldSize * 0.3, 2000))
      camera.far = fogFar * 1.1
    } else {
      camera.far = Math.max(worldSize * 3, terrain.maxHeight * 6)
    }
    camera.updateProjectionMatrix()

    controls.maxDistance = worldSize * 2
  }, [terrain.size, terrain.sizeZ, terrain.cellSize, terrain.maxHeight, cameraMode])

  // ── Reset camera when terrain dimensions change (level navigation) ──
  const prevTerrainSizeRef = useRef(`${terrain.size}-${terrain.sizeZ}-${terrain.cellSize}-${currentLevel}`)
  useEffect(() => {
    const key = `${terrain.size}-${terrain.sizeZ}-${terrain.cellSize}-${currentLevel}`
    if (key === prevTerrainSizeRef.current) return
    prevTerrainSizeRef.current = key

    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const worldSize = Math.max(worldSizeX, worldSizeZ)

    if (currentLevel === 'building') {
      // Building interior: position camera for top-down building view
      const bd = buildingDataRef.current
      const bldgSize = bd ? bd.gridSize * bd.gridCellSize : worldSize * 0.5
      const bldgCenter = bldgSize / 2
      camera.position.set(bldgCenter + bldgSize * 0.4, bldgSize * 0.8, bldgCenter + bldgSize * 0.4)
      camera.near = 0.1
      camera.far = bldgSize * 10
      camera.updateProjectionMatrix()
      controls.target.set(bldgCenter, 0, bldgCenter)
      controls.minDistance = 1
      controls.maxDistance = bldgSize * 5
      controls.update()
    } else {
      const cx = worldSizeX * 0.5
      const cz = worldSizeZ * 0.5
      const fovRad = (camera.fov * Math.PI) / 180
      const fitDistance = (worldSize / 2) / Math.tan(fovRad / 2)
      // Position at ~45-degree angle looking at terrain center
      const dist = fitDistance * 0.6
      const terrainTop = terrain.maxHeight || 0
      const resetHeight = Math.max(terrainTop * 0.5, worldSize * 0.3, 15)
      camera.position.set(cx + dist * 0.3, resetHeight, cz + dist * 0.3)
      camera.near = Math.max(0.5, worldSize * 0.001)
      camera.far = worldSize * 4
      camera.updateProjectionMatrix()

      controls.target.set(cx, Math.min(terrainTop * 0.2, resetHeight * 0.3), cz)
      controls.minDistance = Math.max(5, worldSize * 0.01)
      controls.maxDistance = worldSize * 3
      controls.update()
    }
  }, [terrain.size, terrain.sizeZ, terrain.cellSize, currentLevel])

  // ── Camera preset handler ──────────────────────
  useEffect(() => {
    if (!cameraPreset || !cameraRef.current || !controlsRef.current) return
    const camera = cameraRef.current
    const controls = controlsRef.current
    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const worldSize = Math.max(worldSizeX, worldSizeZ)
    const cx = worldSizeX * 0.5
    const cz = worldSizeZ * 0.5

    switch (cameraPreset) {
      case 'top':
        camera.position.set(cx, worldSize * 0.8, cz)
        controls.target.set(cx, 0, cz)
        break
      case 'front':
        camera.position.set(cx, worldSize * 0.15, cz + worldSize * 0.6)
        controls.target.set(cx, 0, cz)
        break
      case 'side':
        camera.position.set(cx + worldSize * 0.6, worldSize * 0.15, cz)
        controls.target.set(cx, 0, cz)
        break
      case 'perspective':
        camera.position.set(cx + worldSize * 0.3, worldSize * 0.3, cz + worldSize * 0.3)
        controls.target.set(cx, 0, cz)
        break
    }
    controls.update()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPresetCounter])

  // ── Update terrain when data changes ──────────────────────
  // Track the heights and materials array identity to distinguish full replacements
  // (heightmap upload, cartography generate, flatten, auto-paint, etc.) from
  // in-place sculpt mutations that only need markDirty/rebuildDirty.
  const prevHeightsRef = useRef<Float32Array | null>(null)
  const prevMaterialsRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
    if (!chunkManagerRef.current) return
    // Skip rebuild if both arrays are the same objects (in-place sculpt/paint mutation).
    // React re-renders because world.updatedAt changed, but the buffers are identical.
    if (terrain.heights === prevHeightsRef.current && terrain.materials === prevMaterialsRef.current) return
    prevHeightsRef.current = terrain.heights
    prevMaterialsRef.current = terrain.materials
    chunkManagerRef.current.setTerrain(terrain)
  }, [terrain])

  // ── Sync objects ──────────────────────────────────────────
  // Only re-sync when the objects array changes (add/remove/reorder).
  // Decoupled from terrain.heights — sculpt strokes no longer rebuild all objects.
  useEffect(() => {
    if (objectManagerRef.current) {
      objectManagerRef.current.syncObjects(objects, terrain)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects])

  // ── Update selection highlighting ─────────────────────────
  useEffect(() => {
    if (objectManagerRef.current) {
      objectManagerRef.current.setSelectedIds(selectedObjectIds)
    }
  }, [selectedObjectIds])

  // ── Sync borders ────────────────────────────────────────────
  // Filter out borders linked to child regions (those are rendered as child region outlines)
  useEffect(() => {
    if (borderManagerRef.current && polygonBorders && showBorders) {
      const decorativeBorders = polygonBorders.filter(b => !b.linkedChildId)
      borderManagerRef.current.syncBorders(decorativeBorders, terrain)
    } else if (borderManagerRef.current) {
      borderManagerRef.current.syncBorders([], terrain)
    }
  }, [polygonBorders, terrain, showBorders])

  // ── Border preview line ───────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old preview (may be a Group with children)
    if (borderPreviewRef.current) {
      borderPreviewRef.current.traverse(child => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach(m => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })
      scene.remove(borderPreviewRef.current)
      borderPreviewRef.current = null
    }

    if (borderDrawMode === 'drawing' && borderVertices.length > 0 && borderManagerRef.current) {
      const preview = borderManagerRef.current.renderPreview(borderVertices, null, terrain, borderColor)
      if (preview) {
        scene.add(preview)
        borderPreviewRef.current = preview
      }
    }
  }, [borderDrawMode, borderVertices, terrain, borderColor])

  // ── Polygon boundary outline (inside child node) ─────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old outline
    if (boundaryOutlineRef.current) {
      boundaryOutlineRef.current.geometry.dispose()
      ;(boundaryOutlineRef.current.material as THREE.Material).dispose()
      scene.remove(boundaryOutlineRef.current)
      boundaryOutlineRef.current = null
    }

    if (polygonBoundary && polygonBoundary.length >= 3) {
      const points = polygonBoundary.map(v => {
        const gx = Math.floor(v.x / terrain.cellSize)
        const gz = Math.floor(v.z / terrain.cellSize)
        const idx = Math.max(0, Math.min(gz, terrain.sizeZ - 1)) * terrain.size + Math.max(0, Math.min(gx, terrain.size - 1))
        const y = (terrain.heights[idx] ?? 0) * terrain.maxHeight + 2
        return new THREE.Vector3(v.x, y, v.z)
      })
      // Close the polygon
      points.push(points[0].clone())

      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineDashedMaterial({
        color: 0xff6b35,
        dashSize: 3,
        gapSize: 1.5,
        opacity: 0.7,
        transparent: true,
        depthTest: false,
      })
      const line = new THREE.Line(geo, mat)
      line.computeLineDistances()
      line.renderOrder = 15
      scene.add(line)
      boundaryOutlineRef.current = line
    }
  }, [polygonBoundary, terrain])

  // ── Sync lots ─────────────────────────────────────────────
  useEffect(() => {
    if (lotManagerRef.current && lots && showLots) {
      lotManagerRef.current.syncLots(lots, terrain)
    } else if (lotManagerRef.current) {
      lotManagerRef.current.syncLots([], terrain)
    }
  }, [lots, terrain, showLots])

  // ── Lot preview rectangle (two-click sizing) ──────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const old = scene.getObjectByName('lot-preview')
    if (old) scene.remove(old)

    if (!lotCorner1) return

    const cs = terrain.cellSize || 1
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9966ff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = 'lot-preview'
    mesh.position.set(lotCorner1.x * cs, 0.2, lotCorner1.z * cs)
    mesh.renderOrder = 12
    scene.add(mesh)

    return () => {
      scene.remove(mesh)
      geo.dispose()
      mat.dispose()
    }
  }, [lotCorner1, terrain.cellSize])

  // ── Sync roads ────────────────────────────────────────────
  useEffect(() => {
    if (roadManagerRef.current && roadNetwork && showRoads) {
      roadManagerRef.current.syncNetwork(roadNetwork, terrain)
    } else if (roadManagerRef.current) {
      roadManagerRef.current.syncNetwork({ segments: [], intersections: [] }, terrain)
    }
  }, [roadNetwork, terrain, showRoads])

  // ── Road preview line ─────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old preview
    const oldPreview = scene.getObjectByName('road-preview')
    if (oldPreview) {
      oldPreview.traverse(child => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach(m => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })
      scene.remove(oldPreview)
    }

    if (roadDrawMode !== 'drawing' || roadWaypoints.length < 2) return

    const { positions, uvs, indices } = computeRoadRibbon(roadWaypoints, roadWidth, terrain)
    if (positions.length === 0) return

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()

    const mat = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })

    const preview = new THREE.Mesh(geo, mat)
    preview.name = 'road-preview'
    scene.add(preview)

    return () => {
      scene.remove(preview)
      geo.dispose()
      mat.dispose()
    }
  }, [roadDrawMode, roadWaypoints, terrain, roadWidth])

  // ── Toggle terrain/object visibility at building level ───
  useEffect(() => {
    const isBuilding = currentLevel === 'building'
    if (chunkManagerRef.current) {
      chunkManagerRef.current.getGroup().visible = !isBuilding
    }
    if (objectManagerRef.current) {
      objectManagerRef.current.getGroup().visible = !isBuilding
    }
    // Also hide roads, lots, borders at building level
    if (roadManagerRef.current) {
      roadManagerRef.current.getGroup().visible = !isBuilding
    }
    if (lotManagerRef.current) {
      lotManagerRef.current.getGroup().visible = !isBuilding
    }
    if (borderPreviewRef.current) {
      borderPreviewRef.current.visible = !isBuilding
    }
    // Disable fog inside buildings
    if (isBuilding && sceneRef.current) {
      sceneRef.current.fog = null
    }
  }, [currentLevel])

  // ── Sync building ─────────────────────────────────────────
  useEffect(() => {
    if (wallManagerRef.current && buildingData && currentLevel === 'building') {
      wallManagerRef.current.syncBuilding(buildingData, activeFloor, floorVisibility)
    } else if (wallManagerRef.current) {
      wallManagerRef.current.dispose()
    }
  }, [buildingData, activeFloor, currentLevel, floorVisibility])

  // ── Wall ghost preview ────────────────────────────────────
  useEffect(() => {
    if (wallManagerRef.current && wallDrawMode === 'drawing' && wallStartPoint && buildingData) {
      // Ghost will be updated per mouse move (handled in mouse handler)
    } else if (wallManagerRef.current) {
      wallManagerRef.current.clearGhost()
    }
  }, [wallDrawMode, wallStartPoint, buildingData])

  // ── Ghost preview for object placement ────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Remove old ghost
    if (ghostMeshRef.current) {
      scene.remove(ghostMeshRef.current)
      ghostMeshRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material?.dispose()
          }
        }
      })
      ghostMeshRef.current = null
    }

    // Create new ghost if placing objects
    if (activeTool === 'place-object' && selectedObjectType) {
      const entry = getCatalogEntry(selectedObjectType)
      if (entry) {
        const ghost = entry.createMesh(entry.defaultColor)
        ghost.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.Material & { transparent: boolean; opacity: number; depthWrite: boolean }
            mat.transparent = true
            mat.opacity = 0.5
            mat.depthWrite = false
          }
        })
        ghost.visible = false
        ghost.renderOrder = 998
        scene.add(ghost)
        ghostMeshRef.current = ghost
      }
    }
  }, [activeTool, selectedObjectType])

  // ── Update grid helper ─────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (gridHelperRef.current) {
      scene.remove(gridHelperRef.current)
      gridHelperRef.current.geometry?.dispose()
      if (gridHelperRef.current.material instanceof THREE.Material) {
        gridHelperRef.current.material.dispose()
      }
      gridHelperRef.current = null
    }

    if (showGrid) {
      const worldSizeX = terrain.size * terrain.cellSize
      const worldSizeZ = terrain.sizeZ * terrain.cellSize
      const maxWorldSize = Math.max(worldSizeX, worldSizeZ)
      const maxCells = Math.min(Math.max(terrain.size, terrain.sizeZ), 64)
      const grid = new THREE.GridHelper(maxWorldSize, maxCells, 0x444444, 0x333333)
      grid.position.set(worldSizeX / 2, 0.05, worldSizeZ / 2)
      grid.material.opacity = 0.15
      grid.material.transparent = true
      scene.add(grid)
      gridHelperRef.current = grid
    }
  }, [showGrid, terrain.size, terrain.sizeZ, terrain.cellSize])

  // ── Update water plane ─────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (waterMeshRef.current) {
      waterMeshRef.current.geometry.dispose()
      ;(waterMeshRef.current.material as THREE.Material).dispose()
      scene.remove(waterMeshRef.current)
      waterMeshRef.current = null
    }

    if (showWater && terrain.seaLevel > 0) {
      const worldSizeX = terrain.size * terrain.cellSize
      const worldSizeZ = terrain.sizeZ * terrain.cellSize
      // Water extends 5x beyond terrain edges to create an ocean effect
      const waterExtent = Math.max(worldSizeX, worldSizeZ) * 5
      const waterGeo = new THREE.PlaneGeometry(waterExtent, waterExtent)
      waterGeo.rotateX(-Math.PI / 2)
      const waterMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(waterColor),
      })
      const waterMesh = new THREE.Mesh(waterGeo, waterMat)
      waterMesh.position.set(worldSizeX / 2, terrain.seaLevel * terrain.maxHeight, worldSizeZ / 2)
      waterMesh.userData.isWater = true
      scene.add(waterMesh)
      waterMeshRef.current = waterMesh
    }
  }, [showWater, terrain.seaLevel, terrain.maxHeight, terrain.size, terrain.sizeZ, terrain.cellSize, waterColor])

  // ── Terrain boundary indicator ───────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old boundary
    if (boundaryLineRef.current) {
      boundaryLineRef.current.geometry.dispose()
      ;(boundaryLineRef.current.material as THREE.Material).dispose()
      scene.remove(boundaryLineRef.current)
      boundaryLineRef.current = null
    }

    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const waterY = terrain.seaLevel * terrain.maxHeight
    const borderY = Math.max(waterY + 0.5, 1)

    const points = [
      new THREE.Vector3(0, borderY, 0),
      new THREE.Vector3(worldSizeX, borderY, 0),
      new THREE.Vector3(worldSizeX, borderY, worldSizeZ),
      new THREE.Vector3(0, borderY, worldSizeZ),
      new THREE.Vector3(0, borderY, 0),
    ]

    const geo = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineDashedMaterial({
      color: 0xff8800,
      dashSize: 4,
      gapSize: 2,
      opacity: 0.7,
      transparent: true,
    })
    const line = new THREE.Line(geo, mat)
    line.computeLineDistances()
    scene.add(line)
    boundaryLineRef.current = line
  }, [terrain.size, terrain.sizeZ, terrain.cellSize, terrain.seaLevel, terrain.maxHeight])

  // ── Child region outlines ──────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old region outlines
    if (regionGroupRef.current) {
      scene.remove(regionGroupRef.current)
      regionGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach(m => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })
      regionGroupRef.current = null
    }

    if (!childRegions || childRegions.length === 0) return

    const group = new THREE.Group()
    group.name = 'childRegions'
    const cs = terrain.cellSize

    for (const region of childRegions) {
      const b = region.bounds
      const color = new THREE.Color(region.color || '#44aaff')

      // Compute average height within bounds for Y position
      let avgH = 0
      let count = 0
      for (let z = b.startZ; z < b.startZ + b.depth; z += Math.max(1, Math.floor(b.depth / 4))) {
        for (let x = b.startX; x < b.startX + b.width; x += Math.max(1, Math.floor(b.width / 4))) {
          if (x >= 0 && x < terrain.size && z >= 0 && z < terrain.sizeZ) {
            avgH += terrain.heights[z * terrain.size + x] * terrain.maxHeight
            count++
          }
        }
      }
      const baseY = count > 0 ? avgH / count + 1 : 2

      // Use polygon vertices if available, otherwise fall back to rectangular bounds
      const polyVerts = region.polygonVertices
      let outlinePoints: THREE.Vector3[]

      if (polyVerts && polyVerts.length >= 3) {
        // Polygon outline from border vertices (already in world coords)
        outlinePoints = polyVerts.map(v => new THREE.Vector3(v.x, baseY, v.z))
        outlinePoints.push(outlinePoints[0].clone()) // close loop
      } else {
        // Rectangular outline from bounds
        const x0 = b.startX * cs
        const z0 = b.startZ * cs
        const x1 = (b.startX + b.width) * cs
        const z1 = (b.startZ + b.depth) * cs
        outlinePoints = [
          new THREE.Vector3(x0, baseY, z0),
          new THREE.Vector3(x1, baseY, z0),
          new THREE.Vector3(x1, baseY, z1),
          new THREE.Vector3(x0, baseY, z1),
          new THREE.Vector3(x0, baseY, z0),
        ]
      }

      const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints)
      const outlineMat = new THREE.LineDashedMaterial({
        color,
        dashSize: 2,
        gapSize: 1,
        opacity: 0.9,
        transparent: true,
        linewidth: 2,
      })
      const outlineLine = new THREE.Line(outlineGeo, outlineMat)
      outlineLine.computeLineDistances()
      outlineLine.renderOrder = 10
      outlineLine.userData.regionId = region.id
      group.add(outlineLine)

      // Semi-transparent fill
      if (polyVerts && polyVerts.length >= 3) {
        // Polygon fill using ShapeGeometry
        const shape = new THREE.Shape()
        shape.moveTo(polyVerts[0].x, polyVerts[0].z)
        for (let i = 1; i < polyVerts.length; i++) {
          shape.lineTo(polyVerts[i].x, polyVerts[i].z)
        }
        shape.closePath()
        const fillGeo = new THREE.ShapeGeometry(shape)
        // ShapeGeometry is in XY plane, rotate to XZ
        fillGeo.rotateX(-Math.PI / 2)
        const fillMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const fillMesh = new THREE.Mesh(fillGeo, fillMat)
        fillMesh.position.y = baseY - 0.1
        fillMesh.renderOrder = 9
        fillMesh.userData.regionId = region.id
        group.add(fillMesh)
      } else {
        const x0 = b.startX * cs
        const z0 = b.startZ * cs
        const x1 = (b.startX + b.width) * cs
        const z1 = (b.startZ + b.depth) * cs
        const fillGeo = new THREE.PlaneGeometry(b.width * cs, b.depth * cs)
        fillGeo.rotateX(-Math.PI / 2)
        const fillMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const fillMesh = new THREE.Mesh(fillGeo, fillMat)
        fillMesh.position.set((x0 + x1) / 2, baseY - 0.1, (z0 + z1) / 2)
        fillMesh.renderOrder = 9
        fillMesh.userData.regionId = region.id
        group.add(fillMesh)
      }

      // Label (text sprite) — compute centroid from polygon or bounds center
      let labelX: number, labelZ: number
      if (polyVerts && polyVerts.length >= 3) {
        labelX = polyVerts.reduce((s, v) => s + v.x, 0) / polyVerts.length
        labelZ = polyVerts.reduce((s, v) => s + v.z, 0) / polyVerts.length
      } else {
        labelX = (b.startX + b.width / 2) * cs
        labelZ = (b.startZ + b.depth / 2) * cs
      }
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = `#${color.getHexString()}`
        ctx.font = 'bold 28px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(region.name, 128, 40)

        const texture = new THREE.CanvasTexture(canvas)
        const labelMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85 })
        const sprite = new THREE.Sprite(labelMat)
        sprite.position.set(labelX, baseY + 5, labelZ)
        sprite.scale.set(b.width * cs * 0.5, b.width * cs * 0.125, 1)
        sprite.userData.regionId = region.id
        group.add(sprite)
      }
    }

    scene.add(group)
    regionGroupRef.current = group
  }, [childRegions, terrain.cellSize, terrain.size, terrain.sizeZ, terrain.heights, terrain.maxHeight])

  // ── Update sun position from angle/elevation ──────────────
  useEffect(() => {
    const sun = sunRef.current
    const ambient = ambientRef.current
    if (!sun) return
    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const worldCenter = Math.max(worldSizeX, worldSizeZ) * 0.5
    const distance = worldCenter * 1.5

    const azRad = sunAngle * Math.PI / 180
    const elRad = sunElevation * Math.PI / 180

    sun.position.set(
      worldSizeX * 0.5 + distance * Math.cos(azRad) * Math.cos(elRad),
      distance * Math.sin(elRad),
      worldSizeZ * 0.5 + distance * Math.sin(azRad) * Math.cos(elRad)
    )
    sun.target.position.set(worldSizeX * 0.5, 0, worldSizeZ * 0.5)
    sun.target.updateMatrixWorld()

    // Adjust intensity based on elevation (lower sun = dimmer, warmer)
    const normalizedEl = sunElevation / 90 // 0 at horizon, 1 at zenith
    sun.intensity = 0.4 + normalizedEl * 0.6
    if (ambient) {
      ambient.intensity = 0.3 + normalizedEl * 0.3
    }

    // Warm color at low elevation, white at high
    const warmth = 1 - normalizedEl
    sun.color.setRGB(1, 1 - warmth * 0.15, 1 - warmth * 0.35)

    // Update terrain chunk shader light direction
    const lightDir = sun.position.clone().sub(new THREE.Vector3(worldSizeX * 0.5, 0, worldSizeZ * 0.5)).normalize()
    chunkManagerRef.current?.updateLightDirection(lightDir)
  }, [sunAngle, sunElevation, terrain.size, terrain.sizeZ, terrain.cellSize])

  // ── Sky color effect ────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return
    const color = new THREE.Color(skyColor)
    sceneRef.current.background = color
  }, [skyColor])

  // ── Fog effect ──────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (!fogEnabled || currentLevelRef.current === 'building') {
      scene.fog = null
      return
    }

    const worldSize = Math.max(terrain.size, terrain.sizeZ) * terrain.cellSize
    const fogColor = new THREE.Color(skyColor)

    if (cameraMode === 'first-person') {
      const fogNear = Math.max(150, Math.min(worldSize * 0.08, 500))
      const fogFar = Math.max(600, Math.min(worldSize * 0.3, 2000))
      scene.fog = new THREE.Fog(fogColor, fogNear, fogFar)
    } else {
      const fogNear = worldSize * 0.4
      const fogFar = worldSize * 1.2
      scene.fog = new THREE.Fog(fogColor, fogNear, fogFar)
    }
  }, [fogEnabled, skyColor, weatherType, cameraMode, terrain.size, terrain.sizeZ, terrain.cellSize])

  // ── Weather particle system ─────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old particles
    if (weatherParticlesRef.current) {
      scene.remove(weatherParticlesRef.current)
      weatherParticlesRef.current.geometry.dispose()
      ;(weatherParticlesRef.current.material as THREE.Material).dispose()
      weatherParticlesRef.current = null
      weatherVelocitiesRef.current = null
    }

    if (weatherType === 'clear' || weatherType === 'cloudy') return

    const count = weatherType === 'rain' ? 2000 : 1000
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    const spread = 200

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread
      positions[i * 3 + 1] = Math.random() * 100
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread
      velocities[i] = weatherType === 'rain'
        ? 40 + Math.random() * 20
        : 3 + Math.random() * 3
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      color: weatherType === 'rain' ? 0xaaccff : 0xffffff,
      size: weatherType === 'rain' ? 0.4 : 1.5,
      transparent: true,
      opacity: weatherType === 'rain' ? 0.6 : 0.8,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    points.name = 'weather-particles'
    scene.add(points)
    weatherParticlesRef.current = points
    weatherVelocitiesRef.current = velocities
  }, [weatherType])

  // ── Weather: cloudy dims sun + tints sky ────────────────────
  useEffect(() => {
    const sun = sunRef.current
    const ambient = ambientRef.current
    const scene = sceneRef.current
    if (!sun) return
    const normalizedEl = sunElevation / 90
    if (weatherType === 'cloudy') {
      sun.intensity = (0.4 + normalizedEl * 0.6) * 0.6
      if (ambient) ambient.intensity = (0.3 + normalizedEl * 0.3) * 0.7
      // Tint scene background towards grey
      if (scene) {
        const base = new THREE.Color(skyColor)
        const grey = new THREE.Color(0x8a8a8a)
        base.lerp(grey, 0.4)
        scene.background = base
      }
    } else {
      sun.intensity = 0.4 + normalizedEl * 0.6
      if (ambient) ambient.intensity = 0.3 + normalizedEl * 0.3
      // Restore original sky color
      if (scene) {
        scene.background = new THREE.Color(skyColor)
      }
    }
  }, [weatherType, sunElevation, skyColor])

  // ── Update brush cursor size ───────────────────────────────
  useEffect(() => {
    const cursor = brushCursorRef.current
    if (!cursor) return
    const size = activeTool === 'paint-material'
      ? materialBrush.size * terrain.cellSize
      : sculptBrush.size * terrain.cellSize
    cursor.scale.set(size, size, size)
  }, [activeTool, sculptBrush.size, materialBrush.size, terrain.cellSize])

  // ── Mouse interaction ─────────────────────────────────────
  const updateMouseNDC = useCallback((e: MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }, [])

  // Cached center vector for first-person raycasting (avoid per-call allocation)
  const centerNDCRef = useRef(new THREE.Vector2(0, 0))

  /** Set raycaster from either mouse position (orbit) or screen center (first-person) */
  const setupRaycaster = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    // FP + pointer locked: raycast from crosshair (center)
    // FP + not locked (trackpad drag): raycast from mouse position
    if (cameraModeRef.current === 'first-person' && fpControllerRef.current?.isLocked()) {
      raycasterRef.current.setFromCamera(centerNDCRef.current, camera)
    } else {
      raycasterRef.current.setFromCamera(mouseRef.current, camera)
    }
  }, [])

  const raycastTerrain = useCallback((): THREE.Vector3 | null => {
    const camera = cameraRef.current
    if (!camera) return null

    setupRaycaster()

    // At building level, skip terrain chunks and raycast against the floor plane directly
    if (currentLevelRef.current === 'building') {
      const bd = buildingDataRef.current
      if (bd) {
        const floor = bd.floors.find(f => f.level === activeFloorRef.current)
        const floorY = floor?.floorHeight ?? 0
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY)
        const floorTarget = new THREE.Vector3()
        const floorHit = raycasterRef.current.ray.intersectPlane(floorPlane, floorTarget)
        if (floorHit) return floorHit
      }
      // Fallback to y=0 ground plane for building level
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const target = new THREE.Vector3()
      return raycasterRef.current.ray.intersectPlane(groundPlane, target)
    }

    // Try terrain chunk meshes first (non-building levels)
    const chunkMgr = chunkManagerRef.current
    if (chunkMgr) {
      const hits = raycasterRef.current.intersectObjects(chunkMgr.getChunkMeshes(), false)
      if (hits.length > 0) {
        return hits[0].point
      }
    }

    // Fallback: intersect ground plane at y=0 so clicks always register
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const target = new THREE.Vector3()
    const hit = raycasterRef.current.ray.intersectPlane(groundPlane, target)
    return hit
  }, [setupRaycaster])

  const raycastObjects = useCallback((): { objectId: string; point: THREE.Vector3 } | null => {
    const camera = cameraRef.current
    const objMgr = objectManagerRef.current
    if (!camera || !objMgr) return null

    setupRaycaster()
    const pickables = objMgr.getPickableMeshes()
    const hits = raycasterRef.current.intersectObjects(pickables, false)
    if (hits.length > 0) {
      const id = objMgr.findObjectIdFromIntersection(hits[0])
      if (id) return { objectId: id, point: hits[0].point }
    }
    return null
  }, [setupRaycaster])

  const handleBrushStroke = useCallback(() => {
    const point = raycastTerrain()
    if (!point) return

    // Skip strokes outside polygon boundary if set
    const boundary = polygonBoundaryRef.current
    if (boundary && boundary.length >= 3) {
      if (!isPointInPolygon(point.x, point.z, boundary)) return
    }

    const t = terrainRef.current
    const grid = worldToGrid(point, t)
    if (!grid) return

    const tool = activeToolRef.current
    if (tool === 'sculpt') {
      const brush = sculptBrushRef.current
      onTerrainSculpt(grid.x, grid.z, brush)
      if (chunkManagerRef.current) {
        chunkManagerRef.current.markDirty(grid.x, grid.z, brush.size)
        chunkManagerRef.current.rebuildDirty()
      }
    } else if (tool === 'paint-material') {
      const brush = materialBrushRef.current
      onTerrainPaint(grid.x, grid.z, brush)
      if (chunkManagerRef.current) {
        chunkManagerRef.current.markDirty(grid.x, grid.z, brush.size)
        chunkManagerRef.current.rebuildDirty()
      }
    }
  }, [raycastTerrain, onTerrainSculpt, onTerrainPaint])

  // Mouse event handlers
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Throttle timestamps — raycast + state updates are expensive
    let lastRaycastTime = 0
    let lastCursorStateTime = 0
    const RAYCAST_INTERVAL = 33   // ~30fps for raycasts
    const STATE_INTERVAL = 200    // ~5fps for React state updates

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const tool = activeToolRef.current

      if (tool === 'sculpt' || tool === 'paint-material') {
        updateMouseNDC(e)
        isPaintingRef.current = true
        lastPaintTimeRef.current = 0
        handleBrushStroke()
        return
      }

      if (tool === 'place-object') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          onObjectPlaceRef.current([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'select') {
        updateMouseNDC(e)
        const objHit = raycastObjects()
        if (objHit) {
          const additive = e.shiftKey || e.ctrlKey || e.metaKey
          onObjectSelectRef.current(objHit.objectId, additive)
          isDraggingObjectRef.current = true
          dragObjectIdRef.current = objHit.objectId
          dragPlaneRef.current.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            objHit.point
          )
        } else {
          // Click on empty space — start marquee tracking
          isMarqueeRef.current = true
          const rect = container.getBoundingClientRect()
          marqueeStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
          marqueeEndRef.current = { ...marqueeStartRef.current }
          onObjectSelectRef.current(null, false)
        }
        return
      }

      if (tool === 'delete') {
        updateMouseNDC(e)
        const objHit = raycastObjects()
        if (objHit) {
          onObjectSelectRef.current(objHit.objectId, false)
        }
        return
      }

      if (tool === 'define-region') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          // Check if click is inside an existing region (for double-click enter)
          const regions = childRegionsRef.current
          const cs = terrainRef.current.cellSize
          if (regions) {
            const now = performance.now()
            for (const region of regions) {
              const b = region.bounds
              const x0 = b.startX * cs
              const z0 = b.startZ * cs
              const x1 = (b.startX + b.width) * cs
              const z1 = (b.startZ + b.depth) * cs
              if (point.x >= x0 && point.x <= x1 && point.z >= z0 && point.z <= z1) {
                // Check double-click
                if (lastClickRegionRef.current === region.id && now - lastClickTimeRef.current < 400) {
                  onRegionDoubleClickRef.current?.(region.id)
                  lastClickTimeRef.current = 0
                  lastClickRegionRef.current = null
                  return
                }
                lastClickTimeRef.current = now
                lastClickRegionRef.current = region.id
              }
            }
          }

          // Not a double-click on a region — fire region click for corner definition
          onRegionClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      // ── New tool handlers ────────────────────────
      if (tool === 'draw-border') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          onBorderClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'draw-lot') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          // Check for lot double-click (enter building)
          const lotsArr = lotsRef.current
          if (lotManagerRef.current && lotsArr) {
            const hitLotId = lotManagerRef.current.findLotAtPosition(point.x, point.z, lotsArr, terrainRef.current)
            if (hitLotId) {
              const now = performance.now()
              if (lastLotClickIdRef.current === hitLotId && now - lastLotClickTimeRef.current < 400) {
                onLotDoubleClickRef.current?.(hitLotId)
                lastLotClickTimeRef.current = 0
                lastLotClickIdRef.current = null
                return
              }
              lastLotClickTimeRef.current = now
              lastLotClickIdRef.current = hitLotId
            } else {
              lastLotClickIdRef.current = null
            }
          }
          onLotClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'draw-road') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          onRoadClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'place-wall') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          onWallClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'place-door') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          onWallClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'paint-floor') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          floorDragStartRef.current = [point.x, point.y, point.z]
          onFloorPaintRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'place-furniture') {
        updateMouseNDC(e)
        const point = raycastTerrain()
        if (point) {
          onFurniturePlaceRef.current?.([point.x, point.y, point.z])
        }
        return
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      updateMouseNDC(e)

      // Marquee select tracking
      if (isMarqueeRef.current && activeToolRef.current === 'select') {
        const rect = container.getBoundingClientRect()
        marqueeEndRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        const s = marqueeStartRef.current
        const en = marqueeEndRef.current
        const x = Math.min(s.x, en.x)
        const y = Math.min(s.y, en.y)
        const w = Math.abs(en.x - s.x)
        const h = Math.abs(en.y - s.y)
        if (w > 5 || h > 5) {
          setMarqueeRect({ x, y, w, h })
        }
        return
      }

      // Object dragging — needs responsive feel, but throttle terrain snap
      if (isDraggingObjectRef.current && dragObjectIdRef.current && activeToolRef.current === 'select') {
        const camera = cameraRef.current
        if (camera) {
          raycasterRef.current.setFromCamera(mouseRef.current, camera)
          const intersectPoint = new THREE.Vector3()
          if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint)) {
            const pos: [number, number, number] = [intersectPoint.x, intersectPoint.y, intersectPoint.z]
            dragLastPosRef.current = pos
            onObjectMoveRef.current(dragObjectIdRef.current!, pos)
          }
        }
        return
      }

      const now = performance.now()

      // Throttle raycasts — this is the expensive operation
      if (now - lastRaycastTime < RAYCAST_INTERVAL) return
      lastRaycastTime = now

      const tool = activeToolRef.current
      const point = raycastTerrain()

      if (point) {
        // Update Three.js objects directly (cheap, no React)
        const cursor = brushCursorRef.current
        if (cursor) {
          const showCursor = tool === 'sculpt' || tool === 'paint-material'
          cursor.visible = showCursor
          if (showCursor) {
            cursor.position.set(point.x, point.y + 0.2, point.z)
          }
        }

        const ghost = ghostMeshRef.current
        if (ghost && tool === 'place-object') {
          ghost.visible = true
          ghost.position.set(point.x, point.y, point.z)
        }

        // Lot preview rectangle update
        if (tool === 'draw-lot' && lotCorner1Ref.current) {
          const preview = sceneRef.current?.getObjectByName('lot-preview')
          if (preview) {
            const c1 = lotCorner1Ref.current
            const cs = terrainRef.current.cellSize || 1
            const cx = (c1.x * cs + point.x) / 2
            const cz = (c1.z * cs + point.z) / 2
            const w = Math.abs(point.x - c1.x * cs)
            const d = Math.abs(point.z - c1.z * cs)
            preview.position.set(cx, point.y + 0.2, cz)
            preview.scale.set(Math.max(w, 0.1), 1, Math.max(d, 0.1))
          }
        }

        // Wall ghost preview
        if (tool === 'place-wall' && wallDrawModeRef.current === 'drawing' && wallStartPointRef.current) {
          const wallMgr = wallManagerRef.current
          if (wallMgr) {
            const bd = buildingDataRef.current
            const floorY = bd?.floors.find(f => f.level === activeFloorRef.current)?.floorHeight ?? 0
            wallMgr.showGhostWall(
              wallStartPointRef.current.x, wallStartPointRef.current.z,
              point.x, point.z,
              wallHeightRef.current, floorY,
              wallMaterialRef.current
            )
          }
        }

        // Throttle React state updates separately (causes full page re-render)
        if (now - lastCursorStateTime > STATE_INTERVAL) {
          lastCursorStateTime = now
          const t = terrainRef.current
          const grid = worldToGrid(point, t)
          onCursorMove([point.x, point.y, point.z], grid)
        }
      } else {
        if (brushCursorRef.current) brushCursorRef.current.visible = false
        if (ghostMeshRef.current) ghostMeshRef.current.visible = false
        if (now - lastCursorStateTime > STATE_INTERVAL) {
          lastCursorStateTime = now
          onCursorMove(null, null)
        }
      }

      // Continuous painting
      if (isPaintingRef.current) {
        if (now - lastPaintTimeRef.current > 50) {
          lastPaintTimeRef.current = now
          handleBrushStroke()
        }
      }
    }

    const handleMouseUp = () => {
      // Finish marquee select
      if (isMarqueeRef.current) {
        isMarqueeRef.current = false
        const s = marqueeStartRef.current
        const en = marqueeEndRef.current
        const mx = Math.min(s.x, en.x)
        const my = Math.min(s.y, en.y)
        const mw = Math.abs(en.x - s.x)
        const mh = Math.abs(en.y - s.y)
        if (mw > 5 || mh > 5) {
          const rect = { x: mx, y: my, w: mw, h: mh }
          // Project all object positions to screen and select those within rect
          const camera = cameraRef.current
          const objectManager = objectManagerRef.current
          if (camera && objectManager && container) {
            const containerRect = container.getBoundingClientRect()
            const selectedIds: string[] = []
            const objs = objectsRef.current
            for (const obj of objs) {
              const pos = new THREE.Vector3(obj.position[0], obj.position[1], obj.position[2])
              pos.project(camera)
              const sx = (pos.x * 0.5 + 0.5) * containerRect.width
              const sy = (-pos.y * 0.5 + 0.5) * containerRect.height
              if (sx >= rect.x && sx <= rect.x + rect.w && sy >= rect.y && sy <= rect.y + rect.h) {
                selectedIds.push(obj.id)
              }
            }
            if (selectedIds.length > 0) {
              // Use the first as select, rest as additive
              onObjectSelectRef.current(selectedIds[0], false)
              for (let i = 1; i < selectedIds.length; i++) {
                onObjectSelectRef.current(selectedIds[i], true)
              }
            }
          }
        }
        setMarqueeRect(null)
      }

      // Floor drag-to-fill: on release, fill rectangle from start to end
      if (floorDragStartRef.current && activeToolRef.current === 'paint-floor') {
        const point = raycastTerrain()
        if (point) {
          onFloorPaintRef.current?.([point.x, point.y, point.z], floorDragStartRef.current)
        }
        floorDragStartRef.current = null
      }

      if (isPaintingRef.current) {
        isPaintingRef.current = false
        onTerrainChanged()
      }
      if (isDraggingObjectRef.current && dragObjectIdRef.current && dragLastPosRef.current) {
        onObjectMoveEndRef.current?.(dragObjectIdRef.current, dragLastPosRef.current)
      }
      isDraggingObjectRef.current = false
      dragObjectIdRef.current = null
      dragLastPosRef.current = null
    }

    const handleMouseLeave = () => {
      isMarqueeRef.current = false
      setMarqueeRect(null)
      floorDragStartRef.current = null
      if (brushCursorRef.current) brushCursorRef.current.visible = false
      if (ghostMeshRef.current) ghostMeshRef.current.visible = false
      onCursorMove(null, null)
      if (isPaintingRef.current) {
        isPaintingRef.current = false
        onTerrainChanged()
      }
      if (isDraggingObjectRef.current && dragObjectIdRef.current && dragLastPosRef.current) {
        onObjectMoveEndRef.current?.(dragObjectIdRef.current, dragLastPosRef.current)
      }
      isDraggingObjectRef.current = false
      dragObjectIdRef.current = null
      dragLastPosRef.current = null
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [updateMouseNDC, raycastTerrain, raycastObjects, handleBrushStroke, onTerrainChanged, onCursorMove])

  const cursorStyle = (() => {
    switch (activeTool) {
      case 'sculpt':
      case 'paint-material':
      case 'paint-floor':
        return 'crosshair'
      case 'place-object':
      case 'place-furniture':
        return 'copy'
      case 'delete':
        return 'not-allowed'
      case 'select':
        return 'pointer'
      case 'draw-border':
      case 'draw-lot':
      case 'draw-road':
      case 'place-wall':
      case 'place-door':
        return 'crosshair'
      default:
        return 'default'
    }
  })()

  return (
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: isPointerLocked ? 'none' : cursorStyle }}
      />
      {/* Marquee select rectangle */}
      {marqueeRect && (
        <div
          className="absolute pointer-events-none border border-dashed border-sky-400 bg-sky-400/10"
          style={{
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.w,
            height: marqueeRect.h,
          }}
        />
      )}
      {/* Crosshair overlay for first-person mode (only when pointer locked) */}
      {cameraMode === 'first-person' && isPointerLocked && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-6 h-6">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/70" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/70" />
          </div>
        </div>
      )}
    </div>
  )
}
