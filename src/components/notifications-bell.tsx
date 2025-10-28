"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function NotificationsBell() {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,kind,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
  const unread = useMemo(() => (data || []).filter((n: any) => !n.read_at), [data]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (btnRef.current && !btnRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  async function markAsRead(id: string) {
    const now = new Date().toISOString();
    qc.setQueryData(["notifications"], (prev: any) => (prev || []).map((n: any) => (n.id === id ? { ...n, read_at: now } : n)));
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }
  async function markAllRead() {
    const now = new Date().toISOString();
    qc.setQueryData(["notifications"], (prev: any) => (prev || []).map((n: any) => ({ ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-full bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 shadow-sm flex items-center justify-center"
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 ? (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 text-[10px] px-1 rounded-full bg-rose-500 text-white">
            {Math.min(99, unread.length)}
          </span>
        ) : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 mt-2 w-[360px] max-w-[90vw] rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 text-sm">
            <div className="font-medium">Notifications</div>
            {unread.length > 0 ? (
              <button onClick={markAllRead} className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">Mark all read</button>
            ) : null}
          </div>
          <ul className="max-h-80 overflow-auto divide-y divide-zinc-200/60 dark:divide-zinc-800">
            {(data || []).length === 0 ? (
              <li className="px-3 py-6 text-sm text-zinc-500">You're all caught up</li>
            ) : null}
            {(data || []).map((n: any) => (
              <li key={n.id} className={cn("px-3 py-3 text-sm", !n.read_at ? "bg-[hsl(var(--accent)/0.06)]" : "") }>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    {n.body ? <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{n.body}</div> : null}
                  </div>
                  {!n.read_at ? (
                    <button onClick={() => markAsRead(n.id)} className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">Mark read</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
