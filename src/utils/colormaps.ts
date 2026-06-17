import * as THREE from "three";
import type { ColormapName } from "@/types/cfd";

type RGB = [number, number, number];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleGradient(stops: { t: number; c: RGB }[], x: number): RGB {
  if (x <= stops[0].t) return stops[0].c;
  if (x >= stops[stops.length - 1].t) return stops[stops.length - 1].c;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (x >= a.t && x <= b.t) {
      const t = (x - a.t) / (b.t - a.t);
      return [lerp(a.c[0], b.c[0], t), lerp(a.c[1], b.c[1], t), lerp(a.c[2], b.c[2], t)];
    }
  }
  return stops[stops.length - 1].c;
}

const JET_STOPS: { t: number; c: RGB }[] = [
  { t: 0.0, c: [0, 0, 0.5] },
  { t: 0.125, c: [0, 0, 1] },
  { t: 0.375, c: [0, 1, 1] },
  { t: 0.625, c: [0.5, 1, 0.5] },
  { t: 0.875, c: [1, 0.5, 0] },
  { t: 1.0, c: [0.5, 0, 0] },
];

const VIRIDIS_STOPS: { t: number; c: RGB }[] = [
  { t: 0.0, c: [0.267, 0.005, 0.329] },
  { t: 0.25, c: [0.282, 0.14, 0.458] },
  { t: 0.5, c: [0.254, 0.265, 0.53] },
  { t: 0.75, c: [0.207, 0.372, 0.553] },
  { t: 1.0, c: [0.993, 0.906, 0.143] },
];

const PLASMA_STOPS: { t: number; c: RGB }[] = [
  { t: 0.0, c: [0.05, 0.03, 0.53] },
  { t: 0.25, c: [0.42, 0.01, 0.6] },
  { t: 0.5, c: [0.74, 0.16, 0.53] },
  { t: 0.75, c: [0.98, 0.48, 0.32] },
  { t: 1.0, c: [0.94, 0.97, 0.13] },
];

const COOLWARM_STOPS: { t: number; c: RGB }[] = [
  { t: 0.0, c: [0.23, 0.3, 0.75] },
  { t: 0.25, c: [0.43, 0.55, 0.86] },
  { t: 0.5, c: [0.93, 0.92, 0.92] },
  { t: 0.75, c: [0.91, 0.6, 0.46] },
  { t: 1.0, c: [0.69, 0.1, 0.18] },
];

const STOP_MAP: Record<ColormapName, { t: number; c: RGB }[]> = {
  jet: JET_STOPS,
  viridis: VIRIDIS_STOPS,
  plasma: PLASMA_STOPS,
  coolwarm: COOLWARM_STOPS,
};

export function sampleColormap(name: ColormapName, x: number): RGB {
  const v = Math.max(0, Math.min(1, x));
  return sampleGradient(STOP_MAP[name], v);
}

export function buildColormapTexture(name: ColormapName, size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const [r, g, b] = sampleColormap(name, i / (size - 1));
    data[i * 4] = Math.round(r * 255);
    data[i * 4 + 1] = Math.round(g * 255);
    data[i * 4 + 2] = Math.round(b * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function colormapCss(name: ColormapName): string {
  const stops: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const [r, g, b] = sampleColormap(name, i / 8);
    stops.push(`rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}) ${(i / 8) * 100}%`);
  }
  return `linear-gradient(to top, ${stops.join(", ")})`;
}

export const COLORMAP_OPTIONS: { name: ColormapName; label: string }[] = [
  { name: "jet", label: "JET" },
  { name: "viridis", label: "VIRIDIS" },
  { name: "plasma", label: "PLASMA" },
  { name: "coolwarm", label: "COOLWARM" },
];
