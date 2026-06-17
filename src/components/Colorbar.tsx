import { useMemo } from "react";
import type { ColormapName } from "@/types/cfd";
import { colormapCss } from "@/utils/colormaps";

interface ColorbarProps {
  colormap: ColormapName;
  range: { min: number; max: number };
  label: string;
  unit?: string;
}

export default function Colorbar({ colormap, range, label, unit }: ColorbarProps) {
  const ticks = useMemo(() => {
    const n = 5;
    const arr: number[] = [];
    for (let i = 0; i <= n; i++) arr.push(range.min + ((range.max - range.min) * i) / n);
    return arr;
  }, [range]);
  const fmt = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e5 || (a < 1e-3 && a > 0)) return v.toExponential(2);
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(2);
    return v.toFixed(4);
  };
  return (
    <div className="flex flex-col items-stretch gap-1 select-none">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-400">{label}</span>
        {unit && <span className="font-mono text-[9px] text-accent-cyan/70">{unit}</span>}
      </div>
      <div className="flex items-stretch gap-2">
        <div
          className="w-3 h-32 rounded-[2px] border border-line"
          style={{ background: colormapCss(colormap) }}
        />
        <div className="flex flex-col justify-between py-0">
          {ticks
            .slice()
            .reverse()
            .map((t, i) => (
              <span key={i} className="font-mono text-[9px] tabular-nums text-ink-400 leading-none">
                {fmt(t)}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
