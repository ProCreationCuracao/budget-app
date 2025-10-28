"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { showToast } from "@/components/toast";

const SCOPES = ["Personal", "Household", "Business"] as const;

export default function OverviewScopeSwitcher() {
  const supabase = createSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string>("Personal");
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("scope").eq("id", user.id).single();
        if (data && data.scope) setScope(data.scope);
      } catch {}
    })();
  }, [supabase]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (btnRef.current && !btnRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  async function updateScope(next: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ scope: next }).eq("id", user.id);
      setScope(next);
      showToast(`Scope set to ${next}`, "success");
    } catch {}
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-sm font-medium"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>Overview: {scope}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {open ? (
        <div role="menu" className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 rounded-2xl border border-white/10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur shadow-lg p-1 text-sm">
          {SCOPES.map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={scope === s}
              onClick={() => { updateScope(s); setOpen(false); }}
              className={"w-full text-left rounded-md px-2 py-1.5 hover:bg-white/50 dark:hover:bg-zinc-900/60 " + (scope === s ? "font-medium" : "")}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
