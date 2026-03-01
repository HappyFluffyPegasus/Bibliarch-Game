/**
 * Custom GLSL shaders for instanced grass blades with wind animation.
 * Babylon.js port: uses thin instances with built-in instance matrix.
 */

export const grassVertexShader = /* glsl */ `
  precision highp float;

  attribute vec3 position;

  uniform mat4 worldViewProjection;
  uniform mat4 viewMatrix;
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindFrequency;

  #include<instancesDeclaration>

  varying vec3 vColor;
  varying float vHeightFactor;

  void main() {
    #include<instancesVertex>

    vHeightFactor = position.y;

    vec4 worldPos = finalWorld * vec4(position, 1.0);

    // Wind sway
    float swayAmount = vHeightFactor * vHeightFactor;
    float windX = sin(uTime * uWindFrequency + worldPos.x * 0.4 + worldPos.z * 0.2) * uWindStrength * swayAmount;
    float windZ = sin(uTime * uWindFrequency * 0.7 + worldPos.x * 0.2 + worldPos.z * 0.5) * uWindStrength * 0.6 * swayAmount;

    worldPos.x += windX;
    worldPos.z += windZ;

    gl_Position = viewProjection * worldPos;

    // Default green color (instance color would be set via custom attribute)
    vColor = vec3(0.2, 0.6, 0.2);
  }
`

export const grassFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vHeightFactor;

  void main() {
    float brightness = 0.65 + vHeightFactor * 0.45;
    vec3 color = vColor * brightness;
    gl_FragColor = vec4(color, 1.0);
  }
`
