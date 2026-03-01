'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Scene,
  FreeCamera,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { idbGet } from '@/services/worldStorage'
import { deserializeWorld, type World, type WorldLocation, type SerializedWorld } from '@/types/world'
import { ChunkManager } from '@/lib/terrain/ChunkManager'

interface SceneBackdropProps {
  storyId: string
  locationId: string | null
  scene: Scene
  camera: FreeCamera
}

/**
 * SceneBackdrop - Renders world terrain as a backdrop for scenes.
 * Loads the world from IndexedDB and renders terrain chunks around the saved location.
 */
export default function SceneBackdrop({
  storyId,
  locationId,
  scene,
  camera,
}: SceneBackdropProps) {
  const [world, setWorld] = useState<World | null>(null)
  const [location, setLocation] = useState<WorldLocation | null>(null)
  const chunkManagerRef = useRef<ChunkManager | null>(null)
  const terrainGroupRef = useRef<TransformNode | null>(null)

  // Load world data
  useEffect(() => {
    if (!storyId) return

    const loadWorld = async () => {
      try {
        const data = await idbGet<SerializedWorld>(`bibliarch-world-${storyId}`)
        if (data) {
          const w = deserializeWorld(data)
          setWorld(w)
        }
      } catch (e) {
        console.error('Failed to load world for backdrop:', e)
      }
    }

    loadWorld()
  }, [storyId])

  // Find location when locationId or world changes
  useEffect(() => {
    if (!world || !locationId) {
      setLocation(null)
      return
    }

    const loc = world.locations?.find(l => l.id === locationId)
    setLocation(loc || null)
  }, [world, locationId])

  // Initialize terrain rendering
  useEffect(() => {
    if (!world || !location) {
      // Clean up if no location
      if (terrainGroupRef.current) {
        terrainGroupRef.current.dispose()
        terrainGroupRef.current = null
      }
      if (chunkManagerRef.current) {
        chunkManagerRef.current.dispose()
        chunkManagerRef.current = null
      }
      return
    }

    // Create terrain group if needed
    if (!terrainGroupRef.current) {
      terrainGroupRef.current = new TransformNode('SceneBackdrop', scene)
    }

    // Create chunk manager
    if (!chunkManagerRef.current) {
      chunkManagerRef.current = new ChunkManager(scene)
      const chunkGroup = chunkManagerRef.current.getParent()
      chunkGroup.parent = terrainGroupRef.current
    }

    // Set terrain data
    chunkManagerRef.current.setTerrain(world.terrain)

    // Position camera at saved location
    camera.position.set(
      location.cameraPosition[0],
      location.cameraPosition[1],
      location.cameraPosition[2]
    )

    // Apply rotation
    camera.rotation.set(
      location.cameraRotation[0],
      location.cameraRotation[1],
      location.cameraRotation[2]
    )

    return () => {
      if (chunkManagerRef.current) {
        chunkManagerRef.current.dispose()
        chunkManagerRef.current = null
      }
      if (terrainGroupRef.current) {
        terrainGroupRef.current.dispose()
        terrainGroupRef.current = null
      }
    }
  }, [world, location, scene, camera])

  // This component doesn't render anything directly - it manages the 3D scene
  return null
}

/**
 * Hook to manage scene backdrop
 */
export function useSceneBackdrop(
  storyId: string,
  locationId: string | null,
  scene: Scene | null,
  camera: FreeCamera | null
) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!storyId || !locationId || !scene || !camera) {
      setIsLoaded(false)
      return
    }

    const loadBackdrop = async () => {
      try {
        const data = await idbGet<SerializedWorld>(`bibliarch-world-${storyId}`)
        if (!data) {
          setError('World not found')
          return
        }

        const world = deserializeWorld(data)
        const location = world.locations?.find(l => l.id === locationId)

        if (!location) {
          setError('Location not found')
          return
        }

        // Create terrain group
        const terrainGroup = new TransformNode('SceneBackdrop', scene)

        // Create chunk manager and set terrain
        const chunkManager = new ChunkManager(scene)
        const chunkParent = chunkManager.getParent()
        chunkParent.parent = terrainGroup
        chunkManager.setTerrain(world.terrain)

        setIsLoaded(true)
        setError(null)

        // Return cleanup function
        return () => {
          chunkManager.dispose()
          terrainGroup.dispose()
        }
      } catch (e) {
        console.error('Failed to load backdrop:', e)
        setError('Failed to load backdrop')
      }
    }

    const cleanup = loadBackdrop()

    return () => {
      cleanup?.then(fn => fn?.())
    }
  }, [storyId, locationId, scene, camera])

  return { isLoaded, error }
}
