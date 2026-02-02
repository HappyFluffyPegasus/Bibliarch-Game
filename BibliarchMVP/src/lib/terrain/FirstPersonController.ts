import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { TerrainData } from '@/types/world'

export class FirstPersonController {
  private controls: PointerLockControls
  private camera: THREE.PerspectiveCamera
  private domElement: HTMLElement

  // Key state
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  }

  // Settings
  private _subMode: 'walk' | 'fly' = 'walk'
  private _speed = 1.0
  private eyeHeight = 1.7

  // Internals
  private velocity = new THREE.Vector3()
  private direction = new THREE.Vector3()
  private moveVector = new THREE.Vector3()
  private handleKeyDown: (e: KeyboardEvent) => void
  private handleKeyUp: (e: KeyboardEvent) => void

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera
    this.domElement = domElement
    this.controls = new PointerLockControls(camera, domElement)

    this.handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return

      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.forward = true; break
        case 'KeyS': case 'ArrowDown': this.keys.backward = true; break
        case 'KeyA': case 'ArrowLeft': this.keys.left = true; break
        case 'KeyD': case 'ArrowRight': this.keys.right = true; break
        case 'Space': this.keys.up = true; e.preventDefault(); break
        case 'ShiftLeft': case 'ShiftRight': this.keys.down = true; break
      }
    }

    this.handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.keys.forward = false; break
        case 'KeyS': case 'ArrowDown': this.keys.backward = false; break
        case 'KeyA': case 'ArrowLeft': this.keys.left = false; break
        case 'KeyD': case 'ArrowRight': this.keys.right = false; break
        case 'Space': this.keys.up = false; break
        case 'ShiftLeft': case 'ShiftRight': this.keys.down = false; break
      }
    }
  }

  get subMode() { return this._subMode }
  set subMode(mode: 'walk' | 'fly') { this._subMode = mode }

  get speed() { return this._speed }
  set speed(s: number) { this._speed = Math.max(0.1, Math.min(10, s)) }

  isLocked(): boolean {
    return this.controls.isLocked
  }

  lock(): void {
    this.controls.lock()
  }

  unlock(): void {
    this.controls.unlock()
    this.resetKeys()
  }

  onUnlock(callback: () => void): void {
    this.controls.addEventListener('unlock', callback)
  }

  offUnlock(callback: () => void): void {
    this.controls.removeEventListener('unlock', callback)
  }

  bindEvents(): void {
    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('keyup', this.handleKeyUp)
  }

  unbindEvents(): void {
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)
    this.resetKeys()
  }

  private resetKeys(): void {
    this.keys.forward = false
    this.keys.backward = false
    this.keys.left = false
    this.keys.right = false
    this.keys.up = false
    this.keys.down = false
  }

  /** Get a raycaster from the center of the screen (for crosshair tool interaction) */
  getCenterRay(): THREE.Raycaster {
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    return raycaster
  }

  /** Get terrain height at a world XZ position by sampling the heightmap */
  private getTerrainHeight(terrain: TerrainData, worldX: number, worldZ: number): number {
    const gridX = worldX / terrain.cellSize
    const gridZ = worldZ / terrain.cellSize

    // Bilinear interpolation
    const gx0 = Math.floor(gridX)
    const gz0 = Math.floor(gridZ)
    const gx1 = gx0 + 1
    const gz1 = gz0 + 1
    const fx = gridX - gx0
    const fz = gridZ - gz0

    const sample = (x: number, z: number): number => {
      if (x < 0 || x >= terrain.size || z < 0 || z >= terrain.sizeZ) return 0
      return terrain.heights[z * terrain.size + x] * terrain.maxHeight
    }

    const h00 = sample(gx0, gz0)
    const h10 = sample(gx1, gz0)
    const h01 = sample(gx0, gz1)
    const h11 = sample(gx1, gz1)

    const h0 = h00 + (h10 - h00) * fx
    const h1 = h01 + (h11 - h01) * fx
    return h0 + (h1 - h0) * fz
  }

  /** Called each frame. Moves camera based on key state and mode. */
  update(delta: number, terrain: TerrainData): void {
    if (!this.controls.isLocked) return

    const baseSpeed = 20 * this._speed
    const moveSpeed = baseSpeed * delta

    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize

    // Get camera forward direction (horizontal only for WASD)
    this.camera.getWorldDirection(this.direction)
    const forward = new THREE.Vector3(this.direction.x, 0, this.direction.z).normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    this.moveVector.set(0, 0, 0)

    if (this.keys.forward) this.moveVector.add(forward)
    if (this.keys.backward) this.moveVector.sub(forward)
    if (this.keys.right) this.moveVector.add(right)
    if (this.keys.left) this.moveVector.sub(right)

    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize().multiplyScalar(moveSpeed)
    }

    this.camera.position.x += this.moveVector.x
    this.camera.position.z += this.moveVector.z

    if (this._subMode === 'fly') {
      if (this.keys.up) this.camera.position.y += moveSpeed
      if (this.keys.down) this.camera.position.y -= moveSpeed
    }

    // Clamp to world bounds
    this.camera.position.x = Math.max(0, Math.min(worldSizeX, this.camera.position.x))
    this.camera.position.z = Math.max(0, Math.min(worldSizeZ, this.camera.position.z))

    // Terrain height snapping
    const terrainY = this.getTerrainHeight(terrain, this.camera.position.x, this.camera.position.z)
    const minY = terrainY + this.eyeHeight

    if (this._subMode === 'walk') {
      this.camera.position.y = minY
    } else {
      // Fly mode: don't go below terrain
      if (this.camera.position.y < minY) {
        this.camera.position.y = minY
      }
    }
  }

  dispose(): void {
    this.unbindEvents()
    this.controls.dispose()
  }
}
