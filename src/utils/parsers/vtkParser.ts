import type { CFDataset, FieldData, MeshData, Vec3, CellType } from "@/types/cfd";

interface ParseContext {
  lines: string[];
  i: number;
  binary: boolean;
  view: DataView;
  byteOffset: number;
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

function fieldRangeScalar(data: Float32Array): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min)) { min = 0; max = 1; }
  return { min, max };
}

function fieldRangeVector(data: Float32Array): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i += 3) {
    const mag = Math.hypot(data[i], data[i + 1], data[i + 2]);
    if (mag < min) min = mag;
    if (mag > max) max = mag;
  }
  if (!isFinite(min)) { min = 0; max = 1; }
  return { min, max };
}

const VTK_CELL_VERTICES: Record<number, { type: CellType; n: number }> = {
  1: { type: "line", n: 2 },
  3: { type: "line", n: 2 },
  5: { type: "tri", n: 3 },
  9: { type: "quad", n: 4 },
  10: { type: "tetra", n: 4 },
  12: { type: "hex", n: 8 },
};

export function parseVTK(text: string, fileName: string): CFDataset {
  const trimmed = text.replace(/\r/g, "");
  const upper = trimmed.slice(0, 4096).toUpperCase();
  const isBinary = upper.includes("BINARY");

  if (isBinary) {
    return parseVTKBinary(trimmed, fileName);
  }
  return parseVTKAscii(trimmed, fileName);
}

function parseVTKAscii(text: string, fileName: string): CFDataset {
  const tokens = text.split(/\s+/).filter(Boolean);
  let idx = 0;
  const next = () => tokens[idx++];
  const nextNum = () => parseFloat(next());
  const peek = (offset = 0) => tokens[idx + offset];

  let header = next();
  if (header && header.toUpperCase() === "#VTK") header = next();

  let points: Float32Array | null = null;
  let cellType: CellType = "hex";
  let verticesPerCell = 8;
  let cells: Uint32Array | null = null;
  let cellCount = 0;
  const fields: Record<string, FieldData> = {};
  let bbox = { min: [0, 0, 0] as Vec3, max: [1, 1, 1] as Vec3 };

  let structuredDims: number[] | null = null;
  let structuredOrigin: number[] | null = null;
  let structuredSpacing: number[] | null = null;
  let datasetType: string | null = null;

  const tryBuildStructured = () => {
    if (points) return;
    if (structuredDims && structuredOrigin && structuredSpacing) {
      const result = buildStructuredMesh(structuredDims, structuredOrigin, structuredSpacing);
      points = result.points;
      cells = result.cells;
      cellCount = result.cellCount;
      cellType = "hex";
      verticesPerCell = 8;
      bbox = computeBoundingBox(points);
    }
  };

  while (idx < tokens.length) {
    const kw = next()?.toUpperCase();
    if (!kw) break;

    if (kw === "DATASET") {
      datasetType = next()?.toUpperCase() || null;
    } else if (kw === "POINTS") {
      const n = parseInt(next());
      next();
      points = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) points[i] = nextNum();
      bbox = computeBoundingBox(points);
    } else if (kw === "STRUCTURED_POINTS") {
      datasetType = "STRUCTURED_POINTS";
      const dims = [parseInt(next()), parseInt(next()), parseInt(next())];
      const origin = [nextNum(), nextNum(), nextNum()];
      const spacing = [nextNum(), nextNum(), nextNum()];
      structuredDims = dims;
      structuredOrigin = origin;
      structuredSpacing = spacing;
      tryBuildStructured();
    } else if (kw === "DIMENSIONS") {
      structuredDims = [parseInt(next()), parseInt(next()), parseInt(next())];
      tryBuildStructured();
    } else if (kw === "ORIGIN") {
      structuredOrigin = [nextNum(), nextNum(), nextNum()];
      tryBuildStructured();
    } else if (kw === "SPACING") {
      structuredSpacing = [nextNum(), nextNum(), nextNum()];
      tryBuildStructured();
    } else if (kw === "CELLS") {
      cellCount = parseInt(next());
      const size = parseInt(next());
      const raw: number[] = [];
      for (let i = 0; i < size; i++) raw.push(parseInt(next()));
      const result = decodeCells(raw, cellCount);
      cells = result.cells;
      cellType = result.type;
      verticesPerCell = result.n;
    } else if (kw === "CELL_TYPES") {
      const n = parseInt(next());
      for (let i = 0; i < n; i++) next();
    } else if (kw === "POINT_DATA") {
      tryBuildStructured();
      const n = parseInt(next());
      while (idx < tokens.length) {
        const sub = peek()?.toUpperCase();
        if (!sub) break;
        if (sub === "SCALARS") {
          next();
          const name = next();
          next();
          next();
          if (peek()?.toUpperCase() === "LOOKUP_TABLE") {
            next();
            next();
          }
          const data = new Float32Array(n);
          for (let i = 0; i < n; i++) data[i] = nextNum();
          fields[name] = {
            name,
            unit: "",
            type: "scalar",
            components: 1,
            timesteps: [data],
            range: fieldRangeScalar(data),
          };
        } else if (sub === "VECTORS") {
          next();
          const name = next();
          next();
          const data = new Float32Array(n * 3);
          for (let i = 0; i < n * 3; i++) data[i] = nextNum();
          fields[name] = {
            name,
            unit: "",
            type: "vector",
            components: 3,
            timesteps: [data],
            range: fieldRangeVector(data),
          };
        } else if (sub === "LOOKUP_TABLE") {
          next();
          const tblName = next();
          const cnt = parseInt(next());
          for (let i = 0; i < cnt * 4; i++) next();
        } else {
          break;
        }
      }
    } else if (kw === "CELL_DATA") {
      tryBuildStructured();
      const n = parseInt(next());
      while (idx < tokens.length) {
        const sub = peek()?.toUpperCase();
        if (!sub) break;
        if (sub === "SCALARS" || sub === "VECTORS") {
          next();
          next();
          next();
          if (sub === "SCALARS") {
            if (peek()?.toUpperCase() === "LOOKUP_TABLE") {
              next();
              next();
            }
            for (let i = 0; i < n; i++) next();
          } else {
            for (let i = 0; i < n * 3; i++) next();
          }
        } else if (sub === "LOOKUP_TABLE") {
          next();
          const tblName = next();
          const cnt = parseInt(next());
          for (let i = 0; i < cnt * 4; i++) next();
        } else {
          break;
        }
      }
    } else if (kw === "LOOKUP_TABLE") {
      next();
      const cnt = parseInt(next());
      for (let i = 0; i < cnt * 4; i++) next();
    } else {
      // skip unknown token
    }
  }

  if (!points) throw new Error("VTK 文件未包含 POINTS 数据");

  const mesh = buildMeshData(points, cells, cellType, verticesPerCell, bbox);
  return finalizeDataset(mesh, fields, fileName, "vtk");
}

function buildStructuredMesh(dims: number[], origin: number[], spacing: number[]) {
  const [nx, ny, nz] = dims;
  const n = nx * ny * nz;
  const points = new Float32Array(n * 3);
  let p = 0;
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        points[p++] = origin[0] + i * spacing[0];
        points[p++] = origin[1] + j * spacing[1];
        points[p++] = origin[2] + k * spacing[2];
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
        cells[c++] = base;
        cells[c++] = base + 1;
        cells[c++] = base + 1 + nx;
        cells[c++] = base + nx;
        cells[c++] = base + nx * ny;
        cells[c++] = base + 1 + nx * ny;
        cells[c++] = base + 1 + nx + nx * ny;
        cells[c++] = base + nx + nx * ny;
      }
  return { points, cells, cellCount };
}

function decodeCells(raw: number[], cellCount: number) {
  const cells = new Uint32Array(raw.length);
  for (let i = 0; i < raw.length; i++) cells[i] = raw[i];
  const sample = raw[0];
  const info = VTK_CELL_VERTICES[sample] || { type: "hex" as CellType, n: 8 };
  return { cells, type: info.type, n: info.n };
}

function buildMeshData(
  points: Float32Array,
  cells: Uint32Array | null,
  cellType: CellType,
  verticesPerCell: number,
  bbox: { min: Vec3; max: Vec3 }
): MeshData {
  const indices = buildSurfaceIndices(cells, cellType, verticesPerCell);
  return {
    points,
    pointCount: points.length / 3,
    cells: cells || new Uint32Array(0),
    cellCount: cells ? cells.length / (verticesPerCell + 1) : 0,
    cellType,
    verticesPerCell,
    indices,
    boundingBox: bbox,
  };
}

export function buildSurfaceIndices(
  cells: Uint32Array | null,
  cellType: CellType,
  vpc: number
): Uint32Array {
  if (!cells || cells.length === 0) return new Uint32Array(0);
  const out: number[] = [];
  let o = 0;
  while (o < cells.length) {
    const n = cells[o++];
    const verts: number[] = [];
    for (let i = 0; i < n; i++) verts.push(cells[o++]);
    if (cellType === "hex" && n === 8) {
      out.push(verts[0], verts[1], verts[2]);
      out.push(verts[0], verts[2], verts[3]);
      out.push(verts[4], verts[7], verts[6]);
      out.push(verts[4], verts[6], verts[5]);
      out.push(verts[0], verts[4], verts[5]);
      out.push(verts[0], verts[5], verts[1]);
      out.push(verts[1], verts[5], verts[6]);
      out.push(verts[1], verts[6], verts[2]);
      out.push(verts[2], verts[6], verts[7]);
      out.push(verts[2], verts[7], verts[3]);
      out.push(verts[3], verts[7], verts[4]);
      out.push(verts[3], verts[4], verts[0]);
    } else if (cellType === "quad" && n === 4) {
      out.push(verts[0], verts[1], verts[2]);
      out.push(verts[0], verts[2], verts[3]);
    } else if (cellType === "tetra" && n === 4) {
      out.push(verts[0], verts[1], verts[2]);
      out.push(verts[0], verts[2], verts[3]);
      out.push(verts[0], verts[3], verts[1]);
      out.push(verts[1], verts[3], verts[2]);
    } else if (cellType === "tri" && n === 3) {
      out.push(verts[0], verts[1], verts[2]);
    }
  }
  return new Uint32Array(out);
}

function finalizeDataset(
  mesh: MeshData,
  fields: Record<string, FieldData>,
  fileName: string,
  source: "vtk" | "json" | "sample"
): CFDataset {
  if (!fields.pressure && Object.values(fields).some((f) => f.type === "scalar")) {
    const scalar = Object.values(fields).find((f) => f.type === "scalar")!;
    fields.pressure = { ...scalar };
  }
  if (!fields.velocity) {
    const vec = Object.values(fields).find((f) => f.type === "vector");
    if (vec) fields.velocity = { ...vec };
  }
  return {
    id: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: fileName.replace(/\.[^.]+$/, ""),
    caseLabel: source === "sample" ? "SAMPLE" : fileName,
    mesh,
    fields,
    times: [0],
    source,
    fileName,
  };
}

function parseVTKBinary(text: string, fileName: string): CFDataset {
  throw new Error("二进制 VTK 解析暂未启用，请使用 ASCII 格式或 JSON 数据");
}
