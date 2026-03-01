import {
  Mesh,
  MeshBuilder,
  Matrix,
  Vector3,
  Quaternion,
  TransformNode,
  StandardMaterial,
  RenderTargetTexture,
  Scene,
  HemisphericLight,
  DirectionalLight,
  FreeCamera,
  Color3,
  Color4,
  type Camera,
} from '@babylonjs/core'

/**
 * Billboard impostor system for distant objects.
 * Uses Babylon.js RenderTargetTexture for atlas capture
 * and thin instances for efficient billboard rendering.
 */

const IMPOSTOR_DISTANCE = 200
const ATLAS_VIEWS = 8
const ATLAS_CELL_SIZE = 64
const ATLAS_SIZE = 512

interface ImpostorType {
  atlas: RenderTargetTexture
  mesh: Mesh
  idToIndex: Map<string, number>
  indexToId: Map<number, string>
  count: number
}

export class ImpostorSystem {
  private parent: TransformNode
  private types: Map<string, ImpostorType> = new Map()
  private scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
    this.parent = new TransformNode('impostors', scene)
  }

  getParent(): TransformNode {
    return this.parent
  }

  getThreshold(): number {
    return IMPOSTOR_DISTANCE
  }

  captureAtlas(
    type: string,
    createMesh: (scene: Scene) => TransformNode,
    _objectHeight: number = 2
  ): void {
    if (this.types.has(type)) return

    // Create a temporary capture scene
    const captureScene = new Scene(this.scene.getEngine())
    captureScene.clearColor = new Color4(0, 0, 0, 0)

    const ambientLight = new HemisphericLight('capAmb', new Vector3(0, 1, 0), captureScene)
    ambientLight.intensity = 1
    const dirLight = new DirectionalLight('capDir', new Vector3(-1, -1, -1), captureScene)
    dirLight.intensity = 0.5

    const meshNode = createMesh(captureScene)

    // Compute bounding box
    let minVec = new Vector3(Infinity, Infinity, Infinity)
    let maxVec = new Vector3(-Infinity, -Infinity, -Infinity)
    meshNode.getChildMeshes(false).forEach(child => {
      child.computeWorldMatrix(true)
      const bb = child.getBoundingInfo().boundingBox
      minVec = Vector3.Minimize(minVec, bb.minimumWorld)
      maxVec = Vector3.Maximize(maxVec, bb.maximumWorld)
    })
    const center = Vector3.Center(minVec, maxVec)
    const size = maxVec.subtract(minVec)
    const maxDim = Math.max(size.x, size.y, size.z)

    // Create orthographic camera
    const halfSize = maxDim * 0.6
    const captureCamera = new FreeCamera('capCam', Vector3.Zero(), captureScene)
    captureCamera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA
    captureCamera.orthoLeft = -halfSize
    captureCamera.orthoRight = halfSize
    captureCamera.orthoTop = halfSize
    captureCamera.orthoBottom = -halfSize
    captureCamera.minZ = 0.1
    captureCamera.maxZ = 100

    // Create render target for the atlas
    const rtt = new RenderTargetTexture(`atlas-${type}`, ATLAS_SIZE, captureScene, false)
    rtt.hasAlpha = true

    // Render from multiple angles into the atlas
    // Note: Full atlas capture with viewport control is complex in Babylon.js
    // For now, we capture a single front view - can be extended later
    const dist = maxDim * 2
    captureCamera.position = new Vector3(center.x, center.y + size.y * 0.3, center.z + dist)
    captureCamera.setTarget(center)

    meshNode.getChildMeshes(false).forEach(child => {
      rtt.renderList?.push(child)
    })

    captureScene.render()

    // Cleanup capture scene
    meshNode.dispose()
    captureScene.dispose()

    // Create billboard quad mesh
    const quad = MeshBuilder.CreatePlane(`impostor-${type}`, { size: 1 }, this.scene)
    quad.billboardMode = Mesh.BILLBOARDMODE_ALL
    quad.parent = this.parent

    const mat = new StandardMaterial(`impostor-mat-${type}`, this.scene)
    mat.diffuseColor = Color3.White()
    mat.alpha = 1
    mat.backFaceCulling = false
    quad.material = mat

    this.types.set(type, {
      atlas: rtt,
      mesh: quad,
      idToIndex: new Map(),
      indexToId: new Map(),
      count: 0,
    })
  }

  updateImpostors(
    camera: Camera,
    objects: { id: string; type: string; position: [number, number, number]; scale: [number, number, number] }[]
  ): void {
    const camPos = camera.position

    for (const [type, pool] of this.types) {
      pool.count = 0
      pool.idToIndex.clear()
      pool.indexToId.clear()

      const matrices: Matrix[] = []

      for (const obj of objects) {
        if (obj.type !== type) continue

        const pos = new Vector3(obj.position[0], obj.position[1], obj.position[2])
        const dist = Vector3.Distance(camPos, pos)
        if (dist < IMPOSTOR_DISTANCE) continue

        const idx = pool.count
        pool.idToIndex.set(obj.id, idx)
        pool.indexToId.set(idx, obj.id)

        const billboardPos = new Vector3(
          obj.position[0],
          obj.position[1] + obj.scale[1] * 0.5,
          obj.position[2]
        )
        const scale = new Vector3(obj.scale[0] * 2, obj.scale[1] * 2, 1)

        matrices.push(Matrix.Compose(
          scale,
          Quaternion.Identity(),
          billboardPos
        ))

        pool.count++
      }

      // Apply thin instances
      if (matrices.length > 0) {
        const buf = new Float32Array(matrices.length * 16)
        matrices.forEach((m, i) => {
          m.copyToArray(buf, i * 16)
        })
        pool.mesh.thinInstanceSetBuffer('matrix', buf, 16)
      } else {
        pool.mesh.thinInstanceCount = 0
      }
    }
  }

  dispose(): void {
    for (const pool of this.types.values()) {
      pool.mesh.dispose()
      pool.atlas.dispose()
    }
    this.types.clear()
    this.parent.dispose()
  }
}
