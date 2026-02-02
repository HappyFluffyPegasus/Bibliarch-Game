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
    sprint: false,
  }

  // Settings
  private _subMode: 'walk' | 'fly' = 'walk'
  private _speed = 1.0

  // Character head bone height at 100% scale (from Viewer3D CAMERA_POSITIONS)
  private eyeHeight = 1.65

  // Physics
  private velocityY = 0
  private isGrounded = false
  private gravity = -30      // units/s²
  private jumpImpulse = 10   // units/s
  private jumpRequested = false

  // Double-space fly toggle
  private lastSpaceTime = 0
  private readonly DOUBLE_TAP_MS = 300

  // Mode change callback (walk ↔ fly)
  private _onSubModeChange: ((mode: 'walk' | 'fly') => void) | null = null

  // Internals (cached to avoid per-frame allocations)
  private direction = new THREE.Vector3()
  private moveVector = new THREE.Vector3()
  private _forward = new THREE.Vector3()
  private _right = new THREE.Vector3()
  private _up = new THREE.Vector3(0, 1, 0)
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
        case 'ShiftLeft': case 'ShiftRight': this.keys.down = true; break
        case 'ControlLeft': case 'ControlRight': this.keys.sprint = true; break
        case 'Space': {
          e.preventDefault()
          this.keys.up = true

          const now = performance.now()
          // Double-tap space → toggle fly/walk
          if (now - this.lastSpaceTime < this.DOUBLE_TAP_MS) {
            this.toggleSubMode()
            this.lastSpaceTime = 0
          } else {
            this.lastSpaceTime = now
            // Single space in walk mode → jump
            if (this._subMode === 'walk' && this.isGrounded) {
              this.jumpRequested = true
            }
          }
          break
        }
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
        case 'ControlLeft': case 'ControlRight': this.keys.sprint = false; break
      }
    }
  }

  private toggleSubMode(): void {
    this._subMode = this._subMode === 'walk' ? 'fly' : 'walk'
    if (this._subMode === 'walk') {
      // Entering walk mode: let gravity take over
      this.velocityY = 0
    }
    this._onSubModeChange?.(this._subMode)
  }

  get subMode() { return this._subMode }
  set subMode(mode: 'walk' | 'fly') {
    if (mode === this._subMode) return
    this._subMode = mode
    if (mode === 'walk') this.velocityY = 0
  }

  get speed() { return this._speed }
  set speed(s: number) { this._speed = Math.max(0.1, Math.min(10, s)) }

  set onSubModeChange(cb: ((mode: 'walk' | 'fly') => void) | null) {
    this._onSubModeChange = cb
  }

  isLocked(): boolean {
    return this.controls.isLocked
  }

  lock(): void {
    this.controls.lock()
  }

  unlock(): void {
    this.controls.unlock()
    this.resetKeys()
    this.velocityY = 0
    this.jumpRequested = false
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
    this.keys.sprint = false
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

    // Clamp delta to prevent physics explosion on lag spikes
    const dt = Math.min(delta, 0.1)

    const sprintMultiplier = this.keys.sprint ? 2 : 1
    const baseSpeed = 20 * this._speed * sprintMultiplier
    const moveSpeed = baseSpeed * dt

    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize

    // Get camera forward direction (horizontal only for WASD) — reuse cached vectors
    this.camera.getWorldDirection(this.direction)
    this._forward.set(this.direction.x, 0, this.direction.z).normalize()
    this._right.crossVectors(this._forward, this._up).normalize()

    // Horizontal movement (both modes)
    this.moveVector.set(0, 0, 0)
    if (this.keys.forward) this.moveVector.add(this._forward)
    if (this.keys.backward) this.moveVector.sub(this._forward)
    if (this.keys.right) this.moveVector.add(this._right)
    if (this.keys.left) this.moveVector.sub(this._right)

    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize().multiplyScalar(moveSpeed)
    }

    this.camera.position.x += this.moveVector.x
    this.camera.position.z += this.moveVector.z

    // Clamp to world bounds
    this.camera.position.x = Math.max(0, Math.min(worldSizeX, this.camera.position.x))
    this.camera.position.z = Math.max(0, Math.min(worldSizeZ, this.camera.position.z))

    // Terrain height at current position
    const terrainY = this.getTerrainHeight(terrain, this.camera.position.x, this.camera.position.z)
    const floorY = terrainY + this.eyeHeight

    if (this._subMode === 'fly') {
      // ── Fly mode (creative mode) ──
      if (this.keys.up) this.camera.position.y += moveSpeed
      if (this.keys.down) this.camera.position.y -= moveSpeed

      // Floor clamp
      if (this.camera.position.y < floorY) {
        this.camera.position.y = floorY
      }
    } else {
      // ── Walk mode (gravity + jump) ──

      // Jump
      if (this.jumpRequested && this.isGrounded) {
        this.velocityY = this.jumpImpulse
        this.isGrounded = false
        this.jumpRequested = false
      }
      this.jumpRequested = false

      // Gravity
      this.velocityY += this.gravity * dt
      this.camera.position.y += this.velocityY * dt

      // Ground collision
      if (this.camera.position.y <= floorY) {
        this.camera.position.y = floorY
        this.velocityY = 0
        this.isGrounded = true
      } else {
        this.isGrounded = false
      }
    }
  }

  dispose(): void {
    this.unbindEvents()
    this.controls.dispose()
  }
}
