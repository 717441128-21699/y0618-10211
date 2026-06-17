import type { CFDataset, FieldData, MeshData, Vec3, CellType } from "@/types/cfd";
import { buildSurfaceIndices } from "./parsers/vtkParser";

function bbox(points: Float32Array): { min: Vec3; max: Vec3 } {
  let m0 = Infinity, m1 = Infinity, m2 = Infinity, x0 = -Infinity, x1 = -Infinity, x2 = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const a = points[i], b = points[i + 1], c = points[i + 2];
    if (a < m0) m0 = a; if (b < m1) m1 = b; if (c < m2) m2 = c;
    if (a > x0) x0 = a; if (b > x1) x1 = b; if (c > x2) x2 = c;
  }
  return { min: [m0, m1, m2], max: [x0, x1, x2] };
}

function rangeScalar(data: Float32Array) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) { if (data[i] < min) min = data[i]; if (data[i] > max) max = data[i]; }
  return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 1 };
}
function rangeVector(data: Float32Array) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i += 3) { const m = Math.hypot(data[i], data[i + 1], data[i + 2]); if (m < min) min = m; if (m > max) max = m; }
  return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 1 };
}

function buildStructured(nx: number, ny: number, nz: number, fn: (i: number, j: number, k: number) => Vec3): MeshData {
  const pointCount = nx * ny * nz;
  const points = new Float32Array(pointCount * 3);
  let p = 0;
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const [x, y, z] = fn(i, j, k);
        points[p++] = x; points[p++] = y; points[p++] = z;
      }
  const ccx = Math.max(1, nx - 1);
  const ccy = Math.max(1, ny - 1);
  const ccz = Math.max(1, nz - 1);
  const cellCount = ccx * ccy * ccz;
  const cells = new Uint32Array(cellCount * 9);
  let c = 0;
  for (let k = 0; k < ccz; k++)
    for (let j = 0; j < ccy; j++)
      for (let i = 0; i < ccx; i++) {
        const base = i + j * nx + k * nx * ny;
        cells[c++] = 8;
        cells[c++] = base; cells[c++] = base + 1; cells[c++] = base + 1 + nx; cells[c++] = base + nx;
        cells[c++] = base + nx * ny; cells[c++] = base + 1 + nx * ny; cells[c++] = base + 1 + nx + nx * ny; cells[c++] = base + nx + nx * ny;
      }
  const cellType: CellType = "hex";
  const indices = buildSurfaceIndices(cells, cellType, 8);
  return { points, pointCount, cells, cellCount, cellType, verticesPerCell: 8, indices, boundingBox: bbox(points) };
}

function makeDataset(
  name: string, caseLabel: string, mesh: MeshData,
  pressureSteps: Float32Array[], velocitySteps: Float32Array[], times: number[]
): CFDataset {
  const fields: Record<string, FieldData> = {};
  fields.pressure = { name: "pressure", unit: "Pa", type: "scalar", components: 1, timesteps: pressureSteps, range: rangeScalar(pressureSteps[0]) };
  fields.velocity = { name: "velocity", unit: "m/s", type: "vector", components: 3, timesteps: velocitySteps, range: rangeVector(velocitySteps[0]) };
  return {
    id: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name, caseLabel, mesh, fields, times, source: "sample", fileName: name,
  };
}

function index(i: number, j: number, k: number, nx: number, ny: number): number {
  return i + j * nx + k * nx * ny;
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

export function sampleCylinderFlow(): CFDataset {
  const nx = 90, ny = 48, nz = 6;
  const Lx = 9, Ly = 4.8, Lz = 0.6;
  const cx = 2.2, cy = Ly / 2, R = 0.5;
  const U = 1.0;
  const mesh = buildStructured(nx, ny, nz, (i, j, k) => {
    const x = (i / (nx - 1)) * Lx;
    const y = (j / (ny - 1)) * Ly;
    const z = (k / (nz - 1)) * Lz - Lz / 2;
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d < R + 1e-6) {
      const s = (R + 0.02) / Math.max(d, 1e-4);
      return [cx + dx * s, cy + dy * s, z];
    }
    return [x, y, z];
  });

  const npts = nx * ny * nz;
  const steps = 12;
  const times: number[] = [];
  const pressureSteps: Float32Array[] = [];
  const velocitySteps: Float32Array[] = [];
  const St = 0.2;
  const D = 2 * R;
  const f = St * U / D;
  const period = 1 / f;

  for (let s = 0; s < steps; s++) {
    const t = (s / (steps - 1)) * period * 1.2;
    times.push(+(t * 1000).toFixed(1));
    const pArr = new Float32Array(npts);
    const vArr = new Float32Array(npts * 3);
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const x = (i / (nx - 1)) * Lx;
          const y = (j / (ny - 1)) * Ly;
          const dx = x - cx, dy = y - cy;
          const d = Math.hypot(dx, dy);
          const idx = index(i, j, k, nx, ny);
          let vx = U, vy = 0, vz = 0;
          let pressure = 0;
          const inside = d < R + 0.02;
          if (d < 3.0) {
            const block = Math.exp(-Math.pow((d - R) / 0.35, 2)) * (d > R ? 0 : 1);
            const mag = U * (1 - Math.exp(-(d - R) * 3));
            vx *= clamp(mag, 0, 1);
            const theta = Math.atan2(dy, dx);
            const tang = U * R * R / Math.max(d, R) * (d > R ? 1 : 0);
            vx += -tang * Math.sin(theta) * 0.4;
            vy += tang * Math.cos(theta) * 0.4;
            void block;
          }
          if (x > cx && d > R) {
            const phase = t * 2 * Math.PI * f;
            const xs = x - cx;
            const sign = Math.sin(phase - xs * 1.6) * (1 - Math.exp(-xs / 1.2));
            const decay = Math.exp(-Math.pow((y - cy) / 1.1, 2)) * Math.exp(-xs / 6);
            const amp = 0.55 * decay;
            vy += sign * amp;
            vx += -0.15 * Math.cos(phase - xs * 1.6) * decay;
            const wake = Math.exp(-Math.pow((d - R) / 0.8, 2)) * Math.exp(-xs / 5);
            vx *= 1 - 0.6 * wake;
            pressure -= 0.5 * 0.6 * sign * decay;
          }
          pressure += 0.5 * 0.8 * (1 - Math.min(1, Math.hypot(vx, vy) / U)) * Math.exp(-Math.max(0, R - d) / 0.3);
          if (x < cx && Math.abs(y - cy) < R) {
            pressure += 0.5 * 0.5 * Math.exp(-(x - (cx - R)) / 0.4);
          }
          if (inside) { vx = 0; vy = 0; }
          vArr[idx * 3] = +vx.toFixed(5);
          vArr[idx * 3 + 1] = +vy.toFixed(5);
          vArr[idx * 3 + 2] = +vz.toFixed(5);
          pArr[idx] = +(pressure * 1000).toFixed(3);
        }
    pressureSteps.push(pArr);
    velocitySteps.push(vArr);
  }
  return makeDataset("cylinder_flow", "Re=100 卡门涡街", mesh, pressureSteps, velocitySteps, times);
}

export function sampleAirfoilFlow(): CFDataset {
  const nx = 80, ny = 40, nz = 4;
  const Lx = 6, Ly = 3, Lz = 0.5;
  const chord = 1.6;
  const mesh = buildStructured(nx, ny, nz, (i, j, k) => {
    const x = (i / (nx - 1)) * Lx - 0.5;
    const y = (j / (ny - 1)) * Ly - Ly / 2;
    const z = (k / (nz - 1)) * Lz - Lz / 2;
    return [x, y, z];
  });
  const npts = nx * ny * nz;
  const aoa = 8 * Math.PI / 180;
  const U = 1.0;
  const pArr = new Float32Array(npts);
  const vArr = new Float32Array(npts * 3);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i =  0; i < nx; i++) {
        const x = (i / (nx - 1)) * Lx - 0.5;
        const y = (j / (ny - 1)) * Ly - Ly / 2;
        const idx = index(i, j, k, nx, ny);
        const xc = x - 0.2;
        const t = xc / chord;
        let thickness = 0.12 * chord * 5 * (0.2969 * Math.sqrt(Math.max(0, t)) - 0.126 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1015 * t * t * t * t);
        if (t < 0 || t > 1) thickness = 0;
        const camber = t > 0 && t < 1 ? 0.05 * chord * Math.sin(Math.PI * t) : 0;
        const dyAir = camber;
        const dist = Math.abs(y - dyAir) - thickness;
        const near = Math.exp(-Math.max(0, dist) / 0.25) * (t > 0 && t < 1 ? 1 : 0);
        const onSurface = Math.abs(y - dyAir) < thickness + 0.01 && t > 0 && t < 1;
        let vx = U, vy = U * Math.sin(aoa);
        vx = U * Math.cos(aoa); vy = U * Math.sin(aoa);
        vx *= 1 + 0.4 * near * Math.sign(xc);
        vy += 0.35 * near * Math.sign(xc);
        const liftCirc = 0.9 * Math.exp(-Math.hypot(xc, y - dyAir) / 1.2) * (t > 0 && t < 1 ? 1 : 0);
        vy += liftCirc;
        const pressure = -0.5 * near * 1.2 * Math.sign(xc) - 0.4 * liftCirc;
        if (onSurface) { vx *= 0.1; vy *= 0.1; }
        vArr[idx * 3] = vx; vArr[idx * 3 + 1] = vy; vArr[idx * 3 + 2] = 0;
        pArr[idx] = pressure * 1000;
      }
  return makeDataset("airfoil", "NACA 翼型 α=8°", mesh, [pArr], [vArr], [0]);
}

export function sampleJetMixing(): CFDataset {
  const nx = 70, ny = 50, nz = 6;
  const Lx = 7, Ly = 5, Lz = 1;
  const mesh = buildStructured(nx, ny, nz, (i, j, k) => {
    const x = (i / (nx - 1)) * Lx;
    const y = (j / (ny - 1)) * Ly - Ly / 2;
    const z = (k / (nz - 1)) * Lz - Lz / 2;
    return [x, y, z];
  });
  const npts = nx * ny * nz;
  const steps = 10;
  const times: number[] = [];
  const pressureSteps: Float32Array[] = [];
  const velocitySteps: Float32Array[] = [];
  const Uj = 2.0;
  for (let s = 0; s < steps; s++) {
    const t = s / (steps - 1);
    times.push(+(t * 500).toFixed(1));
    const pArr = new Float32Array(npts);
    const vArr = new Float32Array(npts * 3);
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const x = (i / (nx - 1)) * Lx;
          const y = (j / (ny - 1)) * Ly - Ly / 2;
          const idx = index(i, j, k, nx, ny);
          const r = Math.hypot(y);
          const halfWidth = 0.35 + 0.18 * x;
          const profile = Math.exp(-Math.pow(r / halfWidth, 2));
          const decay = 1 / (1 + 0.35 * x);
          let vx = Uj * profile * decay;
          const turbulence = 0.25 * Math.sin(x * 3 + t * 12 + r * 4) * (1 - decay);
          vx += turbulence * profile;
          const vy = 0.15 * Math.sin(x * 2.5 - t * 10) * profile * decay;
          const pressure = -0.5 * profile * decay * 0.8;
          vArr[idx * 3] = vx; vArr[idx * 3 + 1] = vy; vArr[idx * 3 + 2] = 0;
          pArr[idx] = pressure * 1000;
        }
    pressureSteps.push(pArr);
    velocitySteps.push(vArr);
  }
  return makeDataset("jet_mixing", "喷流 Re=2000", mesh, pressureSteps, velocitySteps, times);
}

export const SAMPLE_DATASETS = [
  { key: "cylinder_flow", label: "圆柱绕流 · 卡门涡街", fn: sampleCylinderFlow },
  { key: "airfoil", label: "翼型绕流 · 升力", fn: sampleAirfoilFlow },
  { key: "jet_mixing", label: "喷流混合 · 湍流", fn: sampleJetMixing },
];
