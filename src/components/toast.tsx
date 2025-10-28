"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ToastType = "info" | "success" | "error";

type ToastItem = { id: string; message: string; type: ToastType; actionLabel?: string; onAction?: () => void; durationMs?: number };

export function showToast(
  message: string,
  typeOrOpts: ToastType | { type?: ToastType; actionLabel?: string; onAction?: () => void; durationMs?: number } = "info"
) {
  if (typeof window === "undefined") return;
  const detail = typeof typeOrOpts === "string" ? { type: typeOrOpts } : (typeOrOpts || {});
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, ...detail } }));
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    try { setContainer(document.body); } catch { setContainer(null); }
  }, []);

  useEffect(() => {
    function onEvent(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; type?: ToastType; actionLabel?: string; onAction?: () => void; durationMs?: number };
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = { id, message: detail.message, type: detail.type || "info", actionLabel: detail.actionLabel, onAction: detail.onAction, durationMs: detail.durationMs };
      setToasts((t) => [...t, item]);
      const ms = item.durationMs ?? (item.actionLabel ? 7000 : 2600);
      const timer = setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
      (item as any)._timer = timer;
    }
    window.addEventListener("app:toast", onEvent as any);
    return () => window.removeEventListener("app:toast", onEvent as any);
  }, []);

  if (!mounted || !container) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-start justify-center p-4">
      <div className="mt-10 w-full max-w-sm space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ring-inset flex items-center justify-between gap-3 ${
            t.type === "success" ? "bg-emerald-600/20 ring-emerald-500/30 text-emerald-200" :
            t.type === "error" ? "bg-rose-600/20 ring-rose-500/30 text-rose-200" :
            "bg-white/10 ring-white/20 text-white"
          }`}>
            <span>{t.message}</span>
            {t.actionLabel ? (
              <button
                onClick={() => {
                  try { t.onAction && t.onAction(); } finally { setToasts((all) => all.filter((x) => x.id !== t.id)); }
                }}
                className="rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-xs"
              >
                {t.actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>,
    container
  );
}
