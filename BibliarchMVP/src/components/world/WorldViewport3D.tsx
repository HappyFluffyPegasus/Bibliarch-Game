'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  FreeCamera,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Plane,
  Matrix,
  DynamicTexture,
  VertexData,
  VertexBuffer,
  LinesMesh,
  type AbstractMesh,
  Viewport,
} from '@babylonjs/core'
import { TerrainData, EditorTool, BrushSettings, MaterialBrushSettings, WorldObject, LevelBounds, PolygonBorder, CityLot, RoadNetwork, BuildingData, RoadWaypoint, WorldLevel, isPointInPolygon } from '@/types/world'
import { ChunkManager, worldToGrid } from '@/lib/terrain/ChunkManager'

import { ObjectManager } from '@/lib/terrain/ObjectManager'
import { getCatalogEntry } from '@/lib/terrain/objectCatalog'
import { FirstPersonController } from '@/lib/terrain/FirstPersonController'
import { BorderManager } from '@/lib/borders/BorderManager'
import { LotManager } from '@/lib/city/LotManager'
import { RoadNetworkManager } from '@/lib/city/RoadNetworkManager'
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
  onWallClick?: (worldPos: [number, number, number]) => void
  onFloorPaint?: (worldPos: [number, number, number]) => void
  onFurniturePlace?: (worldPos: [number, number, number]) => void

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
  onWallClick,
  onFloorPaint,
  onFurniturePlace,
  transformMode = 'translate',
  cameraPreset,
  cameraPresetCounter,
}: WorldViewport3DProps) {
  const [isPointerLocked, setIsPointerLocked] = useState(false)
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const cameraRef = useRef<ArcRotateCamera | null>(null)
  const fpCameraRef = useRef<FreeCamera | null>(null)
  const fpControllerRef = useRef<FirstPersonController | null>(null)
  const chunkManagerRef = useRef<ChunkManager | null>(null)

  const objectManagerRef = useRef<ObjectManager | null>(null)
  const borderManagerRef = useRef<BorderManager | null>(null)
  const lotManagerRef = useRef<LotManager | null>(null)
  const roadManagerRef = useRef<RoadNetworkManager | null>(null)
  const wallManagerRef = useRef<WallManager | null>(null)
  const borderPreviewRef = useRef<TransformNode | null>(null)
  const roadPreviewRef = useRef<TransformNode | null>(null)
  // Marquee select refs
  const isMarqueeRef = useRef(false)
  const marqueeStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const marqueeEndRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const gridMeshRef = useRef<LinesMesh | null>(null)
  const sunRef = useRef<DirectionalLight | null>(null)
  const ambientRef = useRef<HemisphericLight | null>(null)
  const waterMeshRef = useRef<Mesh | null>(null)
  const boundaryOutlineRef = useRef<LinesMesh | null>(null)
  const polygonBoundaryRef = useRef(polygonBoundary)
  polygonBoundaryRef.current = polygonBoundary
  const boundaryLineRef = useRef<LinesMesh | null>(null)
  const brushCursorRef = useRef<Mesh | null>(null)
  const ghostMeshRef = useRef<TransformNode | null>(null)
  const weatherParticlesRef = useRef<Mesh | null>(null)
  const weatherVelocitiesRef = useRef<Float32Array | null>(null)
  const weatherPositionsRef = useRef<Float32Array | null>(null)
  const fpsFramesRef = useRef(0)
  const fpsTimeRef = useRef(performance.now())
  const isPaintingRef = useRef(false)
  const isDraggingObjectRef = useRef(false)
  const dragObjectIdRef = useRef<string | null>(null)
  const dragLastPosRef = useRef<[number, number, number] | null>(null)
  const dragPlaneRef = useRef<Plane>(new Plane(0, 1, 0, 0))
  const lastPaintTimeRef = useRef(0)

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
  const regionGroupRef = useRef<TransformNode | null>(null)
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

  // Mouse position in screen coords for raycasting
  const mouseScreenRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 })

  // ── Initialize Babylon.js scene ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Create canvas for Babylon.js
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.outline = 'none'
    container.appendChild(canvas)

    // Engine — enable device pixel ratio scaling for crisp rendering
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false }, true)
    engine.setHardwareScalingLevel(1 / window.devicePixelRatio)
    engineRef.current = engine

    // Scene
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.529, 0.808, 0.922, 1) // #87CEEB
    scene.fogMode = Scene.FOGMODE_LINEAR
    scene.fogColor = new Color3(0.529, 0.808, 0.922)
    scene.fogStart = 200
    scene.fogEnd = 500
    sceneRef.current = scene

    // Camera (ArcRotateCamera replaces OrbitControls)
    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const worldSize = Math.max(worldSizeX, worldSizeZ)
    // ArcRotateCamera: alpha (azimuth), beta (polar), radius, target
    const targetPos = new Vector3(worldSizeX * 0.4, 0, worldSizeZ * 0.4)
    const initPos = new Vector3(worldSizeX * 0.15, worldSize * 0.12, worldSizeZ * 0.15)
    const dx = initPos.x - targetPos.x
    const dy = initPos.y - targetPos.y
    const dz = initPos.z - targetPos.z
    const initRadius = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const initAlpha = Math.atan2(dz, dx)
    const initBeta = Math.acos(dy / initRadius)

    const camera = new ArcRotateCamera('orbit-camera', initAlpha, initBeta, initRadius, targetPos.clone(), scene)
    camera.fov = 60 * Math.PI / 180 // Babylon uses radians
    camera.minZ = 0.5
    camera.maxZ = worldSize * 3
    camera.attachControl(canvas, true)
    camera.inertia = 0.92
    camera.lowerRadiusLimit = 5
    camera.upperRadiusLimit = worldSize * 2
    camera.upperBetaLimit = Math.PI / 2.05
    // Mouse button mapping: left = none (we handle left click), middle = rotate, right = pan
    ;(camera.inputs.attached.pointers as any).buttons = [1, 2]  // middle=1, right=2
    cameraRef.current = camera

    // First-person camera (hidden by default)
    const fpCamera = new FreeCamera('fp-camera', new Vector3(0, 10, 0), scene)
    fpCamera.fov = 110 * Math.PI / 180
    fpCamera.minZ = 0.5
    fpCamera.maxZ = worldSize * 3
    fpCameraRef.current = fpCamera

    // Lighting
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
    ambient.intensity = 0.6
    ambient.groundColor = new Color3(0.333, 0.42, 0.184) // #556B2F approx
    ambient.diffuse = new Color3(0.529, 0.808, 0.922) // sky tint
    ambientRef.current = ambient

    const sun = new DirectionalLight('sun', new Vector3(-1, -1, -1), scene)
    sun.intensity = 0.9
    sun.position = new Vector3(worldSize * 0.5, worldSize * 0.8, worldSize * 0.3)
    sunRef.current = sun

    // Chunk manager
    const chunkManager = new ChunkManager(scene)
    chunkManager.setTerrain(terrain)
    chunkManagerRef.current = chunkManager

    // Object manager
    const objectManager = new ObjectManager(scene)
    objectManagerRef.current = objectManager

    // Border manager
    const borderManager = new BorderManager(scene)
    borderManagerRef.current = borderManager

    // Lot manager
    const lotManager = new LotManager(scene)
    lotManagerRef.current = lotManager

    // Road network manager
    const roadManager = new RoadNetworkManager(scene)
    roadManagerRef.current = roadManager

    // Wall manager (building level)
    const wallManager = new WallManager(scene)
    wallManagerRef.current = wallManager

    // First-person controller
    const fpController = new FirstPersonController(fpCamera, scene, canvas)
    fpController.onSubModeChange = (mode) => {
      onSubModeChangeRef.current(mode)
    }
    fpController.onShiftLockChange = (locked) => {
      setIsPointerLocked(locked)
    }
    fpControllerRef.current = fpController

    // Brush cursor — torus (ring) lying flat
    const cursorMesh = MeshBuilder.CreateTorus('brush-cursor', {
      diameter: 2,
      thickness: 0.2,
      tessellation: 32,
    }, scene)
    const cursorMat = new StandardMaterial('brush-cursor-mat', scene)
    cursorMat.diffuseColor = Color3.White()
    cursorMat.disableLighting = true
    cursorMat.alpha = 0.6
    cursorMat.backFaceCulling = false
    cursorMat.disableDepthWrite = true
    cursorMesh.material = cursorMat
    cursorMesh.setEnabled(false)
    cursorMesh.renderingGroupId = 3
    brushCursorRef.current = cursorMesh

    // Camera position reporting (throttled ~10fps)
    let lastCameraUpdate = 0

    // Render loop
    let lastTime = performance.now()
    engine.runRenderLoop(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      if (cameraModeRef.current === 'first-person') {
        fpController.update(delta, terrainRef.current)
      }

      // FPS counter
      fpsFramesRef.current++
      if (now - fpsTimeRef.current >= 1000) {
        onFpsUpdate(fpsFramesRef.current)
        fpsFramesRef.current = 0
        fpsTimeRef.current = now
      }

      // Camera position reporting (throttled ~4fps to avoid React re-render spam)
      if (now - lastCameraUpdate > 250) {
        lastCameraUpdate = now
        const activeCamera = scene.activeCamera
        if (activeCamera) {
          let camPos: Vector3
          let yaw: number
          if (activeCamera === fpCamera) {
            camPos = fpCamera.position
            const fwd = fpCamera.getForwardRay().direction
            yaw = Math.atan2(fwd.x, fwd.z)
          } else {
            camPos = camera.position
            const fwd = camera.getForwardRay().direction
            yaw = Math.atan2(fwd.x, fwd.z)
          }
          onCameraUpdateRef.current?.(
            [camPos.x, camPos.y, camPos.z],
            yaw
          )
        }
      }

      // Frustum cull terrain chunks before rendering
      const activeCam = scene.activeCamera
      if (activeCam && chunkManagerRef.current) {
        chunkManagerRef.current.cullChunks(activeCam)
      }

      // Update weather particles — follow camera + fall, scale with distance
      const wPositions = weatherPositionsRef.current
      const wv = weatherVelocitiesRef.current
      const wpMesh = weatherParticlesRef.current
      if (wPositions && wv && wpMesh && activeCam) {
        const camPos = activeCam.position
        const cameraDistance = camPos.length()
        const spread = Math.max(200, cameraDistance * 0.5)
        const count = wv.length
        for (let i = 0; i < count; i++) {
          wPositions[i * 3 + 1] -= wv[i] * delta
          // Respawn at top when below camera
          if (wPositions[i * 3 + 1] < camPos.y - spread * 0.5) {
            wPositions[i * 3] = camPos.x + (Math.random() - 0.5) * spread
            wPositions[i * 3 + 1] = camPos.y + spread * 0.5 + Math.random() * spread * 0.5
            wPositions[i * 3 + 2] = camPos.z + (Math.random() - 0.5) * spread
          }
        }
        // Update vertex buffer
        wpMesh.updateVerticesData(VertexBuffer.PositionKind, wPositions)
        // Scale particle size with distance (adjust material point size if available)
        const mat = wpMesh.material as StandardMaterial
        if (mat) {
          mat.pointSize = Math.max(2, cameraDistance * 0.02)
        }
      }

      scene.render()
    })

    // Resize
    function handleResize() {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      fpController.dispose()
      chunkManager.dispose()
      objectManager.dispose()
      borderManager.dispose()
      lotManager.dispose()
      roadManager.dispose()
      wallManager.dispose()
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Saved orbit camera state for restoring when exiting first-person
  const savedOrbitRef = useRef<{ alpha: number; beta: number; radius: number; target: Vector3 } | null>(null)

  // ── Camera mode switching ─────────────────────────────────
  useEffect(() => {
    const camera = cameraRef.current
    const fpCamera = fpCameraRef.current
    const fpController = fpControllerRef.current
    const scene = sceneRef.current
    if (!camera || !fpCamera || !fpController || !scene) return

    const tr = terrainRef.current

    if (cameraMode === 'first-person') {
      // Save orbit state before switching
      savedOrbitRef.current = {
        alpha: camera.alpha,
        beta: camera.beta,
        radius: camera.radius,
        target: camera.target.clone(),
      }

      camera.detachControl()
      scene.activeCamera = fpCamera
      fpController.bindEvents()

      if (tr) {
        // Place camera at the orbit target (where user was looking) at ground level
        const targetX = camera.target.x
        const targetZ = camera.target.z

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

        fpCamera.position = new Vector3(px, terrainY + eyeHeight, pz)
        // Look forward along the direction from old camera to target (horizontal)
        const orbitPos = camera.position
        const lookDir = new Vector3(targetX - orbitPos.x, 0, targetZ - orbitPos.z)
        if (lookDir.lengthSquared() > 0.01) {
          lookDir.normalize()
          fpCamera.setTarget(new Vector3(px + lookDir.x * 10, terrainY + eyeHeight, pz + lookDir.z * 10))
        }

        fpCamera.fov = 110 * Math.PI / 180
      }
    } else {
      fpController.resetShiftLock()
      fpController.unbindEvents()
      scene.activeCamera = camera

      const canvas = engineRef.current?.getRenderingCanvas()
      if (canvas) {
        camera.attachControl(canvas, true)
      }

      // Restore saved orbit camera state
      if (savedOrbitRef.current) {
        camera.alpha = savedOrbitRef.current.alpha
        camera.beta = savedOrbitRef.current.beta
        camera.radius = savedOrbitRef.current.radius
        camera.target = savedOrbitRef.current.target.clone()
        savedOrbitRef.current = null
      }
      camera.fov = 60 * Math.PI / 180
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
    const fpCamera = fpCameraRef.current
    if (!camera) return

    const worldSize = Math.max(terrain.size, terrain.sizeZ) * terrain.cellSize

    if (cameraMode === 'first-person') {
      const fogFar = Math.max(600, Math.min(worldSize * 0.3, 2000))
      if (fpCamera) {
        fpCamera.maxZ = fogFar * 1.1
      }
    } else {
      camera.maxZ = Math.max(worldSize * 3, terrain.maxHeight * 6)
    }

    camera.upperRadiusLimit = worldSize * 2
  }, [terrain.size, terrain.sizeZ, terrain.cellSize, terrain.maxHeight, cameraMode])

  // ── Reset camera when terrain dimensions change (level navigation) ──
  const prevTerrainSizeRef = useRef(`${terrain.size}-${terrain.sizeZ}-${terrain.cellSize}`)
  useEffect(() => {
    const key = `${terrain.size}-${terrain.sizeZ}-${terrain.cellSize}`
    if (key === prevTerrainSizeRef.current) return
    prevTerrainSizeRef.current = key

    const camera = cameraRef.current
    if (!camera) return

    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const worldSize = Math.max(worldSizeX, worldSizeZ)

    const cx = worldSizeX * 0.5
    const cz = worldSizeZ * 0.5
    const fovRad = camera.fov // already in radians in Babylon
    const fitDistance = (worldSize / 2) / Math.tan(fovRad / 2)
    // Position at ~45-degree angle looking at terrain center
    const dist = fitDistance * 0.6
    camera.target = new Vector3(cx, 0, cz)
    camera.radius = dist
    camera.alpha = Math.PI / 4  // ~45 degrees azimuth
    camera.beta = Math.PI / 4   // ~45 degrees from top

    camera.minZ = Math.max(0.5, worldSize * 0.001)
    camera.maxZ = worldSize * 4

    camera.lowerRadiusLimit = Math.max(5, worldSize * 0.01)
    camera.upperRadiusLimit = worldSize * 3
  }, [terrain.size, terrain.sizeZ, terrain.cellSize])

  // ── Camera preset handler ──────────────────────
  useEffect(() => {
    if (!cameraPreset || !cameraRef.current) return
    const camera = cameraRef.current
    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const worldSize = Math.max(worldSizeX, worldSizeZ)
    const cx = worldSizeX * 0.5
    const cz = worldSizeZ * 0.5

    camera.target = new Vector3(cx, 0, cz)

    switch (cameraPreset) {
      case 'top':
        camera.alpha = 0
        camera.beta = 0.01 // near-top-down
        camera.radius = worldSize * 0.8
        break
      case 'front':
        camera.alpha = Math.PI / 2 // looking from +Z
        camera.beta = Math.PI / 2 - 0.15 // near horizontal with slight elevation
        camera.radius = worldSize * 0.6
        break
      case 'side':
        camera.alpha = 0 // looking from +X
        camera.beta = Math.PI / 2 - 0.15
        camera.radius = worldSize * 0.6
        break
      case 'perspective':
        camera.alpha = Math.PI / 4
        camera.beta = Math.PI / 3
        camera.radius = worldSize * 0.45
        break
    }
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

    // Clean up old preview
    if (borderPreviewRef.current) {
      borderPreviewRef.current.getChildMeshes().forEach(child => {
        child.dispose()
      })
      borderPreviewRef.current.dispose()
      borderPreviewRef.current = null
    }

    if (borderDrawMode === 'drawing' && borderVertices.length > 0 && borderManagerRef.current) {
      const preview = borderManagerRef.current.renderPreview(borderVertices, null, terrain, borderColor)
      if (preview) {
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
      boundaryOutlineRef.current.dispose()
      boundaryOutlineRef.current = null
    }

    if (polygonBoundary && polygonBoundary.length >= 3) {
      const points: Vector3[] = polygonBoundary.map(v => {
        const gx = Math.floor(v.x / terrain.cellSize)
        const gz = Math.floor(v.z / terrain.cellSize)
        const idx = Math.max(0, Math.min(gz, terrain.sizeZ - 1)) * terrain.size + Math.max(0, Math.min(gx, terrain.size - 1))
        const y = (terrain.heights[idx] ?? 0) * terrain.maxHeight + 2
        return new Vector3(v.x, y, v.z)
      })
      // Close the polygon
      points.push(points[0].clone())

      const line = MeshBuilder.CreateDashedLines('boundary-outline', {
        points,
        dashSize: 3,
        gapSize: 1.5,
        dashNb: points.length * 10,
      }, scene)
      line.color = new Color3(1, 0.42, 0.21)
      line.renderingGroupId = 2
      line.isPickable = false
      boundaryOutlineRef.current = line
    }

    // Pass polygon boundary to ChunkManager for terrain dimming
    if (chunkManagerRef.current) {
      chunkManagerRef.current.setPolygonBoundary(polygonBoundary && polygonBoundary.length >= 3 ? polygonBoundary : null)
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
    if (roadPreviewRef.current) {
      roadPreviewRef.current.getChildMeshes().forEach(child => {
        child.dispose()
      })
      roadPreviewRef.current.dispose()
      roadPreviewRef.current = null
    }

    if (roadDrawMode === 'drawing' && roadWaypoints.length > 0 && roadManagerRef.current) {
      const preview = roadManagerRef.current.renderPreview(roadWaypoints, null, roadWidth, terrain)
      if (preview) {
        roadPreviewRef.current = preview
      }
    }
  }, [roadDrawMode, roadWaypoints, terrain, roadWidth])

  // ── Sync building ─────────────────────────────────────────
  useEffect(() => {
    if (wallManagerRef.current && buildingData && currentLevel === 'building') {
      wallManagerRef.current.syncBuilding(buildingData, activeFloor)
    } else if (wallManagerRef.current) {
      wallManagerRef.current.dispose()
    }
  }, [buildingData, activeFloor, currentLevel])

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
      ghostMeshRef.current.getChildMeshes().forEach((child) => {
        child.dispose()
      })
      ghostMeshRef.current.dispose()
      ghostMeshRef.current = null
    }

    // Create new ghost if placing objects
    if (activeTool === 'place-object' && selectedObjectType) {
      const entry = getCatalogEntry(selectedObjectType)
      if (entry) {
        const ghost = entry.createMesh(entry.defaultColor, scene)
        ghost.getChildMeshes().forEach((child) => {
          if (child instanceof Mesh) {
            const mat = child.material as StandardMaterial
            if (mat) {
              mat.alpha = 0.5
              mat.disableDepthWrite = true
            }
          }
        })
        ghost.setEnabled(false)
        ghostMeshRef.current = ghost
      }
    }
  }, [activeTool, selectedObjectType])

  // ── Update grid helper ─────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (gridMeshRef.current) {
      gridMeshRef.current.dispose()
      gridMeshRef.current = null
    }

    if (showGrid) {
      const worldSizeX = terrain.size * terrain.cellSize
      const worldSizeZ = terrain.sizeZ * terrain.cellSize
      const maxWorldSize = Math.max(worldSizeX, worldSizeZ)
      const maxCells = Math.min(Math.max(terrain.size, terrain.sizeZ), 64)
      const step = maxWorldSize / maxCells

      // Build grid lines manually
      const points: Vector3[] = []
      const halfX = worldSizeX / 2
      const halfZ = worldSizeZ / 2

      // Lines along X axis
      for (let i = 0; i <= maxCells; i++) {
        const z = i * step
        points.push(new Vector3(0, 0.05, z))
        points.push(new Vector3(worldSizeX, 0.05, z))
      }
      // Lines along Z axis
      for (let i = 0; i <= maxCells; i++) {
        const x = i * step
        points.push(new Vector3(x, 0.05, 0))
        points.push(new Vector3(x, 0.05, worldSizeZ))
      }

      const lineSegments: Vector3[][] = []
      for (let i = 0; i < points.length; i += 2) {
        lineSegments.push([points[i], points[i + 1]])
      }

      const grid = MeshBuilder.CreateLineSystem('grid-helper', {
        lines: lineSegments,
      }, scene)
      grid.color = new Color3(0.2, 0.2, 0.2)
      grid.alpha = 0.15
      grid.isPickable = false
      gridMeshRef.current = grid
    }
  }, [showGrid, terrain.size, terrain.sizeZ, terrain.cellSize])

  // ── Update water plane ─────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (waterMeshRef.current) {
      waterMeshRef.current.dispose()
      waterMeshRef.current = null
    }

    if (showWater && terrain.seaLevel > 0) {
      const worldSizeX = terrain.size * terrain.cellSize
      const worldSizeZ = terrain.sizeZ * terrain.cellSize
      // Water extends 5x beyond terrain edges to create an ocean effect
      const waterExtent = Math.max(worldSizeX, worldSizeZ) * 5
      const waterMesh = MeshBuilder.CreateGround('water-plane', {
        width: waterExtent,
        height: waterExtent,
      }, scene)
      const waterMat = new StandardMaterial('water-mat', scene)
      waterMat.diffuseColor = Color3.FromHexString(waterColor)
      waterMat.specularColor = new Color3(0.3, 0.3, 0.35)
      waterMat.specularPower = 64
      waterMat.alpha = 0.85
      waterMesh.material = waterMat
      waterMesh.position = new Vector3(worldSizeX / 2, terrain.seaLevel * terrain.maxHeight, worldSizeZ / 2)
      waterMesh.metadata = { isWater: true }
      waterMesh.isPickable = false
      waterMeshRef.current = waterMesh
    }
  }, [showWater, terrain.seaLevel, terrain.maxHeight, terrain.size, terrain.sizeZ, terrain.cellSize, waterColor])

  // ── Terrain boundary indicator ───────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old boundary
    if (boundaryLineRef.current) {
      boundaryLineRef.current.dispose()
      boundaryLineRef.current = null
    }

    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const waterY = terrain.seaLevel * terrain.maxHeight
    const borderY = Math.max(waterY + 0.5, 1)

    const points = [
      new Vector3(0, borderY, 0),
      new Vector3(worldSizeX, borderY, 0),
      new Vector3(worldSizeX, borderY, worldSizeZ),
      new Vector3(0, borderY, worldSizeZ),
      new Vector3(0, borderY, 0),
    ]

    const line = MeshBuilder.CreateDashedLines('boundary-line', {
      points,
      dashSize: 4,
      gapSize: 2,
      dashNb: 100,
    }, scene)
    line.color = new Color3(1, 0.533, 0) // #ff8800
    line.alpha = 0.7
    line.isPickable = false
    boundaryLineRef.current = line
  }, [terrain.size, terrain.sizeZ, terrain.cellSize, terrain.seaLevel, terrain.maxHeight])

  // ── Child region outlines ──────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old region outlines
    if (regionGroupRef.current) {
      regionGroupRef.current.getChildMeshes().forEach((child) => {
        child.dispose()
      })
      // Also dispose child TransformNodes (labels, etc.)
      regionGroupRef.current.getChildren().forEach((child) => {
        child.dispose()
      })
      regionGroupRef.current.dispose()
      regionGroupRef.current = null
    }

    if (!childRegions || childRegions.length === 0) return

    const group = new TransformNode('childRegions', scene)
    const cs = terrain.cellSize

    for (const region of childRegions) {
      const b = region.bounds
      const color = Color3.FromHexString(region.color || '#44aaff')

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
      let outlinePoints: Vector3[]

      if (polyVerts && polyVerts.length >= 3) {
        // Polygon outline from border vertices (already in world coords)
        outlinePoints = polyVerts.map(v => new Vector3(v.x, baseY, v.z))
        outlinePoints.push(outlinePoints[0].clone()) // close loop
      } else {
        // Rectangular outline from bounds
        const x0 = b.startX * cs
        const z0 = b.startZ * cs
        const x1 = (b.startX + b.width) * cs
        const z1 = (b.startZ + b.depth) * cs
        outlinePoints = [
          new Vector3(x0, baseY, z0),
          new Vector3(x1, baseY, z0),
          new Vector3(x1, baseY, z1),
          new Vector3(x0, baseY, z1),
          new Vector3(x0, baseY, z0),
        ]
      }

      const outlineLine = MeshBuilder.CreateDashedLines(`region-outline-${region.id}`, {
        points: outlinePoints,
        dashSize: 2,
        gapSize: 1,
        dashNb: outlinePoints.length * 10,
      }, scene)
      outlineLine.color = color
      outlineLine.alpha = 0.9
      outlineLine.renderingGroupId = 2
      outlineLine.metadata = { regionId: region.id }
      outlineLine.isPickable = false
      outlineLine.parent = group

      // Semi-transparent fill
      if (polyVerts && polyVerts.length >= 3) {
        // Create a polygon fill from vertices on the XZ plane
        // Build indices for a triangle fan from the polygon
        const positions: number[] = []
        const indices: number[] = []
        for (let i = 0; i < polyVerts.length; i++) {
          positions.push(polyVerts[i].x, baseY - 0.1, polyVerts[i].z)
        }
        // Triangle fan from vertex 0
        for (let i = 1; i < polyVerts.length - 1; i++) {
          indices.push(0, i, i + 1)
        }
        const fillMesh = new Mesh(`region-fill-${region.id}`, scene)
        const vertexData = new VertexData()
        vertexData.positions = positions
        vertexData.indices = indices
        vertexData.applyToMesh(fillMesh)
        const fillMat = new StandardMaterial(`region-fill-mat-${region.id}`, scene)
        fillMat.diffuseColor = color
        fillMat.alpha = 0.08
        fillMat.backFaceCulling = false
        fillMat.disableDepthWrite = true
        fillMat.disableLighting = true
        fillMesh.material = fillMat
        fillMesh.renderingGroupId = 1
        fillMesh.metadata = { regionId: region.id }
        fillMesh.isPickable = false
        fillMesh.parent = group
      } else {
        const x0 = b.startX * cs
        const z0 = b.startZ * cs
        const x1 = (b.startX + b.width) * cs
        const z1 = (b.startZ + b.depth) * cs
        const fillMesh = MeshBuilder.CreateGround(`region-fill-${region.id}`, {
          width: b.width * cs,
          height: b.depth * cs,
        }, scene)
        const fillMat = new StandardMaterial(`region-fill-mat-${region.id}`, scene)
        fillMat.diffuseColor = color
        fillMat.alpha = 0.08
        fillMat.backFaceCulling = false
        fillMat.disableDepthWrite = true
        fillMat.disableLighting = true
        fillMesh.material = fillMat
        fillMesh.position = new Vector3((x0 + x1) / 2, baseY - 0.1, (z0 + z1) / 2)
        fillMesh.renderingGroupId = 1
        fillMesh.metadata = { regionId: region.id }
        fillMesh.isPickable = false
        fillMesh.parent = group
      }

      // Label (billboard text) — compute centroid from polygon or bounds center
      let labelX: number, labelZ: number
      if (polyVerts && polyVerts.length >= 3) {
        labelX = polyVerts.reduce((s, v) => s + v.x, 0) / polyVerts.length
        labelZ = polyVerts.reduce((s, v) => s + v.z, 0) / polyVerts.length
      } else {
        labelX = (b.startX + b.width / 2) * cs
        labelZ = (b.startZ + b.depth / 2) * cs
      }

      // Create a billboard label using DynamicTexture on a plane
      const labelWidth = b.width * cs * 0.5
      const labelHeight = b.width * cs * 0.125
      const dtRes = 256
      const dt = new DynamicTexture(`region-label-tex-${region.id}`, { width: dtRes, height: 64 }, scene, false)
      const dtCtx = dt.getContext() as unknown as CanvasRenderingContext2D
      dtCtx.fillStyle = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`
      dtCtx.font = 'bold 28px sans-serif'
      dtCtx.textAlign = 'center'
      dtCtx.fillText(region.name, dtRes / 2, 40)
      dt.update()

      const labelPlane = MeshBuilder.CreatePlane(`region-label-${region.id}`, {
        width: labelWidth,
        height: labelHeight,
      }, scene)
      const labelMat = new StandardMaterial(`region-label-mat-${region.id}`, scene)
      labelMat.diffuseTexture = dt
      labelMat.diffuseTexture.hasAlpha = true
      labelMat.useAlphaFromDiffuseTexture = true
      labelMat.alpha = 0.85
      labelMat.disableLighting = true
      labelMat.backFaceCulling = false
      labelPlane.material = labelMat
      labelPlane.position = new Vector3(labelX, baseY + 5, labelZ)
      labelPlane.billboardMode = Mesh.BILLBOARDMODE_ALL
      labelPlane.metadata = { regionId: region.id }
      labelPlane.isPickable = false
      labelPlane.parent = group
    }

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

    const sunPosX = worldSizeX * 0.5 + distance * Math.cos(azRad) * Math.cos(elRad)
    const sunPosY = distance * Math.sin(elRad)
    const sunPosZ = worldSizeZ * 0.5 + distance * Math.sin(azRad) * Math.cos(elRad)
    sun.position = new Vector3(sunPosX, sunPosY, sunPosZ)

    // Direction from sun to terrain center
    const targetX = worldSizeX * 0.5
    const targetZ = worldSizeZ * 0.5
    sun.direction = new Vector3(targetX - sunPosX, -sunPosY, targetZ - sunPosZ).normalize()

    // Adjust intensity based on elevation (lower sun = dimmer, warmer)
    const normalizedEl = sunElevation / 90 // 0 at horizon, 1 at zenith
    sun.intensity = 0.4 + normalizedEl * 0.6
    if (ambient) {
      ambient.intensity = 0.3 + normalizedEl * 0.3
    }

    // Warm color at low elevation, white at high
    const warmth = 1 - normalizedEl
    sun.diffuse = new Color3(1, 1 - warmth * 0.15, 1 - warmth * 0.35)

    // Update terrain chunk shader light direction
    const lightDir = new Vector3(sunPosX - targetX, sunPosY, sunPosZ - targetZ).normalize()
    chunkManagerRef.current?.updateLightDirection(lightDir)
  }, [sunAngle, sunElevation, terrain.size, terrain.sizeZ, terrain.cellSize])

  // ── Sky color effect ────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return
    const c = Color3.FromHexString(skyColor)
    sceneRef.current.clearColor = new Color4(c.r, c.g, c.b, 1)
  }, [skyColor])

  // ── Fog effect ──────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (!fogEnabled) {
      scene.fogMode = Scene.FOGMODE_NONE
      return
    }

    const worldSize = Math.max(terrain.size, terrain.sizeZ) * terrain.cellSize
    const fogColor = Color3.FromHexString(skyColor)
    scene.fogColor = fogColor

    if (cameraMode === 'first-person') {
      const fogNear = Math.max(150, Math.min(worldSize * 0.08, 500))
      const fogFar = Math.max(600, Math.min(worldSize * 0.3, 2000))
      scene.fogMode = Scene.FOGMODE_LINEAR
      scene.fogStart = fogNear
      scene.fogEnd = fogFar
    } else {
      const fogNear = worldSize * 0.4
      const fogFar = worldSize * 1.2
      scene.fogMode = Scene.FOGMODE_LINEAR
      scene.fogStart = fogNear
      scene.fogEnd = fogFar
    }
  }, [fogEnabled, skyColor, weatherType, cameraMode, terrain.size, terrain.sizeZ, terrain.cellSize])

  // ── Weather particle system ─────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up old particles
    if (weatherParticlesRef.current) {
      weatherParticlesRef.current.dispose()
      weatherParticlesRef.current = null
      weatherVelocitiesRef.current = null
      weatherPositionsRef.current = null
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

    // Create point cloud mesh using raw vertex data
    const pointMesh = new Mesh('weather-particles', scene)
    const vertexData = new VertexData()
    vertexData.positions = positions
    // Create indices for points (each vertex is a point)
    const indices = new Uint32Array(count)
    for (let i = 0; i < count; i++) indices[i] = i
    vertexData.indices = Array.from(indices)
    vertexData.applyToMesh(pointMesh)

    const mat = new StandardMaterial('weather-mat', scene)
    mat.disableLighting = true
    mat.diffuseColor = weatherType === 'rain'
      ? Color3.FromHexString('#aaccff')
      : Color3.White()
    mat.alpha = weatherType === 'rain' ? 0.6 : 0.8
    mat.disableDepthWrite = true
    mat.pointSize = weatherType === 'rain' ? 2 : 4
    mat.pointsCloud = true
    pointMesh.material = mat

    weatherParticlesRef.current = pointMesh
    weatherVelocitiesRef.current = velocities
    weatherPositionsRef.current = new Float32Array(positions)
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
        const base = Color3.FromHexString(skyColor)
        const grey = new Color3(0.541, 0.541, 0.541) // #8a8a8a
        const lerped = Color3.Lerp(base, grey, 0.4)
        scene.clearColor = new Color4(lerped.r, lerped.g, lerped.b, 1)
      }
    } else {
      sun.intensity = 0.4 + normalizedEl * 0.6
      if (ambient) ambient.intensity = 0.3 + normalizedEl * 0.3
      // Restore original sky color
      if (scene) {
        const c = Color3.FromHexString(skyColor)
        scene.clearColor = new Color4(c.r, c.g, c.b, 1)
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
    cursor.scaling = new Vector3(size, size, size)
  }, [activeTool, sculptBrush.size, materialBrush.size, terrain.cellSize])

  // ── Mouse interaction ─────────────────────────────────────
  const updateMouseScreen = useCallback((e: MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    mouseScreenRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  /** Raycast terrain using scene.pick or crosshair center for first-person */
  const raycastTerrain = useCallback((): Vector3 | null => {
    const scene = sceneRef.current
    const engine = engineRef.current
    if (!scene || !engine) return null

    const chunkMgr = chunkManagerRef.current
    if (!chunkMgr) return null

    const chunkMeshes = chunkMgr.getChunkMeshes()
    const chunkSet = new Set<AbstractMesh>(chunkMeshes)

    let pickX: number
    let pickY: number

    if (cameraModeRef.current === 'first-person' && fpControllerRef.current?.isLocked()) {
      // FP + pointer locked: raycast from crosshair (center)
      const canvas = engine.getRenderingCanvas()
      if (!canvas) return null
      pickX = canvas.width / 2
      pickY = canvas.height / 2
    } else {
      pickX = mouseScreenRef.current.x
      pickY = mouseScreenRef.current.y
    }

    const pickResult = scene.pick(pickX, pickY, (mesh) => chunkSet.has(mesh))

    if (pickResult && pickResult.hit && pickResult.pickedPoint) {
      return pickResult.pickedPoint
    }

    // Fallback: intersect ground plane at y=0 so clicks always register
    const ray = scene.createPickingRay(pickX, pickY, Matrix.Identity(), scene.activeCamera)
    const groundPlane = new Plane(0, 1, 0, 0)
    const dist = ray.intersectsPlane(groundPlane)
    if (dist !== null && dist >= 0) {
      return ray.origin.add(ray.direction.scale(dist))
    }
    return null
  }, [])

  const raycastObjects = useCallback((): { objectId: string; point: Vector3 } | null => {
    const scene = sceneRef.current
    const engine = engineRef.current
    const objMgr = objectManagerRef.current
    if (!scene || !engine || !objMgr) return null

    const pickables = objMgr.getPickableMeshes()
    const pickableSet = new Set<AbstractMesh>(pickables)

    let pickX: number
    let pickY: number

    if (cameraModeRef.current === 'first-person' && fpControllerRef.current?.isLocked()) {
      const canvas = engine.getRenderingCanvas()
      if (!canvas) return null
      pickX = canvas.width / 2
      pickY = canvas.height / 2
    } else {
      pickX = mouseScreenRef.current.x
      pickY = mouseScreenRef.current.y
    }

    const pickResult = scene.pick(pickX, pickY, (mesh) => pickableSet.has(mesh))

    if (pickResult && pickResult.hit && pickResult.pickedPoint) {
      const id = objMgr.findObjectIdFromPick(pickResult)
      if (id) return { objectId: id, point: pickResult.pickedPoint }
    }
    return null
  }, [])

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

    // Throttle timestamp — React state updates are expensive
    let lastCursorStateTime = 0
    const STATE_INTERVAL = 200    // ~5fps for React state updates

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const tool = activeToolRef.current

      if (tool === 'sculpt' || tool === 'paint-material') {
        updateMouseScreen(e)
        isPaintingRef.current = true
        lastPaintTimeRef.current = 0
        handleBrushStroke()
        return
      }

      if (tool === 'place-object') {
        updateMouseScreen(e)
        const point = raycastTerrain()
        if (point) {
          onObjectPlaceRef.current([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'select') {
        updateMouseScreen(e)
        const objHit = raycastObjects()
        if (objHit) {
          const additive = e.shiftKey || e.ctrlKey || e.metaKey
          onObjectSelectRef.current(objHit.objectId, additive)
          isDraggingObjectRef.current = true
          dragObjectIdRef.current = objHit.objectId
          // Set drag plane from hit point (horizontal plane through the point)
          dragPlaneRef.current = new Plane(0, 1, 0, -objHit.point.y)
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
        updateMouseScreen(e)
        const objHit = raycastObjects()
        if (objHit) {
          onObjectSelectRef.current(objHit.objectId, false)
        }
        return
      }

      if (tool === 'define-region') {
        updateMouseScreen(e)
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
        updateMouseScreen(e)
        const point = raycastTerrain()
        if (point) {
          onBorderClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'draw-lot') {
        updateMouseScreen(e)
        const point = raycastTerrain()
        if (point) {
          // Check for lot click/double-click
          if (lotManagerRef.current) {
            const now = performance.now()
            // Simple lot selection (not draw mode) — handled by parent
          }
          onLotClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'draw-road') {
        updateMouseScreen(e)
        const point = raycastTerrain()
        if (point) {
          onRoadClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'place-wall') {
        updateMouseScreen(e)
        const point = raycastTerrain()
        if (point) {
          onWallClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'place-door') {
        updateMouseScreen(e)
        const point = raycastTerrain()
        if (point) {
          onWallClickRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'paint-floor') {
        updateMouseScreen(e)
        isPaintingRef.current = true
        const point = raycastTerrain()
        if (point) {
          onFloorPaintRef.current?.([point.x, point.y, point.z])
        }
        return
      }

      if (tool === 'place-furniture') {
        updateMouseScreen(e)
        const point = raycastTerrain()
        if (point) {
          onFurniturePlaceRef.current?.([point.x, point.y, point.z])
        }
        return
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      updateMouseScreen(e)

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
        const scene = sceneRef.current
        const engine = engineRef.current
        if (scene && engine) {
          const ray = scene.createPickingRay(
            mouseScreenRef.current.x,
            mouseScreenRef.current.y,
            Matrix.Identity(),
            scene.activeCamera
          )
          const plane = dragPlaneRef.current
          const dist = ray.intersectsPlane(plane)
          if (dist !== null && dist >= 0) {
            const intersectPoint = ray.origin.add(ray.direction.scale(dist))
            const pos: [number, number, number] = [intersectPoint.x, intersectPoint.y, intersectPoint.z]
            dragLastPosRef.current = pos
            onObjectMoveRef.current(dragObjectIdRef.current!, pos)
          }
        }
        return
      }

      const now = performance.now()
      const tool = activeToolRef.current

      // Always raycast for ghost/cursor preview — keeps them responsive
      const point = raycastTerrain()

      if (point) {
        // Update Babylon.js objects directly (cheap, no React)
        const cursor = brushCursorRef.current
        if (cursor) {
          const showCursor = tool === 'sculpt' || tool === 'paint-material'
          cursor.setEnabled(showCursor)
          if (showCursor) {
            cursor.position = new Vector3(point.x, point.y + 0.2, point.z)
          }
        }

        const ghost = ghostMeshRef.current
        if (ghost && tool === 'place-object') {
          ghost.setEnabled(true)
          ghost.position = new Vector3(point.x, point.y, point.z)
        }

        // Throttle React state updates separately (causes full page re-render)
        if (now - lastCursorStateTime > STATE_INTERVAL) {
          lastCursorStateTime = now
          const t = terrainRef.current
          const grid = worldToGrid(point, t)
          onCursorMove([point.x, point.y, point.z], grid)
        }
      } else {
        if (brushCursorRef.current) brushCursorRef.current.setEnabled(false)
        if (ghostMeshRef.current) ghostMeshRef.current.setEnabled(false)
        if (now - lastCursorStateTime > STATE_INTERVAL) {
          lastCursorStateTime = now
          onCursorMove(null, null)
        }
      }

      // Continuous painting (throttled)
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
          const scene = sceneRef.current
          const engine = engineRef.current
          const objectManager = objectManagerRef.current
          const activeCam = scene?.activeCamera
          if (scene && engine && objectManager && activeCam && container) {
            const containerRect = container.getBoundingClientRect()
            const selectedIds: string[] = []
            const objs = objectsRef.current
            const viewportWidth = containerRect.width
            const viewportHeight = containerRect.height
            for (const obj of objs) {
              const pos = new Vector3(obj.position[0], obj.position[1], obj.position[2])
              const projected = Vector3.Project(
                pos,
                Matrix.Identity(),
                scene.getTransformMatrix(),
                new Viewport(0, 0, viewportWidth, viewportHeight)
              )
              const sx = projected.x
              const sy = projected.y
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
      if (brushCursorRef.current) brushCursorRef.current.setEnabled(false)
      if (ghostMeshRef.current) ghostMeshRef.current.setEnabled(false)
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
  }, [updateMouseScreen, raycastTerrain, raycastObjects, handleBrushStroke, onTerrainChanged, onCursorMove])

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
