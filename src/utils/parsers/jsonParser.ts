import type { CFDataset, FieldData, MeshData, Vec3, CellType } from "@/types/cfd";
import { buildSurfaceIndices } from "./vtkParser";

interface JsonMesh {
  points: number[][] | number[];
  cells: { type: CellType; indices: number[][] | number[] };
}
interface JsonField {
  unit?: string;
  components?: number;
  timesteps: number[][] | number[];
}
interface JsonDataset {
  name?: string;
  case?: string;
  mesh: JsonMesh;
  fields?: Record<string, JsonField>;
  times?: number[];
}

function computeBoundingBox(points: Float32Array): { min: Vec3; max: Vec3 } {
  let min0 = Infinity, min1 = Infinity, min2 = Infinity;
  let max0 = -Infinity, max1 = -Infinity, max2 = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    if (points[i] < min0) min0 = points[i];
    if (points[i + 1] < min1) min1 = points[i + 1];
    if (points[i + 2] < min2) min2 = points[i + 2];
    if (points[i] > max0) max0 = points[i];
    if (points[i + 1] > max1) max1 = points[i + 1];
    if (points[i + 2] > max2) max2 = points[i + 2];
  }
  return { min: [min0, min1, min2], max: [max0, max1, max2] };
}

function flattenPoints(raw: number[][] | number[]): Float32Array {
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    const arr = raw as number[][];
    const out = new Float32Array(arr.length * 3);
    for (let i = 0; i < arr.length; i++) {
      out[i * 3] = arr[i][0];
      out[i * 3 + 1] = arr[i][1];
      out[i * 3 + 2] = arr[i][2] ?? 0;
    }
    return out;
  }
  return new Float32Array(raw as number[]);
}

function flattenCells(raw: number[][] | number[], type: CellType): { cells: Uint32Array; vpc: number } {
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    const arr = raw as number[][];
    const vpc = arr[0].length;
    const out = new Uint32Array(arr.length * (vpc + 1));
    for (let i = 0; i < arr.length; i++) {
      out[i * (vpc + 1)] = vpc;
      for (let j = 0; j < vpc; j++) out[i * (vpc + 1) + 1 + j] = arr[i][j];
    }
    return { cells: out, vpc };
  }
  const flat = raw as number[];
  return { cells: new Uint32Array(flat), vpc: type === "hex" ? 8 : type === "tetra" ? 4 : 4 };
}

function rangeScalar(data: Float32Array): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 1 };
}

function rangeVector(data: Float32Array): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i += 3) {
    const m = Math.hypot(data[i], data[i + 1], data[i + 2]);
    if (m < min) min = m;
    if (m > max) max = m;
  }
  return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 1 };
}

export function parseCFDJson(text: string, fileName: string): CFDataset {
  const obj: JsonDataset = JSON.parse(text);
  const points = flattenPoints(obj.mesh.points);
  const { cells, vpc } = flattenCells(obj.mesh.cells.indices, obj.mesh.cells.type);
  const bbox = computeBoundingBox(points);
  const indices = buildSurfaceIndices(cells, obj.mesh.cells.type, vpc);

  const mesh: MeshData = {
    points,
    pointCount: points.length / 3,
    cells,
    cellCount: cells.length / (vpc + 1),
    cellType: obj.mesh.cells.type,
    verticesPerCell: vpc,
    indices,
    boundingBox: bbox,
  };

  const fields: Record<string, FieldData> = {};
  const times = obj.times ?? [0];

  if (obj.fields) {
    for (const [name, f] of Object.entries(obj.fields)) {
      const components = f.components ?? 1;
      const isVec = components === 3;
      const timesteps: Float32Array[] = [];
      const stepArr = Array.isArray(f.timesteps) && f.timesteps.length > 0 && Array.isArray(f.timesteps[0])
        ? (f.timesteps as number[][])
        : [f.timesteps as number[]];
      for (const step of stepArr) {
        timesteps.push(new Float32Array(step));
      }
      const range = isVec ? rangeVector(timesteps[0]) : rangeScalar(timesteps[0]);
      fields[name] = {
        name,
        unit: f.unit ?? "",
        type: isVec ? "vector" : "scalar",
        components,
        timesteps,
        range,
      };
    }
  }

  if (!fields.pressure && Object.values(fields).some((f) => f.type === "scalar")) {
    const s = Object.values(fields).find((f) => f.type === "scalar")!;
    fields.pressure = { ...s };
  }
  if (!fields.velocity) {
    const v = Object.values(fields).find((f) => f.type === "vector");
    if (v) fields.velocity = { ...v };
  }

  return {
    id: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: obj.name ?? fileName.replace(/\.[^.]+$/, ""),
    caseLabel: obj.case ?? fileName,
    mesh,
    fields,
    times,
    source: "json",
    fileName,
  };
}
