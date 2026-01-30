/**
 * Custom GLSL shaders for instanced grass blades with wind animation.
 *
 * The vertex shader reads the instance matrix (position/rotation/scale)
 * and applies sinusoidal wind displacement to the top vertices.
 *
 * Per-instance color is passed via an InstancedBufferAttribute "instanceColor".
 */

export const grassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindFrequency;

  attribute vec3 instanceColor;

  varying vec3 vColor;
  varying float vHeightFactor;

  void main() {
    vColor = instanceColor;

    // position.y = 0 at base, ~1 at tip (normalized blade height)
    vHeightFactor = position.y;

    // Transform to world space via instance matrix
    vec4 worldPos = instanceMatrix * vec4(position, 1.0);

    // Wind sway — only top vertices bend (proportional to height on blade)
    float swayAmount = vHeightFactor * vHeightFactor; // quadratic falloff
    float windX = sin(uTime * uWindFrequency + worldPos.x * 0.4 + worldPos.z * 0.2) * uWindStrength * swayAmount;
    float windZ = sin(uTime * uWindFrequency * 0.7 + worldPos.x * 0.2 + worldPos.z * 0.5) * uWindStrength * 0.6 * swayAmount;

    worldPos.x += windX;
    worldPos.z += windZ;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

export const grassFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vHeightFactor;

  void main() {
    // Slight brightness gradient: darker at base, lighter at tip
    float brightness = 0.65 + vHeightFactor * 0.45;
    vec3 color = vColor * brightness;

    gl_FragColor = vec4(color, 1.0);
  }
`
