import * as THREE from "three";
import type { CFDataset, MeshData, Vec3 } from "@/types/cfd";

export function extractBoundaryTriangles(mesh: MeshData): { indices: Uint32Array; count: number } {
  const cells = mesh.cells;
  if (cells.length === 0) {
    return { indices: mesh.indices, count: mesh.indices.length / 3 };
  }
  const faceTable = new Map<string, number[]>();
  const faceList: number[][] = [];

  const addFace = (a: number, b: number, c: number) => {
    const key = [a, b, c].sort((x, y) => x - y).join(",");
    const idx = faceList.length;
    faceList.push([a, b, c]);
    const arr = faceTable.get(key);
    if (arr) arr.push(idx);
    else faceTable.set(key, [idx]);
  };

  let o = 0;
  while (o < cells.length) {
    const n = cells[o++];
    const v: number[] = [];
    for (let i = 0; i < n; i++) v.push(cells[o++]);
    if (mesh.cellType === "hex" && n === 8) {
      addFace(v[0], v[1], v[2]); addFace(v[0], v[2], v[3]);
      addFace(v[4], v[7], v[6]); addFace(v[4], v[6], v[5]);
      addFace(v[0], v[4], v[5]); addFace(v[0], v[5], v[1]);
      addFace(v[1], v[5], v[6]); addFace(v[1], v[6], v[2]);
      addFace(v[2], v[6], v[7]); addFace(v[2], v[7], v[3]);
      addFace(v[3], v[7], v[4]); addFace(v[3], v[4], v[0]);
    } else if (mesh.cellType === "quad" && n === 4) {
      addFace(v[0], v[1], v[2]);
      addFace(v[0], v[2], v[3]);
    } else if (mesh.cellType === "tetra" && n === 4) {
      addFace(v[0], v[1], v[2]);
      addFace(v[0], v[2], v[3]);
      addFace(v[0], v[3], v[1]);
      addFace(v[1], v[3], v[2]);
    } else if (mesh.cellType === "tri" && n === 3) {
      addFace(v[0], v[1], v[2]);
    }
  }

  const out: number[] = [];
  for (const [, idxs] of faceTable) {
    if (idxs.length === 1) {
      const [a, b, c] = faceList[idxs[0]];
      out.push(a, b, c);
    }
  }
  return { indices: new Uint32Array(out), count: out.length / 3 };
}

export function buildGeometry(mesh: MeshData, boundaryOnly: boolean): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(mesh.points, 3));
  const { indices } = boundaryOnly ? extractBoundaryTriangles(mesh) : { indices: mesh.indices };
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

export function fieldAttribute(dataset: CFDataset, field: string, step: number): Float32Array {
  const f = dataset.fields[field];
  const n = dataset.mesh.pointCount;
  const out = new Float32Array(n);
  if (!f) return out;
  const data = f.timesteps[Math.min(step, f.timesteps.length - 1)] || f.timesteps[0];
  if (f.type === "vector") {
    for (let i = 0; i < n; i++) {
      out[i] = Math.hypot(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    }
  } else {
    for (let i = 0; i < n; i++) out[i] = data[i];
  }
  return out;
}

export interface PlaneDef {
  normal: Vec3;
  point: Vec3;
}

export function sliceMesh(dataset: CFDataset, plane: PlaneDef, maxPoints = 20000, field = "pressure", timestep = 0): {
  positions: Float32Array;
  values: Float32Array;
  count: number;
} {
  const mesh = dataset.mesh;
  const pts = mesh.points;
  const cells = mesh.cells;
  if (cells.length === 0) return { positions: new Float32Array(0), values: new Float32Array(0), count: 0 };
  const nx = plane.normal[0], ny = plane.normal[1], nz = plane.normal[2];
  const len = Math.hypot(nx, ny, nz) || 1;
  const a = nx / len, b = ny / len, c = nz / len;
  const d = -(a * plane.point[0] + b * plane.point[1] + c * plane.point[2]);
  const positionsArr: number[] = [];
  const valuesArr: number[] = [];
  const cellField = (idx: number) => {
    const f = dataset.fields[field];
    if (!f) return 0;
    const data = f.timesteps[Math.min(timestep, f.timesteps.length - 1)] || f.timesteps[0];
    if (f.type === "vector") return Math.hypot(data[idx * 3], data[idx * 3 + 1], data[idx * 3 + 2]);
    return data[idx];
  };
  const vsigned = (i: number) => a * pts[i * 3] + b * pts[i * 3 + 1] + c * pts[i * 3 + 2] + d;
  const intersect = (i0: number, i1: number, s0: number, s1: number) => {
    const t = s0 / (s0 - s1);
    return [
      pts[i0 * 3] + t * (pts[i1 * 3] - pts[i0 * 3]),
      pts[i0 * 3 + 1] + t * (pts[i1 * 3 + 1] - pts[i0 * 3 + 1]),
      pts[i0 * 3 + 2] + t * (pts[i1 * 3 + 2] - pts[i0 * 3 + 2]),
    ];
  };
  let o = 0;
  let written = 0;
  const EDGE_EDGES: number[][] = mesh.cellType === "hex"
    ? [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
    : mesh.cellType === "tetra"
    ? [[0,1],[1,2],[2,0],[0,3],[1,3],[2,3]]
    : mesh.cellType === "quad"
    ? [[0,1],[1,2],[2,3],[3,0]]
    : [[0,1],[1,2],[2,0]];
  while (o < cells.length) {
    const n = cells[o++];
    const v: number[] = [];
    for (let i = 0; i < n; i++) v.push(cells[o++]);
    if (v.length < 3) continue;
    const s = v.map((vi) => vsigned(vi));
    const pts3: number[][] = [];
    for (const [i0, i1] of EDGE_EDGES) {
      if (i0 >= v.length || i1 >= v.length) continue;
      const sa = s[i0], sb = s[i1];
      if ((sa <= 0 && sb > 0) || (sa > 0 && sb <= 0) || (sa >= 0 && sb < 0) || (sa < 0 && sb >= 0)) {
        if (sa * sb < 0) pts3.push(intersect(v[i0], v[i1], sa, sb));
      }
    }
    if (pts3.length >= 3 && written < maxPoints) {
      const cx = (pts3[0][0] + pts3[1][0] + pts3[2][0]) / 3;
      const cy = (pts3[0][1] + pts3[1][1] + pts3[2][1]) / 3;
      const cz = (pts3[0][2] + pts3[1][2] + pts3[2][2]) / 3;
      let bi = 0, bd = Infinity;
      for (let k = 0; k < v.length; k++) {
        const dx = pts[v[k] * 3] - cx, dy = pts[v[k] * 3 + 1] - cy, dz = pts[v[k] * 3 + 2] - cz;
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd < bd) { bd = dd; bi = v[k]; }
      }
      const val = cellField(bi);
      for (let p = 0; p < 3; p++) {
        positionsArr.push(pts3[p][0], pts3[p][1], pts3[p][2]);
        valuesArr.push(val);
      }
      written += 3;
    }
  }
  return { positions: new Float32Array(positionsArr), values: new Float32Array(valuesArr), count: positionsArr.length / 3 };
}

export function datasetCenter(dataset: CFDataset): THREE.Vector3 {
  const bb = dataset.mesh.boundingBox;
  return new THREE.Vector3(
    (bb.min[0] + bb.max[0]) / 2,
    (bb.min[1] + bb.max[1]) / 2,
    (bb.min[2] + bb.max[2]) / 2
  );
}

export function datasetSize(dataset: CFDataset): number {
  const bb = dataset.mesh.boundingBox;
  return Math.hypot(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]);
}
