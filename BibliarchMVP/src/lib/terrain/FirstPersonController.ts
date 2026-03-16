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

  // Shift lock (Roblox-style cursor lock toggle)
  private _shiftLocked = false
  private _onShiftLockChange: ((locked: boolean) => void) | null = null

  // Drag-to-look (trackpad / right-click drag)
  private isDragLooking = false
  private lastDragX = 0
  private lastDragY = 0
  private dragEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly DRAG_SENSITIVITY = 0.003
  private handleMouseDownDrag: (e: MouseEvent) => void
  private handleMouseMoveDrag: (e: MouseEvent) => void
  private handleMouseUpDrag: (e: MouseEvent) => void
  private handleContextMenu: (e: Event) => void
  private handleClickLock: (e: MouseEvent) => void
  private handlePointerLockError: () => void

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

    // Suppress the PointerLockControls "Unable to use Pointer Lock API" error.
    // It fires on pointerlockerror events which are non-fatal (e.g. no user gesture).
    this.handlePointerLockError = () => { /* silenced — handled via promise catch */ }
    domElement.ownerDocument.addEventListener('pointerlockerror', this.handlePointerLockError)

    // Shift lock state is driven entirely by pointer lock events.
    // This handles ESC, lock failures, and toggle correctly.
    this.controls.addEventListener('lock', () => {
      this._shiftLocked = true
      this._onShiftLockChange?.(true)
    })
    this.controls.addEventListener('unlock', () => {
      this._shiftLocked = false
      this._onShiftLockChange?.(false)
    })

    // Left-click on canvas toggles pointer lock (browsers require a click
    // gesture for requestPointerLock — keydown alone may be rejected).
    this.handleClickLock = (e: MouseEvent) => {
      if (e.button === 0 && !this.controls.isLocked) {
        this.toggleShiftLock()
      }
    }

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
        case 'KeyQ': this.keys.down = true; break
        case 'ShiftLeft': case 'ShiftRight':
          if (this._subMode === 'fly') {
            this.keys.down = true
          } else if (!e.repeat) {
            this.toggleShiftLock()
          }
          break
        case 'ControlLeft': case 'ControlRight': this.keys.sprint = true; break
        case 'Space': {
          e.preventDefault()
          // Ignore key repeat events — only act on fresh presses
          if (e.repeat) {
            this.keys.up = true
            break
          }
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
        case 'KeyQ': this.keys.down = false; break
        case 'ShiftLeft': case 'ShiftRight': this.keys.down = false; break
        case 'ControlLeft': case 'ControlRight': this.keys.sprint = false; break
      }
    }

    // ── Drag-to-look handlers (right-click / two-finger trackpad) ──

    this.handleMouseDownDrag = (e: MouseEvent) => {
      if (e.button === 2) {
        this.isDragLooking = true
        this.lastDragX = e.clientX
        this.lastDragY = e.clientY
      }
    }

    this.handleMouseMoveDrag = (e: MouseEvent) => {
      if (!this.isDragLooking || this.controls.isLocked) return

      const dx = e.clientX - this.lastDragX
      const dy = e.clientY - this.lastDragY
      this.lastDragX = e.clientX
      this.lastDragY = e.clientY

      // Rotate camera via euler angles (same method PointerLockControls uses)
      this.dragEuler.setFromQuaternion(this.camera.quaternion)
      this.dragEuler.y -= dx * this.DRAG_SENSITIVITY
      this.dragEuler.x -= dy * this.DRAG_SENSITIVITY
      this.dragEuler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.dragEuler.x))
      this.camera.quaternion.setFromEuler(this.dragEuler)
    }

    this.handleMouseUpDrag = (e: MouseEvent) => {
      if (e.button === 2) {
        this.isDragLooking = false
      }
    }

    this.handleContextMenu = (e: Event) => {
      e.preventDefault()
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

  private toggleShiftLock(): void {
    if (this._shiftLocked) {
      this.controls.unlock()
    } else {
      // Call requestPointerLock directly so we can catch the Promise rejection.
      // PointerLockControls still detects lock via the pointerlockchange event.
      const promise = this.domElement.requestPointerLock() as unknown as Promise<void> | void
      if (promise && typeof (promise as Promise<void>).catch === 'function') {
        (promise as Promise<void>).catch(() => { /* browser denied — no user gesture or other restriction */ })
      }
    }
  }

  /** Public reset for when exiting FP mode */
  resetShiftLock(): void {
    if (this._shiftLocked) {
      this.controls.unlock()
    }
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

  get shiftLocked() { return this._shiftLocked }

  set onShiftLockChange(cb: ((locked: boolean) => void) | null) {
    this._onShiftLockChange = cb
  }

  isLocked(): boolean {
    return this.controls.isLocked
  }

  lock(): void {
    const promise = this.domElement.requestPointerLock() as unknown as Promise<void> | void
    if (promise && typeof (promise as Promise<void>).catch === 'function') {
      (promise as Promise<void>).catch(() => {})
    }
  }

  unlock(): void {
    this.controls.unlock()
    this.resetKeys()
    this.velocityY = 0
    this.jumpRequested = false
  }

  onLock(callback: () => void): void {
    this.controls.addEventListener('lock', callback)
  }

  offLock(callback: () => void): void {
    this.controls.removeEventListener('lock', callback)
  }

  onUnlock(callback: () => void): void {
    this.controls.addEventListener('unlock', callback)
  }

  offUnlock(callback: () => void): void {
    this.controls.removeEventListener('unlock', callback)
  }

  /** Returns true if the controller is in use (pointer locked or drag-looking) */
  isEngaged(): boolean {
    return this.controls.isLocked || this.isDragLooking
  }

  bindEvents(): void {
    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('keyup', this.handleKeyUp)
    this.domElement.addEventListener('mousedown', this.handleMouseDownDrag)
    document.addEventListener('mousemove', this.handleMouseMoveDrag)
    document.addEventListener('mouseup', this.handleMouseUpDrag)
    this.domElement.addEventListener('contextmenu', this.handleContextMenu)
    this.domElement.addEventListener('click', this.handleClickLock)
  }

  unbindEvents(): void {
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)
    this.domElement.removeEventListener('mousedown', this.handleMouseDownDrag)
    document.removeEventListener('mousemove', this.handleMouseMoveDrag)
    document.removeEventListener('mouseup', this.handleMouseUpDrag)
    this.domElement.removeEventListener('contextmenu', this.handleContextMenu)
    this.domElement.removeEventListener('click', this.handleClickLock)
    this.resetKeys()
    this.isDragLooking = false
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
    this.domElement.ownerDocument.removeEventListener('pointerlockerror', this.handlePointerLockError)
    this.controls.dispose()
  }
}
