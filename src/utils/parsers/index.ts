import type { CFDataset } from "@/types/cfd";
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
