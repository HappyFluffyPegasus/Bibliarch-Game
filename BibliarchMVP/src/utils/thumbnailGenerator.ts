import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

class ThumbnailGenerator {
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private canvas: HTMLCanvasElement | null = null
  private thumbnailCache: Map<string, string> = new Map()
  private modelLoaded: Promise<THREE.Group> | null = null
  private meshMap: Map<string, THREE.Mesh> = new Map()
  private modelGroup: THREE.Group | null = null
  private hairTexture: THREE.Texture | null = null
  private readonly CACHE_VERSION = 'v34-dark-blue'
  private initialized = false

  private init() {
    if (this.initialized || typeof window === 'undefined') return

    // Create offscreen canvas
    this.canvas = document.createElement('canvas')
    this.canvas.width = 256
    this.canvas.height = 256

    // Scene setup - dark slate background to match UI
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1e293b) // Slate-800 to match UI

    // Camera setup - far plane extended for large FBX model
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 10000)
    this.camera.position.set(0, 0, 400)
    this.camera.lookAt(0, 0, 0)

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })
    this.renderer.setSize(256, 256)
    this.renderer.setPixelRatio(1)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    this.scene.add(ambientLight)

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight1.position.set(2, 2, 2)
    this.scene.add(directionalLight1)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    directionalLight2.position.set(-2, -1, -2)
    this.scene.add(directionalLight2)

    // Load blonde/platinum hair texture for nice hair previews
    const textureLoader = new THREE.TextureLoader()
    textureLoader.load('/Textures/Hair Textures by Gell3D/Hair13.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      this.hairTexture = tex
      console.log('Thumbnail hair texture loaded')
    })

    // Load model once
    this.modelLoaded = this.loadModel()
    this.initialized = true
  }

  private async loadModel(): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader()
      loader.load(
        '/models/Bibliarch Maybe.fbx',
        (fbx) => {
          // Keep original FBX scale for thumbnails (easier camera positioning)
          // The model is about 170 units tall at original scale
          this.modelGroup = fbx
          fbx.traverse((node) => {
            if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
              const meshName = node.name || 'unnamed_mesh'
              this.meshMap.set(meshName, node as THREE.Mesh)
            }
          })
          console.log(`Thumbnail generator loaded FBX model with ${this.meshMap.size} meshes`)
          resolve(fbx)
        },
        undefined,
        reject
      )
    })
  }

  private isBaseMesh(meshName: string): boolean {
    const lower = meshName.toLowerCase()
    return lower === 'body' ||
           lower === 'plane072' ||
           (lower.includes('eye') && !lower.includes('brow'))
  }

  private categorizeItem(meshName: string): 'hair' | 'face' | 'top' | 'dress' | 'bottom' | 'shoes' | 'accessory' | 'other' {
    const lower = meshName.toLowerCase()

    if (lower.includes('plane072') || lower.includes('eye')) return 'face'
    if (lower.includes('eyebrow') || lower.includes('brow')) return 'face'
    if (lower.includes('mouth')) return 'face'
    if (lower.includes('glasses')) return 'face'

    if (lower.includes('hair') || lower.includes('pigtail') || lower.includes('ponytail') ||
        lower.includes('bob') || lower.includes('bangs') || lower.includes('bun') || lower.includes('braids') ||
        lower.includes('ahoge') || lower.includes('luke') || lower.includes('strand')) return 'hair'

    if (lower.includes('shirt') || lower.includes('tee') || lower.includes('polo') ||
        lower.includes('sweater') || lower.includes('jacket') || lower.includes('tank') ||
        lower.includes('top') || lower.includes('plane023')) return 'top'

    if (lower.includes('dress')) return 'dress'

    if (lower.includes('pants') || lower.includes('jeans') || lower.includes('short') ||
        lower.includes('skirt')) return 'bottom'

    if (lower.includes('shoe') || lower.includes('boot') || lower.includes('loafer') ||
        lower.includes('sneaker') || lower.includes('mary') || lower.includes('jane')) return 'shoes'

    if (lower.includes('sock') || lower.includes('tight') || lower.includes('stocking') ||
        lower.includes('warmer') || lower.includes('hat') || lower.includes('wing')) return 'accessory'

    return 'other'
  }

  async generateThumbnail(meshName: string, color: string): Promise<string> {
    this.init()

    if (!this.scene || !this.camera || !this.renderer || !this.canvas) {
      return this.createPlaceholder(meshName, color)
    }

    const cacheKey = `${this.CACHE_VERSION}_${meshName}_${color}`

    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!
    }

    await this.modelLoaded

    if (!this.modelGroup) {
      console.warn('Model not loaded')
      return this.createPlaceholder(meshName, color)
    }

    const originalMesh = this.meshMap.get(meshName)
    if (!originalMesh) {
      console.warn(`Mesh ${meshName} not found`)
      return this.createPlaceholder(meshName, color)
    }

    const modelClone = this.modelGroup.clone(true)

    const itemType = this.categorizeItem(meshName)
    const isHairItem = itemType === 'hair'

    modelClone.traverse((node) => {
      // Handle both Mesh and SkinnedMesh (FBX uses SkinnedMesh)
      if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
        const nodeMeshName = node.name || 'unnamed_mesh'

        if (nodeMeshName === meshName) {
          const materials = Array.isArray(node.material) ? node.material : [node.material]
          const newMaterials = materials.map(mat => {
            if (mat) {
              // Use hair texture without tint for clean previews
              if (isHairItem && this.hairTexture) {
                const hairMat = new THREE.MeshStandardMaterial({
                  map: this.hairTexture,
                  color: 0xffffff, // No tint - pure platinum blonde
                  roughness: 0.7,
                  metalness: 0.0
                })
                return hairMat
              }
              // Regular colored material for non-hair items
              const clonedMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(color),
                roughness: 0.6,
                metalness: 0.1
              })
              return clonedMat
            }
            return mat
          })
          node.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials
          node.visible = true
        }
        else {
          // Hide everything else (no base character)
          node.visible = false
        }
      }
    })

    // Clear scene (keep lights - we have 3: ambient + 2 directional)
    while (this.scene.children.length > 3) {
      this.scene.remove(this.scene.children[3])
    }

    this.scene.add(modelClone)
    modelClone.position.set(0, 0, 0)

    // FBX model is ~100x larger than scaled version in Viewer3D
    // Camera rotated 90° to the right from Viewer3D positions (swap X to Z)
    const S = 100
    // itemType already defined above
    let lookAtPoint = new THREE.Vector3(0, 0, 0)

    // Camera positions rotated 90° right: (x, y, z) -> (0, y, -x) for side view
    switch (itemType) {
      case 'hair':
        // HAIR: original (-1.2, 1.7, 0) -> rotated (0, 1.7, 1.2)
        this.camera.position.set(0, 1.7 * S, 1.2 * S)
        this.camera.fov = 40
        lookAtPoint.set(0, 1.65 * S, 0)
        break

      case 'face':
        // Face: rotated side view
        this.camera.position.set(0, 1.5 * S, 1.0 * S)
        this.camera.fov = 35
        lookAtPoint.set(0, 1.5 * S, 0)
        break

      case 'top':
        // TOPS: original (-1.8, 1.2, 0) -> rotated (0, 1.2, 1.8)
        this.camera.position.set(0, 1.2 * S, 1.8 * S)
        this.camera.fov = 45
        lookAtPoint.set(0, 1.1 * S, 0)
        break

      case 'dress':
        // DRESSES: original (-2.8, 1.0, 0) -> rotated (0, 1.0, 2.8)
        this.camera.position.set(0, 1.0 * S, 2.8 * S)
        this.camera.fov = 40
        lookAtPoint.set(0, 1.0 * S, 0)
        break

      case 'bottom':
        // PANTS: original (-2.0, 0.8, 0) -> rotated (0, 0.8, 2.0)
        this.camera.position.set(0, 0.8 * S, 2.0 * S)
        this.camera.fov = 50
        lookAtPoint.set(0, 0.6 * S, 0)
        break

      case 'shoes':
        // SHOES: original (-1.5, 0.3, 0.3) -> rotated (0.3, 0.3, 1.5)
        this.camera.position.set(0.3 * S, 0.3 * S, 1.5 * S)
        this.camera.fov = 45
        lookAtPoint.set(0, 0.1 * S, 0)
        break

      case 'accessory':
        const lower = meshName.toLowerCase()
        if (lower.includes('sock') || lower.includes('tight') || lower.includes('stocking') || lower.includes('warmer')) {
          // Socks use pants camera rotated
          this.camera.position.set(0, 0.8 * S, 2.0 * S)
          this.camera.fov = 50
          lookAtPoint.set(0, 0.6 * S, 0)
        } else {
          // ACCESSORIES: original (-5, 1.55, 0) -> rotated (0, 1.55, 5)
          this.camera.position.set(0, 1.55 * S, 5 * S)
          this.camera.fov = 28
          lookAtPoint.set(0, 1.1 * S, 0)
        }
        break

      default:
        // Default full body view rotated
        this.camera.position.set(0, 1.65 * S, 4 * S)
        this.camera.fov = 30
        lookAtPoint.set(0, 1.4 * S, 0)
        break
    }

    // FBX needs -90° Y rotation like in Viewer3D
    modelClone.rotation.set(0, -Math.PI / 2, 0)

    this.camera.updateProjectionMatrix()
    this.camera.lookAt(lookAtPoint)

    this.renderer.render(this.scene, this.camera)

    const dataURL = this.canvas.toDataURL('image/png')

    this.thumbnailCache.set(cacheKey, dataURL)

    this.scene.remove(modelClone)

    return dataURL
  }

  private createPlaceholder(meshName: string, color: string): string {
    if (typeof document === 'undefined') {
      return ''
    }

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = color
    ctx.fillRect(0, 0, 256, 256)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(meshName, 128, 128)

    return canvas.toDataURL('image/png')
  }

  clearCache() {
    this.thumbnailCache.clear()
  }
}

// Singleton instance
export const thumbnailGenerator = new ThumbnailGenerator()
