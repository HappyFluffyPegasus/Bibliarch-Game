import {
  ShaderMaterial,
  Effect,
  Color3,
  Color4,
  Vector3,
  Scene,
  Mesh,
  StandardMaterial,
  PBRMaterial,
  Texture,
  RawTexture,
  Constants,
  type AbstractMesh,
} from '@babylonjs/core'

/**
 * Custom toon/cell shading material for Babylon.js.
 * Ports the Three.js toon shader system with identical visual results.
 */

// ── Register custom shader code with Babylon.js Effect store ──

// Toon character shader (non-skinned meshes)
Effect.ShadersStore['toonVertexShader'] = `
precision highp float;

// Babylon.js built-in attributes
attribute vec3 position;
attribute vec3 normal;

// Babylon.js built-in uniforms
uniform mat4 worldViewProjection;
uniform mat4 worldView;
uniform mat4 world;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vNormal = normalize(mat3(world) * normal);
  vec4 mvPosition = worldView * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`

Effect.ShadersStore['toonFragmentShader'] = `
precision highp float;

uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform float uSteps;
uniform float uAmbient;
uniform vec3 uRimColor;
uniform float uRimPower;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uLightDirection);

  // Diffuse (cel-shaded steps)
  float NdotL = dot(normal, lightDir);
  float intensity = (NdotL * 0.5 + 0.5); // Remap from [-1,1] to [0,1]
  float stepped = floor(intensity * uSteps) / uSteps;
  stepped = max(stepped, uAmbient);

  vec3 diffuse = uColor * stepped;

  // Rim lighting (optional soft edge highlight)
  vec3 viewDir = normalize(vViewPosition);
  float rim = 1.0 - max(dot(normal, viewDir), 0.0);
  rim = pow(rim, uRimPower);
  vec3 rimLight = uRimColor * rim * 0.3;

  gl_FragColor = vec4(diffuse + rimLight, 1.0);
}
`

// Toon terrain shader (vertex colors)
Effect.ShadersStore['toonTerrainVertexShader'] = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;

uniform mat4 worldViewProjection;
uniform mat4 world;

varying vec3 vColor;
varying vec3 vNormal;

void main() {
  vColor = color.rgb;
  // Transform normal to world space using the world matrix (mat3 portion)
  vNormal = normalize(mat3(world) * normal);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`

Effect.ShadersStore['toonTerrainFragmentShader'] = `
precision highp float;

uniform vec3 uLightDirection;
uniform float uSteps;
uniform float uAmbient;

varying vec3 vColor;
varying vec3 vNormal;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uLightDirection);

  float NdotL = dot(normal, lightDir);
  float intensity = (NdotL * 0.5 + 0.5);
  float stepped = floor(intensity * uSteps) / uSteps;
  stepped = max(stepped, uAmbient);

  gl_FragColor = vec4(vColor * stepped, 1.0);
}
`

// Outline shader (inverted hull technique)
Effect.ShadersStore['outlineVertexShader'] = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;

uniform mat4 worldViewProjection;
uniform float outlineThickness;

void main() {
  vec3 pos = position + normal * outlineThickness;
  gl_Position = worldViewProjection * vec4(pos, 1.0);
}
`

Effect.ShadersStore['outlineFragmentShader'] = `
precision highp float;

uniform vec3 outlineColor;

void main() {
  gl_FragColor = vec4(outlineColor, 1.0);
}
`

// Skinned outline shader
Effect.ShadersStore['skinnedOutlineVertexShader'] = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;

uniform mat4 worldViewProjection;
uniform mat4 view;
uniform mat4 projection;
uniform mat4 world;
uniform float outlineThickness;

#include<bonesDeclaration>

void main() {
  mat4 finalWorld = world;

  #include<bonesVertex>

  vec4 worldPos = finalWorld * vec4(position, 1.0);
  vec3 worldNormal = normalize(mat3(finalWorld) * normal);

  // Push vertices out along normal in view space for perspective-correct outline
  vec4 viewPos = view * worldPos;
  vec3 viewNormal = normalize(mat3(view) * worldNormal);
  viewPos.xy += normalize(viewNormal.xy) * outlineThickness;

  gl_Position = projection * viewPos;
}
`

Effect.ShadersStore['skinnedOutlineFragmentShader'] = `
precision highp float;

uniform vec3 outlineColor;

void main() {
  gl_FragColor = vec4(outlineColor, 1.0);
}
`

// Colored shadow toon shader (for skinned meshes - uses MeshToonMaterial equivalent)
// This implements 2-tone cel shading with proper bone animation support
Effect.ShadersStore['coloredShadowVertexShader'] = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;

#include<bonesDeclaration>

varying vec3 vNormal;
varying vec2 vUv;

void main() {
  mat4 finalWorld = world;

  #include<bonesVertex>

  vec4 worldPos = finalWorld * vec4(position, 1.0);
  vNormal = normalize(mat3(finalWorld) * normal);
  vUv = uv;
  gl_Position = projection * view * worldPos;
}
`

Effect.ShadersStore['coloredShadowFragmentShader'] = `
precision highp float;

uniform vec3 uColor;
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uLightDirection;

varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uLightDirection);

  // 2-step cel shading (shadow/lit boundary)
  float NdotL = dot(normal, lightDir);
  float intensity = (NdotL * 0.5 + 0.5);
  // Sharp 2-tone: shadow = 0.706 (180/255), lit = 1.0
  float stepped = intensity > 0.5 ? 1.0 : 0.706;

  vec3 baseColor = uColor;
  if (uHasMap > 0.5) {
    vec4 texColor = texture2D(uMap, vUv);
    baseColor = baseColor * texColor.rgb;
  }

  gl_FragColor = vec4(baseColor * stepped, 1.0);
}
`

// ── Material Factories ──────────────────────────────────────

export interface OutlineMaterialOptions {
  color?: Color3 | string | number
  thickness?: number
}

function parseColor(c: Color3 | string | number | undefined, fallback: Color3 = Color3.Black()): Color3 {
  if (!c) return fallback
  if (c instanceof Color3) return c
  if (typeof c === 'string') return Color3.FromHexString(c.startsWith('#') ? c : `#${c}`)
  // number → hex string
  const hex = '#' + c.toString(16).padStart(6, '0')
  return Color3.FromHexString(hex)
}

export function createOutlineMaterial(scene: Scene, options: OutlineMaterialOptions = {}): ShaderMaterial {
  const color = parseColor(options.color, Color3.Black())
  const thickness = options.thickness ?? 0.02

  const material = new ShaderMaterial('outlineMaterial', scene, {
    vertex: 'outline',
    fragment: 'outline',
  }, {
    attributes: ['position', 'normal'],
    uniforms: ['worldViewProjection', 'outlineColor', 'outlineThickness'],
  })

  material.setColor3('outlineColor', color)
  material.setFloat('outlineThickness', thickness)
  material.sideOrientation = Mesh.BACKSIDE
  material.depthFunction = Constants.LEQUAL

  return material
}

export function createSkinnedOutlineMaterial(scene: Scene, options: OutlineMaterialOptions = {}): ShaderMaterial {
  const color = parseColor(options.color, Color3.Black())
  const thickness = options.thickness ?? 0.012

  const material = new ShaderMaterial('skinnedOutlineMaterial', scene, {
    vertex: 'skinnedOutline',
    fragment: 'skinnedOutline',
  }, {
    attributes: ['position', 'normal'],
    uniforms: ['worldViewProjection', 'view', 'projection', 'world', 'outlineColor', 'outlineThickness'],
    needAlphaBlending: false,
  })

  material.setColor3('outlineColor', color)
  material.setFloat('outlineThickness', thickness)
  material.sideOrientation = Mesh.BACKSIDE

  return material
}

// ── Colored Shadow Material (skinned mesh toon material) ──

export interface ColoredShadowMaterialOptions {
  color: Color3 | string | number
  map?: Texture | null
}

export function createColoredShadowMaterial(scene: Scene, options: ColoredShadowMaterialOptions): ShaderMaterial {
  const color = parseColor(options.color)

  const material = new ShaderMaterial('coloredShadowMaterial', scene, {
    vertex: 'coloredShadow',
    fragment: 'coloredShadow',
  }, {
    attributes: ['position', 'normal', 'uv'],
    uniforms: ['worldViewProjection', 'world', 'view', 'projection', 'uColor', 'uMap', 'uHasMap', 'uLightDirection'],
    needAlphaBlending: false,
  })

  material.backFaceCulling = false
  material.setColor3('uColor', color)
  material.setFloat('uHasMap', options.map ? 1.0 : 0.0)
  if (options.map) {
    material.setTexture('uMap', options.map)
  }
  material.setVector3('uLightDirection', new Vector3(1, 1, 1).normalize())

  // Store metadata
  ;(material as any)._toonColor = color.clone()
  ;(material as any)._isToonMaterial = true

  return material
}

// ── Toon Material (non-skinned) ──

export interface ToonMaterialOptions {
  color?: Color3 | string | number
  lightDirection?: Vector3
  steps?: number
  ambient?: number
  rimColor?: Color3 | string | number
  rimPower?: number
  skinning?: boolean
}

export function createToonMaterial(scene: Scene, options: ToonMaterialOptions = {}): ShaderMaterial {
  const color = parseColor(options.color, Color3.White())
  const rimColor = parseColor(options.rimColor, Color3.White())

  if (options.skinning) {
    // For skinned meshes, use the colored shadow material
    return createColoredShadowMaterial(scene, { color })
  }

  const material = new ShaderMaterial('toonMaterial', scene, {
    vertex: 'toon',
    fragment: 'toon',
  }, {
    attributes: ['position', 'normal'],
    uniforms: ['worldViewProjection', 'worldView', 'world', 'uColor', 'uLightDirection', 'uSteps', 'uAmbient', 'uRimColor', 'uRimPower'],
  })

  material.backFaceCulling = false
  material.setColor3('uColor', color)
  material.setVector3('uLightDirection', options.lightDirection ?? new Vector3(1, 1, 1).normalize())
  material.setFloat('uSteps', options.steps ?? 4)
  material.setFloat('uAmbient', options.ambient ?? 0.25)
  material.setColor3('uRimColor', rimColor)
  material.setFloat('uRimPower', options.rimPower ?? 3.0)

  // Store metadata
  ;(material as any)._toonColor = color.clone()
  ;(material as any)._isToonMaterial = true

  return material
}

export function setToonMaterialColor(material: ShaderMaterial, color: Color3 | string | number): void {
  const c = parseColor(color)

  if ((material as any).uColor !== undefined || material.getEffect()?.getUniform('uColor')) {
    material.setColor3('uColor', c)
  }

  ;(material as any)._toonColor = c
}

export function getToonMaterialColor(material: ShaderMaterial): Color3 {
  if ((material as any)._toonColor) {
    return (material as any)._toonColor
  }
  return Color3.White()
}

/**
 * Convert a standard material to toon shading. Preserves the base color.
 */
export function convertToToonMaterial(
  scene: Scene,
  originalMaterial: any,
  skinning: boolean = false
): ShaderMaterial {
  let color = new Color3(0.8, 0.8, 0.8)

  if (originalMaterial instanceof StandardMaterial || originalMaterial instanceof PBRMaterial) {
    const diffuse = (originalMaterial as StandardMaterial).diffuseColor ||
                    (originalMaterial as PBRMaterial).albedoColor
    if (diffuse) {
      color = diffuse.clone()
    }
  }

  return createToonMaterial(scene, { color, skinning })
}

// ── Toon Terrain Material ──

export interface ToonTerrainMaterialOptions {
  lightDirection?: Vector3
  steps?: number
  ambient?: number
}

export function createToonTerrainMaterial(scene: Scene, options: ToonTerrainMaterialOptions = {}): ShaderMaterial {
  const material = new ShaderMaterial('toonTerrainMaterial', scene, {
    vertex: 'toonTerrain',
    fragment: 'toonTerrain',
  }, {
    attributes: ['position', 'normal', 'color'],
    uniforms: ['worldViewProjection', 'world', 'uLightDirection', 'uSteps', 'uAmbient'],
  })

  material.setVector3('uLightDirection', options.lightDirection ?? new Vector3(1, 1, 1).normalize())
  material.setFloat('uSteps', options.steps ?? 4)
  material.setFloat('uAmbient', options.ambient ?? 0.35)

  return material
}
