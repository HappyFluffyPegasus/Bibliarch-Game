import {
  Mesh,
  VertexData,
  ShaderMaterial,
  Effect,
  Matrix,
  Vector3,
  TransformNode,
  Scene,
  VertexBuffer,
  Constants,
  Buffer,
  Quaternion,
} from '@babylonjs/core'
import { TerrainData, TerrainMaterialId, terrainIndex, isInBounds } from '@/types/world'
import { getMaterialDef } from './materials'
import { grassVertexShader, grassFragmentShader } from './grass-shaders'

// ── Configuration ────────────────────────────────────────────

const MAX_INSTANCES = 180_000
const VISIBLE_RANGE = 70
const REBUILD_THRESHOLD = 10
const BLADES_PER_CELL = 28
const BLADE_WIDTH = 0.08
const BLADE_HEIGHT_MIN = 0.25
const BLADE_HEIGHT_MAX = 0.55
const WIND_STRENGTH = 0.15
const WIND_FREQUENCY = 1.8

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Register grass shaders
Effect.ShadersStore['grassVertexShader'] = grassVertexShader
Effect.ShadersStore['grassFragmentShader'] = grassFragmentShader

function createBladeGeometry(scene: Scene): Mesh {
  const hw = BLADE_WIDTH / 2

  const positions = [
    // Quad 1
    -hw, 0, 0,  hw, 0, 0,  hw, 1, 0,  -hw, 1, 0,
    // Quad 2
    0, 0, -hw,  0, 0, hw,  0, 1, hw,  0, 1, -hw,
  ]

  const indices = [
    0, 1, 2,  0, 2, 3,  2, 1, 0,  3, 2, 0,
    4, 5, 6,  4, 6, 7,  6, 5, 4,  7, 6, 4,
  ]

  const mesh = new Mesh('grass-blade', scene)
  const vertexData = new VertexData()
  vertexData.positions = positions
  vertexData.indices = indices
  vertexData.applyToMesh(mesh)

  return mesh
}

export class GrassSystem {
  private mesh: Mesh | null = null
  private material: ShaderMaterial | null = null
  private parent: TransformNode
  private terrain: TerrainData | null = null
  private lastCameraPos: Vector3 = new Vector3(Infinity, Infinity, Infinity)
  private instanceCount = 0
  private enabled = true
  private scene: Scene

  private colorArr: Float32Array = new Float32Array(MAX_INSTANCES * 3)

  constructor(scene: Scene) {
    this.scene = scene
    this.parent = new TransformNode('grass-system', scene)
  }

  getParent(): TransformNode {
    return this.parent
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.mesh) {
      this.mesh.setEnabled(enabled)
    }
  }

  setTerrain(terrain: TerrainData): void {
    this.terrain = terrain
    this.lastCameraPos.set(Infinity, Infinity, Infinity)
  }

  update(cameraPosition: Vector3, time: number): void {
    if (!this.enabled || !this.terrain) return

    if (this.material) {
      this.material.setFloat('uTime', time)
    }

    const dx = cameraPosition.x - this.lastCameraPos.x
    const dz = cameraPosition.z - this.lastCameraPos.z
    const distMoved = Math.sqrt(dx * dx + dz * dz)

    if (distMoved > REBUILD_THRESHOLD) {
      this.rebuild(cameraPosition)
      this.lastCameraPos.copyFrom(cameraPosition)
    }
  }

  rebuild(centerPos: Vector3): void {
    if (!this.terrain) return
    const terrain = this.terrain

    if (!this.mesh) {
      this.createMesh()
    }
    if (!this.mesh) return

    const cellSize = terrain.cellSize
    const range = VISIBLE_RANGE
    const rangeSquared = range * range

    const minGx = Math.max(0, Math.floor((centerPos.x - range) / cellSize))
    const maxGx = Math.min(terrain.size - 1, Math.ceil((centerPos.x + range) / cellSize))
    const minGz = Math.max(0, Math.floor((centerPos.z - range) / cellSize))
    const maxGz = Math.min(terrain.size - 1, Math.ceil((centerPos.z + range) / cellSize))

    let count = 0
    const colors = this.colorArr
    const matrices: Matrix[] = []

    for (let gz = minGz; gz <= maxGz && count < MAX_INSTANCES; gz++) {
      for (let gx = minGx; gx <= maxGx && count < MAX_INSTANCES; gx++) {
        const worldX = gx * cellSize
        const worldZ = gz * cellSize
        const dxc = worldX - centerPos.x
        const dzc = worldZ - centerPos.z
        if (dxc * dxc + dzc * dzc > rangeSquared) continue

        const idx = terrainIndex(gx, gz, terrain.size)
        const matId = terrain.materials[idx] as TerrainMaterialId
        const matDef = getMaterialDef(matId)
        if (!matDef.hasGrass || matDef.grassDensity <= 0) continue

        const cellHeight = terrain.heights[idx]
        if (cellHeight < terrain.seaLevel) continue

        const baseY = cellHeight * terrain.maxHeight
        const bladesInCell = Math.floor(BLADES_PER_CELL * matDef.grassDensity)
        const grassColor = matDef.grassColor || matDef.color

        const rng = seededRandom(gx * 73856093 + gz * 19349663)

        for (let b = 0; b < bladesInCell && count < MAX_INSTANCES; b++) {
          const ox = (rng() - 0.5) * cellSize
          const oz = (rng() - 0.5) * cellSize
          const bx = worldX + ox
          const bz = worldZ + oz
          const bladeH = BLADE_HEIGHT_MIN + rng() * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN)
          const rotY = rng() * Math.PI * 2
          const colorVar = 0.85 + rng() * 0.3

          colors[count * 3] = grassColor[0] * colorVar
          colors[count * 3 + 1] = grassColor[1] * colorVar
          colors[count * 3 + 2] = grassColor[2] * colorVar

          matrices.push(Matrix.Compose(
            new Vector3(1, bladeH, 1),
            Quaternion.FromEulerAngles(0, rotY, 0),
            new Vector3(bx, baseY, bz)
          ))

          count++
        }
      }
    }

    this.instanceCount = count

    if (count > 0) {
      const buf = new Float32Array(count * 16)
      for (let i = 0; i < count; i++) {
        matrices[i].copyToArray(buf, i * 16)
      }
      this.mesh.thinInstanceSetBuffer('matrix', buf, 16)
    } else {
      this.mesh.thinInstanceCount = 0
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose()
      this.mesh = null
    }
    if (this.material) {
      this.material.dispose()
      this.material = null
    }
    this.parent.dispose()
  }

  private createMesh(): void {
    this.dispose()

    this.parent = new TransformNode('grass-system', this.scene)

    const bladeMesh = createBladeGeometry(this.scene)

    this.material = new ShaderMaterial('grassMaterial', this.scene, {
      vertex: 'grass',
      fragment: 'grass',
    }, {
      attributes: ['position', 'instanceColor'],
      uniforms: ['worldViewProjection', 'viewMatrix', 'uTime', 'uWindStrength', 'uWindFrequency'],
      needAlphaBlending: false,
    })

    this.material.setFloat('uTime', 0)
    this.material.setFloat('uWindStrength', WIND_STRENGTH)
    this.material.setFloat('uWindFrequency', WIND_FREQUENCY)
    this.material.backFaceCulling = false

    bladeMesh.material = this.material
    bladeMesh.parent = this.parent

    this.mesh = bladeMesh
  }
}
