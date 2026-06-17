import type { CFDataset, FieldData } from "@/types/cfd";
import { parseVTK } from "./vtkParser";
import { parseCFDJson } from "./jsonParser";

export interface ParseResult {
  dataset: CFDataset;
}

export async function parseCFDFile(file: File): Promise<CFDataset> {
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith(".vtk")) {
    return parseVTK(text, file.name);
  }
  if (name.endsWith(".json")) {
    return parseCFDJson(text, file.name);
  }
  const trimmed = text.trimStart();
  if (trimmed.startsWith("# vtk") || trimmed.toLowerCase().startsWith("vtk datafile")) {
    return parseVTK(text, file.name);
  }
  try {
    return parseCFDJson(text, file.name);
  } catch {
    return parseVTK(text, file.name);
  }
}

function naturalSort(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const ra = a.match(re) || [];
  const rb = b.match(re) || [];
  for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
    if (i >= ra.length) return -1;
    if (i >= rb.length) return 1;
    const na = parseInt(ra[i]);
    const nb = parseInt(rb[i]);
    if (!isNaN(na) && !isNaN(nb)) {
      if (na !== nb) return na - nb;
    } else {
      if (ra[i] < rb[i]) return -1;
      if (ra[i] > rb[i]) return 1;
    }
  }
  return 0;
}

export async function parseCFDFiles(files: File[]): Promise<CFDataset> {
  if (files.length === 0) throw new Error("未选择文件");
  if (files.length === 1) return parseCFDFile(files[0]);

  const sorted = [...files].sort((a, b) => naturalSort(a.name, b.name));
  const datasets = await Promise.all(sorted.map((f) => parseCFDFile(f)));

  const first = datasets[0];
  const mesh = first.mesh;
  const fields: Record<string, FieldData> = {};

  for (const fieldName of Object.keys(first.fields)) {
    const firstField = first.fields[fieldName];
    const timesteps: Float32Array[] = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const ds of datasets) {
      const f = ds.fields[fieldName];
      if (!f) continue;
      const stepData = f.timesteps[0];
      if (stepData) {
        timesteps.push(stepData);
        if (f.range.min < minVal) minVal = f.range.min;
        if (f.range.max > maxVal) maxVal = f.range.max;
      }
    }

    if (timesteps.length > 0) {
      fields[fieldName] = {
        ...firstField,
        timesteps,
        range: { min: minVal, max: maxVal },
      };
    }
  }

  const name = first.name.replace(/[_\.\-\s]?\d+[_\.\-\s]?$/, "") || first.name;
  const caseLabel = first.caseLabel;

  return {
    id: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    caseLabel,
    mesh,
    fields,
    times: datasets.map((_, i) => i),
    source: first.source,
    fileName: sorted.map((f) => f.name).join("; "),
  };
}
