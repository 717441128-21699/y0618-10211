import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CFDataset, Probe } from "@/types/cfd";
import { sampleProbeTimeSeries } from "@/utils/streamlines";

interface ProbeChartProps {
  dataset: CFDataset;
  probes: Probe[];
  fields: string[];
  currentTime: number;
}

export default function ProbeChart({ dataset, probes, fields, currentTime }: ProbeChartProps) {
  const data = useMemo(() => {
    if (probes.length === 0) return [];
    const field = fields[0] ?? "pressure";
    const { times, series } = sampleProbeTimeSeries(dataset, probes[0].position, [field]);
    return times.map((t, i) => {
      const row: Record<string, number> = { t, time: t };
      probes.forEach((p) => {
        const r = sampleProbeTimeSeries(dataset, p.position, [field]);
        row[p.id] = r.series[field][i];
      });
      return row;
    });
  }, [dataset, probes, fields]);

  const field = fields[0] ?? "pressure";

  if (probes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] font-mono uppercase tracking-wider text-ink-500 border border-dashed border-line rounded-[2px]">
        放置探针后显示时序曲线
      </div>
    );
  }

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#222b3a" strokeDasharray="2 2" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="#4a5668"
            tick={{ fill: "#6b7686", fontSize: 9, fontFamily: "IBM Plex Mono" }}
            tickLine={{ stroke: "#222b3a" }}
            axisLine={{ stroke: "#222b3a" }}
          />
          <YAxis
            stroke="#4a5668"
            tick={{ fill: "#6b7686", fontSize: 9, fontFamily: "IBM Plex Mono" }}
            tickLine={{ stroke: "#222b3a" }}
            axisLine={{ stroke: "#222b3a" }}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "#0e131b",
              border: "1px solid #222b3a",
              borderRadius: 2,
              fontSize: 10,
              fontFamily: "IBM Plex Mono",
            }}
            labelStyle={{ color: "#36e2c8" }}
          />
          <Legend wrapperStyle={{ fontSize: 9, fontFamily: "IBM Plex Mono" }} iconType="plainline" />
          {probes.map((p) => (
            <Line
              key={p.id}
              type="monotone"
              dataKey={p.id}
              stroke={p.color}
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
              name={p.label}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-500">
        场变量 / {field}
      </div>
    </div>
  );
}
