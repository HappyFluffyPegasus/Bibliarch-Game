import {
  FreeCamera,
  Vector3,
  Vector2,
  Quaternion,
  Matrix,
  Ray,
  Scene,
} from '@babylonjs/core'
import { TerrainData } from '@/types/world'

export class FirstPersonController {
  private camera: FreeCamera
  private scene: Scene
  private domElement: HTMLElement

  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    sprint: false,
  }

  private _subMode: 'walk' | 'fly' = 'walk'
  private _speed = 1.0
  private eyeHeight = 1.65

  private velocityY = 0
  private isGrounded = false
  private gravity = -30
  private jumpImpulse = 10
  private jumpRequested = false

  private lastSpaceTime = 0
  private readonly DOUBLE_TAP_MS = 300

  private _onSubModeChange: ((mode: 'walk' | 'fly') => void) | null = null
  private _shiftLocked = false
  private _onShiftLockChange: ((locked: boolean) => void) | null = null

  private isDragLooking = false
  private lastDragX = 0
  private lastDragY = 0
  private readonly DRAG_SENSITIVITY = 0.003

  private direction = new Vector3()
  private moveVector = new Vector3()
  private _forward = new Vector3()
  private _right = new Vector3()
  private _up = new Vector3(0, 1, 0)

  private handleKeyDown: (e: KeyboardEvent) => void
  private handleKeyUp: (e: KeyboardEvent) => void
  private handleMouseDownDrag: (e: MouseEvent) => void
  private handleMouseMoveDrag: (e: MouseEvent) => void
  private handleMouseUpDrag: (e: MouseEvent) => void
  private handleContextMenu: (e: Event) => void

  constructor(camera: FreeCamera, scene: Scene, domElement: HTMLElement) {
    this.camera = camera
    this.scene = scene
    this.domElement = domElement

    // Disable Babylon.js default camera controls — we handle input ourselves
    camera.inputs.clear()

    this.handleKeyDown = (e: KeyboardEvent) => {
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
          if (e.repeat) {
            this.keys.up = true
            break
          }
          this.keys.up = true

          const now = performance.now()
          if (now - this.lastSpaceTime < this.DOUBLE_TAP_MS) {
            this.toggleSubMode()
            this.lastSpaceTime = 0
          } else {
            this.lastSpaceTime = now
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

    this.handleMouseDownDrag = (e: MouseEvent) => {
      if (e.button === 2) {
        this.isDragLooking = true
        this.lastDragX = e.clientX
        this.lastDragY = e.clientY
      }
    }

    this.handleMouseMoveDrag = (e: MouseEvent) => {
      if (!this.isDragLooking && !this._shiftLocked) return

      const dx = e.movementX || (e.clientX - this.lastDragX)
      const dy = e.movementY || (e.clientY - this.lastDragY)
      this.lastDragX = e.clientX
      this.lastDragY = e.clientY

      // Rotate camera
      this.camera.rotation.y += dx * this.DRAG_SENSITIVITY
      this.camera.rotation.x += dy * this.DRAG_SENSITIVITY
      this.camera.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.camera.rotation.x))
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
      this.velocityY = 0
    }
    this._onSubModeChange?.(this._subMode)
  }

  private toggleShiftLock(): void {
    if (this._shiftLocked) {
      document.exitPointerLock()
      this._shiftLocked = false
      this._onShiftLockChange?.(false)
    } else {
      const promise = this.domElement.requestPointerLock() as unknown as Promise<void> | void
      if (promise && typeof (promise as Promise<void>).catch === 'function') {
        (promise as Promise<void>).catch(() => {})
      }
      this._shiftLocked = true
      this._onShiftLockChange?.(true)
    }
  }

  resetShiftLock(): void {
    if (this._shiftLocked) {
      document.exitPointerLock()
      this._shiftLocked = false
      this._onShiftLockChange?.(false)
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
    return this._shiftLocked
  }

  lock(): void {
    const promise = this.domElement.requestPointerLock() as unknown as Promise<void> | void
    if (promise && typeof (promise as Promise<void>).catch === 'function') {
      (promise as Promise<void>).catch(() => {})
    }
    this._shiftLocked = true
    this._onShiftLockChange?.(true)
  }

  unlock(): void {
    document.exitPointerLock()
    this._shiftLocked = false
    this._onShiftLockChange?.(false)
    this.resetKeys()
    this.velocityY = 0
    this.jumpRequested = false
  }

  onLock(callback: () => void): void {
    // Pointer lock change listener
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.domElement) {
        callback()
      }
    })
  }

  offLock(_callback: () => void): void {
    // Would need to track and remove specific listener
  }

  onUnlock(callback: () => void): void {
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement) {
        callback()
      }
    })
  }

  offUnlock(_callback: () => void): void {}

  isEngaged(): boolean {
    return this._shiftLocked || this.isDragLooking
  }

  bindEvents(): void {
    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('keyup', this.handleKeyUp)
    this.domElement.addEventListener('mousedown', this.handleMouseDownDrag)
    document.addEventListener('mousemove', this.handleMouseMoveDrag)
    document.addEventListener('mouseup', this.handleMouseUpDrag)
    this.domElement.addEventListener('contextmenu', this.handleContextMenu)
  }

  unbindEvents(): void {
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)
    this.domElement.removeEventListener('mousedown', this.handleMouseDownDrag)
    document.removeEventListener('mousemove', this.handleMouseMoveDrag)
    document.removeEventListener('mouseup', this.handleMouseUpDrag)
    this.domElement.removeEventListener('contextmenu', this.handleContextMenu)
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

  getCenterRay(): Ray {
    return this.camera.getForwardRay()
  }

  private getTerrainHeight(terrain: TerrainData, worldX: number, worldZ: number): number {
    const gridX = worldX / terrain.cellSize
    const gridZ = worldZ / terrain.cellSize

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

  update(delta: number, terrain: TerrainData): void {
    const dt = Math.min(delta, 0.1)

    const sprintMultiplier = this.keys.sprint ? 2 : 1
    const baseSpeed = 20 * this._speed * sprintMultiplier
    const moveSpeed = baseSpeed * dt

    const worldSizeX = terrain.size * terrain.cellSize
    const worldSizeZ = terrain.sizeZ * terrain.cellSize

    // Get camera forward direction
    const forward = this.camera.getForwardRay().direction
    this._forward.set(forward.x, 0, forward.z).normalize()
    this._right = Vector3.Cross(this._forward, this._up).normalize()

    this.moveVector.set(0, 0, 0)
    if (this.keys.forward) this.moveVector.addInPlace(this._forward)
    if (this.keys.backward) this.moveVector.subtractInPlace(this._forward)
    if (this.keys.right) this.moveVector.addInPlace(this._right)
    if (this.keys.left) this.moveVector.subtractInPlace(this._right)

    if (this.moveVector.lengthSquared() > 0) {
      this.moveVector.normalize().scaleInPlace(moveSpeed)
    }

    this.camera.position.x += this.moveVector.x
    this.camera.position.z += this.moveVector.z

    // Clamp to world bounds
    this.camera.position.x = Math.max(0, Math.min(worldSizeX, this.camera.position.x))
    this.camera.position.z = Math.max(0, Math.min(worldSizeZ, this.camera.position.z))

    const terrainY = this.getTerrainHeight(terrain, this.camera.position.x, this.camera.position.z)
    const floorY = terrainY + this.eyeHeight

    if (this._subMode === 'fly') {
      if (this.keys.up) this.camera.position.y += moveSpeed
      if (this.keys.down) this.camera.position.y -= moveSpeed
      if (this.camera.position.y < floorY) {
        this.camera.position.y = floorY
      }
    } else {
      if (this.jumpRequested && this.isGrounded) {
        this.velocityY = this.jumpImpulse
        this.isGrounded = false
        this.jumpRequested = false
      }
      this.jumpRequested = false

      this.velocityY += this.gravity * dt
      this.camera.position.y += this.velocityY * dt

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
  }
}
