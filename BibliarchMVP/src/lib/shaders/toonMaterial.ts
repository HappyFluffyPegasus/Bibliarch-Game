import * as THREE from 'three'

/**
 * Custom toon/cell shading material.
 * Uses a stepped gradient for diffuse lighting (cel-shading effect).
 *
 * For skinned meshes, uses Three.js MeshToonMaterial which handles
 * skeletal animation properly.
 */

// Create a 3-tone gradient texture for cel shading
// MeshToonMaterial samples this texture based on light intensity
let threeStepGradient: THREE.DataTexture | null = null

export function getThreeStepGradient(): THREE.DataTexture {
  if (threeStepGradient) return threeStepGradient

  // 2-tone gradient for basic toon shading
  const colors = new Uint8Array([
    180,  // shadow
    255,  // lit
  ])

  threeStepGradient = new THREE.DataTexture(colors, 2, 1, THREE.RedFormat)
  threeStepGradient.needsUpdate = true
  threeStepGradient.minFilter = THREE.NearestFilter
  threeStepGradient.magFilter = THREE.NearestFilter
  threeStepGradient.wrapS = THREE.ClampToEdgeWrapping
  threeStepGradient.wrapT = THREE.ClampToEdgeWrapping

  return threeStepGradient
}

// ────────────────────────────────────────────────────────────────
// Outline material for cel-shading (inverted hull technique)
// ────────────────────────────────────────────────────────────────

export interface OutlineMaterialOptions {
  color?: THREE.Color | string | number
  thickness?: number  // outline thickness, default 0.02
}

export function createOutlineMaterial(options: OutlineMaterialOptions = {}): THREE.ShaderMaterial {
  const color = options.color instanceof THREE.Color
    ? options.color
    : new THREE.Color(options.color ?? 0x000000)

  const thickness = options.thickness ?? 0.02

  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor: { value: color },
      outlineThickness: { value: thickness },
    },
    vertexShader: `
      uniform float outlineThickness;

      void main() {
        vec3 pos = position + normal * outlineThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;

      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.BackSide,  // Render back faces only
    depthWrite: true,
  })
}

// Outline material for skinned meshes - modifies MeshBasicMaterial
export function createSkinnedOutlineMaterial(options: OutlineMaterialOptions = {}): THREE.MeshBasicMaterial {
  const color = options.color instanceof THREE.Color
    ? options.color
    : new THREE.Color(options.color ?? 0x000000)

  const thickness = options.thickness ?? 0.012

  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: thickness }

    // Add uniform declaration
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `uniform float outlineThickness;
void main() {`
    )

    // Displace in clip space - natural perspective makes it thinner when far
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      // Push vertices out along normal for outline
      vec3 viewNormal = normalize(normalMatrix * objectNormal);
      vec4 clipPos = gl_Position;
      vec3 clipNormal = (projectionMatrix * vec4(viewNormal, 0.0)).xyz;
      // Fixed clip-space offset - perspective division naturally scales with distance
      clipPos.xy += normalize(clipNormal.xy) * outlineThickness;
      gl_Position = clipPos;`
    )
  }

  return material
}

// ────────────────────────────────────────────────────────────────
// Colored shadow toon material for skinned meshes
// Uses MeshToonMaterial with onBeforeCompile to add hue shift
// ────────────────────────────────────────────────────────────────

export interface ColoredShadowMaterialOptions {
  color: THREE.Color | string | number
  map?: THREE.Texture | null
}

export function createColoredShadowMaterial(options: ColoredShadowMaterialOptions): THREE.MeshToonMaterial {
  const color = options.color instanceof THREE.Color
    ? options.color
    : new THREE.Color(options.color)

  // Create gradient for 2-tone cel shading (higher shadow value lets ambient color show through)
  const gradientColors = new Uint8Array([180, 255])
  const gradientMap = new THREE.DataTexture(gradientColors, 2, 1, THREE.RedFormat)
  gradientMap.needsUpdate = true
  gradientMap.minFilter = THREE.NearestFilter
  gradientMap.magFilter = THREE.NearestFilter

  const material = new THREE.MeshToonMaterial({
    color,
    map: options.map ?? undefined,
    gradientMap,
    side: THREE.FrontSide,
  })

  ;(material as any)._toonColor = color.clone()
  ;(material as any)._isToonMaterial = true

  return material
}

const TOON_VERTEX_SHADER = `
precision highp float;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`

const TOON_FRAGMENT_SHADER = `
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

export interface ToonMaterialOptions {
  color?: THREE.Color | string | number
  lightDirection?: THREE.Vector3
  steps?: number // Number of shading steps (default 4)
  ambient?: number // Minimum brightness (default 0.2)
  rimColor?: THREE.Color | string | number
  rimPower?: number
  skinning?: boolean
}

export function createToonMaterial(options: ToonMaterialOptions = {}): THREE.Material {
  const color = options.color instanceof THREE.Color
    ? options.color
    : new THREE.Color(options.color ?? 0xffffff)

  // For skinned meshes, use MeshToonMaterial with 3-step gradient
  if (options.skinning) {
    const gradientMap = getThreeStepGradient()

    const material = new THREE.MeshToonMaterial({
      color,
      gradientMap,
      side: THREE.FrontSide,
    })

    // Store metadata for color updates
    ;(material as any)._toonColor = color.clone()
    ;(material as any)._isToonMaterial = true

    return material
  }

  // For non-skinned meshes, use custom shader for more control
  const rimColor = options.rimColor instanceof THREE.Color
    ? options.rimColor
    : new THREE.Color(options.rimColor ?? 0xffffff)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uLightDirection: { value: options.lightDirection ?? new THREE.Vector3(1, 1, 1).normalize() },
      uSteps: { value: options.steps ?? 4 },
      uAmbient: { value: options.ambient ?? 0.25 },
      uRimColor: { value: rimColor },
      uRimPower: { value: options.rimPower ?? 3.0 },
    },
    vertexShader: TOON_VERTEX_SHADER,
    fragmentShader: TOON_FRAGMENT_SHADER,
    side: THREE.FrontSide,
  })

  // Store original color for easy updates
  ;(material as any)._toonColor = color
  ;(material as any)._isToonMaterial = true

  return material
}

/**
 * Update the color of a toon material
 */
export function setToonMaterialColor(material: THREE.Material, color: THREE.Color | string | number): void {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color)

  if (material instanceof THREE.MeshToonMaterial) {
    material.color = c
  } else if (material instanceof THREE.ShaderMaterial && material.uniforms.uColor) {
    material.uniforms.uColor.value = c
  }

  ;(material as any)._toonColor = c
}

/**
 * Get the current color of a toon material
 */
export function getToonMaterialColor(material: THREE.Material): THREE.Color {
  if ((material as any)._toonColor) {
    return (material as any)._toonColor
  }
  if (material instanceof THREE.MeshToonMaterial) {
    return material.color
  }
  if (material instanceof THREE.ShaderMaterial && material.uniforms.uColor) {
    return material.uniforms.uColor.value
  }
  return new THREE.Color(0xffffff)
}

/**
 * Convert a MeshStandardMaterial or MeshPhongMaterial to toon shading.
 * Preserves the base color.
 */
export function convertToToonMaterial(
  originalMaterial: THREE.Material,
  skinning: boolean = false
): THREE.Material {
  let color = new THREE.Color(0xcccccc)

  if (originalMaterial instanceof THREE.MeshStandardMaterial ||
      originalMaterial instanceof THREE.MeshPhongMaterial ||
      originalMaterial instanceof THREE.MeshBasicMaterial ||
      originalMaterial instanceof THREE.MeshLambertMaterial) {
    color = originalMaterial.color.clone()
  }

  return createToonMaterial({ color, skinning })
}

// ────────────────────────────────────────────────────────────────
// Toon terrain material with vertex colors
// ────────────────────────────────────────────────────────────────

const TOON_TERRAIN_VERTEX_SHADER = `
precision highp float;

attribute vec3 color;
varying vec3 vColor;
varying vec3 vNormal;

void main() {
  vColor = color;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const TOON_TERRAIN_FRAGMENT_SHADER = `
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

export interface ToonTerrainMaterialOptions {
  lightDirection?: THREE.Vector3
  steps?: number
  ambient?: number
}

export function createToonTerrainMaterial(options: ToonTerrainMaterialOptions = {}): THREE.Material {
  // Use MeshBasicMaterial with vertex colors for reliability
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.FrontSide,
  })
}
