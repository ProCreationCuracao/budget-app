"use client";

import { useMemo, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export type DayData = { date: string; spend: number };

export default function MonthCalendar({
  year,
  month, // 0-11
  days,
  locale = "en-US",
  currency = "USD",
  totalBudget = 0,
  totalSpent = 0,
  onLongPress,
}: {
  year: number;
  month: number;
  days: DayData[];
  locale?: string;
  currency?: string;
  totalBudget?: number;
  totalSpent?: number;
  onLongPress?: (isoDate: string) => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selected, setSelected] = useState<string | null>(todayIso);
  const dayMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of days) m.set(d.date, d.spend);
    return m;
  }, [days]);

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7; // Monday=0
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const weekOfSelected = useMemo(() => {
    const sel = selected ?? todayIso;
    const d = new Date(sel + "T00:00:00Z");
    const weekday = (d.getUTCDay() + 6) % 7; // Mon=0
    const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - weekday));
    const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6));
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const s = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + i))
        .toISOString()
        .slice(0, 10);
      sum += dayMap.get(s) ?? 0;
    }
    return sum;
  }, [dayMap, selected, todayIso]);

  const monthAvgPerDay = useMemo(() => {
    const total = days.reduce((a, d) => a + (d.spend || 0), 0);
    const count = Math.max(1, daysInMonth);
    return total / count;
  }, [days, daysInMonth]);

  const remainingBudget = Math.max(0, totalBudget - totalSpent);

  // Long press handler
  const pressTimer = useRef<any>(null);
  function handlePointerDown(dateIso: string) {
    pressTimer.current = setTimeout(() => {
      onLongPress?.(dateIso);
    }, 500);
  }
  function handlePointerUp() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  function bucketClass(v: number) {
    if (v <= 0) return "bucket-0";
    if (v < 25) return "bucket-1";
    if (v < 100) return "bucket-2";
    if (v < 250) return "bucket-3";
    return "bucket-4";
  }

  return (
    <div>
      {/* Sticky-ish summary */}
      <div className="mb-2 text-xs text-zinc-500 flex items-center gap-3">
        <span>Week Total: <span className="tabular font-medium">{fmtCurrency(weekOfSelected)}</span></span>
        <span>Month Avg/Day: <span className="tabular font-medium">{fmtCurrency(monthAvgPerDay)}</span></span>
        <span>Remaining Budget: <span className="tabular font-medium">{fmtCurrency(remainingBudget)}</span></span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
          <div key={d} className="text-[10px] text-zinc-500 text-center">{d}</div>
        ))}
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - startOffset + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const dateIso = inMonth
            ? new Date(Date.UTC(year, month, dayNum)).toISOString().slice(0, 10)
            : "";
          const spend = inMonth ? dayMap.get(dateIso) ?? 0 : 0;
          const isToday = dateIso === todayIso;
          const isSelected = selected === dateIso;
          return (
            <button
              key={idx}
              disabled={!inMonth}
              onClick={() => inMonth && setSelected(dateIso)}
              onPointerDown={() => inMonth && handlePointerDown(dateIso)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={cn(
                "h-12 rounded-xl p-1 text-left transition-transform",
                inMonth ? bucketClass(spend) : "opacity-30",
                isSelected ? "-translate-y-0.5 shadow-sm" : "",
                isToday ? "outline outline-1 outline-offset-2 outline-[hsl(var(--accent))]" : ""
              )}
              aria-label={`${fmtCurrency(spend)} on ${dateIso || ""}`}
            >
              <div className="text-[10px] text-zinc-500">{inMonth ? dayNum : ""}</div>
              <div className="text-xs font-medium tabular">{inMonth ? (spend > 0 ? Math.round(spend) : "—") : ""}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  function fmtCurrency(v: number) {
    return formatCurrency(v || 0, currency || "USD", locale || "en-US", { maximumFractionDigits: 0 });
  }
}
