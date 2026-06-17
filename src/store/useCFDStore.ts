import { create } from "zustand";
import type {
  CFDataset,
  VisualizationMode,
  ColormapName,
  Probe,
  ClipState,
  CameraState,
} from "@/types/cfd";

const PROBE_COLORS = ["#36e2c8", "#ffb347", "#ff4d8d", "#8b7bff", "#7ed957", "#ff7eb6"];

interface PlaybackState {
  playing: boolean;
  fps: number;
  loop: boolean;
}

interface RangeOverride {
  min: number;
  max: number;
}

interface CFDStore {
  datasets: CFDataset[];
  activeId: string | null;

  mode: VisualizationMode;
  colormap: ColormapName;
  activeField: string;
  rangeOverride: RangeOverride | null;
  autoRange: boolean;

  timestep: number;
  datasetTimesteps: Record<string, number>;
  playback: PlaybackState;

  probes: Probe[];
  selectedProbeId: string | null;

  sectionProbes: Probe[];
  sectionProbeMode: boolean;

  clip: ClipState;
  showGrid: boolean;
  showAxes: boolean;
  projection: "perspective" | "orthographic";
  syncCameras: boolean;
  masterCamera: CameraState | null;
  syncTime: boolean;

  isosurfaceValue: number;
  vectorDensity: number;
  vectorScale: number;
  streamlineDensity: number;

  loading: boolean;
  error: string | null;

  setDataset: (ds: CFDataset) => void;
  addDataset: (ds: CFDataset) => void;
  removeDataset: (id: string) => void;
  setActive: (id: string) => void;

  setMode: (m: VisualizationMode) => void;
  setColormap: (c: ColormapName) => void;
  setActiveField: (f: string) => void;
  setRange: (r: RangeOverride | null) => void;
  setAutoRange: (v: boolean) => void;

  setTimestep: (t: number) => void;
  setDatasetTimestep: (id: string, t: number) => void;
  getTimestepFor: (datasetId: string) => number;
  setPlaying: (p: boolean) => void;
  setFps: (f: number) => void;
  setLoop: (l: boolean) => void;

  addProbe: (p: [number, number, number]) => void;
  removeProbe: (id: string) => void;
  selectProbe: (id: string | null) => void;
  clearProbes: () => void;

  addSectionProbe: (p: [number, number, number]) => void;
  updateSectionProbe: (id: string, p: [number, number, number]) => void;
  removeSectionProbe: (id: string) => void;
  clearSectionProbes: () => void;
  setSectionProbeMode: (v: boolean) => void;

  setClip: (c: Partial<ClipState>) => void;

  setShowGrid: (v: boolean) => void;
  setShowAxes: (v: boolean) => void;
  setProjection: (p: "perspective" | "orthographic") => void;
  setSyncCameras: (v: boolean) => void;
  setMasterCamera: (cam: CameraState | null) => void;
  setSyncTime: (v: boolean) => void;

  setIsosurfaceValue: (v: number) => void;
  setVectorDensity: (v: number) => void;
  setVectorScale: (v: number) => void;
  setStreamlineDensity: (v: number) => void;

  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;

  getActive: () => CFDataset | null;
}

let probeCounter = 0;

export const useCFDStore = create<CFDStore>((set, get) => ({
  datasets: [],
  activeId: null,

  mode: "pressure",
  colormap: "jet",
  activeField: "pressure",
  rangeOverride: null,
  autoRange: true,

  timestep: 0,
  datasetTimesteps: {},
  playback: { playing: false, fps: 6, loop: true },

  probes: [],
  selectedProbeId: null,

  sectionProbes: [],
  sectionProbeMode: false,

  clip: { enabled: false, axis: "z", position: 0, normal: [0, 0, 1] },
  showGrid: false,
  showAxes: true,
  projection: "perspective",
  syncCameras: true,
  masterCamera: null,
  syncTime: true,

  isosurfaceValue: 0.5,
  vectorDensity: 0.5,
  vectorScale: 1,
  streamlineDensity: 0.5,

  loading: false,
  error: null,

  setDataset: (ds) =>
    set((s) => {
      const exists = s.datasets.some((d) => d.id === ds.id);
      const datasets = exists ? s.datasets.map((d) => (d.id === ds.id ? ds : d)) : [...s.datasets, ds];
      const activeId = s.activeId ?? ds.id;
      const firstField = ds.fields.pressure ? "pressure" : Object.keys(ds.fields)[0] ?? "pressure";
      const datasetTimesteps = { ...s.datasetTimesteps, [ds.id]: 0 };
      return {
        datasets,
        activeId,
        timestep: 0,
        datasetTimesteps,
        activeField: s.activeField in ds.fields ? s.activeField : firstField,
        clip: { ...s.clip, position: 0 },
      };
    }),
  addDataset: (ds) =>
    set((s) => ({
      datasets: [...s.datasets, ds],
      activeId: s.activeId ?? ds.id,
      datasetTimesteps: { ...s.datasetTimesteps, [ds.id]: 0 },
    })),
  removeDataset: (id) =>
    set((s) => {
      const datasets = s.datasets.filter((d) => d.id !== id);
      const activeId = s.activeId === id ? datasets[0]?.id ?? null : s.activeId;
      const { [id]: _removed, ...rest } = s.datasetTimesteps;
      void _removed;
      return { datasets, activeId, datasetTimesteps: rest };
    }),
  setActive: (id) => set({ activeId: id }),

  setMode: (m) => set({ mode: m }),
  setColormap: (c) => set({ colormap: c }),
  setActiveField: (f) => set({ activeField: f, autoRange: true, rangeOverride: null }),
  setRange: (r) => set({ rangeOverride: r, autoRange: false }),
  setAutoRange: (v) => set({ autoRange: v, rangeOverride: v ? null : get().rangeOverride }),

  setTimestep: (t) =>
    set((s) => {
      if (!s.syncTime && s.activeId) {
        const ds = s.datasets.find((d) => d.id === s.activeId);
        const clamped = ds ? Math.max(0, Math.min(t, ds.times.length - 1)) : t;
        return {
          timestep: clamped,
          datasetTimesteps: { ...s.datasetTimesteps, [s.activeId]: clamped },
        };
      }
      return { timestep: t };
    }),
  setDatasetTimestep: (id, t) =>
    set((s) => ({
      datasetTimesteps: { ...s.datasetTimesteps, [id]: t },
    })),
  getTimestepFor: (datasetId) => {
    const s = get();
    if (s.syncTime) return s.timestep;
    const ds = s.datasets.find((d) => d.id === datasetId);
    const dsMax = ds ? Math.max(0, ds.times.length - 1) : 0;
    const stored = s.datasetTimesteps[datasetId];
    if (stored === undefined) return Math.min(s.timestep, dsMax);
    return Math.max(0, Math.min(stored, dsMax));
  },
  setPlaying: (p) => set({ playback: { ...get().playback, playing: p } }),
  setFps: (f) => set({ playback: { ...get().playback, fps: f } }),
  setLoop: (l) => set({ playback: { ...get().playback, loop: l } }),

  addProbe: (p) =>
    set((s) => {
      probeCounter += 1;
      const id = `p${probeCounter}`;
      const color = PROBE_COLORS[(probeCounter - 1) % PROBE_COLORS.length];
      const probe: Probe = {
        id,
        position: [+p[0].toFixed(4), +p[1].toFixed(4), +p[2].toFixed(4)],
        field: s.activeField,
        label: `PROBE-${String(probeCounter).padStart(2, "0")}`,
        color,
      };
      return { probes: [...s.probes, probe], selectedProbeId: id };
    }),
  removeProbe: (id) =>
    set((s) => ({ probes: s.probes.filter((p) => p.id !== id), selectedProbeId: s.selectedProbeId === id ? null : s.selectedProbeId })),
  selectProbe: (id) => set({ selectedProbeId: id }),
  clearProbes: () => set({ probes: [], selectedProbeId: null }),

  addSectionProbe: (p) =>
    set((s) => {
      probeCounter += 1;
      const id = `s${probeCounter}`;
      const color = PROBE_COLORS[(probeCounter - 1) % PROBE_COLORS.length];
      const probe: Probe = {
        id,
        position: [+p[0].toFixed(4), +p[1].toFixed(4), +p[2].toFixed(4)],
        field: s.activeField,
        label: `SEC-${String(probeCounter).padStart(2, "0")}`,
        color,
      };
      return { sectionProbes: [...s.sectionProbes, probe] };
    }),
  updateSectionProbe: (id, p) =>
    set((s) => ({
      sectionProbes: s.sectionProbes.map((pr) =>
        pr.id === id ? { ...pr, position: [+p[0].toFixed(4), +p[1].toFixed(4), +p[2].toFixed(4)] } : pr
      ),
    })),
  removeSectionProbe: (id) =>
    set((s) => ({ sectionProbes: s.sectionProbes.filter((p) => p.id !== id) })),
  clearSectionProbes: () => set({ sectionProbes: [] }),
  setSectionProbeMode: (v) => set({ sectionProbeMode: v }),

  setClip: (c) => set((s) => ({ clip: { ...s.clip, ...c } })),

  setShowGrid: (v) => set({ showGrid: v }),
  setShowAxes: (v) => set({ showAxes: v }),
  setProjection: (p) => set({ projection: p }),
  setSyncCameras: (v) => set({ syncCameras: v }),
  setMasterCamera: (cam) => set({ masterCamera: cam }),
  setSyncTime: (v) =>
    set((s) => {
      if (!v) {
        const active = s.datasets.find((d) => d.id === s.activeId);
        const newTs: Record<string, number> = {};
        for (const d of s.datasets) {
          const maxT = Math.max(0, d.times.length - 1);
          newTs[d.id] = Math.min(s.timestep, maxT);
        }
        const activeMax = active ? Math.max(0, active.times.length - 1) : 0;
        const activeClamped = Math.min(s.timestep, activeMax);
        return {
          syncTime: false,
          datasetTimesteps: newTs,
          timestep: activeClamped,
        };
      }
      return { syncTime: true };
    }),

  setIsosurfaceValue: (v) => set({ isosurfaceValue: v }),
  setVectorDensity: (v) => set({ vectorDensity: v }),
  setVectorScale: (v) => set({ vectorScale: v }),
  setStreamlineDensity: (v) => set({ streamlineDensity: v }),

  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),

  getActive: () => {
    const s = get();
    return s.datasets.find((d) => d.id === s.activeId) ?? null;
  },
}));

export function activeRange(dataset: CFDataset | null, field: string, override: RangeOverride | null, auto: boolean) {
  if (!dataset || !dataset.fields[field]) return { min: 0, max: 1 };
  if (!auto && override) return override;
  return dataset.fields[field].range;
}

export function maxTimestepCount(datasets: CFDataset[]): number {
  let m = 1;
  for (const d of datasets) {
    const n = d.times.length;
    if (n > m) m = n;
  }
  return m;
}

export type { CFDStore };
export type { CameraState };
