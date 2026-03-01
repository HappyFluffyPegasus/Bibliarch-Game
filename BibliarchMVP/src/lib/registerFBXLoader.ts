import { SceneLoader } from '@babylonjs/core'
import { FBXLoader } from 'babylonjs-fbx-loader'

// Register the FBX loader plugin once (idempotent — safe to import multiple times)
let registered = false
if (!registered) {
  SceneLoader.RegisterPlugin(new FBXLoader().createPlugin())
  registered = true
}
