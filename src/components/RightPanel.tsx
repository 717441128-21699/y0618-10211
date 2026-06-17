import {
  Crosshair,
  Trash2,
  MapPin,
  TrendingUp,
  Sigma,
  Timer,
  Target,
  Radio,
} from "lucide-react";
import { useCFDStore, activeRange } from "@/store/useCFDStore";
import ProbeChart from "./ProbeChart";
import { sampleFieldAtPoint } from "@/utils/streamlines";
import { useMemo } from "react";

interface RightPanelProps {
  probePlacement: boolean;
  onTogglePlacement: () => void;
}

export default function RightPanel({ probePlacement, onTogglePlacement }: RightPanelProps) {
  const store = useCFDStore();
  const dataset = store.getActive();
  const range = dataset ? activeRange(dataset, store.activeField, store.rangeOverride, store.autoRange) : { min: 0, max: 1 };

  const currentValues = useMemo(() => {
    if (!dataset) return [];
    return store.probes.map((p) => ({
      probe: p,
      ...sampleFieldAtPoint(dataset, store.activeField, store.timestep, p.position),
    }));
  }, [dataset, store.probes, store.activeField, store.timestep]);

  const stats = useMemo(() => {
    if (!dataset) return null;
    const f = dataset.fields[store.activeField];
    if (!f) return null;
    const step = Math.min(store.timestep, f.timesteps.length - 1);
    const data = f.timesteps[step];
    let min = Infinity, max = -Infinity, sum = 0, n = 0;
    for (let i = 0; i < data.length; i += f.components) {
      const v = f.type === "vector" ? Math.hypot(data[i], data[i + 1], data[i + 2]) : data[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v; n++;
    }
    return { min, max, mean: sum / n, count: n };
  }, [dataset, store.activeField, store.timestep]);

  const fmt = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e4 || (a < 1e-3 && a > 0)) return v.toExponential(2);
    if (a >= 100) return v.toFixed(2);
    if (a >= 1) return v.toFixed(3);
    return v.toFixed(4);
  };

  return (
    <aside className="flex w-72 flex-col border-l border-line bg-ink-900/70 overflow-y-auto scroll-thin">
      <section className="panel-header">
        <span>数值探针</span>
        <span className="text-accent-cyan/60">{store.probes.length}</span>
      </section>
      <div className="p-3 space-y-2">
        <button
          className={`w-full btn h-8 ${probePlacement ? "btn-active !text-accent-amber !border-accent-amber/60" : ""}`}
          onClick={onTogglePlacement}
        >
          <Crosshair className="h-3.5 w-3.5" strokeWidth={1.5} />
          {probePlacement ? "点击视口放置探针" : "放置探针"}
        </button>

        <div className="space-y-1 max-h-44 overflow-y-auto scroll-thin">
          {store.probes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Target className="h-6 w-6 text-ink-600 mb-2" strokeWidth={1} />
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
                尚无探针
              </span>
            </div>
          )}
          {store.probes.map((p) => {
            const cv = currentValues.find((c) => c.probe.id === p.id);
            return (
              <div
                key={p.id}
                className={`rounded-[2px] border px-2 py-1.5 cursor-pointer transition-colors ${
                  store.selectedProbeId === p.id
                    ? "border-accent-cyan/50 bg-accent-cyan/5"
                    : "border-line hover:border-ink-500"
                }`}
                onClick={() => store.selectProbe(p.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
                    />
                    <span className="font-mono text-[10px] text-ink-100">{p.label}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); store.removeProbe(p.id); }}
                    className="text-ink-500 hover:text-accent-magenta transition-colors"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-1 font-mono text-[8px] text-ink-500">
                  <MapPin className="h-2.5 w-2.5" strokeWidth={1.5} />
                  {p.position.map((v) => v.toFixed(2)).join(", ")}
                </div>
                {cv && (
                  <div className="mt-1 flex items-center justify-between font-mono text-[9px]">
                    <span className="text-ink-400 uppercase">{store.activeField}</span>
                    <span className="text-accent-cyan tabular-nums">{fmt(cv.value)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {store.probes.length > 0 && (
          <button className="w-full btn h-6 text-[9px]" onClick={() => store.clearProbes()}>
            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
            清空全部
          </button>
        )}
      </div>

      <section className="panel-header">
        <TrendingUp className="h-3 w-3" strokeWidth={1.5} />
        <span className="flex-1">时序曲线</span>
        <Radio className="h-3 w-3 text-accent-amber/70 animate-pulseLine" strokeWidth={1.5} />
      </section>
      <div className="p-3">
        <ProbeChart
          dataset={dataset!}
          probes={store.probes}
          fields={[store.activeField]}
          currentTime={dataset?.times[store.timestep] ?? 0}
        />
      </div>

      <section className="panel-header">
        <Sigma className="h-3 w-3" strokeWidth={1.5} />
        <span className="flex-1">场统计</span>
        <Timer className="h-3 w-3 text-accent-cyan/70" strokeWidth={1.5} />
      </section>
      <div className="p-3 space-y-1.5">
        {stats && (
          <div className="grid grid-cols-2 gap-1.5">
            <StatCell label="MIN" value={fmt(stats.min)} color="amber" />
            <StatCell label="MAX" value={fmt(stats.max)} color="cyan" />
            <StatCell label="MEAN" value={fmt(stats.mean)} color="violet" />
            <StatCell label="RANGE" value={fmt(stats.max - stats.min)} color="magenta" />
          </div>
        )}
        <div className="divider mt-2" />
        <div className="flex items-center justify-between font-mono text-[9px]">
          <span className="text-ink-500 uppercase">CURRENT TS</span>
          <span className="text-accent-cyan tabular-nums">
            {store.timestep + 1} / {dataset?.times.length ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[9px]">
          <span className="text-ink-500 uppercase">PHYS TIME</span>
          <span className="text-ink-200 tabular-nums">
            {fmt(dataset?.times[store.timestep] ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[9px]">
          <span className="text-ink-500 uppercase">LUT MIN/MAX</span>
          <span className="text-ink-200 tabular-nums">
            {fmt(range.min)} / {fmt(range.max)}
          </span>
        </div>
      </div>
    </aside>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: "text-accent-cyan",
    amber: "text-accent-amber",
    violet: "text-accent-violet",
    magenta: "text-accent-magenta",
  };
  return (
    <div className="rounded-[2px] border border-line bg-ink-850 px-2 py-1.5">
      <div className="font-mono text-[8px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`font-mono text-[11px] tabular-nums ${colorMap[color]}`}>{value}</div>
    </div>
  );
}
