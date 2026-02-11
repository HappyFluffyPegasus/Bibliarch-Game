/**
 * SceneCharacterManager - Manages multiple character instances in a scene.
 * Handles loading, positioning, and updating of characters with real 3D models.
 */

import * as THREE from 'three'
import { CharacterRenderer } from '@/lib/characters/CharacterRenderer'
import type { CharacterData, SceneCharacter } from '@/types/scenes'

interface ManagedCharacter {
  sceneCharacterId: string
  characterId: string
  renderer: CharacterRenderer
  loaded: boolean
}

export class SceneCharacterManager {
  private characters: Map<string, ManagedCharacter> = new Map()
  private parentGroup: THREE.Group
  private characterDataMap: Map<string, CharacterData> = new Map()

  constructor(parent: THREE.Group) {
    this.parentGroup = parent
  }

  /**
   * Set the character data map (full appearance data)
   */
  setCharacterDataMap(dataMap: Map<string, CharacterData>): void {
    this.characterDataMap = dataMap

    // Re-apply appearance to existing characters if their data changed
    this.characters.forEach((managed) => {
      const charData = this.characterDataMap.get(managed.characterId)
      if (charData && managed.loaded) {
        managed.renderer.applyAppearance(charData)
      }
    })
  }

  /**
   * Add a character to the scene
   */
  async addCharacter(sceneChar: SceneCharacter): Promise<void> {
    if (this.characters.has(sceneChar.id)) {
      // Already exists, just update position
      this.updateTransform(sceneChar.id, sceneChar.position, sceneChar.rotation)
      return
    }

    const renderer = new CharacterRenderer()
    const managed: ManagedCharacter = {
      sceneCharacterId: sceneChar.id,
      characterId: sceneChar.characterId,
      renderer,
      loaded: false,
    }

    this.characters.set(sceneChar.id, managed)
    this.parentGroup.add(renderer.getGroup())

    // Load the model
    await renderer.load()
    managed.loaded = true

    // Apply appearance from character data
    const charData = this.characterDataMap.get(sceneChar.characterId)
    if (charData) {
      renderer.applyAppearance(charData)
    }

    // Set initial position
    renderer.setWorldTransform(sceneChar.position, sceneChar.rotation)

    // Store reference for raycasting
    renderer.getGroup().userData.sceneCharacterId = sceneChar.id
  }

  /**
   * Remove a character from the scene
   */
  removeCharacter(sceneCharacterId: string): void {
    const managed = this.characters.get(sceneCharacterId)
    if (!managed) return

    this.parentGroup.remove(managed.renderer.getGroup())
    managed.renderer.dispose()
    this.characters.delete(sceneCharacterId)
  }

  /**
   * Update character transform
   */
  updateTransform(sceneCharacterId: string, position: [number, number, number], rotation: number): void {
    const managed = this.characters.get(sceneCharacterId)
    if (!managed) return

    managed.renderer.setWorldTransform(position, rotation)
  }

  /**
   * Sync with scene character list - adds/removes as needed
   */
  async syncCharacters(sceneCharacters: SceneCharacter[]): Promise<void> {
    const sceneCharIds = new Set(sceneCharacters.map(c => c.id))

    // Remove characters no longer in scene
    const toRemove: string[] = []
    this.characters.forEach((_, id) => {
      if (!sceneCharIds.has(id)) {
        toRemove.push(id)
      }
    })
    toRemove.forEach(id => this.removeCharacter(id))

    // Add or update characters in scene
    for (const sceneChar of sceneCharacters) {
      await this.addCharacter(sceneChar)
    }
  }

  /**
   * Update all characters (call each frame)
   */
  update(delta: number): void {
    this.characters.forEach((managed) => {
      if (managed.loaded) {
        managed.renderer.update(delta)
      }
    })
  }

  /**
   * Get the Three.js group for a character (for selection/gizmo attachment)
   */
  getCharacterGroup(sceneCharacterId: string): THREE.Group | null {
    const managed = this.characters.get(sceneCharacterId)
    return managed?.renderer.getGroup() ?? null
  }

  /**
   * Get all character groups for raycasting
   */
  getAllCharacterGroups(): THREE.Group[] {
    const groups: THREE.Group[] = []
    this.characters.forEach((managed) => {
      if (managed.loaded) {
        groups.push(managed.renderer.getGroup())
      }
    })
    return groups
  }

  /**
   * Find character by raycasting intersection
   */
  findCharacterByIntersection(intersectedObject: THREE.Object3D): string | null {
    let obj: THREE.Object3D | null = intersectedObject
    while (obj) {
      if (obj.userData.sceneCharacterId) {
        return obj.userData.sceneCharacterId as string
      }
      obj = obj.parent
    }
    return null
  }

  /**
   * Get character count
   */
  get count(): number {
    return this.characters.size
  }

  /**
   * Dispose all characters
   */
  dispose(): void {
    this.characters.forEach((managed) => {
      this.parentGroup.remove(managed.renderer.getGroup())
      managed.renderer.dispose()
    })
    this.characters.clear()
  }
}
