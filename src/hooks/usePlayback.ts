import { useEffect, useRef } from "react";
import { useCFDStore, maxTimestepCount } from "@/store/useCFDStore";

export function usePlayback(compare = false) {
  const store = useCFDStore();
  const { playing, fps, loop } = store.playback;
  const timestep = store.timestep;
  const timer = useRef<number | null>(null);
  const dataset = store.getActive();
  const datasets = store.datasets;

  useEffect(() => {
    if (!playing) {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      return;
    }
    const activeTotal = dataset?.times.length ?? 1;
    const globalTotal = compare && store.syncTime ? maxTimestepCount(datasets) : activeTotal;
    const total = Math.max(activeTotal, globalTotal);
    if (total <= 1) {
      useCFDStore.getState().setPlaying(false);
      return;
    }
    const interval = 1000 / Math.max(0.5, fps);
    const tick = () => {
      const s = useCFDStore.getState();
      const activeDs = s.getActive();
      let t: number;
      let maxStep: number;
      if (s.syncTime || !activeDs) {
        t = s.timestep;
        const aTotal = activeDs?.times.length ?? 1;
        const gTotal = compare && s.syncTime ? maxTimestepCount(s.datasets) : aTotal;
        maxStep = Math.max(aTotal, gTotal) - 1;
      } else {
        t = s.getTimestepFor(activeDs.id);
        maxStep = Math.max(0, activeDs.times.length - 1);
      }
      let next = t + 1;
      if (next > maxStep) {
        if (loop) next = 0;
        else {
          s.setTimestep(maxStep);
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
  }, [playing, fps, loop, dataset, timestep, compare, store.syncTime, datasets]);
}
