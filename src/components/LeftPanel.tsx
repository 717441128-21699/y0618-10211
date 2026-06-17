import { useRef, useState, useMemo } from "react";
import {
  Upload,
  Layers,
  Grid3x3,
  Wind,
  CircleDot,
  Boxes,
  Scissors,
  SlidersHorizontal,
  FileBox,
  Plus,
  ChevronDown,
  Layers3,
  Crosshair,
} from "lucide-react";
import { useCFDStore, activeRange } from "@/store/useCFDStore";
import { parseCFDFiles } from "@/utils/parsers";
import { SAMPLE_DATASETS } from "@/utils/sampleData";
import { COLORMAP_OPTIONS, colormapCss } from "@/utils/colormaps";
import { sliceToCSV, downloadText, downloadSliceReport } from "@/utils/exporters";
import type { VisualizationMode, ColormapName, ClipAxis } from "@/types/cfd";

const MODES: { key: VisualizationMode; label: string; icon: typeof Layers }[] = [
  { key: "pressure", label: "压力云图", icon: CircleDot },
  { key: "velocity", label: "速度幅值", icon: Wind },
  { key: "streamlines", label: "流线图", icon: Wind },
  { key: "vectors", label: "速度矢量", icon: Grid3x3 },
  { key: "isosurface", label: "等值面", icon: Layers },
  { key: "mesh", label: "网格线框", icon: Boxes },
];

export default function LeftPanel({ canvasRef }: { canvasRef?: React.RefObject<HTMLCanvasElement | null> }) {
  const store = useCFDStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dataset = store.getActive();

  const handleFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    setImporting(true);
    store.setError(null);
    try {
      const ds = await parseCFDFiles(fileArr);
      store.setDataset(ds);
    } catch (e) {
      store.setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const loadSample = (fn: () => any) => {
    store.setError(null);
    const ds = fn();
    store.setDataset(ds);
  };

  const range = dataset ? activeRange(dataset, store.activeField, store.rangeOverride, store.autoRange) : { min: 0, max: 1 };

  return (
    <aside className="flex w-64 flex-col border-r border-line bg-ink-900/70 overflow-y-auto scroll-thin">
      <section className="panel-header">
        <span>数据源</span>
        <span className="text-accent-cyan/60">{store.datasets.length} loaded</span>
      </section>
      <div className="p-3 space-y-2.5">
        <div
          className={`relative rounded-[3px] border border-dashed p-3 transition-colors ${
            dragOver ? "border-accent-cyan bg-accent-cyan/5" : "border-line"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0) {
              handleFiles(e.dataTransfer.files);
            }
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".vtk,.json,.vtu"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
              }
            }}
          />
          <button
            className="w-full btn btn-primary h-9 text-[11px]"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
            {importing ? "解析中…" : "导入网格文件"}
          </button>
          <p className="mt-2 text-center font-mono text-[8px] uppercase tracking-wider text-ink-500">
            拖拽 .vtk / .json 至此处 · 支持多选时间步
          </p>
        </div>

        <div className="divider" />

        <div className="field-label flex items-center gap-1.5">
          <FileBox className="h-3 w-3" strokeWidth={1.5} />
          示例工况
        </div>
        <div className="space-y-1">
          {SAMPLE_DATASETS.map((s) => (
            <button
              key={s.key}
              className="w-full flex items-center justify-between rounded-[2px] border border-line px-2 py-1.5 text-left hover:border-accent-cyan/50 hover:bg-accent-cyan/5 transition-colors group"
              onClick={() => loadSample(s.fn)}
            >
              <span className="font-mono text-[10px] text-ink-200">{s.label}</span>
              <Plus className="h-3 w-3 text-ink-500 group-hover:text-accent-cyan" strokeWidth={1.5} />
            </button>
          ))}
        </div>

        {store.datasets.length > 1 && (
          <>
            <div className="divider" />
            <DatasetSwitcher />
          </>
        )}
      </div>

      <section className="panel-header">
        <span>可视化模式</span>
      </section>
      <div className="p-3 grid grid-cols-2 gap-1.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = store.mode === m.key;
          return (
            <button
              key={m.key}
              className={`btn flex-col h-14 gap-1 ${active ? "btn-active" : ""}`}
              onClick={() => {
                store.setMode(m.key);
                if (m.key === "velocity" || m.key === "vectors" || m.key === "streamlines") {
                  if (store.activeField === "pressure" && dataset?.fields.velocity) store.setActiveField("velocity");
                } else if (m.key === "pressure" || m.key === "isosurface" || m.key === "mesh") {
                  if (store.activeField === "velocity" && dataset?.fields.pressure) store.setActiveField("pressure");
                }
              }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-[9px]">{m.label}</span>
            </button>
          );
        })}
      </div>

      <section className="panel-header">
        <span>场变量</span>
      </section>
      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {dataset &&
            Object.keys(dataset.fields).map((f) => (
              <button
                key={f}
                className={`chip ${store.activeField === f ? "!text-accent-cyan !border-accent-cyan/60 bg-accent-cyan/10" : ""}`}
                onClick={() => store.setActiveField(f)}
              >
                {f} · {dataset.fields[f].type === "vector" ? "VEC" : "SCA"}
              </button>
            ))}
        </div>
        <ColormapSelector value={store.colormap} onChange={(c) => store.setColormap(c)} />
      </div>

      <RangeControl
        range={range}
        auto={store.autoRange}
        onAuto={(v) => store.setAutoRange(v)}
        onChange={(r) => store.setRange(r)}
        disabled={!dataset}
      />

      <ClipControl disabled={!dataset} canvasRef={canvasRef} />

      {store.error && (
        <div className="mx-3 mb-3 rounded-[2px] border border-accent-magenta/40 bg-accent-magenta/5 p-2">
          <p className="font-mono text-[9px] text-accent-magenta">{store.error}</p>
        </div>
      )}
    </aside>
  );
}

function DatasetSwitcher() {
  const store = useCFDStore();
  return (
    <div>
      <div className="field-label mb-1">已加载数据集</div>
      <div className="space-y-1 max-h-32 overflow-y-auto scroll-thin">
        {store.datasets.map((d) => (
          <button
            key={d.id}
            className={`w-full flex items-center justify-between rounded-[2px] border px-2 py-1 text-left transition-colors ${
              d.id === store.activeId ? "border-accent-cyan/60 bg-accent-cyan/5" : "border-line hover:border-ink-500"
            }`}
            onClick={() => store.setActive(d.id)}
          >
            <span className="font-mono text-[9px] text-ink-200 truncate">{d.name}</span>
            <span className="font-mono text-[8px] text-ink-500">{d.source}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ColormapSelector({ value, onChange }: { value: ColormapName; onChange: (c: ColormapName) => void }) {
  return (
    <div>
      <div className="field-label mb-1.5">色带 LUT</div>
      <div className="grid grid-cols-2 gap-1">
        {COLORMAP_OPTIONS.map((c) => (
          <button
            key={c.name}
            className={`flex items-center gap-1.5 rounded-[2px] border px-1.5 py-1 transition-colors ${
              value === c.name ? "border-accent-cyan/60 bg-accent-cyan/5" : "border-line hover:border-ink-500"
            }`}
            onClick={() => onChange(c.name)}
          >
            <span className="h-2.5 w-8 rounded-[1px] border border-line" style={{ background: colormapCss(c.name) }} />
            <span className="font-mono text-[8px] text-ink-300">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeControl({
  range,
  auto,
  onAuto,
  onChange,
  disabled,
}: {
  range: { min: number; max: number };
  auto: boolean;
  onAuto: (v: boolean) => void;
  onChange: (r: { min: number; max: number }) => void;
  disabled: boolean;
}) {
  const fmt = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e4 || (a < 1e-3 && a > 0)) return v.toExponential(1);
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(2);
    return v.toFixed(3);
  };
  return (
    <>
      <section className="panel-header">
        <span>数值范围</span>
        <button className={`chip ${auto ? "!text-accent-cyan !border-accent-cyan/60" : ""}`} onClick={() => onAuto(!auto)}>
          AUTO
        </button>
      </section>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-ink-500">MIN</span>
          <span className="text-accent-amber tabular-nums">{fmt(range.min)}</span>
        </div>
        <input
          type="range"
          min={range.min}
          max={range.max}
          defaultValue={range.min}
          disabled={disabled || auto}
          className="w-full"
          onChange={(e) => onChange({ min: parseFloat(e.target.value), max: range.max })}
        />
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-ink-500">MAX</span>
          <span className="text-accent-cyan tabular-nums">{fmt(range.max)}</span>
        </div>
        <input
          type="range"
          min={range.min}
          max={range.max}
          defaultValue={range.max}
          disabled={disabled || auto}
          className="w-full"
          onChange={(e) => onChange({ min: range.min, max: parseFloat(e.target.value) })}
        />
      </div>
    </>
  );
}

function ClipControl({ disabled, canvasRef }: { disabled: boolean; canvasRef?: React.RefObject<HTMLCanvasElement | null> }) {
  const store = useCFDStore();
  const dataset = store.getActive();
  const clip = store.clip;
  const bb = dataset?.mesh.boundingBox;

  const axisRange = bb
    ? (() => {
        if (clip.axis === "x") return [bb.min[0], bb.max[0]];
        if (clip.axis === "y") return [bb.min[1], bb.max[1]];
        if (clip.axis === "z") return [bb.min[2], bb.max[2]];
        const n = clip.normal;
        const nl = Math.hypot(n[0], n[1], n[2]) || 1;
        const nx = n[0] / nl, ny = n[1] / nl, nz = n[2] / nl;
        const cx = (bb.min[0] + bb.max[0]) / 2;
        const cy = (bb.min[1] + bb.max[1]) / 2;
        const cz = (bb.min[2] + bb.max[2]) / 2;
        let minD = Infinity, maxD = -Infinity;
        for (let i = 0; i < 8; i++) {
          const px = (i & 1) ? bb.max[0] : bb.min[0];
          const py = (i & 2) ? bb.max[1] : bb.min[1];
          const pz = (i & 4) ? bb.max[2] : bb.min[2];
          const d = nx * (px - cx) + ny * (py - cy) + nz * (pz - cz);
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        }
        return [minD, maxD];
      })()
    : [0, 1];

  const sliceStats = useMemo(() => {
    if (!dataset || !clip.enabled) return null;
    try {
      const { stats } = sliceToCSV(dataset, clip, store.activeField, store.timestep);
      return stats;
    } catch {
      return null;
    }
  }, [dataset, clip, store.activeField, store.timestep, clip.enabled, clip.axis, clip.position, clip.normal[0], clip.normal[1], clip.normal[2]]);

  const axes: { key: ClipAxis; label: string }[] = [
    { key: "x", label: "YZ / X" },
    { key: "y", label: "XZ / Y" },
    { key: "z", label: "XY / Z" },
    { key: "custom", label: "任意法向" },
  ];

  const handleNormalChange = (comp: number, val: number) => {
    const n = [...clip.normal] as [number, number, number];
    n[comp] = val;
    store.setClip({ normal: n });
  };

  const handleExportCSV = () => {
    if (!dataset) return;
    const { csv } = sliceToCSV(dataset, clip, store.activeField, store.timestep);
    const axisLabel = clip.axis === "custom" ? "custom" : clip.axis.toUpperCase();
    const fname = `slice_${axisLabel}_${clip.position.toFixed(3)}_${store.activeField}.csv`;
    downloadText(fname, csv);
  };

  const handleExportReport = async () => {
    if (!dataset) return;
    await downloadSliceReport(dataset, clip, store.activeField, store.timestep, canvasRef?.current ?? null);
  };

  const fmt = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e4 || (a < 1e-3 && a > 0)) return v.toExponential(1);
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(2);
    return v.toFixed(3);
  };

  return (
    <>
      <section className="panel-header">
        <Scissors className="h-3 w-3" strokeWidth={1.5} />
        <span className="flex-1">截面切割</span>
        <button
          className={`chip ${clip.enabled ? "!text-accent-cyan !border-accent-cyan/60 bg-accent-cyan/10" : ""}`}
          onClick={() => store.setClip({ enabled: !clip.enabled })}
          disabled={disabled}
        >
          {clip.enabled ? "ON" : "OFF"}
        </button>
      </section>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-4 gap-1">
          {axes.map((a) => (
            <button
              key={a.key}
              className={`btn h-6 text-[9px] ${clip.axis === a.key ? "btn-active" : ""}`}
              onClick={() => {
                if (a.key === "custom" && clip.axis !== "custom") {
                  store.setClip({ axis: a.key, position: 0 });
                } else {
                  store.setClip({ axis: a.key });
                }
              }}
              disabled={disabled || !clip.enabled}
            >
              {a.label}
            </button>
          ))}
        </div>

        {clip.axis === "custom" && (
          <div className="space-y-1.5 pt-1 border-t border-line/60">
            <div className="field-label">法线方向 N</div>
            <div className="grid grid-cols-3 gap-1.5">
              {["X", "Y", "Z"].map((label, i) => (
                <div key={label} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] text-ink-500 uppercase">{label}</span>
                    <span className="font-mono text-[8px] text-ink-400 tabular-nums">{fmt(clip.normal[i])}</span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={clip.normal[i]}
                    disabled={disabled || !clip.enabled}
                    className="w-full h-1"
                    onChange={(e) => handleNormalChange(i, parseFloat(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-ink-500">POS</span>
          <span className="text-accent-cyan tabular-nums">{clip.position.toFixed(3)}</span>
        </div>
        <input
          type="range"
          min={axisRange[0]}
          max={axisRange[1]}
          step={(axisRange[1] - axisRange[0]) / 200}
          value={clip.position}
          disabled={disabled || !clip.enabled}
          className="w-full"
          onChange={(e) => store.setClip({ position: parseFloat(e.target.value) })}
        />

        {clip.enabled && sliceStats && (
          <div className="space-y-1 pt-2 border-t border-line/60">
            <div className="field-label flex items-center justify-between">
              <span>截面统计 · {store.activeField}</span>
              <span className="text-ink-500">{sliceStats.pointCount} pts</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="rounded-[2px] bg-ink-950/60 px-1.5 py-1">
                <div className="font-mono text-[7px] text-ink-500 uppercase">MIN</div>
                <div className="font-mono text-[10px] text-accent-amber tabular-nums">{fmt(sliceStats.min)}</div>
              </div>
              <div className="rounded-[2px] bg-ink-950/60 px-1.5 py-1">
                <div className="font-mono text-[7px] text-ink-500 uppercase">MEAN</div>
                <div className="font-mono text-[10px] text-ink-200 tabular-nums">{fmt(sliceStats.mean)}</div>
              </div>
              <div className="rounded-[2px] bg-ink-950/60 px-1.5 py-1">
                <div className="font-mono text-[7px] text-ink-500 uppercase">MAX</div>
                <div className="font-mono text-[10px] text-accent-cyan tabular-nums">{fmt(sliceStats.max)}</div>
              </div>
            </div>
            <button
              className="w-full btn h-7 text-[9px] mt-1"
              onClick={handleExportCSV}
              disabled={disabled || !sliceStats.pointCount}
            >
              <FileBox className="h-3 w-3" strokeWidth={1.5} />
              导出截面 CSV
            </button>
          </div>
        )}

        {clip.enabled && (
          <div className="space-y-1.5 pt-2 border-t border-line/60">
            <div className="field-label flex items-center justify-between">
              <span>截面测点</span>
              <span className="text-ink-500">{store.sectionProbes.length} 个</span>
            </div>
            <div className="flex gap-1">
              <button
                className={`btn h-6 flex-1 text-[9px] ${store.sectionProbeMode ? "btn-active !text-accent-amber !border-accent-amber/60" : ""}`}
                onClick={() => store.setSectionProbeMode(!store.sectionProbeMode)}
                disabled={disabled}
              >
                <Crosshair className="h-3 w-3" strokeWidth={1.5} />
                {store.sectionProbeMode ? "点击截面放置" : "放置测点"}
              </button>
              <button
                className="btn h-6 text-[9px]"
                onClick={() => store.clearSectionProbes()}
                disabled={disabled || store.sectionProbes.length === 0}
                title="清空截面测点"
              >
                清空
              </button>
            </div>
            {store.sectionProbes.length > 0 && (
              <div className="space-y-0.5">
                {store.sectionProbes.map((p) => (
                  <div key={p.id} className="flex items-center gap-1 font-mono text-[8px] text-ink-300">
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 truncate">{p.label}</span>
                    <span className="text-ink-500 tabular-nums">
                      {p.position.map((v) => v.toFixed(2)).join(", ")}
                    </span>
                    <button
                      className="text-ink-600 hover:text-accent-magenta"
                      onClick={() => store.removeSectionProbe(p.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="font-mono text-[7px] text-ink-600 uppercase tracking-wider">
              拖动测点移动 · 双击标签删除
            </p>
            <button
              className="w-full btn h-7 text-[9px] !text-accent-violet !border-accent-violet/50"
              onClick={handleExportReport}
              disabled={disabled}
            >
              <FileBox className="h-3 w-3" strokeWidth={1.5} />
              一键导出报告 (CSV + PNG)
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          <SlidersHorizontal className="h-3 w-3 text-ink-500" strokeWidth={1.5} />
          <ChevronDown className="h-3 w-3 text-ink-500" strokeWidth={1.5} />
          <span className="font-mono text-[8px] uppercase tracking-wider text-ink-500">
            切割面显示该平面流场分布
          </span>
        </div>
      </div>
    </>
  );
}
