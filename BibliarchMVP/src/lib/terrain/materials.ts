import { TerrainMaterialId, TerrainMaterial } from '@/types/world'

/**
 * All terrain material definitions.
 * Colors are RGB in 0-1 range for direct use in Three.js shaders/vertex colors.
 */
export const TERRAIN_MATERIALS: Record<TerrainMaterialId, TerrainMaterial> = {
  // ── Natural ──────────────────────────────────────────────
  [TerrainMaterialId.Grass]: {
    id: TerrainMaterialId.Grass,
    name: 'Grass',
    color: [0.30, 0.68, 0.31],
    roughness: 0.9,
    category: 'natural',
    hasGrass: true,
    grassDensity: 0.8,
    grassColor: [0.25, 0.55, 0.22],
  },
  [TerrainMaterialId.Sand]: {
    id: TerrainMaterialId.Sand,
    name: 'Sand',
    color: [0.83, 0.73, 0.55],
    roughness: 0.95,
    category: 'natural',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Rock]: {
    id: TerrainMaterialId.Rock,
    name: 'Rock',
    color: [0.55, 0.53, 0.50],
    roughness: 0.85,
    category: 'natural',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Snow]: {
    id: TerrainMaterialId.Snow,
    name: 'Snow',
    color: [0.95, 0.96, 0.98],
    roughness: 0.6,
    category: 'natural',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Dirt]: {
    id: TerrainMaterialId.Dirt,
    name: 'Dirt',
    color: [0.55, 0.39, 0.26],
    roughness: 0.95,
    category: 'natural',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Mud]: {
    id: TerrainMaterialId.Mud,
    name: 'Mud',
    color: [0.40, 0.30, 0.20],
    roughness: 0.7,
    category: 'natural',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Ice]: {
    id: TerrainMaterialId.Ice,
    name: 'Ice',
    color: [0.75, 0.88, 0.95],
    roughness: 0.15,
    category: 'natural',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Gravel]: {
    id: TerrainMaterialId.Gravel,
    name: 'Gravel',
    color: [0.63, 0.60, 0.57],
    roughness: 0.9,
    category: 'natural',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Clay]: {
    id: TerrainMaterialId.Clay,
    name: 'Clay',
    color: [0.72, 0.45, 0.32],
    roughness: 0.8,
    category: 'natural',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.DeadGrass]: {
    id: TerrainMaterialId.DeadGrass,
    name: 'Dead Grass',
    color: [0.62, 0.58, 0.35],
    roughness: 0.9,
    category: 'natural',
    hasGrass: true,
    grassDensity: 0.3,
    grassColor: [0.55, 0.50, 0.28],
  },

  // ── Urban ────────────────────────────────────────────────
  [TerrainMaterialId.Concrete]: {
    id: TerrainMaterialId.Concrete,
    name: 'Concrete',
    color: [0.73, 0.73, 0.72],
    roughness: 0.85,
    category: 'urban',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Asphalt]: {
    id: TerrainMaterialId.Asphalt,
    name: 'Asphalt',
    color: [0.25, 0.25, 0.27],
    roughness: 0.9,
    category: 'urban',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Cobblestone]: {
    id: TerrainMaterialId.Cobblestone,
    name: 'Cobblestone',
    color: [0.58, 0.55, 0.50],
    roughness: 0.85,
    category: 'urban',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Brick]: {
    id: TerrainMaterialId.Brick,
    name: 'Brick',
    color: [0.70, 0.33, 0.24],
    roughness: 0.85,
    category: 'urban',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.WoodPlanks]: {
    id: TerrainMaterialId.WoodPlanks,
    name: 'Wood Planks',
    color: [0.60, 0.43, 0.27],
    roughness: 0.75,
    category: 'urban',
    hasGrass: false,
    grassDensity: 0,
  },

  // ── Fantasy ──────────────────────────────────────────────
  [TerrainMaterialId.Crystal]: {
    id: TerrainMaterialId.Crystal,
    name: 'Crystal',
    color: [0.60, 0.80, 0.95],
    roughness: 0.1,
    category: 'fantasy',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Lava]: {
    id: TerrainMaterialId.Lava,
    name: 'Lava',
    color: [0.90, 0.25, 0.05],
    roughness: 0.5,
    category: 'fantasy',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Corrupted]: {
    id: TerrainMaterialId.Corrupted,
    name: 'Corrupted',
    color: [0.30, 0.10, 0.35],
    roughness: 0.8,
    category: 'fantasy',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.MagicGlow]: {
    id: TerrainMaterialId.MagicGlow,
    name: 'Magic Glow',
    color: [0.40, 0.85, 0.70],
    roughness: 0.3,
    category: 'fantasy',
    hasGrass: false,
    grassDensity: 0,
  },
  [TerrainMaterialId.Void]: {
    id: TerrainMaterialId.Void,
    name: 'Void',
    color: [0.05, 0.02, 0.08],
    roughness: 0.5,
    category: 'fantasy',
    hasGrass: false,
    grassDensity: 0,
  },
}

/** Get material definition by ID */
export function getMaterialDef(id: TerrainMaterialId): TerrainMaterial {
  return TERRAIN_MATERIALS[id] ?? TERRAIN_MATERIALS[TerrainMaterialId.Grass]
}

/** Get RGB color for a material as a Three.js-compatible array */
export function getMaterialColor(id: TerrainMaterialId): [number, number, number] {
  return getMaterialDef(id).color
}

/** Get all materials in a specific category */
export function getMaterialsByCategory(category: 'natural' | 'urban' | 'fantasy'): TerrainMaterial[] {
  return Object.values(TERRAIN_MATERIALS).filter((m) => m.category === category)
}

/** Get all material IDs */
export function getAllMaterialIds(): TerrainMaterialId[] {
  return Object.keys(TERRAIN_MATERIALS).map(Number) as TerrainMaterialId[]
}
