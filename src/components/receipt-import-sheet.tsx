"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { addToQueue, QuickAddPayload, useSyncStatus } from "@/lib/offline-queue";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { showToast } from "@/components/toast";
import { formatCurrency } from "@/lib/format";

export default function ReceiptImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shouldReduce = useReducedMotion();
  const supabase = createSupabaseBrowserClient();
  const { processQueue } = useSyncStatus();

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; type: "income" | "expense" }[]>([]);
  const [currency, setCurrency] = useState<string>("USD");
  const [locale, setLocale] = useState<string>("en-US");

  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data: a } = await supabase.from("accounts").select("id,name").order("name", { ascending: true });
        setAccounts((a ?? []) as any);
        if (a && a.length) setAccountId(a[0].id);
      } catch {}
      try {
        const { data: c } = await supabase.from("categories").select("id,name,type").order("name", { ascending: true });
        setCategories((c ?? []) as any);
      } catch {}
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id;
        if (uid) {
          const { data: prof } = await supabase.from("profiles").select("currency,locale").eq("id", uid).single();
          if (prof?.currency) setCurrency(prof.currency);
          if (prof?.locale) setLocale(prof.locale);
        }
      } catch {}
      setImgUrl(null);
      setOcrText("");
      setError("");
      setAmount("");
      setNotes("");
    })();
  }, [open]);

  async function onPickFile(f: File) {
    const url = URL.createObjectURL(f);
    setImgUrl(url);
    setLoading(true);
    setError("");
    try {
      const text = await runOcr(url);
      setOcrText(text);
      const parsed = extractReceiptFields(text);
      if (parsed.amount) setAmount(parsed.amount.toString());
      if (parsed.date) setDate(parsed.date);
      if (parsed.merchant) setNotes(parsed.merchant);
    } catch (e: any) {
      setError("Failed to read receipt");
    } finally {
      setLoading(false);
    }
  }

  async function runOcr(imageUrl: string): Promise<string> {
    // Load Tesseract from CDN at runtime to avoid bundler dependency
    const w: any = window as any;
    if (!w.Tesseract) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/tesseract.js@v5.0.3/dist/tesseract.min.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("tesseract_load_failed"));
        document.head.appendChild(s);
      });
    }
    const T = (window as any).Tesseract;
    const res = await T.recognize(imageUrl, "eng", { logger: () => {} });
    return String(res?.data?.text || "");
  }

  function extractReceiptFields(text: string): { amount?: number; date?: string; merchant?: string } {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let merchant = lines.find((l) => /[a-zA-Z]/.test(l) && !/receipt|total|invoice|tax/i.test(l)) || undefined;

    // Date detection (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
    const dateRe = /(\d{4}[-\/\.](\d{1,2})[-\/\.](\d{1,2}))|(\d{1,2}[-\/\.](\d{1,2})[-\/\.](\d{2,4}))/;
    let foundDate: string | undefined;
    for (const l of lines) {
      const m = l.match(dateRe);
      if (m) {
        const raw = m[0].replace(/\./g, "-").replace(/\//g, "-");
        const parts = raw.split("-").map((p) => p.padStart(2, "0"));
        if (parts[0].length === 4) {
          foundDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
        } else if (parts[2].length === 4) {
          // assume MM-DD-YYYY
          foundDate = `${parts[2]}-${parts[0]}-${parts[1]}`;
        }
        if (foundDate) break;
      }
    }

    // Amount detection: prefer a line with 'total', else largest currency-like number
    let totals: number[] = [];
    let maxFound = 0;
    for (const l of lines) {
      const moneyMatches = l.match(/(\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.[0-9]{2})?/g);
      if (moneyMatches) {
        for (const m of moneyMatches) {
          const n = Number(m.replace(/[^0-9\.]/g, ""));
          if (n > 0) {
            if (/total/i.test(l)) totals.push(n);
            if (n > maxFound) maxFound = n;
          }
        }
      }
    }
    const amount = (totals.length ? totals[totals.length - 1] : maxFound) || undefined;

    return { amount, date: foundDate, merchant };
  }

  async function submit() {
    try {
      const amt = Number(amount || 0);
      if (!isFinite(amt) || amt <= 0) return;
      if (!accountId) return;
      const payload: QuickAddPayload = {
        type: "expense",
        amount: amt,
        date,
        categoryId,
        notes,
        recurring: false,
        split: false,
        accountId,
      };
      await addToQueue({ kind: "add-transaction", payload });
      if (navigator.onLine) {
        try { await processQueue(); showToast("Added", "success"); }
        catch { showToast("Sync failed", "error"); }
      } else {
        showToast("Queued (offline)");
      }
      onClose();
    } catch {
      showToast("Failed to add", "error");
    }
  }

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
              <div className="text-sm text-zinc-700 dark:text-zinc-300">Import Receipt</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{loading ? "Reading…" : error ? "Error" : imgUrl ? "Ready" : ""}</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                  }}
                />
                <div className="mt-3 rounded-xl ring-1 ring-inset ring-black/10 dark:ring-white/10 bg-black/5 dark:bg-white/5 p-2 min-h-32 flex items-center justify-center overflow-hidden">
                  {imgUrl ? (
                    <img src={imgUrl} alt="receipt" className="max-h-60 w-auto object-contain" />
                  ) : (
                    <div className="text-xs text-zinc-500">No image selected</div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">Account</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {accounts.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setAccountId(a.id)}
                        className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${
                          accountId === a.id ? "bg-black/10 ring-black/20 dark:bg-white/12 dark:ring-white/20" : "bg-black/5 ring-black/10 dark:bg-white/5 dark:ring-white/10"
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">Category</div>
                  <div className="mt-2 flex flex-wrap gap-2 max-h-28 overflow-auto no-scrollbar pr-1">
                    {categories.filter((c) => c.type === "expense").map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategoryId(c.id)}
                        className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${
                          categoryId === c.id ? "bg-black/10 ring-black/20 dark:bg-white/12 dark:ring-white/20" : "bg-black/5 ring-black/10 dark:bg-white/5 dark:ring-white/10"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">Date</div>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                </div>
                <div>
                  <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">Amount</div>
                  <div className="mt-1 text-xl tabular">{formatCurrency(Number(amount || 0), currency, locale)}</div>
                  <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                </div>
                <div>
                  <div className="text-[11px] tracking-wider uppercase text-zinc-600 dark:text-zinc-500">Notes</div>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" placeholder="Merchant or memo" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-zinc-800 dark:text-zinc-300">Cancel</button>
              <button onClick={submit} disabled={loading || !accountId || Number(amount) <= 0} className="rounded-md bg-[hsl(var(--primary))] text-white px-3 py-2 text-sm hover:brightness-110 disabled:opacity-50">Add</button>
            </div>

            {error ? <div className="mt-2 text-xs text-rose-600">{error}</div> : null}
            {ocrText ? (
              <details className="mt-2">
                <summary className="text-xs text-zinc-600">View extracted text</summary>
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] text-zinc-600 dark:text-zinc-400 bg-black/5 dark:bg-white/5 rounded-md p-2">{ocrText}</pre>
              </details>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
