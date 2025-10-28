"use client";

import { useId, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type CashflowPoint = { x: string; y: number };

export default function CashflowArea({ data, compare, currency, locale, stroke, fill, defaultShowCompare = false, txCount }: { data: CashflowPoint[]; compare?: CashflowPoint[]; currency?: string; locale?: string; stroke?: string; fill?: string; defaultShowCompare?: boolean; txCount?: number }) {
  const [showCompare, setShowCompare] = useState<boolean>(!!defaultShowCompare);
  const [open, setOpen] = useState(false);
  const id = useId().replace(/:/g, "");
  const endpoint = data?.[data.length - 1]?.y ?? 0;
  const prevEndpoint = useMemo(() => {
    if (!compare || compare.length === 0) return null as number | null;
    const idx = Math.min(compare.length - 1, data.length - 1);
    return compare[idx]?.y ?? null;
  }, [compare, data]);
  const deltaPct = prevEndpoint != null && prevEndpoint !== 0 ? (endpoint - prevEndpoint) / Math.abs(prevEndpoint) : null;
  return (
    <div className="relative w-full h-48 sm:h-64">
      <div className="absolute left-2 top-2 z-10">
        <button
          type="button"
          aria-label="Cashflow summary"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="text-xs rounded-full px-2 py-1 bg-white/8 ring-1 ring-inset ring-white/12 hover:bg-white/12"
        >
          Summary
        </button>
        {open ? (
          <div className="mt-2 w-56 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 p-2 text-xs shadow-md">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span className="font-medium tabular">{formatCurrency(endpoint, currency || "USD", locale || "en-US")}</span>
            </div>
            {typeof txCount === "number" ? (
              <div className="flex items-center justify-between mt-1">
                <span># of txns</span>
                <span className="font-medium tabular">{txCount}</span>
              </div>
            ) : null}
            {deltaPct != null ? (
              <div className="flex items-center justify-between mt-1">
                <span>Δ vs last period</span>
                <span className={"font-medium " + (deltaPct >= 0 ? "text-emerald-600" : "text-rose-600")}>{`${deltaPct >= 0 ? "+" : ""}${Math.round(deltaPct * 100)}%`}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-pressed={showCompare}
        onClick={() => setShowCompare((v) => !v)}
        className="absolute right-2 top-2 z-10 text-xs rounded-full px-2 py-1 bg-white/8 ring-1 ring-inset ring-white/12 hover:bg-white/12"
      >
        {showCompare ? "Hide compare" : "Compare last period"}
      </button>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fill ?? "hsl(var(--accent))"} stopOpacity={0.28} />
              <stop offset="100%" stopColor={fill ?? "hsl(var(--accent))"} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--fg)/0.08)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: "hsl(var(--fg)/0.6)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--fg)/0.6)" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ stroke: "hsl(var(--fg)/0.2)", strokeWidth: 1 }}
            contentStyle={{ background: "hsl(var(--bg))", border: "1px solid hsl(var(--fg)/0.14)", borderRadius: 12, padding: 8 }}
            formatter={(value: any, name: any) => [formatCurrency(Number(value), currency || "USD", locale || "en-US", { maximumFractionDigits: 0 }), name === "y" ? (showCompare ? "This period" : "Net") : "Last period"]}
            labelFormatter={(label: any, payload: readonly any[]) => {
              if (!showCompare) return label as any;
              const cur = payload?.find((p: any) => p.dataKey === "y")?.value as number | undefined;
              const idx = (payload as any)?.[0]?.payload?.index ?? null;
              const prevVal = (compare && idx != null && compare[idx]) ? compare[idx].y : undefined;
              if (prevVal == null || cur == null) return label as any;
              const delta = prevVal === 0 ? 0 : (cur - prevVal) / Math.abs(prevVal);
              const pct = isFinite(delta) ? Math.round(delta * 100) : 0;
              return `${label}  •  Δ ${pct >= 0 ? "+" : ""}${pct}%` as any;
            }}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke={stroke ?? "hsl(var(--accent))"}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
          {/* Overlay transparent line to render only the endpoint luminous dot */}
          <Line
            type="monotone"
            dataKey="y"
            stroke="transparent"
            dot={(props: any) => {
              const { cx, cy, index } = props;
              if (index !== data.length - 1) return <g key={`dot-${index}`} />;
              return (
                <g key={`dot-${index}`}>
                  <circle cx={cx} cy={cy} r={10} fill="hsl(var(--accent)/0.12)" />
                  <circle cx={cx} cy={cy} r={5} fill="hsl(var(--accent)/0.22)" />
                  <circle cx={cx} cy={cy} r={3} fill={stroke ?? "hsl(var(--accent))"} />
                </g>
              );
            }}
            isAnimationActive={false}
          />
          {showCompare && compare ? (
            <Line type="monotone" dataKey="y" name="last" data={compare} stroke="hsl(var(--fg)/0.45)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

