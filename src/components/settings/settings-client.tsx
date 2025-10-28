"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import CsvImport from "@/app/(app)/transactions/csv-import";
import { showToast } from "@/components/toast";
import { formatCurrency } from "@/lib/format";
import { setAccent as setAccentAttr, setReducedMotion as setReducedMotionAttr } from "@/lib/appearance";
import { useTheme } from "next-themes";
import SmartRulesManager from "@/components/settings/smart-rules-manager";
import FxRatesManager from "@/components/settings/fx-rates-manager";
import AccountsManager from "@/components/accounts-manager";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Bell, ChevronDown, Check } from "lucide-react";

export default function SettingsClient({
  initialDisplayName,
  email,
  currency,
  locale,
  startOfMonth,
  initialTheme,
  initialShowDualCurrency,
}: {
  initialDisplayName: string;
  email: string;
  currency: string;
  locale: string;
  startOfMonth: number;
  initialTheme: string;
  initialShowDualCurrency: boolean;
}) {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [q, setQ] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    Profile: true,
    Appearance: true,
    Notifications: false,
    Accounts: true,
    "Budgets Defaults": false,
    "Transactions & Categories": false,
    Security: false,
    Data: false,
    About: false,
  });

  const profilePrefsQ = useQuery<{ accent?: string; reduced_motion?: boolean; animation_density?: number; default_account?: string | null }>({
    queryKey: ["profile", "prefs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {} as any;
      const { data, error } = await supabase.from("profiles").select("accent,reduced_motion,animation_density,default_account").eq("id", user.id).single();
      if (error) throw error;
      return (data as any) || {};
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const d = profilePrefsQ.data || {} as any;
    if (d.accent) { setAccent(d.accent); setAccentAttr(d.accent as any); }
    if (typeof d.reduced_motion === 'boolean') { setReducedMotion(!!d.reduced_motion); setReducedMotionAttr(!!d.reduced_motion); }
    if (typeof d.animation_density === 'number') setAnimationDensity(Number(d.animation_density || 100));
    if (d.default_account) setDefaultAccount(String(d.default_account));
  }, [profilePrefsQ.data]);

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [cur, setCur] = useState(currency);
  const [loc, setLoc] = useState(locale);
  const [som, setSom] = useState<number>(Math.min(Math.max(Number(startOfMonth || 1), 1), 28));
  const [accent, setAccent] = useState("purple");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [animationDensity, setAnimationDensity] = useState(100);
  const [defaultAccount, setDefaultAccount] = useState<string>("");
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState<null | "saving" | "saved" | "error">(null);
  const currencies = ["USD","EUR","GBP","JPY","CAD","AUD","INR","BRL","MXN","CNY"];
  const locales = ["en-US","en-GB","fr-FR","de-DE","es-ES","ja-JP","en-CA","pt-BR","zh-CN","hi-IN"];
  const [showDual, setShowDual] = useState<boolean>(!!initialShowDualCurrency);

  const accountsQ = useQuery<{ id: string; name: string }[]>({
    queryKey: ["accounts", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id,name").order("name");
      if (error) throw error;
      return (data as any) || [];
    },
    staleTime: 60_000,
  });

  const profileScopeQ = useQuery<{ scope?: string }>({
    queryKey: ["profile", "scope"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {} as any;
      const { data, error } = await supabase.from("profiles").select("scope").eq("id", user.id).single();
      if (error) throw error;
      return (data as any) || {};
    },
    staleTime: 60_000,
  });
  const currentScope = (profileScopeQ.data?.scope as string | undefined) ?? "Personal";

  const setScopeMutation = useMutation({
    mutationFn: async (scope: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("profiles").update({ scope }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", "scope"] }),
  });

  type Notif = { id: string; title: string; body: string | null; kind: string; created_at: string; read_at: string | null };
  const notifQ = useQuery<Notif[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,kind,created_at,read_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
    staleTime: 30_000,
  });
  const unreadCount = (notifQ.data || []).filter((n) => !n.read_at).length;
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<Notif[]>(["notifications"]) ?? [];
      qc.setQueryData<Notif[]>(["notifications"], prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } as any : n)));
      return { prev } as any;
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["notifications"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const periodPreview = useMemo(() => {
    const now = new Date();
    const somClamped = Math.min(Math.max(Number(som || 1), 1), 28);
    const currentSomDate = new Date(now.getFullYear(), now.getMonth(), somClamped);
    const baseStart = now >= currentSomDate ? currentSomDate : new Date(now.getFullYear(), now.getMonth() - 1, somClamped);
    const next = new Date(baseStart.getFullYear(), baseStart.getMonth() + 1, somClamped);
    return `${baseStart.toISOString().slice(0,10)} – ${next.toISOString().slice(0,10)}`;
  }, [som]);

  const currencyValid = useMemo(() => {
    const code = (cur || "").trim();
    if (!/^[A-Z]{3}$/.test(code)) return false;
    try {
      // Verify Intl supports this currency; use current locale or en-US as fallback
      new Intl.NumberFormat(loc || "en-US", { style: "currency", currency: code }).format(0);
      return true;
    } catch {
      return false;
    }
  }, [cur, loc]);
  const localeValid = useMemo(() => /^[a-z]{2,}(-[A-Z]{2,})?$/.test((loc || "").trim()), [loc]);
  const formatPreview = useMemo(() => {
    try {
      return formatCurrency(1234.56, cur || "USD", loc || "en-US");
    } catch {
      return "";
    }
  }, [cur, loc]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!unsaved) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsaved]);

  // Hydrate initial Appearance from localStorage
  useEffect(() => {
    try {
      const acc = localStorage.getItem("accent");
      if (acc) setAccent(acc);
      const rm = localStorage.getItem("reduced-motion");
      if (rm != null) setReducedMotion(rm === "1");
    } catch {}
  }, []);

  function toggle(k: string) {
    setOpen((o) => ({ ...o, [k]: !o[k] }));
  }

  function onReset() {
    setDisplayName(initialDisplayName);
    setCur(currency);
    setLoc(locale);
    setSom(Math.min(Math.max(Number(startOfMonth || 1), 1), 28));
    setTheme(initialTheme || "system");
    setUnsaved(false);
    setSaving(null);
  }

  function markDirty() {
    setUnsaved(true);
    setSaving(null);
  }

  async function onSave() {
    setSaving("saving");
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Not authenticated");
      const nextSom = Math.min(Math.max(Number(som || 1), 1), 28);
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          currency: cur,
          locale: loc,
          start_of_month: nextSom,
          theme: theme || initialTheme || "system",
          show_dual_currency: showDual,
          accent,
          reduced_motion: reducedMotion,
          animation_density: animationDensity,
          default_account: defaultAccount || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      setUnsaved(false);
      setSaving("saved");
      setTimeout(() => setSaving(null), 1200);
      showToast("Settings saved", "success");
    } catch {
      setSaving("error");
    }
  }

  const sections = useMemo(() => [
    {
      key: "Profile",
      content: (
        <div className="space-y-3">
          <div className="text-xs text-zinc-500">Signed in as {email}</div>
          <label className="block">
            <div className="text-sm text-zinc-400">Display name</div>
            <input value={displayName} onChange={(e) => { setDisplayName(e.target.value); markDirty(); }} className="mt-1 w-full rounded-md bg-zinc-900/40 border border-zinc-800 px-3 py-2" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <div className="text-sm text-zinc-400">Currency</div>
              <input list="currency-list" value={cur} onChange={(e) => { setCur(e.target.value); markDirty(); }} className="mt-1 w-full rounded-md bg-zinc-900/40 border border-zinc-800 px-3 py-2" placeholder="USD" />
              <datalist id="currency-list">
                {currencies.map((c) => (<option key={c} value={c} />))}
              </datalist>
              {!currencyValid ? <div className="mt-1 text-xs text-rose-400">Use a 3-letter ISO code (e.g., USD).</div> : null}
            </label>
            <label className="block">
              <div className="text-sm text-zinc-400">Locale</div>
              <input list="locale-list" value={loc} onChange={(e) => { setLoc(e.target.value); markDirty(); }} className="mt-1 w-full rounded-md bg-zinc-900/40 border border-zinc-800 px-3 py-2" placeholder="en-US" />
              <datalist id="locale-list">
                {locales.map((l) => (<option key={l} value={l} />))}
              </datalist>
              {!localeValid ? <div className="mt-1 text-xs text-rose-400">Format like language-REGION (e.g., en-US).</div> : null}
            </label>
            <label className="block">
              <div className="text-sm text-zinc-400">Start of month</div>
              <input type="number" min={1} max={28} value={som} onChange={(e) => { const v = Math.min(Math.max(Number(e.target.value || 1), 1), 28); setSom(v); markDirty(); }} className="mt-1 w-full rounded-md bg-zinc-900/40 border border-zinc-800 px-3 py-2" />
            </label>
            <label className="block">
              <div className="text-sm text-zinc-400">Default account</div>
              <select value={defaultAccount} onChange={(e) => { setDefaultAccount(e.target.value); markDirty(); }} className="mt-1 w-full rounded-md bg-zinc-900/40 border border-zinc-800 px-3 py-2">
                <option value="">None</option>
                {(accountsQ.data || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showDual} onChange={(e) => { setShowDual(e.target.checked); markDirty(); }} />
              <span className="text-sm text-zinc-400">Show original currency alongside converted</span>
            </label>
          </div>
          <div className="text-xs text-zinc-500">This period: {periodPreview}</div>
          <div className="text-xs text-zinc-500">Formatting preview: {formatPreview}</div>
        </div>
      )
    },
    {
      key: "Appearance",
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <select
              value={(theme as string) || initialTheme || "system"}
              onChange={(e) => { setTheme(e.target.value); markDirty(); }}
              className="rounded-md bg-zinc-900/40 border border-zinc-800 px-2 py-1 text-sm"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Accent</span>
            <select
              value={accent}
              onChange={(e) => {
                const v = e.target.value;
                setAccent(v);
                setAccentAttr(v as any);
                markDirty();
              }}
              className="rounded-md bg-zinc-900/40 border border-zinc-800 px-2 py-1 text-sm"
            >
              <option value="purple">Purple</option>
              <option value="aqua">Aqua</option>
              <option value="emerald">Emerald</option>
            </select>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-sm">Reduced motion</span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => {
                const on = e.target.checked;
                setReducedMotion(on);
                setReducedMotionAttr(on);
                markDirty();
              }}
            />
          </label>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Animation density</span>
              <span className="text-xs text-zinc-500">{animationDensity}%</span>
            </div>
            <input type="range" min={50} max={200} value={animationDensity} onChange={(e) => { setAnimationDensity(Number(e.target.value || 100)); markDirty(); }} className="w-full" />
          </div>
        </div>
      )
    },
    { key: "Notifications", content: <Placeholder onDirty={markDirty} items={["Due alerts", "Budget alerts"]} /> },
    { key: "Accounts", content: <AccountsManager /> },
    { key: "Budgets Defaults", content: <Placeholder onDirty={markDirty} items={["Rollover", "Auto-carry", "Alert threshold"]} /> },
    { key: "Transactions & Categories", content: <SmartRulesManager /> },
    { key: "Security", content: (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Sign out</span>
          <button
            onClick={async () => { try { await supabase.auth.signOut(); window.location.href = "/login"; } catch {} }}
            className="rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-3 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    ) },
    { key: "Data", content: (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { try { window.location.href = "/api/export/csv"; } catch { showToast("Export failed", "error"); } }} className="rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-3 py-2 text-sm">Export CSV</button>
          <button onClick={() => { showToast("Backup created", "success"); }} className="rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-3 py-2 text-sm">Create Backup</button>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">CSV Import</div>
          <CsvImport currency={cur} locale={loc} />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">FX Rates</div>
          <FxRatesManager baseCurrency={cur} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const today = new Date().toISOString().slice(0,10);
                  const res = await fetch(`/api/fx/refresh?date=${today}`);
                  if (!res.ok) throw new Error("fx refresh failed");
                  showToast("FX rates refreshed", "success");
                  qc.invalidateQueries({ queryKey: ["fx_rates"] });
                } catch {
                  showToast("FX refresh failed", "error");
                }
              }}
              className="rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-3 py-2 text-sm"
            >
              Fetch latest FX for my pairs
            </button>
            <button
              onClick={async () => {
                try {
                  const today = new Date().toISOString().slice(0,10);
                  const res = await fetch(`/api/fx/refresh?date=${today}&days=90`);
                  if (!res.ok) throw new Error("fx backfill failed");
                  showToast("FX rates backfilled (90d)", "success");
                  qc.invalidateQueries({ queryKey: ["fx_rates"] });
                } catch {
                  showToast("FX backfill failed", "error");
                }
              }}
              className="rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-3 py-2 text-sm"
            >
              Backfill last 90 days
            </button>
          </div>
        </div>
      </div>
    ) },
    { key: "About", content: <div className="text-sm text-zinc-400">Budget v0.1.0</div> },
  ].filter(sec => !q || sec.key.toLowerCase().includes(q.toLowerCase())), [q, email, displayName, accent, reducedMotion, cur, loc, som, theme, initialTheme]);

  return (
    <div>
      <div className="sticky top-0 z-10 pb-2 bg-[hsl(var(--bg)/0.6)] backdrop-blur">
        <div className="flex items-center gap-2">
          <input
            placeholder="Search settings…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 rounded-full bg-zinc-900/50 border border-zinc-800 px-4 py-2 text-sm"
          />
          <div className="relative">
            <button
              onClick={() => setScopeOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-3 py-2 text-xs"
              aria-haspopup="menu"
              aria-expanded={scopeOpen}
            >
              <span>Overview: {currentScope}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <AnimatePresence initial={false}>
              {scopeOpen ? (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 mt-1 w-40 rounded-md bg-white/95 dark:bg-zinc-900/95 ring-1 ring-black/10 dark:ring-white/10 shadow-lg overflow-hidden">
                  {["Personal","Household","Business"].map((s) => (
                    <button key={s} onClick={() => { setScopeOpen(false); if (s !== currentScope) setScopeMutation.mutate(s); }} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center justify-between">
                      <span>{s}</span>
                      {s === currentScope ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="relative">
            <button
              onClick={() => setNotifOpen(true)}
              aria-label="Notifications"
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 flex items-center justify-center relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] leading-4 text-center">{unreadCount}</span> : null}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {sections.map((sec) => (
          <section key={sec.key} className="rounded-2xl glass border border-white/10">
            <button onClick={() => toggle(sec.key)} className="w-full text-left px-4 py-3 flex items-center justify-between">
              <div className="text-sm font-medium">{sec.key}</div>
              <span className="text-xs text-zinc-500">{open[sec.key] ? "Hide" : "Show"}</span>
            </button>
            <AnimatePresence initial={false}>
              {open[sec.key] ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-4 pb-4">
                  {sec.content}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={onSave} disabled={!unsaved || !currencyValid || !localeValid} className="rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-3 py-2 text-sm disabled:opacity-50">Save changes</button>
        <button onClick={onReset} className="rounded-md bg-white/5 hover:bg-white/10 ring-1 ring-inset ring-white/10 px-3 py-2 text-sm">Reset</button>
        {saving === "saving" ? <span className="text-xs text-zinc-400">Saving…</span> : null}
        {saving === "saved" ? <span className="text-xs text-emerald-400">Saved</span> : null}
        {saving === "error" ? <span className="text-xs text-rose-400">Error</span> : null}
      </div>

      <AnimatePresence>
        {notifOpen ? (
          <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setNotifOpen(false)} />
            <motion.aside initial={{ x: 360 }} animate={{ x: 0 }} exit={{ x: 360 }} transition={{ duration: 0.2, ease: [0.22,1,0.36,1] as any }} className="absolute right-0 top-0 bottom-0 w-[min(92vw,360px)] bg-white dark:bg-zinc-950 ring-1 ring-black/10 dark:ring-white/10 shadow-2xl overflow-auto">
              <div className="px-3 py-2 border-b border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                <div className="text-sm font-medium">Notifications</div>
                <button onClick={() => setNotifOpen(false)} className="text-xs text-zinc-500 hover:underline">Close</button>
              </div>
              <div>
                {(notifQ.data || []).length === 0 ? (
                  <div className="px-3 py-4 text-sm text-zinc-500">No notifications</div>
                ) : (
                  (notifQ.data || []).map((n) => (
                    <div key={n.id} className="px-3 py-2 border-b border-zinc-200/60 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{n.title}</div>
                          {n.body ? <div className="text-xs text-zinc-500 whitespace-pre-wrap">{n.body}</div> : null}
                          <div className="text-[10px] text-zinc-500 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                        </div>
                        {!n.read_at ? (
                          <button onClick={() => markReadMutation.mutate(n.id)} className="text-xs text-emerald-600 hover:underline">Mark as read</button>
                        ) : <span className="text-[10px] text-zinc-400">Read</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-3 py-3">
                <button onClick={() => { setQ("notifications"); setNotifOpen(false); }} className="rounded-md border border-zinc-300 dark:border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900">Preferences…</button>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Placeholder({ items, onDirty }: { items: string[]; onDirty?: () => void }) {
  return (
    <div className="space-y-3">
      {items.map((label) => (
        <label key={label} className="flex items-center justify-between">
          <span className="text-sm">{label}</span>
          <input type="checkbox" onChange={onDirty} />
        </label>
      ))}
    </div>
  );
}
