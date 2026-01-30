'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TerrainData, EditorTool, BrushSettings, MaterialBrushSettings } from '@/types/world'
import { ChunkManager, worldToGrid } from '@/lib/terrain/ChunkManager'
import { GrassSystem } from '@/lib/terrain/GrassSystem'

export interface WorldViewport3DProps {
  terrain: TerrainData
  activeTool: EditorTool
  sculptBrush: BrushSettings
  materialBrush: MaterialBrushSettings
  showGrid: boolean
  showWater: boolean
  showGrass: boolean
  onTerrainSculpt: (centerX: number, centerZ: number, brush: BrushSettings) => void
  onTerrainPaint: (centerX: number, centerZ: number, brush: MaterialBrushSettings) => void
  onTerrainChanged: () => void
  onCursorMove: (worldPos: [number, number, number] | null, gridPos: { x: number; z: number } | null) => void
  onFpsUpdate: (fps: number) => void
}

export default function WorldViewport3D({
  terrain,
  activeTool,
  sculptBrush,
  materialBrush,
  showGrid,
  showWater,
  showGrass,
  onTerrainSculpt,
  onTerrainPaint,
  onTerrainChanged,
  onCursorMove,
  onFpsUpdate,
}: WorldViewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const chunkManagerRef = useRef<ChunkManager | null>(null)
  const grassSystemRef = useRef<GrassSystem | null>(null)
  const gridHelperRef = useRef<THREE.GridHelper | null>(null)
  const waterMeshRef = useRef<THREE.Mesh | null>(null)
  const brushCursorRef = useRef<THREE.Mesh | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(-999, -999))
  const animFrameRef = useRef<number>(0)
  const isPaintingRef = useRef(false)
  const lastPaintTimeRef = useRef(0)
  const fpsFramesRef = useRef(0)
  const fpsTimeRef = useRef(performance.now())

  // Keep props in refs for event handlers
  const terrainRef = useRef(terrain)
  const activeToolRef = useRef(activeTool)
  const sculptBrushRef = useRef(sculptBrush)
  const materialBrushRef = useRef(materialBrush)
  terrainRef.current = terrain
  activeToolRef.current = activeTool
  sculptBrushRef.current = sculptBrush
  materialBrushRef.current = materialBrush

  // ── Initialize Three.js scene ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87CEEB) // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 200, 500)
    sceneRef.current = scene

    // Camera - positioned to see the terrain
    const worldSize = terrain.size * terrain.cellSize
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.5, worldSize * 3)
    camera.position.set(worldSize * 0.4, worldSize * 0.3, worldSize * 0.4)
    camera.lookAt(worldSize / 2, 0, worldSize / 2)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls — Blender-style: MMB orbit, Shift+MMB/RMB pan, scroll zoom
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 5
    controls.maxDistance = worldSize * 2
    controls.target.set(worldSize / 2, 0, worldSize / 2)
    controls.mouseButtons = {
      LEFT: -1 as THREE.MOUSE,    // disabled — left click is for tools
      MIDDLE: THREE.MOUSE.ROTATE, // MMB to orbit
      RIGHT: THREE.MOUSE.PAN,     // RMB to pan
    }
    controls.update()
    controlsRef.current = controls

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const sun = new THREE.DirectionalLight(0xffffff, 0.9)
    sun.position.set(worldSize * 0.5, worldSize * 0.8, worldSize * 0.3)
    sun.castShadow = true
    sun.shadow.mapSize.width = 2048
    sun.shadow.mapSize.height = 2048
    const shadowRange = worldSize * 0.6
    sun.shadow.camera.left = -shadowRange
    sun.shadow.camera.right = shadowRange
    sun.shadow.camera.top = shadowRange
    sun.shadow.camera.bottom = -shadowRange
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = worldSize * 2
    scene.add(sun)

    // Hemisphere light for subtle sky/ground color
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x556B2F, 0.3)
    scene.add(hemi)

    // Chunk manager
    const chunkManager = new ChunkManager()
    scene.add(chunkManager.getGroup())
    chunkManager.setTerrain(terrain)
    chunkManagerRef.current = chunkManager

    // Grass system
    const grassSystem = new GrassSystem()
    scene.add(grassSystem.getGroup())
    grassSystem.setTerrain(terrain)
    grassSystemRef.current = grassSystem

    // Brush cursor (transparent disc on terrain)
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
      controls.update()

      // Update grass system (wind + camera-based rebuild)
      const elapsed = clock.getElapsedTime()
      if (grassSystemRef.current) {
        grassSystemRef.current.update(camera.position, elapsed)
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
      chunkManager.dispose()
      grassSystem.dispose()
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
  }, []) // Mount once

  // ── Update terrain when data changes ──────────────────────
  useEffect(() => {
    if (chunkManagerRef.current) {
      chunkManagerRef.current.setTerrain(terrain)
    }
    if (grassSystemRef.current) {
      grassSystemRef.current.setTerrain(terrain)
    }
  }, [terrain])

  // ── Toggle grass visibility ────────────────────────────────
  useEffect(() => {
    if (grassSystemRef.current) {
      grassSystemRef.current.setEnabled(showGrass)
    }
  }, [showGrass])

  // ── Update grid helper ─────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Remove old grid
    if (gridHelperRef.current) {
      scene.remove(gridHelperRef.current)
      gridHelperRef.current = null
    }

    if (showGrid) {
      const worldSize = terrain.size * terrain.cellSize
      const grid = new THREE.GridHelper(worldSize, terrain.size, 0x444444, 0x333333)
      grid.position.set(worldSize / 2, 0.05, worldSize / 2)
      grid.material.opacity = 0.15
      grid.material.transparent = true
      scene.add(grid)
      gridHelperRef.current = grid
    }
  }, [showGrid, terrain.size, terrain.cellSize])

  // ── Update water plane ─────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Remove old water
    if (waterMeshRef.current) {
      waterMeshRef.current.geometry.dispose()
      ;(waterMeshRef.current.material as THREE.Material).dispose()
      scene.remove(waterMeshRef.current)
      waterMeshRef.current = null
    }

    if (showWater && terrain.seaLevel > 0) {
      const worldSize = terrain.size * terrain.cellSize
      const waterGeo = new THREE.PlaneGeometry(worldSize * 1.2, worldSize * 1.2)
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
      waterMesh.position.set(worldSize / 2, terrain.seaLevel * terrain.maxHeight, worldSize / 2)
      waterMesh.receiveShadow = true
      waterMesh.userData.isWater = true
      scene.add(waterMesh)
      waterMeshRef.current = waterMesh
    }
  }, [showWater, terrain.seaLevel, terrain.maxHeight, terrain.size, terrain.cellSize])

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

  const raycastTerrain = useCallback((): THREE.Vector3 | null => {
    const camera = cameraRef.current
    const chunkMgr = chunkManagerRef.current
    if (!camera || !chunkMgr) return null

    raycasterRef.current.setFromCamera(mouseRef.current, camera)
    const hits = raycasterRef.current.intersectObjects(chunkMgr.getChunkMeshes(), false)
    if (hits.length > 0) {
      return hits[0].point
    }
    return null
  }, [])

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
      // Immediately rebuild affected terrain chunks
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
    // Rebuild grass to reflect terrain changes
    if (grassSystemRef.current && cameraRef.current) {
      grassSystemRef.current.rebuild(cameraRef.current.position)
    }
  }, [raycastTerrain, onTerrainSculpt, onTerrainPaint])

  // Mouse event handlers
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // Left click only
      const tool = activeToolRef.current
      if (tool === 'sculpt' || tool === 'paint-material') {
        updateMouseNDC(e)
        isPaintingRef.current = true
        lastPaintTimeRef.current = 0
        handleBrushStroke()
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      updateMouseNDC(e)

      // Update brush cursor
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
          const tool = activeToolRef.current
          const showCursor = tool === 'sculpt' || tool === 'paint-material'
          cursor.visible = showCursor
          if (showCursor) {
            cursor.position.set(point.x, point.y + 0.2, point.z)
          }
        }
      } else {
        onCursorMove(null, null)
        if (brushCursorRef.current) brushCursorRef.current.visible = false
      }

      // Continuous painting
      if (isPaintingRef.current) {
        const now = performance.now()
        if (now - lastPaintTimeRef.current > 50) { // 20 strokes/sec max
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
    }

    const handleMouseLeave = () => {
      if (brushCursorRef.current) brushCursorRef.current.visible = false
      onCursorMove(null, null)
      if (isPaintingRef.current) {
        isPaintingRef.current = false
        onTerrainChanged()
      }
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
  }, [updateMouseNDC, raycastTerrain, handleBrushStroke, onTerrainChanged, onCursorMove])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: (activeTool === 'sculpt' || activeTool === 'paint-material') ? 'crosshair' : 'default' }}
    />
  )
}
