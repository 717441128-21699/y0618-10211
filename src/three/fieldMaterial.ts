import * as THREE from "three";

const vertexShader = /* glsl */ `
  attribute float fieldValue;
  varying float vValue;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vValue = fieldValue;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D colormap;
  uniform float uMin;
  uniform float uMax;
  uniform float uOpacity;
  uniform vec3 uEmissive;
  uniform float uEmissiveStrength;
  varying float vValue;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float t = clamp((vValue - uMin) / max(1e-9, (uMax - uMin)), 0.0, 1.0);
    vec3 col = texture2D(colormap, vec2(t, 0.5)).rgb;
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float ndv = max(dot(N, V), 0.0);
    float fres = pow(1.0 - ndv, 2.5);
    vec3 lit = col * (0.55 + 0.45 * ndv) + uEmissive * uEmissiveStrength * col;
    lit += fres * 0.18;
    gl_FragColor = vec4(lit, uOpacity);
  }
`;

export interface FieldSurfaceMaterialParams {
  colormap: THREE.DataTexture;
  min: number;
  max: number;
  opacity?: number;
  emissive?: THREE.Color;
  emissiveStrength?: number;
  clippingPlanes?: THREE.Plane[];
  side?: THREE.Side;
}

export function createFieldSurfaceMaterial(params: FieldSurfaceMaterialParams): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      colormap: { value: params.colormap },
      uMin: { value: params.min },
      uMax: { value: params.max },
      uOpacity: { value: params.opacity ?? 1 },
      uEmissive: { value: params.emissive ?? new THREE.Color(1, 1, 1) },
      uEmissiveStrength: { value: params.emissiveStrength ?? 0.15 },
    },
    vertexShader,
    fragmentShader,
    transparent: (params.opacity ?? 1) < 1,
    side: params.side ?? THREE.DoubleSide,
    clippingPlanes: params.clippingPlanes ?? [],
    clipShadows: true,
    depthWrite: (params.opacity ?? 1) >= 0.99,
  });
}
