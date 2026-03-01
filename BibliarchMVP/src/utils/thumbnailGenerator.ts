import {
  Engine,
  Scene,
  FreeCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  SceneLoader,
  Texture,
  StandardMaterial,
  AbstractMesh,
  TransformNode,
} from '@babylonjs/core'
import '@babylonjs/loaders'

class ThumbnailGenerator {
  private scene: Scene | null = null
  private camera: FreeCamera | null = null
  private engine: Engine | null = null
  private canvas: HTMLCanvasElement | null = null
  private thumbnailCache: Map<string, string> = new Map()
  private modelLoaded: Promise<TransformNode> | null = null
  private meshMap: Map<string, AbstractMesh> = new Map()
  private modelGroup: TransformNode | null = null
  private hairTexture: Texture | null = null
  private readonly CACHE_VERSION = 'v35-babylon'
  private initialized = false

  private init() {
    if (this.initialized || typeof window === 'undefined') return

    this.canvas = document.createElement('canvas')
    this.canvas.width = 256
    this.canvas.height = 256

    this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true })
    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(0.118, 0.161, 0.231, 1) // Slate-800

    this.camera = new FreeCamera('thumbCam', new Vector3(0, 0, 400), this.scene)
    this.camera.setTarget(Vector3.Zero())
    this.camera.fov = 0.785 // ~45 degrees
    this.camera.minZ = 1
    this.camera.maxZ = 10000

    const ambient = new HemisphericLight('thumbAmb', new Vector3(0, 1, 0), this.scene)
    ambient.intensity = 0.8

    const dir1 = new DirectionalLight('thumbDir1', new Vector3(-2, -2, -2).normalize(), this.scene)
    dir1.intensity = 0.6

    const dir2 = new DirectionalLight('thumbDir2', new Vector3(2, 1, 2).normalize(), this.scene)
    dir2.intensity = 0.3

    // Load hair texture
    this.hairTexture = new Texture('/Textures/Hair Textures by Gell3D/Hair13.png', this.scene)

    this.modelLoaded = this.loadModel()
    this.initialized = true
  }

  private async loadModel(): Promise<TransformNode> {
    if (!this.scene) throw new Error('Scene not initialized')

    const result = await SceneLoader.ImportMeshAsync('', '/models/', 'Bibliarch Maybe.glb', this.scene)

    const parent = new TransformNode('thumb-model', this.scene)
    for (const mesh of result.meshes) {
      this.meshMap.set(mesh.name, mesh)
      if (!mesh.parent || mesh.parent.name === '__root__') {
        mesh.parent = parent
      }
    }

    this.modelGroup = parent
    // Hide all meshes initially
    parent.getChildMeshes(true).forEach(m => m.setEnabled(false))
    parent.setEnabled(false)

    console.log(`Thumbnail generator loaded model with ${this.meshMap.size} meshes`)
    return parent
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

    if (!this.scene || !this.camera || !this.engine || !this.canvas) {
      return this.createPlaceholder(meshName, color)
    }

    const cacheKey = `${this.CACHE_VERSION}_${meshName}_${color}`
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!
    }

    await this.modelLoaded

    if (!this.modelGroup) {
      return this.createPlaceholder(meshName, color)
    }

    // Show the target mesh, hide everything else
    this.modelGroup.setEnabled(true)
    const itemType = this.categorizeItem(meshName)
    const isHairItem = itemType === 'hair'

    this.modelGroup.getChildMeshes(true).forEach(mesh => {
      if (mesh.name === meshName) {
        mesh.setEnabled(true)
        if (isHairItem && this.hairTexture) {
          const mat = new StandardMaterial('thumb-hair-mat', this.scene!)
          mat.diffuseTexture = this.hairTexture
          mat.diffuseColor = Color3.White()
          mesh.material = mat
        } else {
          const mat = new StandardMaterial('thumb-mat', this.scene!)
          mat.diffuseColor = Color3.FromHexString(color)
          mesh.material = mat
        }
      } else {
        mesh.setEnabled(false)
      }
    })

    // Position camera based on item type
    const S = 100
    let lookAtPoint = Vector3.Zero()

    switch (itemType) {
      case 'hair':
        this.camera.position = new Vector3(0, 1.7 * S, 1.2 * S)
        this.camera.fov = 40 * Math.PI / 180
        lookAtPoint = new Vector3(0, 1.65 * S, 0)
        break
      case 'face':
        this.camera.position = new Vector3(0, 1.5 * S, 1.0 * S)
        this.camera.fov = 35 * Math.PI / 180
        lookAtPoint = new Vector3(0, 1.5 * S, 0)
        break
      case 'top':
        this.camera.position = new Vector3(0, 1.2 * S, 1.8 * S)
        this.camera.fov = 45 * Math.PI / 180
        lookAtPoint = new Vector3(0, 1.1 * S, 0)
        break
      case 'dress':
        this.camera.position = new Vector3(0, 1.0 * S, 2.8 * S)
        this.camera.fov = 40 * Math.PI / 180
        lookAtPoint = new Vector3(0, 1.0 * S, 0)
        break
      case 'bottom':
        this.camera.position = new Vector3(0, 0.8 * S, 2.0 * S)
        this.camera.fov = 50 * Math.PI / 180
        lookAtPoint = new Vector3(0, 0.6 * S, 0)
        break
      case 'shoes':
        this.camera.position = new Vector3(0.3 * S, 0.3 * S, 1.5 * S)
        this.camera.fov = 45 * Math.PI / 180
        lookAtPoint = new Vector3(0, 0.1 * S, 0)
        break
      case 'accessory':
        const lower = meshName.toLowerCase()
        if (lower.includes('sock') || lower.includes('tight') || lower.includes('stocking') || lower.includes('warmer')) {
          this.camera.position = new Vector3(0, 0.8 * S, 2.0 * S)
          this.camera.fov = 50 * Math.PI / 180
          lookAtPoint = new Vector3(0, 0.6 * S, 0)
        } else {
          this.camera.position = new Vector3(0, 1.55 * S, 5 * S)
          this.camera.fov = 28 * Math.PI / 180
          lookAtPoint = new Vector3(0, 1.1 * S, 0)
        }
        break
      default:
        this.camera.position = new Vector3(0, 1.65 * S, 4 * S)
        this.camera.fov = 30 * Math.PI / 180
        lookAtPoint = new Vector3(0, 1.4 * S, 0)
        break
    }

    this.modelGroup.rotation.set(0, -Math.PI / 2, 0)
    this.camera.setTarget(lookAtPoint)

    this.scene.render()

    const dataURL = this.canvas.toDataURL('image/png')
    this.thumbnailCache.set(cacheKey, dataURL)

    // Hide model after render
    this.modelGroup.setEnabled(false)

    return dataURL
  }

  private createPlaceholder(meshName: string, color: string): string {
    if (typeof document === 'undefined') return ''

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

export const thumbnailGenerator = new ThumbnailGenerator()
