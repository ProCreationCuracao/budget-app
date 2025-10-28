"use client";

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AnimatedNumber from "@/components/animated-number";
import { formatCurrency } from "@/lib/format";
import { useEffect, useId, useState } from "react";

export default function MonthSpendCard({
  total,
  currency,
  locale,
  cumSeries,
  avgSeries,
  txCount,
  prevTotal,
}: {
  total: number;
  currency: string;
  locale: string;
  cumSeries: number[];
  avgSeries: number[];
  txCount?: number;
  prevTotal?: number;
}) {
  const data = cumSeries.map((y, i) => ({ x: i + 1, y, avg: avgSeries[i] ?? 0 }));
  const id = useId().replace(/:/g, "");
  const fmt = (v: number) => formatCurrency(v || 0, currency, locale, { maximumFractionDigits: 0 });
  const deltaPct = typeof prevTotal === "number" && isFinite(prevTotal) && prevTotal !== 0
    ? (total - prevTotal) / Math.abs(prevTotal)
    : null;
  const deltaText = deltaPct == null ? "" : `${deltaPct >= 0 ? "+" : ""}${Math.round(deltaPct * 100)}% vs last mo`;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return (
    <div className="relative rounded-2xl glass border border-zinc-200/50 dark:border-zinc-800 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-wider uppercase text-zinc-500 dark:text-zinc-400">SPENT THIS MONTH</div>
          <div className="mt-1 text-3xl font-semibold tabular tracking-tight">
            {mounted ? <AnimatedNumber value={total} format={fmt} /> : fmt(total)}
          </div>
        </div>
        {typeof txCount === "number" ? (
          <div className="relative">
            <button
              aria-label="Month summary"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              className="rounded-full px-2 py-1 text-xs ring-1 ring-inset ring-black/10 dark:ring-white/10 bg-white/50 dark:bg-zinc-900/40 hover:bg-white/70 dark:hover:bg-zinc-900/60"
            >
              Summary
            </button>
            {open ? (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 p-2 text-xs shadow-md">
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="font-medium tabular">{fmt(total)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span># of txns</span>
                  <span className="font-medium tabular">{txCount}</span>
                </div>
                {deltaPct != null ? (
                  <div className="flex items-center justify-between mt-1">
                    <span>Δ vs last month</span>
                    <span className={"font-medium " + (deltaPct >= 0 ? "text-emerald-600" : "text-rose-600")}>{deltaText}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-3 h-28 sm:h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--fg)/0.08)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="x" tick={{ fontSize: 10, fill: "hsl(var(--fg)/0.6)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--fg)/0.6)" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              cursor={{ stroke: "hsl(var(--fg)/0.2)", strokeWidth: 1 }}
              contentStyle={{ background: "hsl(var(--bg))", border: "1px solid hsl(var(--fg)/0.14)", borderRadius: 12, padding: 8 }}
              formatter={(value: any, name: any) => [fmt(Number(value)), name === "y" ? "Total" : "Average"]}
              labelFormatter={(label) => String(label)}
            />
            <Area type="monotone" dataKey="y" stroke="hsl(var(--primary))" strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
            <Line type="monotone" dataKey="avg" stroke="hsl(var(--fg)/0.4)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
        <div className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(var(--primary))" }} /> This period</div>
        <div className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full border border-zinc-500/50" /> Average</div>
      </div>
    </div>
  );
}
