import * as THREE from 'three'
import { WorldObject, TerrainData, terrainIndex } from '@/types/world'
import { getCatalogEntry, OBJECT_CATALOG } from './objectCatalog'

// ── GPU Instanced Mesh Pool ────────────────────────────────

interface InstancePool {
  mesh: THREE.InstancedMesh
  idToIndex: Map<string, number>  // objectId → instance index
  indexToId: Map<number, string>  // instance index → objectId
  count: number
  maxCount: number
}

class InstancedObjectPool {
  private pools: Map<string, InstancePool> = new Map()
  private group: THREE.Group
  private templateGeometries: Map<string, THREE.BufferGeometry> = new Map()
  private templateMaterials: Map<string, THREE.Material> = new Map()

  constructor(group: THREE.Group) {
    this.group = group
  }

  /** Check if a type has a cached template (is instanceable) */
  isInstanceable(type: string): boolean {
    // Custom items are not instanceable — their geometry varies per-instance
    return !type.startsWith('custom:') && !!OBJECT_CATALOG[type]
  }

  /** Add or update an instanced object. Returns true if handled. */
  addInstance(obj: WorldObject, terrain: TerrainData, getTerrainHeight: (wx: number, wz: number, t: TerrainData) => number): boolean {
    if (!this.isInstanceable(obj.type)) return false

    let pool = this.pools.get(obj.type)

    // Create pool if it doesn't exist
    if (!pool) {
      const newPool = this.createPool(obj.type, obj.color)
      if (!newPool) return false
      this.pools.set(obj.type, newPool)
      pool = newPool
    }

    // If this object is already instanced, just update its transform
    if (pool.idToIndex.has(obj.id)) {
      const idx = pool.idToIndex.get(obj.id)!
      this.setInstanceTransform(pool, idx, obj, terrain, getTerrainHeight)
      return true
    }

    // Grow pool if needed
    if (pool.count >= pool.maxCount) {
      this.growPool(obj.type, pool)
    }

    // Add new instance
    const idx = pool.count
    pool.idToIndex.set(obj.id, idx)
    pool.indexToId.set(idx, obj.id)
    pool.count++
    pool.mesh.count = pool.count

    this.setInstanceTransform(pool, idx, obj, terrain, getTerrainHeight)
    return true
  }

  /** Remove an instanced object. Returns true if it was in a pool. */
  removeInstance(id: string, type: string): boolean {
    const pool = this.pools.get(type)
    if (!pool || !pool.idToIndex.has(id)) return false

    const removedIdx = pool.idToIndex.get(id)!
    const lastIdx = pool.count - 1

    // Swap-remove: move the last instance into the removed slot
    if (removedIdx !== lastIdx) {
      const lastId = pool.indexToId.get(lastIdx)!
      const matrix = new THREE.Matrix4()
      pool.mesh.getMatrixAt(lastIdx, matrix)
      pool.mesh.setMatrixAt(removedIdx, matrix)

      pool.idToIndex.set(lastId, removedIdx)
      pool.indexToId.set(removedIdx, lastId)
    }

    pool.idToIndex.delete(id)
    pool.indexToId.delete(lastIdx)
    pool.count--
    pool.mesh.count = pool.count
    pool.mesh.instanceMatrix.needsUpdate = true

    return true
  }

  /** Update the transform for an existing instanced object */
  updateInstanceTransform(id: string, type: string, pos: [number, number, number], rot: [number, number, number], scale: [number, number, number]): boolean {
    const pool = this.pools.get(type)
    if (!pool || !pool.idToIndex.has(id)) return false

    const idx = pool.idToIndex.get(id)!
    const matrix = new THREE.Matrix4()
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]))
    matrix.compose(
      new THREE.Vector3(pos[0], pos[1], pos[2]),
      q,
      new THREE.Vector3(scale[0], scale[1], scale[2])
    )
    pool.mesh.setMatrixAt(idx, matrix)
    pool.mesh.instanceMatrix.needsUpdate = true
    return true
  }

  /** Get the object ID at a given instance index for a type */
  getObjectIdAtIndex(type: string, index: number): string | null {
    const pool = this.pools.get(type)
    if (!pool) return null
    return pool.indexToId.get(index) ?? null
  }

  /** Find object ID from a raycast intersection with an InstancedMesh */
  findObjectIdFromInstancedHit(mesh: THREE.InstancedMesh, instanceId: number): string | null {
    for (const [type, pool] of this.pools) {
      if (pool.mesh === mesh) {
        return pool.indexToId.get(instanceId) ?? null
      }
    }
    return null
  }

  /** Get all InstancedMesh objects for raycasting */
  getPickableMeshes(): THREE.InstancedMesh[] {
    const meshes: THREE.InstancedMesh[] = []
    for (const pool of this.pools.values()) {
      if (pool.count > 0) meshes.push(pool.mesh)
    }
    return meshes
  }

  dispose(): void {
    for (const pool of this.pools.values()) {
      this.group.remove(pool.mesh)
      pool.mesh.geometry.dispose()
      if (Array.isArray(pool.mesh.material)) {
        pool.mesh.material.forEach(m => m.dispose())
      } else {
        pool.mesh.material.dispose()
      }
    }
    this.pools.clear()
    for (const geo of this.templateGeometries.values()) geo.dispose()
    for (const mat of this.templateMaterials.values()) mat.dispose()
    this.templateGeometries.clear()
    this.templateMaterials.clear()
  }

  // ── Private ──────────────────────────────────────────────

  private createPool(type: string, _color: string): InstancePool | null {
    const entry = getCatalogEntry(type)
    if (!entry) return null

    // Create a template mesh to extract geometry + material
    const templateGroup = entry.createMesh(entry.defaultColor)

    // Collect all mesh children
    const meshes: THREE.Mesh[] = []
    templateGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child)
    })

    if (meshes.length === 0) return null

    let mergedGeo: THREE.BufferGeometry
    let mergedMat: THREE.Material

    if (meshes.length > 1) {
      // Merge all child meshes into one geometry for instancing
      const mergedGeometries: THREE.BufferGeometry[] = []
      for (const m of meshes) {
        const g = m.geometry.clone()
        // Apply the mesh's local position to the geometry
        const posMatrix = new THREE.Matrix4().makeTranslation(m.position.x, m.position.y, m.position.z)
        g.applyMatrix4(posMatrix)
        mergedGeometries.push(g)
      }
      mergedGeo = this.mergeGeometries(mergedGeometries)
      mergedMat = new THREE.MeshLambertMaterial({ vertexColors: true })

      for (const g of mergedGeometries) g.dispose()
    } else {
      const singleMesh = meshes[0]
      mergedGeo = singleMesh.geometry.clone()
      if (singleMesh.position.lengthSq() > 0) {
        mergedGeo.translate(singleMesh.position.x, singleMesh.position.y, singleMesh.position.z)
      }
      mergedMat = (singleMesh.material as THREE.Material).clone()
    }

    // Dispose template
    templateGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) child.material.forEach(mt => mt.dispose())
        else child.material?.dispose()
      }
    })

    const maxCount = 256  // initial capacity, grows on demand
    const instancedMesh = new THREE.InstancedMesh(mergedGeo, mergedMat, maxCount)
    instancedMesh.count = 0
    instancedMesh.frustumCulled = false  // We handle culling manually
    instancedMesh.userData.instancedType = type
    this.group.add(instancedMesh)

    return {
      mesh: instancedMesh,
      idToIndex: new Map(),
      indexToId: new Map(),
      count: 0,
      maxCount,
    }
  }

  private growPool(type: string, pool: InstancePool): void {
    const newMax = pool.maxCount * 2
    const newMesh = new THREE.InstancedMesh(pool.mesh.geometry, pool.mesh.material, newMax)
    newMesh.count = pool.count
    newMesh.frustumCulled = false
    newMesh.userData.instancedType = type

    // Copy existing instance matrices
    for (let i = 0; i < pool.count; i++) {
      const m = new THREE.Matrix4()
      pool.mesh.getMatrixAt(i, m)
      newMesh.setMatrixAt(i, m)
    }
    newMesh.instanceMatrix.needsUpdate = true

    this.group.remove(pool.mesh)
    pool.mesh.dispose()
    pool.mesh = newMesh
    pool.maxCount = newMax
    this.group.add(newMesh)
  }

  private setInstanceTransform(
    pool: InstancePool,
    idx: number,
    obj: WorldObject,
    terrain: TerrainData,
    getTerrainHeight: (wx: number, wz: number, t: TerrainData) => number
  ): void {
    const [px, py, pz] = obj.position
    const terrainY = getTerrainHeight(px, pz, terrain)
    const y = py !== 0 ? py : terrainY

    const matrix = new THREE.Matrix4()
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2]))
    matrix.compose(
      new THREE.Vector3(px, y, pz),
      q,
      new THREE.Vector3(obj.scale[0], obj.scale[1], obj.scale[2])
    )
    pool.mesh.setMatrixAt(idx, matrix)
    pool.mesh.instanceMatrix.needsUpdate = true
  }

  private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    let totalVerts = 0
    let totalIndices = 0
    for (const g of geometries) {
      totalVerts += g.getAttribute('position').count
      totalIndices += g.index ? g.index.count : g.getAttribute('position').count
    }

    const positions = new Float32Array(totalVerts * 3)
    const normals = new Float32Array(totalVerts * 3)
    const colors = new Float32Array(totalVerts * 3)
    const indices = new Uint32Array(totalIndices)

    let vertOffset = 0
    let idxOffset = 0
    let vertCount = 0

    for (const g of geometries) {
      const pos = g.getAttribute('position')
      const norm = g.getAttribute('normal')
      const col = g.getAttribute('color')

      for (let i = 0; i < pos.count; i++) {
        positions[(vertCount + i) * 3] = pos.getX(i)
        positions[(vertCount + i) * 3 + 1] = pos.getY(i)
        positions[(vertCount + i) * 3 + 2] = pos.getZ(i)

        if (norm) {
          normals[(vertCount + i) * 3] = norm.getX(i)
          normals[(vertCount + i) * 3 + 1] = norm.getY(i)
          normals[(vertCount + i) * 3 + 2] = norm.getZ(i)
        }

        if (col) {
          colors[(vertCount + i) * 3] = col.getX(i)
          colors[(vertCount + i) * 3 + 1] = col.getY(i)
          colors[(vertCount + i) * 3 + 2] = col.getZ(i)
        } else {
          // Extract color from material
          const mat = (g as any)._material
          colors[(vertCount + i) * 3] = 0.5
          colors[(vertCount + i) * 3 + 1] = 0.5
          colors[(vertCount + i) * 3 + 2] = 0.5
        }
      }

      if (g.index) {
        for (let i = 0; i < g.index.count; i++) {
          indices[idxOffset + i] = g.index.getX(i) + vertCount
        }
        idxOffset += g.index.count
      } else {
        for (let i = 0; i < pos.count; i++) {
          indices[idxOffset + i] = vertCount + i
        }
        idxOffset += pos.count
      }

      vertCount += pos.count
    }

    const merged = new THREE.BufferGeometry()
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    merged.setIndex(new THREE.BufferAttribute(indices.slice(0, idxOffset), 1))
    merged.computeVertexNormals()
    return merged
  }
}

// ── Object Manager (with instancing + diff sync) ──────────

/**
 * Manages rendering of WorldObjects in the 3D scene.
 * Uses GPU instancing for catalog objects, individual meshes for custom items.
 * Diff-based sync: adding 1 object doesn't destroy 99 existing ones.
 */
export class ObjectManager {
  private group: THREE.Group
  private objectMeshes: Map<string, THREE.Group> = new Map()  // custom/non-instanced objects only
  private objectTypes: Map<string, string> = new Map()  // objectId → type (for all objects)
  private selectedIds: Set<string> = new Set()
  private outlineMeshes: Map<string, THREE.Mesh[]> = new Map()
  private instancePool: InstancedObjectPool

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'world-objects'
    this.instancePool = new InstancedObjectPool(this.group)
  }

  getGroup(): THREE.Group {
    return this.group
  }

  /** Diff-based sync: only add/remove/update what changed */
  syncObjects(objects: WorldObject[], terrain: TerrainData): void {
    const newIds = new Set<string>()
    const newObjectMap = new Map<string, WorldObject>()

    for (const obj of objects) {
      if (obj.visible) {
        newIds.add(obj.id)
        newObjectMap.set(obj.id, obj)
      }
    }

    // Remove objects that no longer exist
    const oldIds = new Set(this.objectTypes.keys())
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        this.removeObject(id)
      }
    }

    // Add new objects, update existing transforms
    for (const obj of objects) {
      if (!obj.visible) continue

      if (this.objectTypes.has(obj.id)) {
        // Existing object — update transform only
        this.updateObjectTransform(obj.id, obj.position, obj.rotation, obj.scale)
      } else {
        // New object
        this.addObject(obj, terrain)
      }
    }
  }

  /** Add a single object */
  addObject(obj: WorldObject, terrain: TerrainData): void {
    this.objectTypes.set(obj.id, obj.type)

    // Try GPU instancing first
    if (this.instancePool.addInstance(obj, terrain, this.getTerrainHeight.bind(this))) {
      // Handled by instancing pool
      if (this.selectedIds.has(obj.id)) {
        // TODO: Instance selection highlighting (overlay approach)
      }
      return
    }

    // Fallback: individual mesh (custom items)
    const entry = getCatalogEntry(obj.type)
    if (!entry) return

    const meshGroup = entry.createMesh(obj.color)
    meshGroup.name = `obj-${obj.id}`
    meshGroup.userData.objectId = obj.id
    meshGroup.userData.objectType = obj.type

    const [px, py, pz] = obj.position
    const terrainY = this.getTerrainHeight(px, pz, terrain)
    meshGroup.position.set(px, py !== 0 ? py : terrainY, pz)
    meshGroup.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2])
    meshGroup.scale.set(obj.scale[0], obj.scale[1], obj.scale[2])

    meshGroup.traverse((child) => {
      child.userData.objectId = obj.id
    })

    this.objectMeshes.set(obj.id, meshGroup)
    this.group.add(meshGroup)

    if (this.selectedIds.has(obj.id)) {
      this.addOutline(obj.id, meshGroup)
    }
  }

  /** Remove a single object */
  removeObject(id: string): void {
    const type = this.objectTypes.get(id)
    this.objectTypes.delete(id)

    // Try instanced pool first
    if (type && this.instancePool.removeInstance(id, type)) {
      this.removeOutline(id)
      return
    }

    // Fallback: individual mesh
    this.removeOutline(id)
    const mesh = this.objectMeshes.get(id)
    if (mesh) {
      this.group.remove(mesh)
      this.disposeMeshGroup(mesh)
      this.objectMeshes.delete(id)
    }
  }

  /** Set which objects are selected (edge outline) */
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

  /** Get all meshes suitable for raycasting (individual + instanced) */
  getPickableMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = []
    // Individual meshes
    for (const group of this.objectMeshes.values()) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child)
        }
      })
    }
    // Instanced meshes
    for (const im of this.instancePool.getPickableMeshes()) {
      meshes.push(im)
    }
    return meshes
  }

  /** Walk parent chain of a raycast hit to find the object ID */
  findObjectIdFromIntersection(hit: THREE.Intersection): string | null {
    // Check if it's an InstancedMesh hit
    if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
      return this.instancePool.findObjectIdFromInstancedHit(hit.object, hit.instanceId)
    }

    // Individual mesh: walk parent chain
    let current: THREE.Object3D | null = hit.object
    while (current) {
      if (current.userData.objectId) {
        return current.userData.objectId as string
      }
      current = current.parent
    }
    return null
  }

  /** Update an object's transform in the scene */
  updateObjectTransform(
    id: string,
    pos: [number, number, number],
    rot: [number, number, number],
    scale: [number, number, number]
  ): void {
    const type = this.objectTypes.get(id)

    // Try instanced pool
    if (type && this.instancePool.updateInstanceTransform(id, type, pos, rot, scale)) {
      return
    }

    // Individual mesh
    const mesh = this.objectMeshes.get(id)
    if (!mesh) return
    mesh.position.set(pos[0], pos[1], pos[2])
    mesh.rotation.set(rot[0], rot[1], rot[2])
    mesh.scale.set(scale[0], scale[1], scale[2])

    if (this.selectedIds.has(id)) {
      this.removeOutline(id)
      this.addOutline(id, mesh)
    }
  }

  /** Dispose everything */
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

  private addOutline(id: string, meshGroup: THREE.Group): void {
    const outlines: THREE.Mesh[] = []
    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.userData.isOutline) {
        const outlineGeo = child.geometry.clone()
        const outlineMat = new THREE.MeshBasicMaterial({
          color: 0x4488ff,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.5,
        })
        const outline = new THREE.Mesh(outlineGeo, outlineMat)
        outline.userData.isOutline = true
        outline.scale.multiplyScalar(1.08)
        outline.position.copy(child.position)
        outline.rotation.copy(child.rotation)
        outline.renderOrder = -1
        meshGroup.add(outline)
        outlines.push(outline)
      }
    })
    this.outlineMeshes.set(id, outlines)
  }

  private removeOutline(id: string): void {
    const outlines = this.outlineMeshes.get(id)
    if (!outlines) return
    const meshGroup = this.objectMeshes.get(id)
    for (const outline of outlines) {
      if (meshGroup) meshGroup.remove(outline)
      outline.geometry.dispose()
      ;(outline.material as THREE.Material).dispose()
    }
    this.outlineMeshes.delete(id)
  }

  private disposeMeshGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }

  private disposeAll(): void {
    for (const [id] of this.outlineMeshes) {
      this.removeOutline(id)
    }
    for (const [, mesh] of this.objectMeshes) {
      this.group.remove(mesh)
      this.disposeMeshGroup(mesh)
    }
    this.objectMeshes.clear()
    this.outlineMeshes.clear()
    this.objectTypes.clear()
    this.instancePool.dispose()
  }
}
