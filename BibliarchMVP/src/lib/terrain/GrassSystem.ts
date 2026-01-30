import * as THREE from 'three'
import { TerrainData, TerrainMaterialId, terrainIndex, isInBounds } from '@/types/world'
import { getMaterialDef } from './materials'
import { grassVertexShader, grassFragmentShader } from './grass-shaders'

// ── Configuration ────────────────────────────────────────────

const MAX_INSTANCES = 180_000
const VISIBLE_RANGE = 70 // World units from camera
const REBUILD_THRESHOLD = 10 // Camera must move this far to trigger rebuild
const BLADES_PER_CELL = 28 // Grass blade count per grass-material cell
const BLADE_WIDTH = 0.08
const BLADE_HEIGHT_MIN = 0.25
const BLADE_HEIGHT_MAX = 0.55
const WIND_STRENGTH = 0.15
const WIND_FREQUENCY = 1.8

// ── Seeded random for deterministic grass placement ─────────

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── Grass blade geometry ─────────────────────────────────────

/**
 * Creates a cross-billboard blade: two intersecting quads at 90°.
 * The blade stands upright (Y-up), with base at y=0 and tip at y=1 (normalized).
 */
function createBladeGeometry(): THREE.BufferGeometry {
  const hw = BLADE_WIDTH / 2

  // Quad 1: aligned along X axis
  // Quad 2: aligned along Z axis (rotated 90° around Y)
  const positions = new Float32Array([
    // Quad 1
    -hw, 0, 0,    // bottom-left
     hw, 0, 0,    // bottom-right
     hw, 1, 0,    // top-right
    -hw, 1, 0,    // top-left
    // Quad 2
    0, 0, -hw,
    0, 0,  hw,
    0, 1,  hw,
    0, 1, -hw,
  ])

  const indices = new Uint16Array([
    // Quad 1 front
    0, 1, 2,  0, 2, 3,
    // Quad 1 back
    2, 1, 0,  3, 2, 0,
    // Quad 2 front
    4, 5, 6,  4, 6, 7,
    // Quad 2 back
    6, 5, 4,  7, 6, 4,
  ])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  return geometry
}

// ── GrassSystem class ────────────────────────────────────────

export class GrassSystem {
  private mesh: THREE.InstancedMesh | null = null
  private material: THREE.ShaderMaterial | null = null
  private geometry: THREE.BufferGeometry | null = null
  private group: THREE.Group
  private terrain: TerrainData | null = null
  private lastCameraPos: THREE.Vector3 = new THREE.Vector3(Infinity, Infinity, Infinity)
  private instanceCount = 0
  private enabled = true

  // Reusable objects
  private dummy = new THREE.Object3D()
  private colorArr: Float32Array = new Float32Array(MAX_INSTANCES * 3)

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'grass-system'
  }

  getGroup(): THREE.Group {
    return this.group
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.mesh) {
      this.mesh.visible = enabled
    }
  }

  setTerrain(terrain: TerrainData): void {
    this.terrain = terrain
    // Force rebuild on next update
    this.lastCameraPos.set(Infinity, Infinity, Infinity)
  }

  /**
   * Call each frame. Rebuilds grass instances when camera moves significantly.
   */
  update(cameraPosition: THREE.Vector3, time: number): void {
    if (!this.enabled || !this.terrain) return

    // Update wind uniform
    if (this.material) {
      this.material.uniforms.uTime.value = time
    }

    // Check if camera moved enough to rebuild
    const dx = cameraPosition.x - this.lastCameraPos.x
    const dz = cameraPosition.z - this.lastCameraPos.z
    const distMoved = Math.sqrt(dx * dx + dz * dz)

    if (distMoved > REBUILD_THRESHOLD) {
      this.rebuild(cameraPosition)
      this.lastCameraPos.copy(cameraPosition)
    }
  }

  /**
   * Force a full rebuild of grass instances around the given position.
   */
  rebuild(centerPos: THREE.Vector3): void {
    if (!this.terrain) return

    const terrain = this.terrain

    // Ensure mesh exists
    if (!this.mesh) {
      this.createMesh()
    }
    if (!this.mesh) return

    const cellSize = terrain.cellSize
    const range = VISIBLE_RANGE
    const rangeSquared = range * range

    // Grid bounds for the visible area
    const minGx = Math.max(0, Math.floor((centerPos.x - range) / cellSize))
    const maxGx = Math.min(terrain.size - 1, Math.ceil((centerPos.x + range) / cellSize))
    const minGz = Math.max(0, Math.floor((centerPos.z - range) / cellSize))
    const maxGz = Math.min(terrain.size - 1, Math.ceil((centerPos.z + range) / cellSize))

    let count = 0
    const dummy = this.dummy
    const colors = this.colorArr

    for (let gz = minGz; gz <= maxGz && count < MAX_INSTANCES; gz++) {
      for (let gx = minGx; gx <= maxGx && count < MAX_INSTANCES; gx++) {
        // Check distance from camera (XZ plane)
        const worldX = gx * cellSize
        const worldZ = gz * cellSize
        const dxc = worldX - centerPos.x
        const dzc = worldZ - centerPos.z
        if (dxc * dxc + dzc * dzc > rangeSquared) continue

        // Check material has grass
        const idx = terrainIndex(gx, gz, terrain.size)
        const matId = terrain.materials[idx] as TerrainMaterialId
        const matDef = getMaterialDef(matId)
        if (!matDef.hasGrass || matDef.grassDensity <= 0) continue

        // Check not underwater
        const cellHeight = terrain.heights[idx]
        if (cellHeight < terrain.seaLevel) continue

        const baseY = cellHeight * terrain.maxHeight
        const bladesInCell = Math.floor(BLADES_PER_CELL * matDef.grassDensity)
        const grassColor = matDef.grassColor || matDef.color

        // Deterministic random based on cell position
        const rng = seededRandom(gx * 73856093 + gz * 19349663)

        for (let b = 0; b < bladesInCell && count < MAX_INSTANCES; b++) {
          // Random offset within cell
          const ox = (rng() - 0.5) * cellSize
          const oz = (rng() - 0.5) * cellSize
          const bx = worldX + ox
          const bz = worldZ + oz

          // Random height variation
          const bladeH = BLADE_HEIGHT_MIN + rng() * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN)

          // Random Y rotation
          const rotY = rng() * Math.PI * 2

          // Color variation
          const colorVar = 0.85 + rng() * 0.3
          colors[count * 3] = grassColor[0] * colorVar
          colors[count * 3 + 1] = grassColor[1] * colorVar
          colors[count * 3 + 2] = grassColor[2] * colorVar

          // Set instance transform
          dummy.position.set(bx, baseY, bz)
          dummy.rotation.set(0, rotY, 0)
          dummy.scale.set(1, bladeH, 1)
          dummy.updateMatrix()
          this.mesh.setMatrixAt(count, dummy.matrix)

          count++
        }
      }
    }

    this.instanceCount = count
    this.mesh.count = count
    this.mesh.instanceMatrix.needsUpdate = true

    // Update color attribute
    const colorAttr = this.mesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute
    if (colorAttr) {
      colorAttr.needsUpdate = true
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.group.remove(this.mesh)
      this.mesh.dispose()
      this.mesh = null
    }
    if (this.geometry) {
      this.geometry.dispose()
      this.geometry = null
    }
    if (this.material) {
      this.material.dispose()
      this.material = null
    }
  }

  // ── Private ────────────────────────────────────────────────

  private createMesh(): void {
    this.dispose()

    // Geometry
    this.geometry = createBladeGeometry()

    // Add instanceColor attribute
    const colorBuffer = new THREE.InstancedBufferAttribute(this.colorArr, 3)
    colorBuffer.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('instanceColor', colorBuffer)

    // Shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: WIND_STRENGTH },
        uWindFrequency: { value: WIND_FREQUENCY },
      },
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
    })

    // Instanced mesh
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_INSTANCES)
    this.mesh.count = 0 // Start with zero visible
    this.mesh.frustumCulled = false // We handle culling manually
    this.mesh.castShadow = false
    this.mesh.receiveShadow = false
    this.mesh.name = 'grass-blades'

    this.group.add(this.mesh)
  }
}
