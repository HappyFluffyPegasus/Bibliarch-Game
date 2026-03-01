import * as THREE from 'three'

/**
 * Billboard impostor system for distant objects.
 *
 * For objects beyond a threshold distance from the camera, replaces 3D meshes
 * with camera-facing textured quads. Uses a single InstancedMesh per object type
 * for all distant impostors of that type (1 draw call for all distant trees, etc.).
 *
 * Atlas: each object type is rendered from 8 angles into a texture atlas.
 * At runtime, the closest angle is selected based on camera direction.
 */

const IMPOSTOR_DISTANCE = 200  // Distance threshold for switching to impostors
const ATLAS_VIEWS = 8          // Number of angle captures per type
const ATLAS_CELL_SIZE = 64     // Pixels per view in atlas
const ATLAS_SIZE = 512          // Total atlas texture size

interface ImpostorType {
  atlas: THREE.Texture
  instancedMesh: THREE.InstancedMesh
  idToIndex: Map<string, number>
  indexToId: Map<number, string>
  count: number
  maxCount: number
}

export class ImpostorSystem {
  private group: THREE.Group
  private types: Map<string, ImpostorType> = new Map()
  private quadGeometry: THREE.PlaneGeometry
  private renderTarget: THREE.WebGLRenderTarget
  private captureScene: THREE.Scene
  private captureCamera: THREE.OrthographicCamera

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'impostors'

    // Shared quad geometry for all impostors
    this.quadGeometry = new THREE.PlaneGeometry(1, 1)

    // Offscreen render target for atlas capture
    this.renderTarget = new THREE.WebGLRenderTarget(ATLAS_SIZE, ATLAS_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    })

    this.captureScene = new THREE.Scene()
    this.captureScene.add(new THREE.AmbientLight(0xffffff, 1))
    this.captureScene.add(new THREE.DirectionalLight(0xffffff, 0.5))

    this.captureCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  }

  getGroup(): THREE.Group {
    return this.group
  }

  /** Get the distance threshold for switching to impostors */
  getThreshold(): number {
    return IMPOSTOR_DISTANCE
  }

  /**
   * Capture an atlas for an object type by rendering it from multiple angles.
   * Call once per type during initialization.
   */
  captureAtlas(
    renderer: THREE.WebGLRenderer,
    type: string,
    createMesh: () => THREE.Group,
    objectHeight: number = 2
  ): void {
    if (this.types.has(type)) return

    const meshGroup = createMesh()

    // Compute bounding box to center the capture
    const box = new THREE.Box3().setFromObject(meshGroup)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    // Setup orthographic camera to fit the object
    const halfSize = maxDim * 0.6
    this.captureCamera.left = -halfSize
    this.captureCamera.right = halfSize
    this.captureCamera.top = halfSize
    this.captureCamera.bottom = -halfSize
    this.captureCamera.updateProjectionMatrix()

    this.captureScene.add(meshGroup)

    // Save current renderer state
    const currentTarget = renderer.getRenderTarget()
    const currentClearColor = new THREE.Color()
    renderer.getClearColor(currentClearColor)
    const currentClearAlpha = renderer.getClearAlpha()

    renderer.setRenderTarget(this.renderTarget)
    renderer.setClearColor(0x000000, 0)

    // Render from ATLAS_VIEWS angles
    for (let i = 0; i < ATLAS_VIEWS; i++) {
      const angle = (i / ATLAS_VIEWS) * Math.PI * 2
      const dist = maxDim * 2

      this.captureCamera.position.set(
        center.x + Math.sin(angle) * dist,
        center.y + size.y * 0.3,
        center.z + Math.cos(angle) * dist
      )
      this.captureCamera.lookAt(center)

      // Set viewport for this angle's cell in the atlas
      const col = i % (ATLAS_SIZE / ATLAS_CELL_SIZE)
      const row = Math.floor(i / (ATLAS_SIZE / ATLAS_CELL_SIZE))
      renderer.setViewport(
        col * ATLAS_CELL_SIZE,
        ATLAS_SIZE - (row + 1) * ATLAS_CELL_SIZE,
        ATLAS_CELL_SIZE,
        ATLAS_CELL_SIZE
      )
      renderer.setScissor(
        col * ATLAS_CELL_SIZE,
        ATLAS_SIZE - (row + 1) * ATLAS_CELL_SIZE,
        ATLAS_CELL_SIZE,
        ATLAS_CELL_SIZE
      )
      renderer.setScissorTest(true)
      renderer.clear()
      renderer.render(this.captureScene, this.captureCamera)
    }

    // Restore state
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height)
    renderer.setRenderTarget(currentTarget)
    renderer.setClearColor(currentClearColor, currentClearAlpha)

    this.captureScene.remove(meshGroup)

    // Dispose the template mesh
    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
        else child.material?.dispose()
      }
    })

    // Read the atlas texture from the render target
    const atlas = this.renderTarget.texture.clone()
    atlas.needsUpdate = true

    // Create InstancedMesh for this type
    const material = new THREE.MeshBasicMaterial({
      map: atlas,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    })

    const maxCount = 256
    const instancedMesh = new THREE.InstancedMesh(this.quadGeometry, material, maxCount)
    instancedMesh.count = 0
    instancedMesh.frustumCulled = false
    this.group.add(instancedMesh)

    this.types.set(type, {
      atlas,
      instancedMesh,
      idToIndex: new Map(),
      indexToId: new Map(),
      count: 0,
      maxCount,
    })
  }

  /**
   * Update impostors for a frame.
   * Call with all objects and their distances; the system will show/hide impostors as needed.
   */
  updateImpostors(
    camera: THREE.Camera,
    objects: { id: string; type: string; position: [number, number, number]; scale: [number, number, number] }[]
  ): void {
    // For each type, rebuild instance list from objects that are beyond the threshold
    const typeBuckets = new Map<string, typeof objects>()

    for (const obj of objects) {
      const dist = camera.position.distanceTo(
        new THREE.Vector3(obj.position[0], obj.position[1], obj.position[2])
      )
      if (dist < IMPOSTOR_DISTANCE) continue

      const bucket = typeBuckets.get(obj.type) || []
      bucket.push(obj)
      typeBuckets.set(obj.type, bucket)
    }

    for (const [type, pool] of this.types) {
      const bucket = typeBuckets.get(type) || []
      pool.count = 0
      pool.idToIndex.clear()
      pool.indexToId.clear()

      // Grow if needed
      if (bucket.length > pool.maxCount) {
        const newMax = Math.max(bucket.length * 2, pool.maxCount * 2)
        const newMesh = new THREE.InstancedMesh(this.quadGeometry, pool.instancedMesh.material, newMax)
        newMesh.frustumCulled = false
        this.group.remove(pool.instancedMesh)
        pool.instancedMesh.dispose()
        pool.instancedMesh = newMesh
        pool.maxCount = newMax
        this.group.add(newMesh)
      }

      for (const obj of bucket) {
        const idx = pool.count
        pool.idToIndex.set(obj.id, idx)
        pool.indexToId.set(idx, obj.id)

        // Billboard: quad faces camera
        const matrix = new THREE.Matrix4()
        const pos = new THREE.Vector3(obj.position[0], obj.position[1] + obj.scale[1] * 0.5, obj.position[2])
        const scale = new THREE.Vector3(obj.scale[0] * 2, obj.scale[1] * 2, 1)

        // Make the quad face the camera
        const lookAt = new THREE.Matrix4().lookAt(pos, camera.position, new THREE.Vector3(0, 1, 0))
        const q = new THREE.Quaternion().setFromRotationMatrix(lookAt)
        matrix.compose(pos, q, scale)
        pool.instancedMesh.setMatrixAt(idx, matrix)

        pool.count++
      }

      pool.instancedMesh.count = pool.count
      pool.instancedMesh.instanceMatrix.needsUpdate = true
    }
  }

  dispose(): void {
    this.quadGeometry.dispose()
    this.renderTarget.dispose()

    for (const pool of this.types.values()) {
      this.group.remove(pool.instancedMesh)
      pool.instancedMesh.geometry.dispose()
      if (Array.isArray(pool.instancedMesh.material)) {
        pool.instancedMesh.material.forEach(m => m.dispose())
      } else {
        pool.instancedMesh.material.dispose()
      }
      pool.atlas.dispose()
    }
    this.types.clear()
  }
}
