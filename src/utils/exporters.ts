import type { CFDataset, Probe, Vec3, ClipState } from "@/types/cfd";
import { sampleFieldAtPoint } from "./streamlines";
import { sliceMesh } from "@/three/geometry";

export function sliceToCSV(
  dataset: CFDataset,
  clip: ClipState,
  field: string,
  timestep: number
): { csv: string; stats: { min: number; max: number; mean: number; pointCount: number } } {
  const bb = dataset.mesh.boundingBox;
  const center: Vec3 = [
    (bb.min[0] + bb.max[0]) / 2,
    (bb.min[1] + bb.max[1]) / 2,
    (bb.min[2] + bb.max[2]) / 2,
  ];

  let normal: Vec3;
  let point: Vec3;

  if (clip.axis === "x" || clip.axis === "y" || clip.axis === "z") {
    const axisIdx = clip.axis === "x" ? 0 : clip.axis === "y" ? 1 : 2;
    normal = clip.axis === "x" ? [1, 0, 0] : clip.axis === "y" ? [0, 1, 0] : [0, 0, 1];
    point = [...center];
    point[axisIdx] = clip.position;
  } else {
    const nl = Math.hypot(clip.normal[0], clip.normal[1], clip.normal[2]) || 1;
    const nx = clip.normal[0] / nl, ny = clip.normal[1] / nl, nz = clip.normal[2] / nl;
    normal = [nx, ny, nz];
    point = [
      center[0] + nx * clip.position,
      center[1] + ny * clip.position,
      center[2] + nz * clip.position,
    ];
  }

  const { positions, values, count } = sliceMesh(dataset, { normal, point }, 200000, field, timestep);

  let minVal = Infinity;
  let maxVal = -Infinity;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const v = values[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
    sum += v;
  }
  const meanVal = count > 0 ? sum / count : 0;
  const stats = { min: minVal, max: maxVal, mean: meanVal, pointCount: count };

  const fieldData = dataset.fields[field];
  const isVector = fieldData?.type === "vector";

  const header = isVector
    ? ["x", "y", "z", `${field}_x`, `${field}_y`, `${field}_z`, `${field}_magnitude`]
    : ["x", "y", "z", field];

  const rows: string[] = [];
  rows.push(`# HYDROSCOPE Section Export`);
  rows.push(`# dataset=${dataset.name} field=${field} timestep=${timestep}`);
  rows.push(`# normal=[${normal.map((n) => n.toFixed(4)).join(",")}] point=[${point.map((p) => p.toFixed(4)).join(",")}]`);
  rows.push(`# stats: min=${minVal.toFixed(6)} mean=${meanVal.toFixed(6)} max=${maxVal.toFixed(6)} points=${count}`);
  rows.push(header.join(","));
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3].toFixed(6);
    const y = positions[i * 3 + 1].toFixed(6);
    const z = positions[i * 3 + 2].toFixed(6);
    if (isVector) {
      const res = sampleFieldAtPoint(dataset, field, timestep, [
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      ]);
      rows.push(
        [x, y, z, res.vector[0].toFixed(6), res.vector[1].toFixed(6), res.vector[2].toFixed(6), res.magnitude.toFixed(6)].join(",")
      );
    } else {
      rows.push([x, y, z, values[i].toFixed(6)].join(","));
    }
  }

  return { csv: rows.join("\n"), stats };
}

export async function downloadSliceReport(
  dataset: CFDataset,
  clip: ClipState,
  field: string,
  timestep: number,
  canvas: HTMLCanvasElement | null
): Promise<void> {
  const { csv, stats } = sliceToCSV(dataset, clip, field, timestep);
  const axisLabel = clip.axis === "custom" ? "custom" : clip.axis.toUpperCase();
  const base = `slice_${axisLabel}_${clip.position.toFixed(3)}_${field}`;
  downloadText(`${base}.csv`, csv);

  if (canvas) {
    await new Promise((r) => setTimeout(r, 80));
    await exportCanvasImage(canvas, `${base}.png`, 2);
  }
  void stats;
}

export function probesToCSV(
  dataset: CFDataset,
  probes: Probe[],
  fields: string[]
): string {
  const header = [
    "timestep",
    "time",
    "probe_id",
    "label",
    "x", "y", "z",
    ...fields.flatMap((f) =>
      dataset.fields[f]?.type === "vector"
        ? [`${f}_x`, `${f}_y`, `${f}_z`, `${f}_magnitude`]
        : [f]
    ),
  ];
  const rows: string[] = [header.join(",")];
  const tcount = dataset.times.length;
  for (let s = 0; s < tcount; s++) {
    const time = dataset.times[s];
    for (const probe of probes) {
      const cols: (string | number)[] = [s, time, probe.id, probe.label];
      cols.push(...probe.position.map((v) => v.toFixed(4)));
      for (const f of fields) {
        const res = sampleFieldAtPoint(dataset, f, s, probe.position);
        const field = dataset.fields[f];
        if (field?.type === "vector") {
          cols.push(res.vector[0].toFixed(5), res.vector[1].toFixed(5), res.vector[2].toFixed(5), res.magnitude.toFixed(5));
        } else {
          cols.push(res.value.toFixed(5));
        }
      }
      rows.push(cols.join(","));
    }
  }
  return rows.join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  triggerDownload(blob, filename);
}

export function downloadBlob(filename: string, blob: Blob) {
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
  scale = 2
): Promise<void> {
  const w = canvas.width;
  const h = canvas.height;
  const off = document.createElement("canvas");
  off.width = w * scale;
  off.height = h * scale;
  const ctx = off.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, off.width, off.height);
  return new Promise((resolve) => {
    off.toBlob(
      (blob) => {
        if (blob) downloadBlob(filename, blob);
        resolve();
      },
      "image/png",
      1
    );
  });
}

export class VideoRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  start(canvas: HTMLCanvasElement, fps = 30) {
    const stream = canvas.captureStream(fps);
    this.stream = stream;
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    this.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100);
  }

  async stop(filename: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.recorder) { resolve(); return; }
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "video/webm" });
        downloadBlob(filename, blob);
        this.stream?.getTracks().forEach((t) => t.stop());
        resolve();
      };
      this.recorder.stop();
    });
  }
}

export function vectorToVec3(v: Vec3): [number, number, number] {
  return [v[0], v[1], v[2]];
}
