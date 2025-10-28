"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

export type RecentDisplayItem = {
  id: string;
  title: string;
  subtitle: string;
  convertedSigned: number;
  originalSigned: number;
  originalCurrency: string;
  same: boolean;
  missing: boolean;
};

export default function RecentListClient({ items, currency, locale, showDualDefault }: { items: RecentDisplayItem[]; currency: string; locale: string; showDualDefault: boolean; }) {
  const [dualOverride, setDualOverride] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dual-display");
      if (raw === "1") setDualOverride(true);
      else if (raw === "0") setDualOverride(false);
    } catch {}
  }, []);
  const showDual = (dualOverride ?? showDualDefault);

  return (
    <div>
      <div className="flex items-center justify-end px-3 sm:px-4 py-2">
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={!!(dualOverride ?? showDualDefault)}
            onChange={(e) => {
              const on = e.target.checked;
              setDualOverride(on);
              try { localStorage.setItem("dual-display", on ? "1" : "0"); } catch {}
            }}
          />
          Dual display
          <button
            onClick={() => { setDualOverride(null); try { localStorage.removeItem("dual-display"); } catch {} }}
            className="hover:underline"
          >
            Reset
          </button>
        </label>
      </div>
      <ul className="divide-y divide-zinc-200/60 dark:divide-zinc-800">
        {items.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-3 sm:px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{t.subtitle}</div>
            </div>
            <div className="ml-4 text-right leading-tight">
              <div className={"text-sm font-semibold tabular inline-flex items-center justify-end gap-1 " + (t.convertedSigned >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {formatCurrency(t.convertedSigned, currency, locale)}
                {t.missing ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" title="No FX rate for this date; treated as 0" /> : null}
              </div>
              {showDual && !t.same ? (
                <div className="text-[10px] text-zinc-500 tabular">{formatCurrency(t.originalSigned, t.originalCurrency as any, locale)}</div>
              ) : null}
            </div>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="px-4 py-6 text-sm text-zinc-500">No recent activity</li>
        ) : null}
      </ul>
    </div>
  );
}
