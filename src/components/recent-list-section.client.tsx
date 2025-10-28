"use client";

import dynamic from "next/dynamic";
import type { RecentDisplayItem } from "@/components/recent-list.client";

const RecentListClient = dynamic(() => import("@/components/recent-list.client"), { ssr: false });

export default function RecentListSection({ items, currency, locale, showDualDefault }: { items: RecentDisplayItem[]; currency: string; locale: string; showDualDefault: boolean }) {
  return <RecentListClient items={items} currency={currency} locale={locale} showDualDefault={showDualDefault} />;
}
