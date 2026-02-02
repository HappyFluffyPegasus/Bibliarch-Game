import {
  CartographyData,
  CartographyRegionType,
  CartographyGenerationSettings,
  TerrainData,
  TerrainMaterialId,
} from '@/types/world'

// ============================================================
// BIOME COLOR MAP — display colors for the 2D cartography editor
// ============================================================

export const BIOME_COLORS: Record<CartographyRegionType, string> = {
  ocean: '#1a3a5c',
  shallows: '#2d7d9a',
  beach: '#d4c484',
  plains: '#7ab648',
  hills: '#5a8a3a',
  mountains: '#8c8c8c',
  forest: '#2d6e2d',
  desert: '#c4a44a',
  tundra: '#c8d8e0',
  swamp: '#4a6a3a',
}

export const BIOME_LABELS: Record<CartographyRegionType, string> = {
  ocean: 'Ocean',
  shallows: 'Shallows',
  beach: 'Beach',
  plains: 'Plains',
  hills: 'Hills',
  mountains: 'Mountains',
  forest: 'Forest',
  desert: 'Desert',
  tundra: 'Tundra',
  swamp: 'Swamp',
}

export const ALL_BIOMES: CartographyRegionType[] = [
  'ocean',
  'shallows',
  'beach',
  'plains',
  'hills',
  'mountains',
  'forest',
  'desert',
  'tundra',
  'swamp',
]

// ============================================================
// BIOME PROFILES — height range, noise params, material mapping
// ============================================================

interface BiomeProfile {
  heightMin: number // 0-1 base height range
  heightMax: number
  noiseAmplitude: number // How much noise adds
  noiseFrequency: number // Base frequency for noise
  material: TerrainMaterialId
}

export const BIOME_PROFILES: Record<CartographyRegionType, BiomeProfile> = {
  ocean: { heightMin: 0.0, heightMax: 0.08, noiseAmplitude: 0.02, noiseFrequency: 0.5, material: TerrainMaterialId.Sand },
  shallows: { heightMin: 0.08, heightMax: 0.15, noiseAmplitude: 0.03, noiseFrequency: 0.8, material: TerrainMaterialId.Sand },
  beach: { heightMin: 0.15, heightMax: 0.22, noiseAmplitude: 0.02, noiseFrequency: 1.0, material: TerrainMaterialId.Sand },
  plains: { heightMin: 0.22, heightMax: 0.35, noiseAmplitude: 0.04, noiseFrequency: 0.6, material: TerrainMaterialId.Grass },
  hills: { heightMin: 0.35, heightMax: 0.55, noiseAmplitude: 0.08, noiseFrequency: 1.2, material: TerrainMaterialId.Grass },
  mountains: { heightMin: 0.55, heightMax: 0.95, noiseAmplitude: 0.12, noiseFrequency: 1.5, material: TerrainMaterialId.Rock },
  forest: { heightMin: 0.25, heightMax: 0.45, noiseAmplitude: 0.05, noiseFrequency: 0.8, material: TerrainMaterialId.Grass },
  desert: { heightMin: 0.20, heightMax: 0.40, noiseAmplitude: 0.06, noiseFrequency: 0.4, material: TerrainMaterialId.Sand },
  tundra: { heightMin: 0.30, heightMax: 0.50, noiseAmplitude: 0.04, noiseFrequency: 0.5, material: TerrainMaterialId.Snow },
  swamp: { heightMin: 0.12, heightMax: 0.25, noiseAmplitude: 0.03, noiseFrequency: 0.7, material: TerrainMaterialId.Mud },
}

// ============================================================
// SEEDED 2D VALUE NOISE
// ============================================================

/** Hash-based pseudo-random at integer lattice points */
function hash2d(ix: number, iz: number, seed: number): number {
  let h = seed + ix * 374761393 + iz * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return (h & 0x7fffffff) / 0x7fffffff // 0-1
}

/** Bilinear interpolation of noise at fractional coordinates */
function valueNoise2d(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz

  // Smoothstep for interpolation
  const sx = fx * fx * (3 - 2 * fx)
  const sz = fz * fz * (3 - 2 * fz)

  const n00 = hash2d(ix, iz, seed)
  const n10 = hash2d(ix + 1, iz, seed)
  const n01 = hash2d(ix, iz + 1, seed)
  const n11 = hash2d(ix + 1, iz + 1, seed)

  const nx0 = n00 + sx * (n10 - n00)
  const nx1 = n01 + sx * (n11 - n01)

  return nx0 + sz * (nx1 - nx0)
}

/** Octave-layered value noise */
function octaveNoise2d(
  x: number,
  z: number,
  seed: number,
  octaves: number,
  baseFrequency: number
): number {
  let value = 0
  let amplitude = 1.0
  let frequency = baseFrequency
  let maxAmplitude = 0

  for (let i = 0; i < octaves; i++) {
    value += valueNoise2d(x * frequency, z * frequency, seed + i * 1000) * amplitude
    maxAmplitude += amplitude
    amplitude *= 0.5
    frequency *= 2.0
  }

  return value / maxAmplitude // Normalize to 0-1
}

// ============================================================
// CARTOGRAPHY GRID HELPERS
// ============================================================

/** Create a default cartography grid filled with a biome type */
export function createCartographyGrid(gridSizeX: number, gridSizeZ: number, fill: CartographyRegionType = 'plains'): Uint8Array {
  const grid = new Uint8Array(gridSizeX * gridSizeZ)
  const fillIndex = ALL_BIOMES.indexOf(fill)
  grid.fill(fillIndex)
  return grid
}

/** Get biome type from grid cell index value */
export function biomeFromIndex(index: number): CartographyRegionType {
  return ALL_BIOMES[index] ?? 'plains'
}

/** Get grid cell index value from biome type */
export function indexFromBiome(biome: CartographyRegionType): number {
  return ALL_BIOMES.indexOf(biome)
}

// ============================================================
// TERRAIN GENERATION FROM CARTOGRAPHY
// ============================================================

export function generateTerrainFromCartography(
  cartographyGrid: Uint8Array,
  cartGridSizeX: number,
  cartGridSizeZ: number,
  terrain: TerrainData,
  settings: CartographyGenerationSettings
): void {
  const terrainSizeX = terrain.size
  const terrainSizeZ = terrain.sizeZ
  const seed = 42 // Deterministic seed

  // Step 1: Map cartography grid onto terrain grid via nearest-neighbor
  // and compute initial heights + materials
  for (let tz = 0; tz < terrainSizeZ; tz++) {
    for (let tx = 0; tx < terrainSizeX; tx++) {
      // Map terrain coord to cartography coord
      const cx = Math.floor((tx / terrainSizeX) * cartGridSizeX)
      const cz = Math.floor((tz / terrainSizeZ) * cartGridSizeZ)
      const cIdx = Math.min(cz, cartGridSizeZ - 1) * cartGridSizeX + Math.min(cx, cartGridSizeX - 1)

      const biomeIndex = cartographyGrid[cIdx]
      const biome = biomeFromIndex(biomeIndex)
      const profile = BIOME_PROFILES[biome]

      // Compute height from base range + noise
      const noiseVal = octaveNoise2d(
        tx / terrainSizeX * settings.noiseScale,
        tz / terrainSizeZ * settings.noiseScale,
        seed,
        settings.noiseOctaves,
        profile.noiseFrequency
      )

      const baseHeight = profile.heightMin + (profile.heightMax - profile.heightMin) * 0.5
      const height = baseHeight + (noiseVal - 0.5) * profile.noiseAmplitude * settings.heightMultiplier

      const tIdx = tz * terrainSizeX + tx
      terrain.heights[tIdx] = Math.max(0, Math.min(1, height))
      terrain.materials[tIdx] = profile.material
    }
  }

  // Step 2: Smoothing passes (3x3 box blur over heights)
  const totalCells = terrainSizeX * terrainSizeZ
  const tempHeights = new Float32Array(totalCells)

  for (let pass = 0; pass < settings.smoothingPasses; pass++) {
    tempHeights.set(terrain.heights)

    for (let tz = 0; tz < terrainSizeZ; tz++) {
      for (let tx = 0; tx < terrainSizeX; tx++) {
        let sum = 0
        let count = 0

        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = tx + dx
            const nz = tz + dz
            if (nx >= 0 && nx < terrainSizeX && nz >= 0 && nz < terrainSizeZ) {
              sum += tempHeights[nz * terrainSizeX + nx]
              count++
            }
          }
        }

        terrain.heights[tz * terrainSizeX + tx] = sum / count
      }
    }
  }

  // Step 3: Extra smoothing at biome boundaries to prevent cliff edges
  const WATER_BIOMES = new Set([0, 1, 2])

  for (let boundaryPass = 0; boundaryPass < 2; boundaryPass++) {
    const boundarySmooth = new Float32Array(totalCells)
    boundarySmooth.set(terrain.heights)

    const scanRadius = 3
    for (let tz = 1; tz < terrainSizeZ - 1; tz++) {
      for (let tx = 1; tx < terrainSizeX - 1; tx++) {
        const cx = Math.floor((tx / terrainSizeX) * cartGridSizeX)
        const cz = Math.floor((tz / terrainSizeZ) * cartGridSizeZ)
        const centerBiome = cartographyGrid[Math.min(cz, cartGridSizeZ - 1) * cartGridSizeX + Math.min(cx, cartGridSizeX - 1)]

        let isBoundary = false
        let isWaterLand = false
        for (let dz = -scanRadius; dz <= scanRadius && !isBoundary; dz++) {
          for (let dx = -scanRadius; dx <= scanRadius && !isBoundary; dx++) {
            if (dx === 0 && dz === 0) continue
            const ncx = Math.floor(((tx + dx * 2) / terrainSizeX) * cartGridSizeX)
            const ncz = Math.floor(((tz + dz * 2) / terrainSizeZ) * cartGridSizeZ)
            if (ncx >= 0 && ncx < cartGridSizeX && ncz >= 0 && ncz < cartGridSizeZ) {
              const neighborBiome = cartographyGrid[ncz * cartGridSizeX + ncx]
              if (neighborBiome !== centerBiome) {
                isBoundary = true
                const centerIsWater = WATER_BIOMES.has(centerBiome)
                const neighborIsWater = WATER_BIOMES.has(neighborBiome)
                if (centerIsWater !== neighborIsWater) {
                  isWaterLand = true
                }
              }
            }
          }
        }

        if (isBoundary) {
          const blurRadius = isWaterLand ? 5 : 3
          let sum = 0
          let count = 0
          for (let dz = -blurRadius; dz <= blurRadius; dz++) {
            for (let dx = -blurRadius; dx <= blurRadius; dx++) {
              const nx = tx + dx
              const nz = tz + dz
              if (nx >= 0 && nx < terrainSizeX && nz >= 0 && nz < terrainSizeZ) {
                sum += boundarySmooth[nz * terrainSizeX + nx]
                count++
              }
            }
          }
          terrain.heights[tz * terrainSizeX + tx] = sum / count
        }
      }
    }
  }
}

// ============================================================
// DERIVE CARTOGRAPHY GRID FROM TERRAIN HEIGHTS
// ============================================================

/**
 * Create a cartography grid from terrain height data.
 * The grid matches the terrain dimensions (1:1 cells).
 */
export function cartographyGridFromHeights(
  heights: Float32Array,
  terrainSizeX: number,
  terrainSizeZ: number
): Uint8Array {
  const grid = new Uint8Array(terrainSizeX * terrainSizeZ)

  for (let z = 0; z < terrainSizeZ; z++) {
    for (let x = 0; x < terrainSizeX; x++) {
      const height = heights[z * terrainSizeX + x]

      let biome: CartographyRegionType
      if (height < 0.10) biome = 'ocean'
      else if (height < 0.15) biome = 'shallows'
      else if (height < 0.22) biome = 'beach'
      else if (height < 0.35) biome = 'plains'
      else if (height < 0.55) biome = 'hills'
      else biome = 'mountains'

      grid[z * terrainSizeX + x] = indexFromBiome(biome)
    }
  }

  return grid
}

// ============================================================
// DEFAULT CARTOGRAPHY DATA
// ============================================================

export function createDefaultCartographyData(gridSizeX: number = 256, gridSizeZ: number = 256): CartographyData {
  return {
    gridSizeX,
    gridSizeZ,
    regions: [],
    paths: [],
    settings: {
      noiseScale: 8,
      noiseOctaves: 4,
      heightMultiplier: 2.0,
      smoothingPasses: 3,
    },
  }
}
