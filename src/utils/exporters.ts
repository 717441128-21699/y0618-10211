import type { CFDataset, Probe, Vec3 } from "@/types/cfd";
import { sampleFieldAtPoint } from "./streamlines";

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
