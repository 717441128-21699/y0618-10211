import { useRef, useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import LeftPanel from "@/components/LeftPanel";
import RightPanel from "@/components/RightPanel";
import Timeline from "@/components/Timeline";
import ViewportOverlay from "@/components/ViewportOverlay";
import Viewport from "@/three/Viewport";
import { useCFDStore } from "@/store/useCFDStore";
import { usePlayback } from "@/hooks/usePlayback";
import { VideoRecorder } from "@/utils/exporters";
import { sampleCylinderFlow } from "@/utils/sampleData";

export default function Home() {
  const store = useCFDStore();
  const dataset = store.getActive();
  const [probePlacement, setProbePlacement] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<VideoRecorder | null>(null);

  usePlayback();

  useEffect(() => {
    if (store.datasets.length === 0) {
      const ds = sampleCylinderFlow();
      store.setDataset(ds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-950">
      <TopBar canvasRef={canvasRef} recorderRef={recorderRef} />
      <div className="relative flex flex-1 overflow-hidden">
        <LeftPanel canvasRef={canvasRef} />
        <main className="relative flex-1 overflow-hidden bg-ink-950">
          <div className="absolute inset-0 bg-grid bg-[length:24px_24px] opacity-40" />
          {dataset ? (
            <Viewport
              dataset={dataset}
              probePlacement={probePlacement}
              onPlaceProbe={(p) => {
                store.addProbe(p);
                setProbePlacement(false);
              }}
              onSelectProbe={(id) => store.selectProbe(id)}
              registerCanvas={(el) => { canvasRef.current = el; }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="scanline mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[3px] border border-accent-cyan/30 bg-accent-cyan/5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-cyan/70">CFD</span>
                </div>
                <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-ink-400">
                  HYDROSCOPE · 流场可视化平台
                </p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-ink-600">
                  从左侧导入数据或选择示例工况开始
                </p>
              </div>
            </div>
          )}
          <ViewportOverlay />
        </main>
        <RightPanel probePlacement={probePlacement} onTogglePlacement={() => setProbePlacement(!probePlacement)} />
      </div>
      <Timeline />
    </div>
  );
}
