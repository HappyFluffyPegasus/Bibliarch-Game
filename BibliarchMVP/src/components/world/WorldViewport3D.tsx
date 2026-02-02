'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TerrainData, EditorTool, BrushSettings, MaterialBrushSettings, WorldObject } from '@/types/world'
import { ChunkManager, worldToGrid } from '@/lib/terrain/ChunkManager'

import { ObjectManager } from '@/lib/terrain/ObjectManager'
import { getCatalogEntry } from '@/lib/terrain/objectCatalog'
import { FirstPersonController } from '@/lib/terrain/FirstPersonController'

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
}: WorldViewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const fpControllerRef = useRef<FirstPersonController | null>(null)
  const chunkManagerRef = useRef<ChunkManager | null>(null)

  const objectManagerRef = useRef<ObjectManager | null>(null)
  const gridHelperRef = useRef<THREE.GridHelper | null>(null)
  const waterMeshRef = useRef<THREE.Mesh | null>(null)
  const brushCursorRef = useRef<THREE.Mesh | null>(null)
  const ghostMeshRef = useRef<THREE.Group | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(-999, -999))
  const animFrameRef = useRef<number>(0)
  const isPaintingRef = useRef(false)
  const isDraggingObjectRef = useRef(false)
  const dragObjectIdRef = useRef<string | null>(null)
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
  const onCameraModeChangeRef = useRef(onCameraModeChange)
  const onSubModeChangeRef = useRef(onSubModeChange)
  onObjectPlaceRef.current = onObjectPlace
  onObjectSelectRef.current = onObjectSelect
  onObjectMoveRef.current = onObjectMove
  onCameraModeChangeRef.current = onCameraModeChange
  onSubModeChangeRef.current = onSubModeChange

  // ── Initialize Three.js scene ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87CEEB)
    scene.fog = new THREE.Fog(0x87CEEB, 200, 500)
    sceneRef.current = scene

    // Camera
    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize
    const worldSize = Math.max(worldSizeX, worldSizeZ)
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.5, worldSize * 3)
    camera.position.set(worldSizeX * 0.15, worldSize * 0.12, worldSizeZ * 0.15)
    camera.lookAt(worldSizeX * 0.4, 0, worldSizeZ * 0.4)
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

    const sun = new THREE.DirectionalLight(0xffffff, 0.9)
    sun.position.set(worldSize * 0.5, worldSize * 0.8, worldSize * 0.3)
    sun.castShadow = true
    // Scale shadow quality with world size to prevent GPU overload on large maps
    const shadowRes = worldSize > 1000 ? 1024 : 2048
    sun.shadow.mapSize.width = shadowRes
    sun.shadow.mapSize.height = shadowRes
    const shadowRange = Math.min(worldSize * 0.6, 2000)
    sun.shadow.camera.left = -shadowRange
    sun.shadow.camera.right = shadowRange
    sun.shadow.camera.top = shadowRange
    sun.shadow.camera.bottom = -shadowRange
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = Math.min(worldSize * 2, 5000)
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

    // First-person controller
    const fpController = new FirstPersonController(camera, renderer.domElement)
    const handleFpUnlock = () => {
      onCameraModeChangeRef.current('orbit')
    }
    fpController.onUnlock(handleFpUnlock)
    fpController.onSubModeChange = (mode) => {
      onSubModeChangeRef.current(mode)
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

    // Animation loop
    const clock = new THREE.Clock()
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      const delta = clock.getDelta()

      if (cameraModeRef.current === 'first-person' && fpController.isLocked()) {
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
      fpController.offUnlock(handleFpUnlock)
      fpController.dispose()
      chunkManager.dispose()
      objectManager.dispose()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
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

  // ── Camera mode switching ─────────────────────────────────
  useEffect(() => {
    const controls = controlsRef.current
    const fpController = fpControllerRef.current
    if (!controls || !fpController) return

    if (cameraMode === 'first-person') {
      controls.enabled = false
      fpController.bindEvents()
      fpController.lock()
    } else {
      if (fpController.isLocked()) {
        fpController.unlock()
      }
      fpController.unbindEvents()
      controls.enabled = true
    }
  }, [cameraMode])

  // ── Sync FP controller settings ──────────────────────────
  useEffect(() => {
    const fpController = fpControllerRef.current
    if (!fpController) return
    fpController.subMode = firstPersonSubMode
    fpController.speed = firstPersonSpeed
  }, [firstPersonSubMode, firstPersonSpeed])

  // ── Reactive fog, camera far plane, and orbit distance ────
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!scene || !camera || !controls) return

    const worldSize = Math.max(terrain.size, terrain.sizeZ) * terrain.cellSize
    const fogNear = worldSize * 0.4
    const fogFar = worldSize * 1.2
    scene.fog = new THREE.Fog(0x87CEEB, fogNear, fogFar)

    camera.far = Math.max(worldSize * 3, terrain.maxHeight * 6)
    camera.updateProjectionMatrix()

    controls.maxDistance = worldSize * 2
  }, [terrain.size, terrain.sizeZ, terrain.cellSize, terrain.maxHeight])

  // ── Update terrain when data changes ──────────────────────
  // Track the heights array identity to distinguish full replacements
  // (heightmap upload, cartography generate, flatten, etc.) from
  // in-place sculpt mutations that only need markDirty/rebuildDirty.
  const prevHeightsRef = useRef<Float32Array | null>(null)

  useEffect(() => {
    if (!chunkManagerRef.current) return
    // Skip rebuild if the heights array is the same object (in-place sculpt mutation).
    // React re-renders because world.updatedAt changed, but the heights buffer is identical.
    if (terrain.heights === prevHeightsRef.current) return
    prevHeightsRef.current = terrain.heights
    chunkManagerRef.current.setTerrain(terrain)
  }, [terrain])

  // ── Sync objects ──────────────────────────────────────────
  // Only re-sync when the objects array or terrain heights change (not in-place sculpt)
  useEffect(() => {
    if (objectManagerRef.current) {
      objectManagerRef.current.syncObjects(objects, terrain)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, terrain.heights])

  // ── Update selection highlighting ─────────────────────────
  useEffect(() => {
    if (objectManagerRef.current) {
      objectManagerRef.current.setSelectedIds(selectedObjectIds)
    }
  }, [selectedObjectIds])

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
            const mat = child.material as THREE.MeshStandardMaterial
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
      const maxCells = Math.max(terrain.size, terrain.sizeZ)
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
      const waterGeo = new THREE.PlaneGeometry(worldSizeX * 1.2, worldSizeZ * 1.2)
      waterGeo.rotateX(-Math.PI / 2)
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x2980b9,
        transparent: true,
        opacity: 0.65,
        roughness: 0.1,
        metalness: 0.3,
        side: THREE.DoubleSide,
      })
      const waterMesh = new THREE.Mesh(waterGeo, waterMat)
      waterMesh.position.set(worldSizeX / 2, terrain.seaLevel * terrain.maxHeight, worldSizeZ / 2)
      waterMesh.receiveShadow = true
      waterMesh.userData.isWater = true
      scene.add(waterMesh)
      waterMeshRef.current = waterMesh
    }
  }, [showWater, terrain.seaLevel, terrain.maxHeight, terrain.size, terrain.sizeZ, terrain.cellSize])

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
    if (cameraModeRef.current === 'first-person') {
      raycasterRef.current.setFromCamera(centerNDCRef.current, camera)
    } else {
      raycasterRef.current.setFromCamera(mouseRef.current, camera)
    }
  }, [])

  const raycastTerrain = useCallback((): THREE.Vector3 | null => {
    const camera = cameraRef.current
    const chunkMgr = chunkManagerRef.current
    if (!camera || !chunkMgr) return null

    setupRaycaster()
    const hits = raycasterRef.current.intersectObjects(chunkMgr.getChunkMeshes(), false)
    if (hits.length > 0) {
      return hits[0].point
    }
    return null
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
          onObjectSelectRef.current(objHit.objectId, e.shiftKey)
          // Start drag
          isDraggingObjectRef.current = true
          dragObjectIdRef.current = objHit.objectId
          dragPlaneRef.current.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            objHit.point
          )
        } else {
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
    }

    const handleMouseMove = (e: MouseEvent) => {
      updateMouseNDC(e)
      const tool = activeToolRef.current

      // Object dragging
      if (isDraggingObjectRef.current && dragObjectIdRef.current && tool === 'select') {
        const camera = cameraRef.current
        if (camera) {
          raycasterRef.current.setFromCamera(mouseRef.current, camera)
          const intersectPoint = new THREE.Vector3()
          if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint)) {
            // Also raycast terrain to snap Y
            const terrainPoint = raycastTerrain()
            const y = terrainPoint ? terrainPoint.y : intersectPoint.y
            onObjectMoveRef.current(dragObjectIdRef.current, [intersectPoint.x, y, intersectPoint.z])
          }
        }
        return
      }

      // Update brush cursor / ghost
      const point = raycastTerrain()
      if (point) {
        const t = terrainRef.current
        const grid = worldToGrid(point, t)
        onCursorMove(
          [point.x, point.y, point.z],
          grid
        )

        const cursor = brushCursorRef.current
        if (cursor) {
          const showCursor = tool === 'sculpt' || tool === 'paint-material'
          cursor.visible = showCursor
          if (showCursor) {
            cursor.position.set(point.x, point.y + 0.2, point.z)
          }
        }

        // Ghost preview for object placement
        const ghost = ghostMeshRef.current
        if (ghost && tool === 'place-object') {
          ghost.visible = true
          ghost.position.set(point.x, point.y, point.z)
        }
      } else {
        onCursorMove(null, null)
        if (brushCursorRef.current) brushCursorRef.current.visible = false
        if (ghostMeshRef.current) ghostMeshRef.current.visible = false
      }

      // Continuous painting
      if (isPaintingRef.current) {
        const now = performance.now()
        if (now - lastPaintTimeRef.current > 50) {
          lastPaintTimeRef.current = now
          handleBrushStroke()
        }
      }
    }

    const handleMouseUp = () => {
      if (isPaintingRef.current) {
        isPaintingRef.current = false
        onTerrainChanged()
      }
      isDraggingObjectRef.current = false
      dragObjectIdRef.current = null
    }

    const handleMouseLeave = () => {
      if (brushCursorRef.current) brushCursorRef.current.visible = false
      if (ghostMeshRef.current) ghostMeshRef.current.visible = false
      onCursorMove(null, null)
      if (isPaintingRef.current) {
        isPaintingRef.current = false
        onTerrainChanged()
      }
      isDraggingObjectRef.current = false
      dragObjectIdRef.current = null
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
        return 'crosshair'
      case 'place-object':
        return 'copy'
      case 'delete':
        return 'not-allowed'
      case 'select':
        return 'pointer'
      default:
        return 'default'
    }
  })()

  return (
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: cameraMode === 'first-person' ? 'none' : cursorStyle }}
      />
      {/* Crosshair overlay for first-person mode */}
      {cameraMode === 'first-person' && (
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
