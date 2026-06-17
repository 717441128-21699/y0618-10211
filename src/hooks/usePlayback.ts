import { useEffect, useRef } from "react";
import { useCFDStore } from "@/store/useCFDStore";

export function usePlayback() {
  const store = useCFDStore();
  const { playing, fps, loop } = store.playback;
  const timestep = store.timestep;
  const timer = useRef<number | null>(null);
  const dataset = store.getActive();

  useEffect(() => {
    if (!playing) {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      return;
    }
    const total = dataset?.times.length ?? 1;
    if (total <= 1) {
      useCFDStore.getState().setPlaying(false);
      return;
    }
    const interval = 1000 / Math.max(0.5, fps);
    const tick = () => {
      const s = useCFDStore.getState();
      const t = s.timestep;
      const max = (s.getActive()?.times.length ?? 1) - 1;
      let next = t + 1;
      if (next > max) {
        if (loop) next = 0;
        else {
          s.setTimestep(max);
          s.setPlaying(false);
          return;
        }
      }
      s.setTimestep(next);
      timer.current = window.setTimeout(tick, interval);
    };
    timer.current = window.setTimeout(tick, interval);
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [playing, fps, loop, dataset, timestep]);
}
