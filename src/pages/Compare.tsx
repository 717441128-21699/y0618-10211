import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Columns2, Link2, Unlink, GitCompare, Plus } from "lucide-react";
import { useCFDStore, activeRange } from "@/store/useCFDStore";
import Viewport from "@/three/Viewport";
import Timeline from "@/components/Timeline";
import { usePlayback } from "@/hooks/usePlayback";
import { SAMPLE_DATASETS } from "@/utils/sampleData";

export default function Compare() {
  const store = useCFDStore();
  usePlayback();
  const cameraSyncRef = useRef<{
    sync: (cam: any) => void;
    setCamera: (cam: any) => void;
  } | null>(null);

  const datasetsToCompare = store.datasets.length > 0 ? store.datasets : [];
  const active = store.getActive();

  const handleAddSample = (fn: () => any) => {
    const ds = fn();
    store.addDataset(ds);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-950">
      <header className="flex h-11 items-center justify-between border-b border-line bg-ink-900/95 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn">
            <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
            返回工作台
          </Link>
          <div className="flex items-center gap-2">
            <Columns2 className="h-4 w-4 text-accent-cyan" strokeWidth={1.5} />
            <span className="font-mono text-[12px] font-bold tracking-[0.2em] text-ink-100">
              工况对比
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`btn ${store.syncCameras ? "btn-active" : ""}`}
            onClick={() => store.setSyncCameras(!store.syncCameras)}
          >
            {store.syncCameras ? <Link2 className="h-3 w-3" strokeWidth={1.5} /> : <Unlink className="h-3 w-3" strokeWidth={1.5} />}
            {store.syncCameras ? "相机已联动" : "相机独立"}
          </button>
          <span className="font-mono text-[9px] text-ink-500 uppercase">
            {datasetsToCompare.length} 个工况
          </span>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {datasetsToCompare.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <GitCompare className="mx-auto mb-3 h-10 w-10 text-ink-600" strokeWidth={1} />
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400">
                尚无可对比的工况
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-600">
                下方添加示例工况到对比池
              </p>
              <div className="mt-4 flex justify-center gap-1.5">
                {SAMPLE_DATASETS.map((s) => (
                  <button key={s.key} className="btn" onClick={() => handleAddSample(s.fn)}>
                    <Plus className="h-3 w-3" strokeWidth={1.5} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 grid-flow-col auto-cols-fr gap-px bg-line p-px">
            {datasetsToCompare.slice(0, 3).map((ds, idx) => (
              <div key={ds.id} className="relative flex flex-col overflow-hidden bg-ink-950">
                <div className="flex h-8 items-center justify-between border-b border-line px-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-300">
                    <span className="text-accent-cyan mr-1.5">[{idx + 1}]</span>
                    {ds.name}
                  </span>
                  <span className="chip">{ds.caseLabel}</span>
                </div>
                <div className="relative flex-1">
                  <Viewport
                    dataset={ds}
                    isMaster={idx === 0}
                    cameraSyncRef={cameraSyncRef}
                    onSelectProbe={(id) => { store.setActive(ds.id); store.selectProbe(id); }}
                  />
                  <CompareOverlay dataset={ds} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {active && <Timeline compact />}

      {datasetsToCompare.length > 0 && datasetsToCompare.length < 3 && (
        <div className="flex h-10 items-center gap-2 border-t border-line bg-ink-900/95 px-4">
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">添加更多工况:</span>
          {SAMPLE_DATASETS.filter(
            (s) => !datasetsToCompare.some((d) => d.name === s.key)
          ).map((s) => (
            <button key={s.key} className="btn h-6 text-[9px]" onClick={() => handleAddSample(s.fn)}>
              <Plus className="h-3 w-3" strokeWidth={1.5} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompareOverlay({ dataset }: { dataset: any }) {
  const store = useCFDStore();
  const range = activeRange(dataset, store.activeField, store.rangeOverride, store.autoRange);
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3));
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-2 bottom-2 chip bg-ink-900/80">
        {store.activeField}: {fmt(range.min)} ~ {fmt(range.max)}
      </div>
    </div>
  );
}
