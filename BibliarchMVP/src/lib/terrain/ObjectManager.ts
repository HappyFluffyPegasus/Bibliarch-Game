import {
  Mesh,
  Matrix,
  Vector3,
  Quaternion,
  TransformNode,
  StandardMaterial,
  Color3,
  Scene,
  type AbstractMesh,
  type PickingInfo,
} from '@babylonjs/core'
import { WorldObject, TerrainData, terrainIndex } from '@/types/world'
import { getCatalogEntry, OBJECT_CATALOG } from './objectCatalog'

// ── Thin Instance Object Pool ────────────────────────────────

interface ThinInstancePool {
  mesh: Mesh
  idToIndex: Map<string, number>
  indexToId: Map<number, string>
  count: number
}

class ThinInstanceObjectPool {
  private pools: Map<string, ThinInstancePool> = new Map()
  private parent: TransformNode
  private scene: Scene

  constructor(parent: TransformNode, scene: Scene) {
    this.parent = parent
    this.scene = scene
  }

  isInstanceable(type: string): boolean {
    return !type.startsWith('custom:') && !!OBJECT_CATALOG[type]
  }

  addInstance(obj: WorldObject, terrain: TerrainData, getTerrainHeight: (wx: number, wz: number, t: TerrainData) => number): boolean {
    if (!this.isInstanceable(obj.type)) return false

    let pool = this.pools.get(obj.type)

    if (!pool) {
      const newPool = this.createPool(obj.type, obj.color)
      if (!newPool) return false
      this.pools.set(obj.type, newPool)
      pool = newPool
    }

    if (pool.idToIndex.has(obj.id)) {
      const idx = pool.idToIndex.get(obj.id)!
      this.setInstanceTransform(pool, idx, obj, terrain, getTerrainHeight)
      return true
    }

    const idx = pool.count
    pool.idToIndex.set(obj.id, idx)
    pool.indexToId.set(idx, obj.id)
    pool.count++

    this.setInstanceTransform(pool, idx, obj, terrain, getTerrainHeight)
    return true
  }

  removeInstance(id: string, type: string): boolean {
    const pool = this.pools.get(type)
    if (!pool || !pool.idToIndex.has(id)) return false

    const removedIdx = pool.idToIndex.get(id)!
    const lastIdx = pool.count - 1

    // Swap-remove
    if (removedIdx !== lastIdx) {
      const lastId = pool.indexToId.get(lastIdx)!
      const matrices = pool.mesh.thinInstanceGetWorldMatrices()
      pool.mesh.thinInstanceSetMatrixAt(removedIdx, matrices[lastIdx], false)

      pool.idToIndex.set(lastId, removedIdx)
      pool.indexToId.set(removedIdx, lastId)
    }

    pool.idToIndex.delete(id)
    pool.indexToId.delete(lastIdx)
    pool.count--

    // Update count by removing last instance
    if (pool.count === 0) {
      pool.mesh.thinInstanceCount = 0
    } else {
      // Rebuild thin instances with new count
      pool.mesh.thinInstanceCount = pool.count
    }
    pool.mesh.thinInstanceRefreshBoundingInfo(false)

    return true
  }

  updateInstanceTransform(id: string, type: string, pos: [number, number, number], rot: [number, number, number], scale: [number, number, number]): boolean {
    const pool = this.pools.get(type)
    if (!pool || !pool.idToIndex.has(id)) return false

    const idx = pool.idToIndex.get(id)!
    const matrix = Matrix.Compose(
      new Vector3(scale[0], scale[1], scale[2]),
      Quaternion.FromEulerAngles(rot[0], rot[1], rot[2]),
      new Vector3(pos[0], pos[1], pos[2])
    )
    pool.mesh.thinInstanceSetMatrixAt(idx, matrix, idx === pool.count - 1)
    return true
  }

  findObjectIdFromThinInstanceHit(mesh: Mesh, thinInstanceIndex: number): string | null {
    for (const [_type, pool] of this.pools) {
      if (pool.mesh === mesh) {
        return pool.indexToId.get(thinInstanceIndex) ?? null
      }
    }
    return null
  }

  getPickableMeshes(): Mesh[] {
    const meshes: Mesh[] = []
    for (const pool of this.pools.values()) {
      if (pool.count > 0) meshes.push(pool.mesh)
    }
    return meshes
  }

  dispose(): void {
    for (const pool of this.pools.values()) {
      pool.mesh.dispose()
    }
    this.pools.clear()
  }

  // ── Private ──────────────────────────────────────────────

  private createPool(type: string, _color: string): ThinInstancePool | null {
    const entry = getCatalogEntry(type)
    if (!entry) return null

    const templateNode = entry.createMesh(entry.defaultColor, this.scene)

    // Collect all mesh children
    const meshes: Mesh[] = []
    templateNode.getChildMeshes(false).forEach(child => {
      if (child instanceof Mesh) meshes.push(child)
    })

    if (meshes.length === 0) {
      templateNode.dispose()
      return null
    }

    // Use the first mesh as the instance source (or merge if multiple)
    let sourceMesh: Mesh
    if (meshes.length > 1) {
      sourceMesh = Mesh.MergeMeshes(meshes, true, true, undefined, false, true) || meshes[0]
      sourceMesh.name = `instanced-${type}`
    } else {
      sourceMesh = meshes[0].clone(`instanced-${type}`)
      sourceMesh.parent = null
    }

    // Dispose template
    templateNode.dispose()

    sourceMesh.parent = this.parent
    sourceMesh.isPickable = true
    sourceMesh.metadata = { instancedType: type }

    return {
      mesh: sourceMesh,
      idToIndex: new Map(),
      indexToId: new Map(),
      count: 0,
    }
  }

  private setInstanceTransform(
    pool: ThinInstancePool,
    idx: number,
    obj: WorldObject,
    terrain: TerrainData,
    getTerrainHeight: (wx: number, wz: number, t: TerrainData) => number
  ): void {
    const [px, py, pz] = obj.position
    const terrainY = getTerrainHeight(px, pz, terrain)
    const y = py !== 0 ? py : terrainY

    const matrix = Matrix.Compose(
      new Vector3(obj.scale[0], obj.scale[1], obj.scale[2]),
      Quaternion.FromEulerAngles(obj.rotation[0], obj.rotation[1], obj.rotation[2]),
      new Vector3(px, y, pz)
    )

    const isLast = idx >= pool.count - 1
    if (idx < pool.count) {
      pool.mesh.thinInstanceSetMatrixAt(idx, matrix, isLast)
    } else {
      pool.mesh.thinInstanceAdd(matrix)
    }
  }
}

// ── Object Manager (with thin instancing + diff sync) ──────

export class ObjectManager {
  private parent: TransformNode
  private objectMeshes: Map<string, TransformNode> = new Map()
  private objectTypes: Map<string, string> = new Map()
  private selectedIds: Set<string> = new Set()
  private outlineMeshes: Map<string, Mesh[]> = new Map()
  private instancePool: ThinInstanceObjectPool
  private scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
    this.parent = new TransformNode('world-objects', scene)
    this.instancePool = new ThinInstanceObjectPool(this.parent, scene)
  }

  getParent(): TransformNode {
    return this.parent
  }

  syncObjects(objects: WorldObject[], terrain: TerrainData): void {
    const newIds = new Set<string>()

    for (const obj of objects) {
      if (obj.visible) {
        newIds.add(obj.id)
      }
    }

    const oldIds = new Set(this.objectTypes.keys())
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        this.removeObject(id)
      }
    }

    for (const obj of objects) {
      if (!obj.visible) continue
      if (this.objectTypes.has(obj.id)) {
        this.updateObjectTransform(obj.id, obj.position, obj.rotation, obj.scale)
      } else {
        this.addObject(obj, terrain)
      }
    }
  }

  addObject(obj: WorldObject, terrain: TerrainData): void {
    this.objectTypes.set(obj.id, obj.type)

    if (this.instancePool.addInstance(obj, terrain, this.getTerrainHeight.bind(this))) {
      return
    }

    const entry = getCatalogEntry(obj.type)
    if (!entry) return

    const meshNode = entry.createMesh(obj.color, this.scene)
    meshNode.name = `obj-${obj.id}`
    meshNode.metadata = { objectId: obj.id, objectType: obj.type }

    const [px, py, pz] = obj.position
    const terrainY = this.getTerrainHeight(px, pz, terrain)
    meshNode.position = new Vector3(px, py !== 0 ? py : terrainY, pz)
    meshNode.rotation = new Vector3(obj.rotation[0], obj.rotation[1], obj.rotation[2])
    meshNode.scaling = new Vector3(obj.scale[0], obj.scale[1], obj.scale[2])

    meshNode.getChildMeshes(false).forEach(child => {
      child.metadata = { ...child.metadata, objectId: obj.id }
    })

    meshNode.parent = this.parent
    this.objectMeshes.set(obj.id, meshNode)

    if (this.selectedIds.has(obj.id)) {
      this.addOutline(obj.id, meshNode)
    }
  }

  removeObject(id: string): void {
    const type = this.objectTypes.get(id)
    this.objectTypes.delete(id)

    if (type && this.instancePool.removeInstance(id, type)) {
      this.removeOutline(id)
      return
    }

    this.removeOutline(id)
    const meshNode = this.objectMeshes.get(id)
    if (meshNode) {
      meshNode.dispose()
      this.objectMeshes.delete(id)
    }
  }

  setSelectedIds(ids: string[]): void {
    for (const oldId of this.selectedIds) {
      if (!ids.includes(oldId)) {
        this.removeOutline(oldId)
      }
    }
    for (const newId of ids) {
      if (!this.selectedIds.has(newId)) {
        const mesh = this.objectMeshes.get(newId)
        if (mesh) this.addOutline(newId, mesh)
      }
    }
    this.selectedIds = new Set(ids)
  }

  getPickableMeshes(): AbstractMesh[] {
    const meshes: AbstractMesh[] = []
    for (const node of this.objectMeshes.values()) {
      node.getChildMeshes(false).forEach(child => {
        meshes.push(child)
      })
    }
    for (const im of this.instancePool.getPickableMeshes()) {
      meshes.push(im)
    }
    return meshes
  }

  findObjectIdFromPick(pickInfo: PickingInfo): string | null {
    if (!pickInfo.hit || !pickInfo.pickedMesh) return null

    // Check thin instance hit
    if (pickInfo.thinInstanceIndex !== undefined && pickInfo.thinInstanceIndex >= 0) {
      return this.instancePool.findObjectIdFromThinInstanceHit(
        pickInfo.pickedMesh as Mesh,
        pickInfo.thinInstanceIndex
      )
    }

    // Walk parent chain for individual meshes
    let current: any = pickInfo.pickedMesh
    while (current) {
      if (current.metadata?.objectId) {
        return current.metadata.objectId as string
      }
      current = current.parent
    }
    return null
  }

  updateObjectTransform(
    id: string,
    pos: [number, number, number],
    rot: [number, number, number],
    scale: [number, number, number]
  ): void {
    const type = this.objectTypes.get(id)
    if (type && this.instancePool.updateInstanceTransform(id, type, pos, rot, scale)) {
      return
    }

    const meshNode = this.objectMeshes.get(id)
    if (!meshNode) return
    meshNode.position = new Vector3(pos[0], pos[1], pos[2])
    meshNode.rotation = new Vector3(rot[0], rot[1], rot[2])
    meshNode.scaling = new Vector3(scale[0], scale[1], scale[2])

    if (this.selectedIds.has(id)) {
      this.removeOutline(id)
      this.addOutline(id, meshNode)
    }
  }

  dispose(): void {
    this.disposeAll()
  }

  // ── Private ──────────────────────────────────────────────

  private getTerrainHeight(worldX: number, worldZ: number, terrain: TerrainData): number {
    const gx = Math.round(worldX / terrain.cellSize)
    const gz = Math.round(worldZ / terrain.cellSize)
    if (gx < 0 || gx >= terrain.size || gz < 0 || gz >= terrain.sizeZ) return 0
    return terrain.heights[terrainIndex(gx, gz, terrain.size)] * terrain.maxHeight
  }

  private addOutline(id: string, meshNode: TransformNode): void {
    const outlines: Mesh[] = []
    meshNode.getChildMeshes(false).forEach(child => {
      if (child instanceof Mesh && !child.metadata?.isOutline) {
        const outline = child.clone(`outline-${id}`)
        if (outline) {
          const mat = new StandardMaterial(`outline-mat-${id}`, this.scene)
          mat.diffuseColor = new Color3(0.267, 0.533, 1)
          mat.alpha = 0.5
          mat.backFaceCulling = false
          outline.material = mat
          outline.metadata = { isOutline: true }
          outline.scaling.scaleInPlace(1.08)
          outline.renderingGroupId = 0
          outline.parent = meshNode
          outlines.push(outline)
        }
      }
    })
    this.outlineMeshes.set(id, outlines)
  }

  private removeOutline(id: string): void {
    const outlines = this.outlineMeshes.get(id)
    if (!outlines) return
    for (const outline of outlines) {
      outline.dispose()
    }
    this.outlineMeshes.delete(id)
  }

  private disposeAll(): void {
    for (const [id] of this.outlineMeshes) {
      this.removeOutline(id)
    }
    for (const [, meshNode] of this.objectMeshes) {
      meshNode.dispose()
    }
    this.objectMeshes.clear()
    this.outlineMeshes.clear()
    this.objectTypes.clear()
    this.instancePool.dispose()
  }
}
