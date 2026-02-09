/**
 * Hair texture catalog and undertone system.
 * Users select an undertone, then pick their color.
 * The texture provides shading detail, the color tints it.
 */

export interface HairUndertone {
  id: string
  name: string
  file: string
  // Preview color for the picker UI
  previewColor: string
}

// Named undertones for the picker UI
export const HAIR_UNDERTONES: HairUndertone[] = [
  { id: 'warm', name: 'Warm', file: 'Hair1.png', previewColor: '#D4A84C' },
  { id: 'neutral', name: 'Neutral', file: 'Hair4.png', previewColor: '#B4A898' },
  { id: 'cool', name: 'Cool', file: 'Hair5.png', previewColor: '#9FBFBC' },
  { id: 'platinum', name: 'Platinum', file: 'Hair13.png', previewColor: '#E8E8E0' },
  { id: 'silver', name: 'Silver', file: 'Hair18.png', previewColor: '#D2CDD5' },
  { id: 'copper', name: 'Copper', file: 'Hair2.png', previewColor: '#D08C80' },
  { id: 'rose', name: 'Rose', file: 'Hair3.png', previewColor: '#B89CA4' },
  { id: 'pink', name: 'Pink', file: 'Hair25.png', previewColor: '#E8A0D8' },
  { id: 'hotpink', name: 'Hot Pink', file: 'Hair7.png', previewColor: '#E066E0' },
  { id: 'lavender', name: 'Lavender', file: 'Hair15.png', previewColor: '#C8C8E8' },
  { id: 'violet', name: 'Violet', file: 'Hair9.png', previewColor: '#B070B0' },
  { id: 'mint', name: 'Mint', file: 'Hair47.png', previewColor: '#80D080' },
  { id: 'forest', name: 'Forest', file: 'Hair20.png', previewColor: '#1A3020' },
]

/**
 * Get the texture path for a given undertone ID
 */
export function getUndertoneTexturePath(undertoneId: string): string {
  const undertone = HAIR_UNDERTONES.find(u => u.id === undertoneId)
  const file = undertone?.file || 'Hair1.png'
  return `/Textures/Hair Textures by Gell3D/${file}`
}

/**
 * Get undertone by ID
 */
export function getUndertone(undertoneId: string): HairUndertone | undefined {
  return HAIR_UNDERTONES.find(u => u.id === undertoneId)
}

interface HairTextureEntry {
  file: string
  // Base RGB color of the texture (0-255)
  r: number
  g: number
  b: number
  // Lightness (0-1) for matching light vs dark colors
  lightness: number
}

// Catalog of hair textures with their approximate base colors
const HAIR_TEXTURES: HairTextureEntry[] = [
  // Warm naturals
  { file: 'Hair1.png', r: 212, g: 168, b: 76, lightness: 0.56 },   // Golden blonde
  { file: 'Hair2.png', r: 208, g: 140, b: 128, lightness: 0.66 },  // Coral/salmon
  { file: 'Hair4.png', r: 180, g: 168, b: 152, lightness: 0.65 },  // Light brown/ash
  { file: 'Hair10.png', r: 165, g: 128, b: 69, lightness: 0.46 },  // Reddish brown

  // Cool tones
  { file: 'Hair5.png', r: 159, g: 191, b: 188, lightness: 0.69 },  // Teal/cyan gray
  { file: 'Hair15.png', r: 200, g: 200, b: 232, lightness: 0.85 }, // Lavender
  { file: 'Hair18.png', r: 210, g: 205, b: 215, lightness: 0.82 }, // Silver/gray

  // Pinks/Magentas
  { file: 'Hair3.png', r: 184, g: 156, b: 164, lightness: 0.67 },  // Dusty pink/mauve
  { file: 'Hair7.png', r: 224, g: 102, b: 224, lightness: 0.64 },  // Hot pink/magenta
  { file: 'Hair25.png', r: 232, g: 160, b: 216, lightness: 0.77 }, // Pink
  { file: 'Hair42.png', r: 240, g: 216, b: 232, lightness: 0.89 }, // Light pink

  // Purples
  { file: 'Hair9.png', r: 176, g: 112, b: 176, lightness: 0.56 },  // Purple/violet

  // Greens
  { file: 'Hair20.png', r: 26, g: 48, b: 32, lightness: 0.15 },    // Dark green/black
  { file: 'Hair47.png', r: 128, g: 208, b: 128, lightness: 0.66 }, // Bright green

  // Whites/Platinum
  { file: 'Hair13.png', r: 232, g: 232, b: 224, lightness: 0.91 }, // Platinum/white
]

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    return { r: 128, g: 128, b: 128 }
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Calculate lightness from RGB (0-1)
 */
function getLightness(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  return (max + min) / 2
}

/**
 * Calculate hue from RGB (0-360)
 */
function getHue(r: number, g: number, b: number): number {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  if (d === 0) return 0

  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4

  h *= 60
  if (h < 0) h += 360
  return h
}

/**
 * Calculate color distance using weighted HSL
 * Prioritizes hue matching, then lightness, then saturation
 */
function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const h1 = getHue(r1, g1, b1)
  const h2 = getHue(r2, g2, b2)
  const l1 = getLightness(r1, g1, b1)
  const l2 = getLightness(r2, g2, b2)

  // Hue distance (circular, 0-180)
  let hueDiff = Math.abs(h1 - h2)
  if (hueDiff > 180) hueDiff = 360 - hueDiff

  // Lightness distance (0-1)
  const lightDiff = Math.abs(l1 - l2)

  // RGB distance for grayscale colors where hue is unreliable
  const rgbDist = Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  ) / 441.67 // Normalize to 0-1

  // Check if color is grayscale-ish (low saturation)
  const isGray1 = Math.max(r1, g1, b1) - Math.min(r1, g1, b1) < 30
  const isGray2 = Math.max(r2, g2, b2) - Math.min(r2, g2, b2) < 30

  if (isGray1 || isGray2) {
    // For grays, use lightness + RGB distance
    return lightDiff * 2 + rgbDist
  }

  // Weighted combination: hue matters most, then lightness
  return (hueDiff / 180) * 1.5 + lightDiff * 1.0 + rgbDist * 0.5
}

export interface HairTextureMatch {
  /** Path to the texture file */
  texturePath: string
  /** Tint color to multiply with the texture to get the desired color */
  tintColor: { r: number; g: number; b: number }
  /** The texture's base color */
  baseColor: { r: number; g: number; b: number }
}

/**
 * Find the best matching hair texture for a given color.
 * Returns the texture path and a tint color to adjust to the exact desired color.
 */
export function findBestHairTexture(hexColor: string): HairTextureMatch {
  const target = hexToRgb(hexColor)

  let bestMatch = HAIR_TEXTURES[0]
  let bestDistance = Infinity

  for (const texture of HAIR_TEXTURES) {
    const dist = colorDistance(
      target.r, target.g, target.b,
      texture.r, texture.g, texture.b
    )
    if (dist < bestDistance) {
      bestDistance = dist
      bestMatch = texture
    }
  }

  // Calculate tint color: target / base (clamped)
  // This will be multiplied with the texture to shift it to the desired color
  const tintR = bestMatch.r > 0 ? Math.min(2, target.r / bestMatch.r) : 1
  const tintG = bestMatch.g > 0 ? Math.min(2, target.g / bestMatch.g) : 1
  const tintB = bestMatch.b > 0 ? Math.min(2, target.b / bestMatch.b) : 1

  return {
    texturePath: `/Textures/Hair Textures by Gell3D/${bestMatch.file}`,
    tintColor: {
      r: Math.round(tintR * 128), // Store as 0-255 for THREE.Color
      g: Math.round(tintG * 128),
      b: Math.round(tintB * 128),
    },
    baseColor: {
      r: bestMatch.r,
      g: bestMatch.g,
      b: bestMatch.b,
    },
  }
}

/**
 * Get all available hair texture entries for debugging/preview
 */
export function getAllHairTextures(): HairTextureEntry[] {
  return [...HAIR_TEXTURES]
}
