import * as THREE from 'three'
import { WorldObject, TerrainData, terrainIndex } from '@/types/world'
import { getCatalogEntry } from './objectCatalog'

/**
 * Manages rendering of WorldObjects in the 3D scene.
 * Follows the same pattern as ChunkManager / GrassSystem.
 */
export class ObjectManager {
  private group: THREE.Group
  private objectMeshes: Map<string, THREE.Group> = new Map()
  private selectedIds: Set<string> = new Set()
  private outlineMeshes: Map<string, THREE.Mesh[]> = new Map()

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'world-objects'
  }

  getGroup(): THREE.Group {
    return this.group
  }

  /** Full rebuild from world data */
  syncObjects(objects: WorldObject[], terrain: TerrainData): void {
    this.disposeAll()
    for (const obj of objects) {
      if (obj.visible) {
        this.addObject(obj, terrain)
      }
    }
  }

  /** Add a single object */
  addObject(obj: WorldObject, terrain: TerrainData): void {
    const entry = getCatalogEntry(obj.type)
    if (!entry) return

    const meshGroup = entry.createMesh(obj.color)
    meshGroup.name = `obj-${obj.id}`
    meshGroup.userData.objectId = obj.id
    meshGroup.userData.objectType = obj.type

    // Position: snap Y to terrain height at XZ
    const [px, py, pz] = obj.position
    const terrainY = this.getTerrainHeight(px, pz, terrain)
    meshGroup.position.set(px, py !== 0 ? py : terrainY, pz)
    meshGroup.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2])
    meshGroup.scale.set(obj.scale[0], obj.scale[1], obj.scale[2])

    // Mark all children for raycasting identification
    meshGroup.traverse((child) => {
      child.userData.objectId = obj.id
    })

    this.objectMeshes.set(obj.id, meshGroup)
    this.group.add(meshGroup)

    // Reapply selection if this object is selected
    if (this.selectedIds.has(obj.id)) {
      this.addOutline(obj.id, meshGroup)
    }
  }

  /** Remove a single object */
  removeObject(id: string): void {
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
    // Remove outlines from deselected
    for (const oldId of this.selectedIds) {
      if (!ids.includes(oldId)) {
        this.removeOutline(oldId)
      }
    }
    // Add outlines to newly selected
    for (const newId of ids) {
      if (!this.selectedIds.has(newId)) {
        const mesh = this.objectMeshes.get(newId)
        if (mesh) this.addOutline(newId, mesh)
      }
    }
    this.selectedIds = new Set(ids)
  }

  /** Get all meshes suitable for raycasting */
  getPickableMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = []
    for (const group of this.objectMeshes.values()) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child)
        }
      })
    }
    return meshes
  }

  /** Walk parent chain of a raycast hit to find the object ID */
  findObjectIdFromIntersection(hit: THREE.Intersection): string | null {
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
    const mesh = this.objectMeshes.get(id)
    if (!mesh) return
    mesh.position.set(pos[0], pos[1], pos[2])
    mesh.rotation.set(rot[0], rot[1], rot[2])
    mesh.scale.set(scale[0], scale[1], scale[2])

    // Refresh outline if selected
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
  }
}
