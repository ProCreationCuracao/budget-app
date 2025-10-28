"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function SegmentedTabs({
  tabs,
  activeKey,
  hrefBase = "/dashboard",
  queryKey = "tab",
}: {
  tabs: { key: string; label: string }[];
  activeKey: string;
  hrefBase?: string;
  queryKey?: string;
}) {
  const idx = Math.max(0, tabs.findIndex((t) => t.key === activeKey));
  return (
    <div className="relative inline-flex rounded-full border border-zinc-300/60 dark:border-zinc-800 p-1 bg-white/50 dark:bg-zinc-900/30 backdrop-blur">
      {tabs.map((t, i) => {
        const active = t.key === activeKey;
        return (
          <Link
            key={t.key}
            href={`${hrefBase}?${queryKey}=${t.key}`}
            className={
              "relative z-10 px-3 py-1.5 text-sm rounded-full transition-colors " +
              (active
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200")
            }
          >
            {t.label}
          </Link>
        );
      })}
      <motion.div
        layout
        className="absolute inset-y-1 rounded-full bg-white dark:bg-zinc-800 shadow-sm"
        style={{ left: `calc(${idx} * 33.333% + 4px)`, width: `calc(33.333% - 8px)` }}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
      />
    </div>
  );
}
