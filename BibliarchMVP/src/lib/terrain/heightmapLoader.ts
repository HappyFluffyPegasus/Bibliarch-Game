const MAX_DIM = 4096

/** Clamp a dimension to reasonable bounds */
function clampDim(px: number): number {
  return Math.max(16, Math.min(MAX_DIM, px))
}

export interface HeightmapResult {
  heights: Float32Array
  sizeX: number
  sizeZ: number
}

/**
 * Load a grayscale heightmap from an image file and convert to a Float32Array.
 * Uses the image's actual dimensions (clamped to 16–4096) — no preset snapping.
 * Non-square images produce non-square terrains.
 *
 * @param file - Image file (PNG, JPEG)
 * @returns HeightmapResult with normalized 0-1 height values and actual dimensions
 */
export function loadHeightmapFromFile(file: File): Promise<HeightmapResult> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const sizeX = clampDim(img.naturalWidth)
        const sizeZ = clampDim(img.naturalHeight)

        // Create hidden canvas at actual image dimensions
        const canvas = document.createElement('canvas')
        canvas.width = sizeX
        canvas.height = sizeZ

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas 2D context'))
          return
        }

        // Draw image resized to sizeX x sizeZ
        ctx.drawImage(img, 0, 0, sizeX, sizeZ)

        // Read pixel data
        const imageData = ctx.getImageData(0, 0, sizeX, sizeZ)
        const pixels = imageData.data // RGBA flat array

        const totalCells = sizeX * sizeZ
        const heights = new Float32Array(totalCells)

        for (let i = 0; i < totalCells; i++) {
          const r = pixels[i * 4]
          const g = pixels[i * 4 + 1]
          const b = pixels[i * 4 + 2]

          // Convert to grayscale via luminance formula
          heights[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        }

        resolve({ heights, sizeX, sizeZ })
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
