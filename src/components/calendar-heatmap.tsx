"use client";

import React, { useMemo, useRef, useState } from "react";
import QuickAddSheet from "@/components/quick-add-sheet";

export default function CalendarHeatmap({
  start,
  values,
  locale,
  currency,
  label = "Spending heatmap",
}: {
  start: string; // ISO yyyy-mm-dd
  values: number[]; // length == days in month
  locale: string;
  currency?: string;
  label?: string;
}) {
  const startDate = new Date(start + "T00:00:00");
  const daysInMonth = values.length;
  const max = Math.max(0, ...values);
  const formatDay = (dayIndex: number) => {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + dayIndex);
    return d.toLocaleDateString(locale || "en-US", { month: "short", day: "numeric" });
  };
  const weeks: { dayIndex: number; value: number }[][] = [];
  const firstWeekday = new Date(startDate.getFullYear(), startDate.getMonth(), 1).getDay();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells / 7; i++) {
    const col: { dayIndex: number; value: number }[] = [];
    for (let r = 0; r < 7; r++) {
      const cellIndex = i * 7 + r;
      const dayIndex = cellIndex - firstWeekday;
      const value = dayIndex >= 0 && dayIndex < daysInMonth ? values[dayIndex] : -1;
      col.push({ dayIndex, value });
    }
    weeks.push(col);
  }
  function bucket(v: number) {
    if (v <= 0) return 0;
    if (max <= 0) return 0;
    const q = v / max;
    if (q < 0.2) return 1;
    if (q < 0.4) return 2;
    if (q < 0.7) return 3;
    return 4;
  }
  const today = useMemo(() => new Date(), []);
  const isToday = (dayIndex: number) => {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + dayIndex);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  };
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);
  function onLongPress(dayIndex: number) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + dayIndex);
    const iso = d.toISOString().slice(0, 10);
    setSheetDate(iso);
    setSheetOpen(true);
  }
  function startPress(dayIndex: number) {
    cancelPress();
    pressTimer.current = window.setTimeout(() => onLongPress(dayIndex), 500);
  }
  function cancelPress() {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  }
  return (
    <div aria-label={label} className="relative">
      <div className="flex items-start gap-1">
        {weeks.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {col.map((d, ri) => {
              const isBlank = d.dayIndex < 0 || d.dayIndex >= daysInMonth;
              const cls = isBlank ? "opacity-0" : `bucket-${bucket(d.value)}`;
              const title = isBlank ? "" : `${formatDay(d.dayIndex)}: ${Intl.NumberFormat(locale || "en-US", { style: "currency", currency: currency || "USD" }).format(d.value || 0)}`;
              const todayCls = !isBlank && isToday(d.dayIndex) ? "ring-2 ring-[hsl(var(--accent)/0.45)] today-pulse" : "";
              return (
                <div
                  key={ri}
                  role="img"
                  aria-label={isBlank ? undefined : title}
                  title={title}
                  className={`h-3.5 w-3.5 rounded-[4px] ${cls} ${todayCls}`}
                  onPointerDown={() => !isBlank && startPress(d.dayIndex)}
                  onPointerUp={cancelPress}
                  onPointerLeave={cancelPress}
                />
              );
            })}
          </div>
        ))}
      </div>
      <QuickAddSheet open={sheetOpen} onClose={() => setSheetOpen(false)} type="expense" date={sheetDate || undefined} />
    </div>
  );
}
