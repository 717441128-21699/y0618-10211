import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Camera,
  Film,
  Crosshair,
  Waves,
  Box,
  Columns2,
  Gauge,
  Cpu,
} from "lucide-react";
import { useCFDStore } from "@/store/useCFDStore";
import { exportCanvasImage, VideoRecorder, downloadText, probesToCSV } from "@/utils/exporters";

interface TopBarProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  recorderRef: React.MutableRefObject<VideoRecorder | null>;
}

export default function TopBar({ canvasRef, recorderRef }: TopBarProps) {
  const location = useLocation();
  const store = useCFDStore();
  const [recording, setRecording] = useState(false);
  const dataset = store.getActive();

  const handleImage = async () => {
    if (canvasRef.current) {
      await exportCanvasImage(canvasRef.current, `hydroscope_${Date.now()}.png`, 2);
    }
  };

  const handleRecord = () => {
    if (!canvasRef.current) return;
    if (!recording) {
      const rec = new VideoRecorder();
      rec.start(canvasRef.current, 30);
      recorderRef.current = rec;
      setRecording(true);
    } else {
      recorderRef.current?.stop(`hydroscope_${Date.now()}.webm`).then(() => {
        setRecording(false);
        recorderRef.current = null;
      });
    }
  };

  const handleCSV = () => {
    if (!dataset || store.probes.length === 0) return;
    const csv = probesToCSV(dataset, store.probes, ["pressure", "velocity"]);
    downloadText(`probes_${Date.now()}.csv`, csv);
  };

  const navItems = [
    { to: "/", label: "WORKSPACE", icon: Gauge },
    { to: "/compare", label: "COMPARE", icon: Columns2 },
  ];

  return (
    <header className="relative z-30 flex h-11 items-center justify-between border-b border-line bg-ink-900/95 px-3 backdrop-blur">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-[3px] border border-accent-cyan/40 bg-accent-cyan/5">
            <Waves className="h-4 w-4 text-accent-cyan" strokeWidth={1.5} />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent-cyan animate-pulseLine" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[13px] font-bold tracking-[0.2em] text-ink-100">
              HYDRO<span className="text-grad">SCOPE</span>
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-ink-500">
              CFD VISUALIZER v1.0
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 ml-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`btn ${active ? "btn-active" : ""}`}
              >
                <Icon className="h-3 w-3" strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {dataset && (
          <div className="hidden md:flex items-center gap-3 font-mono text-[10px] text-ink-400">
            <span className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-accent-cyan/70" strokeWidth={1.5} />
              {dataset.mesh.pointCount.toLocaleString()} PTS
            </span>
            <span className="flex items-center gap-1.5">
              <Box className="h-3 w-3 text-accent-cyan/70" strokeWidth={1.5} />
              {dataset.mesh.cellCount.toLocaleString()} CELLS
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-accent-amber/80" strokeWidth={1.5} />
              {dataset.times.length} STEPS
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button className="btn" onClick={handleCSV} disabled={!dataset || store.probes.length === 0} title="导出探针 CSV">
            <Crosshair className="h-3 w-3" strokeWidth={1.5} />
            CSV
          </button>
          <button className="btn" onClick={handleImage} disabled={!dataset} title="导出高清 PNG">
            <Camera className="h-3 w-3" strokeWidth={1.5} />
            PNG
          </button>
          <button
            className={`btn ${recording ? "btn-active !text-accent-magenta !border-accent-magenta/60" : ""}`}
            onClick={handleRecord}
            disabled={!dataset}
            title="录制动画视频"
          >
            <Film className="h-3 w-3" strokeWidth={1.5} />
            {recording ? "STOP" : "REC"}
            {recording && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent-magenta animate-pulseLine" />}
          </button>
        </div>
      </div>
    </header>
  );
}
