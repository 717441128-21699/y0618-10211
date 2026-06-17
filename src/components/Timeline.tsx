import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useCFDStore } from "@/store/useCFDStore";

interface TimelineProps {
  compact?: boolean;
}

export default function Timeline({ compact = false }: TimelineProps) {
  const store = useCFDStore();
  const dataset = store.getActive();
  const times = dataset?.times ?? [0];
  const total = times.length;
  const max = Math.max(0, total - 1);

  const fmt = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e4 || (a < 1e-3 && a > 0)) return v.toExponential(1);
    if (a >= 100) return v.toFixed(0);
    return v.toFixed(2);
  };

  if (total <= 1) {
    return (
      <footer className="flex h-12 items-center justify-between border-t border-line bg-ink-900/95 px-4">
        <div className="flex items-center gap-2 font-mono text-[10px] text-ink-500 uppercase tracking-wider">
          <Clock className="h-3 w-3" strokeWidth={1.5} />
          稳态模拟 · 单时间步
        </div>
        <span className="font-mono text-[9px] text-ink-600">TIME-SERIES DISABLED</span>
      </footer>
    );
  }

  return (
    <footer className={`flex ${compact ? "h-10" : "h-14"} items-center gap-3 border-t border-line bg-ink-900/95 px-4`}>
      <div className="flex items-center gap-1">
        <button className="btn h-7 w-7 p-0" onClick={() => store.setTimestep(0)} disabled={total <= 1} title="首帧">
          <SkipBack className="h-3 w-3" strokeWidth={1.5} />
        </button>
        <button
          className="btn h-7 w-7 p-0"
          onClick={() => store.setTimestep(Math.max(0, store.timestep - 1))}
          title="上一帧"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          className={`btn h-8 w-8 p-0 ${store.playback.playing ? "btn-active !text-accent-amber !border-accent-amber/60" : "btn-primary"}`}
          onClick={() => store.setPlaying(!store.playback.playing)}
        >
          {store.playback.playing ? <Pause className="h-3.5 w-3.5" strokeWidth={2} /> : <Play className="h-3.5 w-3.5 ml-0.5" strokeWidth={2} />}
        </button>
        <button
          className="btn h-7 w-7 p-0"
          onClick={() => store.setTimestep(Math.min(max, store.timestep + 1))}
          title="下一帧"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          className="btn h-7 w-7 p-0"
          onClick={() => store.setTimestep(max)}
          title="末帧"
        >
          <SkipForward className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 flex items-center gap-2">
        <span className="font-mono text-[9px] tabular-nums text-ink-400 w-12 text-right">
          {fmt(times[store.timestep])}
        </span>
        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={store.timestep}
            className="w-full"
            onChange={(e) => store.setTimestep(parseInt(e.target.value))}
          />
          <div className="pointer-events-none mt-1 flex justify-between font-mono text-[7px] text-ink-600">
            {times.length <= 12 &&
              times.map((_, i) => (
                <span key={i} className={i === store.timestep ? "text-accent-cyan" : ""}>
                  |
                </span>
              ))}
          </div>
        </div>
        <span className="font-mono text-[9px] tabular-nums text-ink-400 w-12">
          {fmt(times[max])}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          className={`btn h-7 ${store.playback.loop ? "btn-active" : ""}`}
          onClick={() => store.setLoop(!store.playback.loop)}
          title="循环"
        >
          <Repeat className="h-3 w-3" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[8px] text-ink-500 uppercase">FPS</span>
          {[2, 6, 12, 24].map((f) => (
            <button
              key={f}
              className={`btn h-6 px-1.5 text-[9px] ${store.playback.fps === f ? "btn-active" : ""}`}
              onClick={() => store.setFps(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="font-mono text-[9px] tabular-nums text-accent-cyan ml-1">
          {store.timestep + 1}/{total}
        </span>
      </div>
    </footer>
  );
}
