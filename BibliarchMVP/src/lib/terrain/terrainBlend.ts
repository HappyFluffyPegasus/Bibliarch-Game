/**
 * Terrain blending utilities for hierarchical world building.
 *
 * - initChildTerrainFromParent: Upsamples parent terrain into child bounds
 * - blendChildIntoParent: Downsamples child terrain back into parent bounds
 * - blendWithFeather: Smooths edge transitions at border cells
 */

import {
  TerrainData,
  LevelBounds,
  terrainIndex,
  isInBounds,
  TerrainMaterialId,
} from '@/types/world'

/**
 * Initialize a child terrain by upsampling from the parent terrain
 * within the specified bounds. The child terrain will be a higher-resolution
 * version of the parent's terrain in that rectangle.
 */
export function initChildTerrainFromParent(
  parentTerrain: TerrainData,
  bounds: LevelBounds,
  childSizeX: number,
  childSizeZ: number
): TerrainData {
  const totalCells = childSizeX * childSizeZ
  const heights = new Float32Array(totalCells)
  const materials = new Uint8Array(totalCells)
  materials.fill(TerrainMaterialId.Grass)

  const scaleX = bounds.width / childSizeX
  const scaleZ = bounds.depth / childSizeZ

  for (let cz = 0; cz < childSizeZ; cz++) {
    for (let cx = 0; cx < childSizeX; cx++) {
      // Map child coord to parent coord (with bilinear interpolation)
      const px = bounds.startX + cx * scaleX
      const pz = bounds.startZ + cz * scaleZ

      const childIdx = terrainIndex(cx, cz, childSizeX)

      // Bilinear interpolation for heights
      const px0 = Math.floor(px)
      const pz0 = Math.floor(pz)
      const px1 = Math.min(px0 + 1, parentTerrain.size - 1)
      const pz1 = Math.min(pz0 + 1, parentTerrain.sizeZ - 1)
      const fx = px - px0
      const fz = pz - pz0

      if (isInBounds(px0, pz0, parentTerrain.size, parentTerrain.sizeZ)) {
        const h00 = parentTerrain.heights[terrainIndex(px0, pz0, parentTerrain.size)]
        const h10 = parentTerrain.heights[terrainIndex(px1, pz0, parentTerrain.size)]
        const h01 = parentTerrain.heights[terrainIndex(px0, pz1, parentTerrain.size)]
        const h11 = parentTerrain.heights[terrainIndex(px1, pz1, parentTerrain.size)]

        heights[childIdx] =
          h00 * (1 - fx) * (1 - fz) +
          h10 * fx * (1 - fz) +
          h01 * (1 - fx) * fz +
          h11 * fx * fz

        // Nearest-neighbor for materials
        const nearX = Math.round(px)
        const nearZ = Math.round(pz)
        if (isInBounds(nearX, nearZ, parentTerrain.size, parentTerrain.sizeZ)) {
          materials[childIdx] = parentTerrain.materials[terrainIndex(nearX, nearZ, parentTerrain.size)]
        }
      }
    }
  }

  return {
    size: childSizeX,
    sizeZ: childSizeZ,
    cellSize: parentTerrain.cellSize * scaleX,
    heights,
    materials,
    seaLevel: parentTerrain.seaLevel,
    maxHeight: parentTerrain.maxHeight,
  }
}

/**
 * Downsample child terrain back into the parent's bounds rectangle.
 * This updates the parent terrain in-place within the specified bounds.
 */
export function blendChildIntoParent(
  parentTerrain: TerrainData,
  childTerrain: TerrainData,
  bounds: LevelBounds
): void {
  const scaleX = childTerrain.size / bounds.width
  const scaleZ = childTerrain.sizeZ / bounds.depth

  for (let pz = bounds.startZ; pz < bounds.startZ + bounds.depth; pz++) {
    for (let px = bounds.startX; px < bounds.startX + bounds.width; px++) {
      if (!isInBounds(px, pz, parentTerrain.size, parentTerrain.sizeZ)) continue

      // Map parent coord to child coord
      const cx = (px - bounds.startX) * scaleX
      const cz = (pz - bounds.startZ) * scaleZ

      const cx0 = Math.floor(cx)
      const cz0 = Math.floor(cz)
      const cx1 = Math.min(cx0 + 1, childTerrain.size - 1)
      const cz1 = Math.min(cz0 + 1, childTerrain.sizeZ - 1)
      const fx = cx - cx0
      const fz = cz - cz0

      // Bilinear interpolation of child heights
      const h00 = childTerrain.heights[terrainIndex(cx0, cz0, childTerrain.size)]
      const h10 = childTerrain.heights[terrainIndex(cx1, cz0, childTerrain.size)]
      const h01 = childTerrain.heights[terrainIndex(cx0, cz1, childTerrain.size)]
      const h11 = childTerrain.heights[terrainIndex(cx1, cz1, childTerrain.size)]

      const blendedHeight =
        h00 * (1 - fx) * (1 - fz) +
        h10 * fx * (1 - fz) +
        h01 * (1 - fx) * fz +
        h11 * fx * fz

      const parentIdx = terrainIndex(px, pz, parentTerrain.size)
      parentTerrain.heights[parentIdx] = blendedHeight

      // Nearest-neighbor for material
      const nearCx = Math.round(cx)
      const nearCz = Math.round(cz)
      if (isInBounds(nearCx, nearCz, childTerrain.size, childTerrain.sizeZ)) {
        parentTerrain.materials[parentIdx] =
          childTerrain.materials[terrainIndex(nearCx, nearCz, childTerrain.size)]
      }
    }
  }
}

/**
 * Apply feathering at the border of bounds to smooth transitions.
 * Blends N cells at each edge between the original parent terrain
 * and the child-blended terrain.
 */
// ============================================================
// TERRAIN PROPAGATION: Parent → Child snapshot system
// ============================================================

export interface BoundsSnapshot {
  heights: number[]
  materials: number[]
}

/**
 * Extract a snapshot of parent terrain within bounds.
 * Used to detect if parent terrain changed since child was created.
 */
export function extractBoundsSnapshot(
  parentTerrain: TerrainData,
  bounds: LevelBounds
): BoundsSnapshot {
  const heights: number[] = []
  const materials: number[] = []
  for (let pz = bounds.startZ; pz < bounds.startZ + bounds.depth; pz++) {
    for (let px = bounds.startX; px < bounds.startX + bounds.width; px++) {
      if (isInBounds(px, pz, parentTerrain.size, parentTerrain.sizeZ)) {
        const idx = terrainIndex(px, pz, parentTerrain.size)
        heights.push(parentTerrain.heights[idx])
        materials.push(parentTerrain.materials[idx])
      } else {
        heights.push(0)
        materials.push(TerrainMaterialId.Grass)
      }
    }
  }
  return { heights, materials }
}

/**
 * Compare two snapshots. Returns true if they differ.
 */
export function snapshotsEqual(a: BoundsSnapshot, b: BoundsSnapshot): boolean {
  if (a.heights.length !== b.heights.length) return false
  for (let i = 0; i < a.heights.length; i++) {
    if (Math.abs(a.heights[i] - b.heights[i]) > 0.0001) return false
    if (a.materials[i] !== b.materials[i]) return false
  }
  return true
}

/**
 * Propagate parent terrain changes to child.
 * Where the child has NOT been user-edited (height matches old snapshot),
 * update to the new parent values. Where child was edited, blend.
 */
export function propagateParentChangesToChild(
  childTerrain: TerrainData,
  bounds: LevelBounds,
  oldSnapshot: BoundsSnapshot,
  parentTerrain: TerrainData
): void {
  const scaleX = childTerrain.size / bounds.width
  const scaleZ = childTerrain.sizeZ / bounds.depth

  for (let cz = 0; cz < childTerrain.sizeZ; cz++) {
    for (let cx = 0; cx < childTerrain.size; cx++) {
      const childIdx = terrainIndex(cx, cz, childTerrain.size)

      // Map child coord to parent coord
      const px = bounds.startX + cx / scaleX
      const pz = bounds.startZ + cz / scaleZ

      const px0 = Math.floor(px)
      const pz0 = Math.floor(pz)
      const px1 = Math.min(px0 + 1, parentTerrain.size - 1)
      const pz1 = Math.min(pz0 + 1, parentTerrain.sizeZ - 1)
      const fx = px - px0
      const fz = pz - pz0

      if (!isInBounds(px0, pz0, parentTerrain.size, parentTerrain.sizeZ)) continue

      // Get current parent height (bilinear)
      const h00 = parentTerrain.heights[terrainIndex(px0, pz0, parentTerrain.size)]
      const h10 = parentTerrain.heights[terrainIndex(px1, pz0, parentTerrain.size)]
      const h01 = parentTerrain.heights[terrainIndex(px0, pz1, parentTerrain.size)]
      const h11 = parentTerrain.heights[terrainIndex(px1, pz1, parentTerrain.size)]
      const newParentHeight = h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz

      // Get old snapshot height for this parent position
      const snapPx = Math.round(px) - bounds.startX
      const snapPz = Math.round(pz) - bounds.startZ
      const snapIdx = snapPz * bounds.width + snapPx
      const oldHeight = snapIdx >= 0 && snapIdx < oldSnapshot.heights.length ? oldSnapshot.heights[snapIdx] : 0

      // Get old parent height (what child was initialized from)
      // Reconstruct using same bilinear from snapshot
      const snapH00Idx = (pz0 - bounds.startZ) * bounds.width + (px0 - bounds.startX)
      const oldParentHeight = snapH00Idx >= 0 && snapH00Idx < oldSnapshot.heights.length ? oldSnapshot.heights[snapH00Idx] : 0

      // Check if child has been user-edited at this point
      const childHeight = childTerrain.heights[childIdx]
      const wasEdited = Math.abs(childHeight - oldParentHeight) > 0.001

      if (!wasEdited) {
        // Not edited → take new parent value directly
        childTerrain.heights[childIdx] = newParentHeight
      } else {
        // Edited → blend: apply the delta from parent change
        const delta = newParentHeight - oldParentHeight
        childTerrain.heights[childIdx] = Math.max(0, Math.min(1, childHeight + delta * 0.5))
      }

      // Update material from parent (nearest neighbor)
      const nearX = Math.round(px)
      const nearZ = Math.round(pz)
      if (isInBounds(nearX, nearZ, parentTerrain.size, parentTerrain.sizeZ)) {
        const oldMat = snapIdx >= 0 && snapIdx < oldSnapshot.materials.length ? oldSnapshot.materials[snapIdx] : 0
        const childMat = childTerrain.materials[childIdx]
        if (childMat === oldMat) {
          // Not edited → use new parent material
          childTerrain.materials[childIdx] = parentTerrain.materials[terrainIndex(nearX, nearZ, parentTerrain.size)]
        }
      }
    }
  }
}

export function blendWithFeather(
  parentTerrain: TerrainData,
  bounds: LevelBounds,
  featherCells: number = 4
): void {
  // For each cell in the feather band, lerp between current value and
  // the average of surrounding cells outside bounds.

  for (let pz = bounds.startZ - featherCells; pz < bounds.startZ + bounds.depth + featherCells; pz++) {
    for (let px = bounds.startX - featherCells; px < bounds.startX + bounds.width + featherCells; px++) {
      if (!isInBounds(px, pz, parentTerrain.size, parentTerrain.sizeZ)) continue

      // Calculate distance from bounds edge
      const dLeft = px - bounds.startX
      const dRight = (bounds.startX + bounds.width - 1) - px
      const dTop = pz - bounds.startZ
      const dBottom = (bounds.startZ + bounds.depth - 1) - pz

      // Only process cells near the edge
      const minDist = Math.min(
        Math.max(0, dLeft),
        Math.max(0, dRight),
        Math.max(0, dTop),
        Math.max(0, dBottom)
      )

      // Inside bounds but near edge
      const isInsideBounds =
        px >= bounds.startX && px < bounds.startX + bounds.width &&
        pz >= bounds.startZ && pz < bounds.startZ + bounds.depth

      if (isInsideBounds && minDist < featherCells) {
        // Smooth with neighbors
        const idx = terrainIndex(px, pz, parentTerrain.size)
        let sum = 0
        let count = 0
        for (let nz = -1; nz <= 1; nz++) {
          for (let nx = -1; nx <= 1; nx++) {
            const npx = px + nx
            const npz = pz + nz
            if (isInBounds(npx, npz, parentTerrain.size, parentTerrain.sizeZ)) {
              sum += parentTerrain.heights[terrainIndex(npx, npz, parentTerrain.size)]
              count++
            }
          }
        }
        const avg = sum / count
        const t = minDist / featherCells // 0 at edge, 1 at featherCells deep
        parentTerrain.heights[idx] = parentTerrain.heights[idx] * t + avg * (1 - t)
      }
    }
  }
}
