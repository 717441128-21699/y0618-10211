import { useEffect, useRef, useState } from "react";
import { useCFDStore, activeRange } from "@/store/useCFDStore";
import Colorbar from "./Colorbar";
import { Maximize, Eye, Grid3x3, Orbit, Boxes } from "lucide-react";

export default function ViewportOverlay() {
  const store = useCFDStore();
  const dataset = store.getActive();
  const [fps, setFps] = useState(0);
  const frameTimes = useRef<number[]>([]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      frameTimes.current.push(now);
      while (frameTimes.current.length > 0 && frameTimes.current[0] < now - 1000) {
        frameTimes.current.shift();
      }
      setFps(frameTimes.current.length);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const range = dataset ? activeRange(dataset, store.activeField, store.rangeOverride, store.autoRange) : { min: 0, max: 1 };
  const field = store.activeField;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Top-left status */}
      <div className="absolute left-3 top-3 flex flex-col gap-1">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <span className="chip !text-accent-cyan !border-accent-cyan/30 bg-ink-900/80">
            <Eye className="h-2.5 w-2.5" strokeWidth={1.5} />
            {store.mode.toUpperCase()}
          </span>
          <span className="chip bg-ink-900/80">
            <Boxes className="h-2.5 w-2.5" strokeWidth={1.5} />
            {field}
          </span>
        </div>
        {dataset && (
          <span className="pointer-events-auto chip bg-ink-900/80">
            <Orbit className="h-2.5 w-2.5 text-accent-cyan/70" strokeWidth={1.5} />
            {dataset.caseLabel}
          </span>
        )}
      </div>

      {/* Top-right quick toggles */}
      <div className="absolute right-3 top-3 flex items-center gap-1 pointer-events-auto">
        <button
          className={`btn h-7 w-7 p-0 bg-ink-900/80 ${store.showGrid ? "btn-active" : ""}`}
          onClick={() => store.setShowGrid(!store.showGrid)}
          title="边界网格"
        >
          <Grid3x3 className="h-3 w-3" strokeWidth={1.5} />
        </button>
        <button
          className="btn h-7 w-7 p-0 bg-ink-900/80"
          onClick={() => store.setProjection(store.projection === "perspective" ? "orthographic" : "perspective")}
          title="切换正交/透视"
        >
          <Maximize className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>

      {/* Bottom-left FPS */}
      <div className="absolute left-3 bottom-3 flex items-center gap-2">
        <span className="chip bg-ink-900/80">
          <span className={`h-1.5 w-1.5 rounded-full ${fps >= 30 ? "bg-accent-cyan" : fps >= 15 ? "bg-accent-amber" : "bg-accent-magenta"}`} />
          {fps} FPS
        </span>
        {dataset && (
          <span className="chip bg-ink-900/80">
            {dataset.mesh.pointCount.toLocaleString()} PTS
          </span>
        )}
      </div>

      {/* Right colorbar */}
      {dataset && (
        <div className="pointer-events-auto absolute right-3 bottom-3">
          <div className="rounded-[2px] border border-line bg-ink-900/80 p-2">
            <Colorbar
              colormap={store.colormap}
              range={range}
              label={store.activeField}
              unit={dataset.fields[store.activeField]?.unit}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!dataset && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="scanline mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[3px] border border-accent-cyan/30 bg-accent-cyan/5">
              <Boxes className="h-7 w-7 text-accent-cyan/60" strokeWidth={1} />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400">
              等待数据载入
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-600">
              导入 VTK / JSON 或选择示例工况
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
