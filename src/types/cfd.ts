export type Vec3 = [number, number, number];

export type CellType = "tetra" | "hex" | "tri" | "quad" | "line";

export interface MeshData {
  points: Float32Array;
  pointCount: number;
  cells: Uint32Array;
  cellCount: number;
  cellType: CellType;
  verticesPerCell: number;
  indices: Uint32Array;
  normals?: Float32Array;
  boundingBox: { min: Vec3; max: Vec3 };
}

export type FieldType = "scalar" | "vector";

export interface FieldData {
  name: string;
  unit: string;
  type: FieldType;
  components: number;
  timesteps: Float32Array[];
  range: { min: number; max: number };
}

export interface CFDataset {
  id: string;
  name: string;
  caseLabel: string;
  mesh: MeshData;
  fields: Record<string, FieldData>;
  times: number[];
  source: "vtk" | "json" | "sample";
  fileName?: string;
}

export type VisualizationMode =
  | "pressure"
  | "velocity"
  | "streamlines"
  | "vectors"
  | "isosurface"
  | "mesh";

export type ColormapName = "jet" | "viridis" | "plasma" | "coolwarm";

export interface Probe {
  id: string;
  position: Vec3;
  field: string;
  label: string;
  color: string;
}

export type ClipAxis = "x" | "y" | "z" | "custom";

export interface ClipState {
  enabled: boolean;
  axis: ClipAxis;
  position: number;
  normal: Vec3;
}

export type CameraProjection = "perspective" | "orthographic";

export interface CameraState {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  projection: CameraProjection;
}

export interface DatasetStats {
  pointCount: number;
  cellCount: number;
  fieldNames: string[];
  timeStepCount: number;
  memoryMB: number;
}
