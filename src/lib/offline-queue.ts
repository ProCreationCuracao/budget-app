"use client";

import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";

export type QuickAddType = "expense" | "income" | "transfer";
export type QuickAddPayload = {
  type: QuickAddType;
  amount: number;
  date: string; // ISO
  categoryId?: string;
  notes?: string;
  recurring?: boolean;
  split?: boolean;
  // For income/expense
  accountId?: string;
  // For transfer
  fromAccountId?: string;
  toAccountId?: string;
};

const KEY = "budget-offline-queue-v1";

type QueueItem = { kind: "add-transaction"; payload: QuickAddPayload; id: string; attempts: number; nextAttemptAt?: number };

export async function getQueue(): Promise<QueueItem[]> {
  return (await get(KEY)) ?? [];
}

export async function addToQueue(item: Omit<QueueItem, "id" | "attempts" | "nextAttemptAt">): Promise<QueueItem[]> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const current = (await get(KEY)) as QueueItem[] | undefined;
  const now = Date.now();
  const updated = [...(current ?? []), { ...item, id, attempts: 0, nextAttemptAt: now }];
  await set(KEY, updated);
  return updated;
}

export async function replaceQueue(items: QueueItem[]): Promise<void> {
  await set(KEY, items);
}

export type SyncStatus = "idle" | "offline" | "queued" | "syncing" | "synced" | "error";

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(navigator.onLine ? "idle" : "offline");
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function refresh() {
      const q = await getQueue();
      setCount(q.length);
      if (!navigator.onLine) setStatus("offline");
      else if (q.length > 0) setStatus("queued");
      else setStatus("idle");
    }
    refresh();

    function onOnline() { setStatus("queued"); processQueue(); }
    function onOffline() { setStatus("offline"); }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function processQueue() {
    const q = await getQueue();
    if (q.length === 0 || !navigator.onLine) return;
    const now = Date.now();
    const ready = q.filter((it) => (it.nextAttemptAt ?? 0) <= now);
    if (ready.length === 0) { setStatus("queued"); return; }
    setStatus("syncing");
    try {
      const res = await fetch("/api/sync-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: ready }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "sync_failed");
      const processed: string[] = Array.isArray(json?.processedIds) ? json.processedIds : [];
      const updated: QueueItem[] = [];
      for (const it of q) {
        if (processed.includes(it.id)) continue;
        if (ready.find((r) => r.id === it.id)) {
          const attempts = (it.attempts ?? 0) + 1;
          const delay = Math.min(300000, 1000 * Math.pow(2, attempts));
          updated.push({ ...it, attempts, nextAttemptAt: now + delay });
        } else {
          updated.push(it);
        }
      }
      await replaceQueue(updated);
      setCount(updated.length);
      if (updated.length === 0) {
        setStatus("synced");
        setTimeout(() => setStatus("idle"), 1200);
      } else {
        setStatus("queued");
      }
    } catch (e) {
      setStatus("error");
    }
  }

  return { status, count, processQueue };
}
