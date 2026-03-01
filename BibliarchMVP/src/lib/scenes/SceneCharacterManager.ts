/**
 * SceneCharacterManager - Manages multiple character instances in a scene.
 * Babylon.js port: uses TransformNode hierarchy and MeshBuilder for hitboxes.
 */

import {
  TransformNode,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  BoundingInfo,
  Scene,
  type AbstractMesh,
} from '@babylonjs/core'
import { CharacterRenderer } from '@/lib/characters/CharacterRenderer'
import { AnimationManager } from '@/lib/scenes/AnimationManager'
import type { CharacterData, SceneCharacter, CharacterAnimationState } from '@/types/scenes'

interface ManagedCharacter {
  sceneCharacterId: string
  characterId: string
  renderer: CharacterRenderer
  animationManager: AnimationManager
  hitbox: Mesh | null
  loaded: boolean
}

export class SceneCharacterManager {
  private characters: Map<string, ManagedCharacter> = new Map()
  private parentNode: TransformNode
  private characterDataMap: Map<string, CharacterData> = new Map()
  private scene: Scene

  constructor(parent: TransformNode, scene: Scene) {
    this.parentNode = parent
    this.scene = scene
  }

  setCharacterDataMap(dataMap: Map<string, CharacterData>): void {
    this.characterDataMap = dataMap

    this.characters.forEach((managed) => {
      const charData = this.characterDataMap.get(managed.characterId)
      if (charData && managed.loaded) {
        managed.renderer.applyAppearance(charData)
      }
    })
  }

  async addCharacter(sceneChar: SceneCharacter): Promise<void> {
    if (this.characters.has(sceneChar.id)) {
      this.updateTransform(sceneChar.id, sceneChar.position, sceneChar.rotation)
      return
    }

    const renderer = new CharacterRenderer(this.scene)
    const animationManager = new AnimationManager()
    const managed: ManagedCharacter = {
      sceneCharacterId: sceneChar.id,
      characterId: sceneChar.characterId,
      renderer,
      animationManager,
      hitbox: null,
      loaded: false,
    }

    this.characters.set(sceneChar.id, managed)
    renderer.getGroup().parent = this.parentNode

    await renderer.load()
    managed.loaded = true

    // Initialize animation manager
    animationManager.initialize(renderer.getGroup(), this.scene)

    // Apply appearance
    const charData = this.characterDataMap.get(sceneChar.characterId)
    if (charData) {
      renderer.applyAppearance(charData)
    }

    // Create invisible hitbox for raycasting
    const group = renderer.getGroup()
    group.computeWorldMatrix(true)

    let minVec = new Vector3(Infinity, Infinity, Infinity)
    let maxVec = new Vector3(-Infinity, -Infinity, -Infinity)
    group.getChildMeshes(true).forEach(child => {
      child.computeWorldMatrix(true)
      const bb = child.getBoundingInfo().boundingBox
      minVec = Vector3.Minimize(minVec, bb.minimumWorld)
      maxVec = Vector3.Maximize(maxVec, bb.maximumWorld)
    })
    const size = maxVec.subtract(minVec)
    const center = Vector3.Center(minVec, maxVec)

    const hitboxHeight = Math.max(size.y, 1.6)
    const hitboxRadius = Math.max(size.x, size.z, 0.4) * 0.5

    const hitbox = MeshBuilder.CreateCylinder(`hitbox-${sceneChar.id}`, {
      height: hitboxHeight,
      diameter: hitboxRadius * 2,
      tessellation: 8,
    }, this.scene)

    hitbox.position = new Vector3(
      center.x - group.position.x,
      center.y - group.position.y,
      center.z - group.position.z
    )
    hitbox.visibility = 0 // Invisible
    hitbox.isPickable = true
    hitbox.metadata = {
      sceneCharacterId: sceneChar.id,
      isHitbox: true,
    }
    hitbox.parent = group
    managed.hitbox = hitbox

    // Set initial position
    renderer.setWorldTransform(sceneChar.position, sceneChar.rotation)

    // Store reference
    group.metadata = { sceneCharacterId: sceneChar.id }
  }

  removeCharacter(sceneCharacterId: string): void {
    const managed = this.characters.get(sceneCharacterId)
    if (!managed) return

    if (managed.hitbox) {
      managed.hitbox.dispose()
    }

    managed.animationManager.dispose()
    managed.renderer.dispose()
    this.characters.delete(sceneCharacterId)
  }

  updateTransform(sceneCharacterId: string, position: [number, number, number], rotation: number): void {
    const managed = this.characters.get(sceneCharacterId)
    if (!managed) return
    managed.renderer.setWorldTransform(position, rotation)
  }

  async syncCharacters(sceneCharacters: SceneCharacter[]): Promise<void> {
    const sceneCharIds = new Set(sceneCharacters.map(c => c.id))

    const toRemove: string[] = []
    this.characters.forEach((_, id) => {
      if (!sceneCharIds.has(id)) {
        toRemove.push(id)
      }
    })
    toRemove.forEach(id => this.removeCharacter(id))

    for (const sceneChar of sceneCharacters) {
      await this.addCharacter(sceneChar)
    }
  }

  async applyAnimationState(sceneCharacterId: string, state: CharacterAnimationState): Promise<void> {
    const managed = this.characters.get(sceneCharacterId)
    if (!managed || !managed.loaded) return
    await managed.animationManager.applyState(state)
  }

  update(delta: number): void {
    this.characters.forEach((managed) => {
      if (managed.loaded) {
        managed.renderer.update(delta)
        managed.animationManager.update(delta)
      }
    })
  }

  getCharacterGroup(sceneCharacterId: string): TransformNode | null {
    const managed = this.characters.get(sceneCharacterId)
    return managed?.renderer.getGroup() ?? null
  }

  getAllCharacterGroups(): TransformNode[] {
    const groups: TransformNode[] = []
    this.characters.forEach((managed) => {
      if (managed.loaded) {
        groups.push(managed.renderer.getGroup())
      }
    })
    return groups
  }

  getAllHitboxes(): Mesh[] {
    const hitboxes: Mesh[] = []
    this.characters.forEach((managed) => {
      if (managed.loaded && managed.hitbox) {
        hitboxes.push(managed.hitbox)
      }
    })
    return hitboxes
  }

  findCharacterByMesh(mesh: AbstractMesh): string | null {
    let current: any = mesh
    while (current) {
      if (current.metadata?.sceneCharacterId) {
        return current.metadata.sceneCharacterId as string
      }
      current = current.parent
    }
    return null
  }

  get count(): number {
    return this.characters.size
  }

  dispose(): void {
    this.characters.forEach((managed) => {
      if (managed.hitbox) {
        managed.hitbox.dispose()
      }
      managed.animationManager.dispose()
      managed.renderer.dispose()
    })
    this.characters.clear()
  }
}
