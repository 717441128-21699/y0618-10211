import * as THREE from "three";
import type { CFDataset, Vec3 } from "@/types/cfd";

function fieldAt(dataset: CFDataset, field: string, step: number, p: THREE.Vector3): THREE.Vector3 {
  const f = dataset.fields[field];
  if (!f) return new THREE.Vector3();
  const mesh = dataset.mesh;
  const pts = mesh.points;
  const npc = mesh.pointCount;
  let best = 0;
  let bestD = Infinity;
  const probe = step * 3;
  for (let i = 0; i < npc; i++) {
    const dx = pts[i * 3] - p.x;
    const dy = pts[i * 3 + 1] - p.y;
    const dz = pts[i * 3 + 2] - p.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  const data = f.timesteps[Math.min(step, f.timesteps.length - 1)] || f.timesteps[0];
  if (f.type === "vector") {
    return new THREE.Vector3(data[best * 3], data[best * 3 + 1], data[best * 3 + 2]);
  }
  return new THREE.Vector3(data[best], 0, 0);
}

export interface StreamlinePoint {
  pos: Vec3;
  mag: number;
}

export function integrateStreamline(
  dataset: CFDataset,
  field: string,
  step: number,
  seed: Vec3,
  options: { steps?: number; stepSize?: number; direction?: "both" | "forward" | "backward" } = {}
): { positions: Float32Array; magnitudes: Float32Array; count: number } {
  const { steps = 80, stepSize = 0.08, direction = "both" } = options;
  const bb = dataset.mesh.boundingBox;
  const inBounds = (v: THREE.Vector3) =>
    v.x >= bb.min[0] - 0.2 && v.x <= bb.max[0] + 0.2 &&
    v.y >= bb.min[1] - 0.2 && v.y <= bb.max[1] + 0.2 &&
    v.z >= bb.min[2] - 0.2 && v.z <= bb.max[2] + 0.2;

  const trace = (dir: number): StreamlinePoint[] => {
    const out: StreamlinePoint[] = [];
    const cur = new THREE.Vector3(seed[0], seed[1], seed[2]);
    for (let s = 0; s < steps; s++) {
      const vel = fieldAt(dataset, field, step, cur);
      const mag = vel.length();
      if (mag < 1e-5) break;
      out.push({ pos: [cur.x, cur.y, cur.z], mag });
      const next = cur.clone().addScaledVector(vel.normalize(), stepSize * dir);
      if (!inBounds(next)) { out.push({ pos: [next.x, next.y, next.z], mag }); break; }
      cur.copy(next);
    }
    return out;
  };

  let pts: StreamlinePoint[] = [];
  if (direction === "forward" || direction === "both") pts = pts.concat(trace(1));
  if (direction === "both") {
    const back = trace(-1).reverse();
    back.pop();
    pts = back.concat(pts);
  } else if (direction === "backward") {
    pts = trace(-1).reverse();
  }

  const positions = new Float32Array(pts.length * 3);
  const magnitudes = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    positions[i * 3] = pts[i].pos[0];
    positions[i * 3 + 1] = pts[i].pos[1];
    positions[i * 3 + 2] = pts[i].pos[2];
    magnitudes[i] = pts[i].mag;
  }
  return { positions, magnitudes, count: pts.length };
}

export function generateSeeds(
  dataset: CFDataset,
  options: { grid?: number; surface?: boolean; count?: number } = {}
): Vec3[] {
  const { grid = 6 } = options;
  const bb = dataset.mesh.boundingBox;
  const seeds: Vec3[] = [];
  const x0 = bb.min[0] + (bb.max[0] - bb.min[0]) * 0.08;
  const xR = bb.max[0] - bb.min[0];
  const yR = bb.max[1] - bb.min[1];
  const zR = bb.max[2] - bb.min[2];
  for (let j = 0; j < grid; j++)
    for (let k = 0; k < Math.max(1, Math.floor(grid / 3)); k++) {
      const y = bb.min[1] + (yR * (j + 0.5)) / grid;
      const z = bb.min[2] + (zR * (k + 0.5)) / Math.max(1, Math.floor(grid / 3));
      seeds.push([x0, y, z]);
    }
  void xR;
  return seeds;
}

export function sampleFieldAtPoint(
  dataset: CFDataset,
  field: string,
  step: number,
  p: Vec3
): { value: number; vector: Vec3; magnitude: number } {
  const f = dataset.fields[field];
  if (!f) return { value: 0, vector: [0, 0, 0], magnitude: 0 };
  const mesh = dataset.mesh;
  const pts = mesh.points;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < mesh.pointCount; i++) {
    const dx = pts[i * 3] - p[0];
    const dy = pts[i * 3 + 1] - p[1];
    const dz = pts[i * 3 + 2] - p[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  const data = f.timesteps[Math.min(step, f.timesteps.length - 1)] || f.timesteps[0];
  if (f.type === "vector") {
    const v: Vec3 = [data[best * 3], data[best * 3 + 1], data[best * 3 + 2]];
    return { value: Math.hypot(v[0], v[1], v[2]), vector: v, magnitude: Math.hypot(v[0], v[1], v[2]) };
  }
  return { value: data[best], vector: [data[best], 0, 0], magnitude: 0 };
}

export function sampleProbeTimeSeries(
  dataset: CFDataset,
  position: Vec3,
  fields: string[]
): { times: number[]; series: Record<string, number[]> } {
  const series: Record<string, number[]> = {};
  for (const f of fields) series[f] = [];
  const times: number[] = [];
  const tcount = dataset.times.length;
  for (let s = 0; s < tcount; s++) {
    times.push(dataset.times[s]);
    for (const f of fields) {
      series[f].push(sampleFieldAtPoint(dataset, f, s, position).value);
    }
  }
  return { times, series };
}
