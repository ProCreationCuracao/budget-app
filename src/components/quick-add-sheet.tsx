"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { addToQueue, QuickAddPayload, QuickAddType, useSyncStatus } from "@/lib/offline-queue";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { showToast } from "@/components/toast";

export default function QuickAddSheet({
  open,
  type: initialType = "expense",
  onClose,
  date,
}: {
  open: boolean;
  type?: QuickAddType;
  onClose: () => void;
  date?: string; // ISO yyyy-mm-dd
}) {
  const shouldReduce = useReducedMotion();
  const [type, setType] = useState<QuickAddType>(initialType);
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [split, setSplit] = useState(false);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<{ id: string; name: string; type: "income" | "expense" }[]>([]);
  const [currency, setCurrency] = useState<string>("USD");
  const [locale, setLocale] = useState<string>("en-US");
  const [submitting, setSubmitting] = useState(false);
  const [justQueued, setJustQueued] = useState(false);
  const { status, count, processQueue } = useSyncStatus();
  const supabase = createSupabaseBrowserClient();
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(undefined);
  const [toAccountId, setToAccountId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setAmount("");
      setNotes("");
      setRecurring(false);
      setSplit(false);
      setCategoryId(undefined);
      setSubmitting(false);
      setJustQueued(false);
      // fetch accounts for selection
      supabase.from("accounts").select("id,name").order("name", { ascending: true }).then(({ data }) => {
        const list = (data ?? []) as { id: string; name: string }[];
        setAccounts(list);
        if (list.length > 0) {
          setAccountId(list[0].id);
          setFromAccountId(list[0].id);
          setToAccountId(list[1]?.id ?? list[0].id);
        }
      });
      // fetch categories for selection
      supabase.from("categories").select("id,name,type").order("name", { ascending: true }).then(({ data }) => {
        setCategories(((data ?? []) as any) as { id: string; name: string; type: "income" | "expense" }[]);
      });
      // fetch profile for currency/locale
      supabase.auth.getUser().then(async ({ data }) => {
        const uid = data?.user?.id;
        if (!uid) return;
        const { data: prof } = await supabase.from("profiles").select("currency,locale").eq("id", uid).single();
        if (prof) {
          if (prof.currency) setCurrency(prof.currency);
          if (prof.locale) setLocale(prof.locale);
        }
      });
    }
  }, [open, initialType]);

  function onKey(k: string) {
    if (k === "⌫") setAmount((a) => a.slice(0, -1));
    else if (k === ".") setAmount((a) => (a.includes(".") ? a : a + "."));
    else setAmount((a) => (a === "0" ? k : a + k));
  }

  async function submit() {
    if (submitting) return;
    const parsed = Number(amount || 0);
    if (!isFinite(parsed) || parsed <= 0) return;
    if (type === "transfer") {
      if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) return;
    } else {
      if (!accountId) return;
    }
    setSubmitting(true);
    const payload: QuickAddPayload = {
      type,
      amount: parsed,
      date: (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : new Date().toISOString().slice(0, 10),
      categoryId,
      notes,
      recurring,
      split,
      accountId,
      fromAccountId,
      toAccountId,
    };
    await addToQueue({ kind: "add-transaction", payload });
    // If online, try to flush immediately
    if (navigator.onLine) {
      try { await processQueue(); showToast("Added", "success"); } catch { showToast("Sync failed", "error"); }
    } else {
      showToast("Queued (offline)");
    }
    setJustQueued(true);
    setSubmitting(false);
    setTimeout(() => {
      onClose();
    }, 400);
  }

  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60]" aria-modal="true" role="dialog">
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white/98 dark:bg-zinc-950/96 ring-1 ring-black/10 dark:ring-white/10 p-4 text-zinc-800 dark:text-zinc-100"
            initial={shouldReduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            animate={shouldReduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={shouldReduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-black/20 dark:bg-white/15" />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-zinc-700 dark:text-zinc-300">Quick Add</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                {status === "offline" ? "Offline" : status === "queued" ? `Queued (${count})` : status === "syncing" ? "Syncing…" : status === "synced" ? "Synced" : ""}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {(["expense", "income", "transfer"] as QuickAddType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-full px-3 py-2 ring-1 ring-inset ${
                    type === t
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {type !== "transfer" ? (
              <div className="mt-4">
                <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">Account</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAccountId(a.id)}
                      className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${
                        accountId === a.id
                          ? "bg-black/10 ring-black/20 dark:bg-white/12 dark:ring-white/20"
                          : "bg-black/5 ring-black/10 dark:bg-white/5 dark:ring-white/10"
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">From</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {accounts.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setFromAccountId(a.id)}
                        className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${
                          fromAccountId === a.id
                            ? "bg-black/10 ring-black/20 dark:bg-white/12 dark:ring-white/20"
                            : "bg-black/5 ring-black/10 dark:bg-white/5 dark:ring-white/10"
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">To</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {accounts.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setToAccountId(a.id)}
                        className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${
                          toAccountId === a.id
                            ? "bg-black/10 ring-black/20 dark:bg-white/12 dark:ring-white/20"
                            : "bg-black/5 ring-black/10 dark:bg-white/5 dark:ring-white/10"
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-[11px] tracking-wider uppercase text-zinc-500">Amount</div>
              <div className="mt-1 text-3xl tabular">{formatCurrency(Number(amount || 0), currency, locale)}</div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {keypad.map((k) => (
                <button key={k} onClick={() => onKey(k)} className="rounded-xl bg-white/20 dark:bg-white/6 ring-1 ring-inset ring-black/10 dark:ring-white/10 py-3 text-lg">
                  {k}
                </button>
              ))}
            </div>

            {type !== "transfer" ? (
              <div className="mt-4">
                <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">Category</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.filter((c) => c.type === type).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${
                        categoryId === c.id
                          ? "bg-black/10 ring-black/20 dark:bg-white/12 dark:ring-white/20"
                          : "bg-black/5 ring-black/10 dark:bg-white/5 dark:ring-white/10"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-inset ring-black/10 dark:ring-white/10 px-3 py-2">
                <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
                <span className="text-sm">Recurring</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-inset ring-black/10 dark:ring-white/10 px-3 py-2">
                <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
                <span className="text-sm">Split</span>
              </label>
            </div>

            <div className="mt-3">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="w-full rounded-xl bg-black/5 dark:bg-white/5 ring-1 ring-inset ring-black/10 dark:ring-white/10 px-3 py-2 text-sm" />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-zinc-800 dark:text-zinc-300">Cancel</button>
              <button onClick={submit} disabled={submitting || Number(amount) <= 0} className="rounded-md bg-[hsl(var(--primary))] text-white px-3 py-2 text-sm hover:brightness-110 disabled:opacity-50">
                {justQueued ? "Queued" : submitting ? "Adding…" : "Add"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
