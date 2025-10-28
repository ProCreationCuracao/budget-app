"use client";

import dynamic from "next/dynamic";

const MonthSpendCard = dynamic(() => import("@/components/month-spend-card"), {
  ssr: false,
  loading: () => (
    <div className="h-40 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 animate-pulse" />
  ),
});

export default function MonthSpendCardClient(props: any) {
  return <MonthSpendCard {...props} />;
}
