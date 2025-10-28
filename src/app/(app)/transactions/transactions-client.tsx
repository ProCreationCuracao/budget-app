"use client";

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { buildFxConverter } from "@/lib/fx";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { applySmartRulesWithTrace, loadSmartRules, type SmartRule } from "@/lib/smart-rules";
import { showToast } from "@/components/toast";
import { ChevronLeft, ChevronRight, Paperclip, FileText, Plus, X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { chip, stagger } from "@/lib/motion";
import NumericKeypad from "@/components/transactions/numeric-keypad";

type TxType = "income" | "expense";

type Account = { id: string; name: string; type: string; currency?: string };

type Category = { id: string; name: string; type: TxType };

type TxRow = {
  id: string;
  date: string;
  amount: number;
  type: TxType;
  currency?: string | null;
  notes: string | null;
  attachment_url?: string | null;
  account_id: string;
  category_id: string | null;
  accounts?: { name?: string } | null;
  categories?: { name?: string } | null;
  tags?: string[] | null;
  subscription_id?: string | null;
};

const txSchema = z.object({
  date: z.string().min(1, "Date is required"),
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  account_id: z.string().min(1, "Account is required"),
  category_id: z.string().min(1, "Category is required"),
  notes: z.string().optional(),
});
type TxForm = z.infer<typeof txSchema>;

export default function TransactionsClient({
  currency,
  locale,
  startOfMonth,
  initialAccounts,
  initialCategories,
  initialTxs,
  initialDateFrom,
  initialDateTo,
}: {
  currency: string;
  locale: string;
  startOfMonth: number;
  initialAccounts?: Account[];
  initialCategories?: Category[];
  initialTxs?: TxRow[];
  initialDateFrom?: string;
  initialDateTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const fxRatesQ = useQuery<any[]>({
    queryKey: ["fx_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fx_rates")
        .select("date,from_currency,to_currency,rate");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const convertFx = useMemo(() => buildFxConverter((fxRatesQ.data || []) as any), [fxRatesQ.data]);
  const conv = useMemo(() => (amount: number, from: string | null | undefined, dateISO: string) => {
    const src = (from || currency).toUpperCase();
    const v = convertFx(amount, src, currency, dateISO);
    return v == null ? (src === currency ? amount : 0) : v;
  }, [convertFx, currency]);

  const { data: profileScopeRow } = useQuery<{ scope?: string }>({
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
  const currentScope = (profileScopeRow?.scope as string | undefined) ?? "Personal";

  const { data: profileDualRow } = useQuery<{ show_dual_currency?: boolean }>({
    queryKey: ["profile", "dual"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {} as any;
      const { data, error } = await supabase.from("profiles").select("show_dual_currency").eq("id", user.id).single();
      if (error) throw error;
      return (data as any) || {};
    },
    staleTime: 60_000,
  });
  const showDual = !!profileDualRow?.show_dual_currency;
  // Per-page override (localStorage): null = no override; boolean otherwise
  const [dualOverride, setDualOverride] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dual-display");
      if (raw === "1") setDualOverride(true);
      else if (raw === "0") setDualOverride(false);
    } catch {}
  }, []);
  const showDualEffective = (dualOverride ?? showDual);
  const reduceMotion = useReducedMotion();
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<TxType | "transfer">("expense");
  const [amountStr, setAmountStr] = useState("");
  const [addDate, setAddDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [addAccountId, setAddAccountId] = useState("");
  const [addToAccountId, setAddToAccountId] = useState("");
  const [addCategoryId, setAddCategoryId] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addRecurring, setAddRecurring] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [splits, setSplits] = useState<Array<{ category_id: string; amount: string }>>([]);
  // Recurring builder state
  const [recName, setRecName] = useState("");
  const [recFreq, setRecFreq] = useState<"weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "custom">("monthly");
  const [recEvery, setRecEvery] = useState<string>("1");
  const [recDayOfMonth, setRecDayOfMonth] = useState<string>(""); // 1-28
  const [recWeekday, setRecWeekday] = useState<string>(""); // 0-6 (Sun..Sat)
  const [recAutoPost, setRecAutoPost] = useState<boolean>(true);
  const [recEndDate, setRecEndDate] = useState<string>("");
  function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function addWeeks(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n * 7); return x; }
  function computeNextDue(): string {
    const start = new Date(addDate + "T00:00:00");
    const every = Math.max(1, Number(recEvery || 1));
    if (recFreq === "weekly") return addWeeks(start, every).toISOString().slice(0,10);
    if (recFreq === "biweekly") return addWeeks(start, 2 * every).toISOString().slice(0,10);
    if (recFreq === "quarterly") return addMonths(start, 3 * every).toISOString().slice(0,10);
    if (recFreq === "yearly") { const x = new Date(start); x.setFullYear(x.getFullYear() + every); return x.toISOString().slice(0,10); }
    // monthly/custom
    if (recDayOfMonth) {
      const dom = Math.min(28, Math.max(1, Number(recDayOfMonth || 1)));
      const base = addMonths(start, every);
      const next = new Date(base.getFullYear(), base.getMonth(), dom);
      return next.toISOString().slice(0,10);
    }
    return addMonths(start, every).toISOString().slice(0,10);
  }
  const [fabHold, setFabHold] = useState(false);
  const [showRadial, setShowRadial] = useState(false);
  const fabTimer = useRef<number | null>(null);
  const [addReceipt, setAddReceipt] = useState<File | null>(null);
  const [tagFilter, setTagFilter] = useState("");
  const [recChip, setRecChip] = useState<"all" | "recurring">("all");
  
  const fabButtonRef = useRef<HTMLButtonElement>(null);
  const addSheetRef = useRef<HTMLDivElement>(null);
  const addLastFocusRef = useRef<HTMLElement | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  function onPickReceipt() {
    receiptInputRef.current?.click();
  }
  async function handleReceiptFile(file: File) {
    try {
      if (!file) return;
      const type = (file.type || "").toLowerCase();
      if (!type.startsWith("image/")) {
        showToast("Use an image receipt for OCR (PNG/JPG)");
      }
      setAddType("expense");
      setAddOpen(true);
      setAddReceipt(file);
      // Attempt lightweight OCR via dynamic import; gracefully fallback if unavailable
      let text = "";
      try {
        const { createWorker } = (await import("tesseract.js")) as any;
        const worker = await createWorker({ logger: () => {} });
        await worker.loadLanguage("eng");
        await worker.initialize("eng");
        const imageData = await file.arrayBuffer();
        const blobUrl = URL.createObjectURL(new Blob([imageData], { type: file.type }));
        const { data } = await worker.recognize(blobUrl);
        text = String(data?.text || "");
        await worker.terminate();
        URL.revokeObjectURL(blobUrl);
      } catch {
        // No OCR backend; leave fields as-is, only attach receipt
        showToast("OCR unavailable: installed fallback used file name only");
      }
      // Heuristic parsing
      if (text) {
        try {
          // Amount: pick the largest-looking monetary number with decimals
          const matches = Array.from(text.matchAll(/([$€£])?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))/g));
          let best: string | null = null;
          let bestVal = -1;
          for (const m of matches) {
            const raw = (m[2] || "").replace(/\./g, "").replace(/,/, ".");
            const v = parseFloat(raw);
            if (isFinite(v) && v > bestVal) { bestVal = v; best = raw; }
          }
          if (best && bestVal > 0) setAmountStr(String(bestVal.toFixed(2)));
          // Date: yyyy-mm-dd or mm/dd/yyyy
          const d1 = text.match(/(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])/);
          const d2 = text.match(/(0?[1-9]|1[0-2])[\/](0?[1-9]|[12]\d|3[01])[\/](20\d{2})/);
          let iso = "";
          if (d1) {
            const y = d1[1]; const m = d1[2].padStart(2, "0"); const d = d1[3].padStart(2, "0");
            iso = `${y}-${m}-${d}`;
          } else if (d2) {
            const m = d2[1].padStart(2, "0"); const d = d2[2].padStart(2, "0"); const y = d2[3];
            iso = `${y}-${m}-${d}`;
          }
          if (iso) setAddDate(iso);
          // Merchant: first reasonable uppercase word line
          const line = (text.split(/\r?\n/).map(s => s.trim()).find(s => /[A-Za-z]/.test(s) && !/total|subtotal|tax/i.test(s)) || "");
          if (line) setAddNotes(line);
        } catch {}
      } else {
        // No OCR text; use filename as note
        try { setAddNotes(file.name.replace(/\.[a-z0-9]+$/i, "")); } catch {}
      }
    } catch {}
  }

  const accountChipRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const accountChipsContainerRef = useRef<HTMLDivElement>(null);
  const [accountUnderline, setAccountUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const categoryChipRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const categoryChipsContainerRef = useRef<HTMLDivElement>(null);
  const [categoryUnderline, setCategoryUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });


  const now = new Date();
  const som = Math.min(Math.max(startOfMonth ?? 1, 1), 28);
  const currentSomDate = new Date(now.getFullYear(), now.getMonth(), som);
  const defaultStart = now >= currentSomDate
    ? currentSomDate
    : new Date(now.getFullYear(), now.getMonth() - 1, som);
  const defaultEnd = new Date(defaultStart.getFullYear(), defaultStart.getMonth() + 1, som - 1);

  const [dateFrom, setDateFrom] = useState<string>(initialDateFrom || defaultStart.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState<string>(initialDateTo || defaultEnd.toISOString().slice(0, 10));
  const [typeFilter, setTypeFilter] = useState<"all" | TxType>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [accountFilter, setAccountFilter] = useState<string | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState<"" | TxType>("");
  const [bulkAccountId, setBulkAccountId] = useState<string>("");
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [lastCheckIndex, setLastCheckIndex] = useState<number | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [rulesPreview, setRulesPreview] = useState<SmartRule[]>([]);
  const matchedCountCache = useRef<Map<string, number>>(new Map());
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!attachmentPreview) return;
    setPreviewLoading(true);
    setPreviewError(false);
    setZoom(1);
    setPanX(0); setPanY(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAttachmentPreview(null); }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => Math.min(4, z + 0.25)); }
      if (e.key === "-") { e.preventDefault(); setZoom((z) => Math.max(0.5, z - 0.25)); }
    };
    const onKeyTrap = (e: KeyboardEvent) => {
      if (!modalRef.current || e.key !== "Tab") return;
      const root = modalRef.current;
      const focusable = root.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onKeyTrap, true);
    const id = window.setTimeout(() => modalRef.current?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("keydown", onKeyTrap, true); window.clearTimeout(id); };
  }, [attachmentPreview]);

  function openAttachmentPreview(url: string, triggerEl?: HTMLElement) {
    lastFocusRef.current = triggerEl ?? null;
    setAttachmentPreview(url);
  }
  function closeAttachmentPreview() {
    setAttachmentPreview(null);
    const el = lastFocusRef.current;
    if (el) { setTimeout(() => el.focus(), 0); }
  }
  

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function onListKeyDown(e: any) {
    if (e?.defaultPrevented) return;
    const key = String(e?.key || "");
    if (key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min((i ?? -1) + 1, Math.max(0, txs.length - 1)));
      return;
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max((i ?? txs.length) - 1, 0));
      return;
    }
    if (key.toLowerCase() === "e") {
      if (selectedIndex != null) startEdit(txs[selectedIndex]);
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      if (selectedIndex != null) deleteMutation.mutate(txs[selectedIndex].id);
      return;
    }
    if (key === "Escape") {
      setSelectedIndex(null);
      cancelEdit();
      return;
    }
  }

  function handleRowCheckClick(index: number, id: string, e: any) {
    const isShift = !!(e?.shiftKey || e?.nativeEvent?.shiftKey);
    if (isShift && lastCheckIndex != null) {
      const a = Math.min(lastCheckIndex, index);
      const b = Math.max(lastCheckIndex, index);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const targetChecked = !prev.has(id);
        for (let i = a; i <= b; i++) {
          const tid = txs[i]?.id;
          if (!tid) continue;
          if (targetChecked) next.add(tid);
          else next.delete(tid);
        }
        return next;
      });
    } else {
      toggleSelect(id);
    }
    setLastCheckIndex(index);
  }
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: txKey });
      const prev = qc.getQueryData<TxRow[]>(txKey) ?? [];
      const next = prev.filter((t) => !ids.includes(t.id));
      qc.setQueryData<TxRow[]>(txKey, next);
      setSelectedIds(new Set());
      showToast("Deleted selected", "success");
      return { prev };
    },
    onError: (_e, _ids, ctx) => ctx?.prev && qc.setQueryData(txKey, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: txKey }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<TxForm> & { type?: TxType } }) => {
      const { error } = await supabase.from("transactions").update(patch).in("id", ids);
      if (error) throw error;
    },
    onMutate: async ({ ids, patch }) => {
      await qc.cancelQueries({ queryKey: txKey });
      const prev = qc.getQueryData<TxRow[]>(txKey) ?? [];
      const next = prev.map((t) =>
        ids.includes(t.id)
          ? {
              ...t,
              type: (patch.type ?? t.type) as TxType,
              account_id: (patch as any).account_id ?? t.account_id,
              category_id: (patch as any).category_id ?? t.category_id,
              accounts: (patch as any).account_id
                ? { name: accounts?.find((a) => a.id === (patch as any).account_id)?.name }
                : t.accounts,
              categories: (patch as any).category_id
                ? { name: categories?.find((c) => c.id === (patch as any).category_id)?.name }
                : t.categories,
            }
          : t
      );
      qc.setQueryData<TxRow[]>(txKey, next);
      return { prev };
    },
    onError: (_e, _vars, ctx) => ctx?.prev && qc.setQueryData(txKey, ctx.prev),
    onSuccess: () => {
      showToast("Updated selected", "success");
      setBulkType("");
      setBulkAccountId("");
      setBulkCategoryId("");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: txKey }),
  });

  function bulkApplyEdit() {
    const ids = Array.from(selectedIds);
    const patch: any = {};
    if (bulkType) patch.type = bulkType;
    if (bulkAccountId) patch.account_id = bulkAccountId;
    if (bulkCategoryId) patch.category_id = bulkCategoryId;
    if (!ids.length) { showToast("No rows selected"); return; }
    if (Object.keys(patch).length === 0) { showToast("Choose fields to apply"); return; }
    bulkUpdateMutation.mutate({ ids, patch });
  }
  function clearSelection() { setSelectedIds(new Set()); }
  function selectAllVisible() { setSelectedIds(new Set(txs.map((t) => t.id))); }
  function shiftMonth(delta: number) {
    const ref = new Date(dateFrom + "T00:00:00");
    const somLocal = Math.min(Math.max(startOfMonth ?? 1, 1), 28);
    const newStart = new Date(ref.getFullYear(), ref.getMonth() + delta, somLocal);
    const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, somLocal - 1);
    setDateFrom(newStart.toISOString().slice(0, 10));
    setDateTo(newEnd.toISOString().slice(0, 10));
  }
  function clearFilters() {
    setDateFrom(defaultStart.toISOString().slice(0, 10));
    setDateTo(defaultEnd.toISOString().slice(0, 10));
    setTypeFilter("all");
    setAccountFilter("all");
    setCategoryFilter("all");
    setSearchInput("");
    setSearch("");
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const block = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || (target as any).isContentEditable);
      if (!block && e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (!block && e.key === "ArrowLeft") { e.preventDefault(); shiftMonth(-1); }
      if (!block && e.key === "ArrowRight") { e.preventDefault(); shiftMonth(1); }
      if (!block && (e.key === "n" || e.key === "N")) { e.preventDefault(); setAddOpen(true); }
      if (addOpen && !block) {
        if (e.key === "e" || e.key === "E") { e.preventDefault(); setAddType("expense"); }
        if (e.key === "i" || e.key === "I") { e.preventDefault(); setAddType("income"); }
        if (e.key === "t" || e.key === "T") { e.preventDefault(); setAddType("transfer"); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dateFrom, dateTo, startOfMonth, addOpen]);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Moved chip underline effects below queries for accounts/categories to satisfy TS ordering

  // Focus trap for Add Transaction sheet
  useEffect(() => {
    if (!addOpen) return;
    addLastFocusRef.current = (document.activeElement as HTMLElement) || null;
    const onKeyClose = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setAddOpen(false); }
    };
    const onKeyTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = addSheetRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyClose);
    document.addEventListener("keydown", onKeyTrap, true);
    const id = window.setTimeout(() => {
      const root = addSheetRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(
        "button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      (first || root).focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKeyClose);
      document.removeEventListener("keydown", onKeyTrap, true);
      window.clearTimeout(id);
      const prev = addLastFocusRef.current || fabButtonRef.current;
      if (prev) setTimeout(() => prev.focus(), 0);
    };
  }, [addOpen]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/smart-rules", { cache: "no-store" });
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          setRulesPreview(Array.isArray(data) ? (data as SmartRule[]) : []);
        } else {
          setRulesPreview(loadSmartRules());
        }
      } catch {
        if (!alive) return;
        setRulesPreview(loadSmartRules());
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    matchedCountCache.current.clear();
  }, [rulesPreview]);

  useEffect(() => {
    const df = searchParams.get("date_from");
    const dt = searchParams.get("date_to");
    const ty = searchParams.get("type") as any;
    const acc = searchParams.get("account_id");
    const q = searchParams.get("search");
    const cat = searchParams.get("category_id");
    const tg = searchParams.get("tag");
    if (df) setDateFrom(df);
    if (dt) setDateTo(dt);
    if (ty === "income" || ty === "expense" || ty === "all") setTypeFilter(ty);
    if (acc) setAccountFilter(acc);
    if (q) { setSearchInput(q); setSearch(q); }
    if (cat) setCategoryFilter(cat);
    if (tg) setTagFilter(tg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (typeFilter) params.set("type", typeFilter);
    if (accountFilter && accountFilter !== "all") params.set("account_id", accountFilter);
    if (categoryFilter && categoryFilter !== "all") params.set("category_id", categoryFilter);
    if (search) params.set("search", search);
    if (tagFilter) params.set("tag", tagFilter);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [dateFrom, dateTo, typeFilter, accountFilter, categoryFilter, search, tagFilter, pathname, router]);

  const txKey = ["transactions", currentScope, dateFrom, dateTo, typeFilter, search, accountFilter, categoryFilter, tagFilter, recChip];

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts", currentScope],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id,name,type,currency")
        .eq("scope", currentScope)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
    initialData: initialAccounts as Account[] | undefined,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories", currentScope, typeFilter],
    queryFn: async (): Promise<Category[]> => {
      let q = supabase.from("categories").select("id,name,type").eq("scope", currentScope).order("name");
      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
    initialData: initialCategories as Category[] | undefined,
  });

  // Account chips underline follows selected chip
  useLayoutEffect(() => {
    const cont = accountChipsContainerRef.current;
    const key = accountFilter as string;
    const el = (accountChipRefs.current.get(key) || accountChipRefs.current.get("all")) as HTMLButtonElement | null;
    const update = () => {
      if (!cont || !el) return;
      const left = el.offsetLeft - cont.scrollLeft;
      const width = el.offsetWidth;
      setAccountUnderline({ left, width });
    };
    update();
    const onResize = () => update();
    const onScroll = () => update();
    window.addEventListener("resize", onResize);
    cont?.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("resize", onResize);
      cont?.removeEventListener("scroll", onScroll);
    };
  }, [accountFilter, accounts]);

  // Category chips underline follows selected chip
  useLayoutEffect(() => {
    const cont = categoryChipsContainerRef.current;
    const key = categoryFilter as string;
    const el = (categoryChipRefs.current.get(key) || categoryChipRefs.current.get("all")) as HTMLButtonElement | null;
    const update = () => {
      if (!cont || !el) return;
      const left = el.offsetLeft - cont.scrollLeft;
      const width = el.offsetWidth;
      setCategoryUnderline({ left, width });
    };
    update();
    const onResize = () => update();
    const onScroll = () => update();
    window.addEventListener("resize", onResize);
    cont?.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("resize", onResize);
      cont?.removeEventListener("scroll", onScroll);
    };
  }, [categoryFilter, categories]);
  const { data: budgets } = useQuery<Array<{ id: string; amount: number; category_id: string | null }>>({
    queryKey: ["budgets", currentScope],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("id,amount,category_id").eq("scope", currentScope);
      if (error) throw error;
      return (data as any) ?? [];
    },
    staleTime: 60_000,
  });

  const useInitialTxs =
    (!!initialTxs && dateFrom === (initialDateFrom || "") && dateTo === (initialDateTo || "") &&
      typeFilter === "all" && accountFilter === "all" && categoryFilter === "all" && !search);

  const txQuery = useQuery<TxRow[]>({
    queryKey: txKey,
    queryFn: async (): Promise<TxRow[]> => {
      let q = supabase
        .from("transactions")
        .select(
          "id,date,amount,type,currency,notes,attachment_url,account_id,category_id,accounts:account_id(name),categories:category_id(name),tags,subscription_id"
        )
        .eq("scope", currentScope)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      if (search) q = q.ilike("notes", `%${search}%`);
      if (accountFilter !== "all") q = q.eq("account_id", accountFilter);
      if (categoryFilter !== "all") q = q.eq("category_id", categoryFilter);
      const tag = (tagFilter || "").trim().replace(/^#/, "");
      if (tag) (q as any) = (q as any).contains("tags", [tag]);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data as unknown as TxRow[]) ?? [];
      if (recChip === "recurring") {
        rows = rows.filter((t) => !!t.subscription_id || (Array.isArray(t.tags) && t.tags.includes("subscription")));
      }
      return rows;
    },
    initialData: useInitialTxs ? (initialTxs as TxRow[] | undefined) : undefined,
    placeholderData: (prev) => prev as TxRow[] | undefined,
  });
  const txs = txQuery.data ?? [];
  const isFetching = txQuery.isFetching;

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of txs) {
      const amt = conv(Number(t.amount || 0), t.currency as any, String(t.date));
      if (t.type === "income") inc += amt;
      if (t.type === "expense") exp += amt;
    }
    return { inc, exp, net: inc - exp };
  }, [txs, conv]);

  const insights = useMemo(() => {
    // Top category by spend (expense only)
    const spendByCat = new Map<string, number>();
    for (const t of txs) {
      if (t.type !== "expense") continue;
      const cid = t.category_id || "";
      if (!cid) continue;
      spendByCat.set(cid, (spendByCat.get(cid) ?? 0) + conv(Number(t.amount || 0), t.currency as any, String(t.date)));
    }
    let topCatId: string | null = null;
    let topCatSpend = 0;
    for (const [cid, sum] of spendByCat.entries()) {
      if (sum > topCatSpend) { topCatSpend = sum; topCatId = cid; }
    }

    // Avg transaction size (expense only)
    const expenses = txs.filter((t) => t.type === "expense");
    const avgSize = expenses.length ? expenses.reduce((s, t) => s + conv(Number(t.amount || 0), t.currency as any, String(t.date)), 0) / expenses.length : 0;

    // Spend velocity per day in current range (up to today)
    const start = new Date(dateFrom + "T00:00:00");
    const end = new Date(dateTo + "T00:00:00");
    const today = new Date();
    const windowEnd = end < today ? end : today;
    const days = Math.max(1, Math.round((Date.UTC(windowEnd.getFullYear(), windowEnd.getMonth(), windowEnd.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / (1000*60*60*24)) + 1);
    const velocity = days > 0 ? (expenses.reduce((s, t) => s + conv(Number(t.amount || 0), t.currency as any, String(t.date)), 0) / days) : 0;

    // No-spend streak in days
    let lastExpenseDate: Date | null = null;
    for (const t of expenses) {
      const d = new Date(String(t.date) + "T00:00:00");
      if (!lastExpenseDate || d > lastExpenseDate) lastExpenseDate = d;
    }
    const streak = lastExpenseDate ? Math.max(0, Math.floor(((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(lastExpenseDate.getFullYear(), lastExpenseDate.getMonth(), lastExpenseDate.getDate())) / (1000*60*60*24)))) : 0;

    const topCatName = topCatId ? (categories ?? []).find((c) => c.id === topCatId)?.name || "" : "";
    return { topCatId, topCatName, topCatSpend, avgSize, velocity, streak };
  }, [txs, dateFrom, dateTo, categories]);
  const budgetByCat = useMemo(() => new Map<string, number>((budgets || []).map((b: any) => [String(b.category_id || ""), Number(b.amount || 0)])), [budgets]);
  const spentByCatPeriod = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txs) {
      if (t.type !== "expense") continue;
      const cid = String(t.category_id || "");
      m.set(cid, (m.get(cid) ?? 0) + conv(Number(t.amount || 0), t.currency as any, String(t.date)));
    }
    return m;
  }, [txs, conv]);
  const accCurrencyMap = useMemo(() => new Map<string, string>((accounts || []).map((a: any) => [a.id, (a.currency as string | null) || currency])), [accounts, currency]);

  const createMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from("transactions").insert(rows as any);
      if (error) throw error;
    },
    onMutate: async (rows: any[]) => {
      await qc.cancelQueries({ queryKey: txKey });
      const prev = qc.getQueryData<TxRow[]>(txKey) ?? [];
      const optimistic: TxRow[] = rows.map((r: any) => ({
        id: "temp-" + Math.random().toString(36).slice(2),
        date: r.date,
        type: r.type,
        amount: r.amount,
        currency: r.currency,
        notes: r.notes || null,
        attachment_url: null,
        account_id: r.account_id,
        category_id: r.category_id || null,
        accounts: { name: accounts?.find(a => a.id === r.account_id)?.name },
        categories: r.category_id ? { name: categories?.find(c => c.id === r.category_id)?.name } : null,
      }));
      qc.setQueryData<TxRow[]>(txKey, [optimistic[0], ...prev]);
      return { prev } as any;
    },
    onError: (_e, rows: any[], ctx) => {
      try {
        const raw = localStorage.getItem("tx-offline-queue");
        const queued = raw ? JSON.parse(raw) : [];
        localStorage.setItem("tx-offline-queue", JSON.stringify([...(queued || []), ...rows]));
        showToast("Saved offline. Will sync when online", "success");
      } catch {}
      if (ctx?.prev) qc.setQueryData(txKey, ctx.prev);
    },
    onSuccess: () => {
      showToast("Transaction added", "success");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: txKey });
      qc.invalidateQueries({ queryKey: ["budgets", currentScope] });
      qc.invalidateQueries({ queryKey: ["accounts", currentScope] });
    },
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = localStorage.getItem("tx-offline-queue");
        const queued = raw ? (JSON.parse(raw) as any[]) : [];
        if (!queued.length) return;
        const { error } = await supabase.from("transactions").insert(queued as any);
        if (!error && alive) localStorage.removeItem("tx-offline-queue");
      } catch {}
    })();
    return () => { alive = false; };
  }, [currentScope]);

  async function saveAdd(another: boolean) {
    try {
      const amt = Number(amountStr || 0);
      if (!isFinite(amt) || amt <= 0) { showToast("Enter an amount"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      const rows: any[] = [];
      let attachmentUrl: string | null = null;
      if (addReceipt) {
        try {
          const ext = (addReceipt.name.split(".").pop() || "dat").toLowerCase();
          const key = `${user?.id || "anon"}/${addDate}/${Math.random().toString(36).slice(2)}.${ext}`;
          const up = await supabase.storage.from("receipts").upload(key, addReceipt, { contentType: addReceipt.type || undefined });
          if (!up.error) {
            const pub = supabase.storage.from("receipts").getPublicUrl(key);
            attachmentUrl = pub.data.publicUrl || null;
          }
        } catch {}
      }
      if (addType === "transfer") {
        if (!addAccountId || !addToAccountId || addAccountId === addToAccountId) { showToast("Choose two different accounts"); return; }
        rows.push({ user_id: user?.id, date: addDate, type: "expense", amount: amt, account_id: addAccountId, category_id: null, notes: `Transfer → ${accounts?.find(a=>a.id===addToAccountId)?.name || ""}${addNotes ? ` · ${addNotes}` : ""}`, scope: currentScope, tags: ["transfer"], currency: accCurrencyMap.get(addAccountId) || currency, attachment_url: attachmentUrl });
        rows.push({ user_id: user?.id, date: addDate, type: "income", amount: amt, account_id: addToAccountId, category_id: null, notes: `Transfer ← ${accounts?.find(a=>a.id===addAccountId)?.name || ""}${addNotes ? ` · ${addNotes}` : ""}`, scope: currentScope, tags: ["transfer"], currency: accCurrencyMap.get(addToAccountId) || currency, attachment_url: attachmentUrl });
      } else if (splitOn && splits.length) {
        for (const s of splits) {
          const a = Number(s.amount || 0);
          if (!s.category_id || !isFinite(a) || a <= 0) continue;
          rows.push({ user_id: user?.id, date: addDate, type: addType, amount: a, account_id: addAccountId, category_id: s.category_id, notes: addNotes || null, scope: currentScope, tags: addRecurring ? ["subscription"] : null, currency: accCurrencyMap.get(addAccountId) || currency, attachment_url: attachmentUrl });
        }
      } else {
        // If recurring and expense: create subscription first to link transaction
        let newSubId: string | null = null;
        if (addRecurring && addType === "expense") {
          try {
            const name = (recName || addNotes || (categories?.find(c => c.id === addCategoryId)?.name) || "Recurring Expense");
            const interval = (() => {
              if (recFreq === "weekly") return "week";
              if (recFreq === "biweekly") return "week";
              if (recFreq === "monthly") return "month";
              if (recFreq === "quarterly") return "month";
              if (recFreq === "yearly") return "year";
              return "month";
            })();
            const every = (() => {
              if (recFreq === "weekly") return Math.max(1, Number(recEvery || 1));
              if (recFreq === "biweekly") return Math.max(1, Number(recEvery || 1)) * 2;
              if (recFreq === "monthly") return Math.max(1, Number(recEvery || 1));
              if (recFreq === "quarterly") return Math.max(1, Number(recEvery || 1)) * 3;
              if (recFreq === "yearly") return Math.max(1, Number(recEvery || 1));
              return Math.max(1, Number(recEvery || 1));
            })();
            const nextStr = computeNextDue();
            const subRowModern: any = {
              user_id: user?.id,
              name,
              amount: amt,
              interval,
              every,
              next_charge_date: nextStr,
              account_id: addAccountId || null,
              category_id: addCategoryId || null,
              active: true,
              auto_post: recAutoPost,
              currency: accCurrencyMap.get(addAccountId) || currency,
              scope: currentScope,
              notes: addNotes || null,
              day_of_month: recDayOfMonth ? Math.min(28, Math.max(1, Number(recDayOfMonth))) : null,
              weekday: recWeekday ? Number(recWeekday) : null,
              end_date: recEndDate || null,
              paused: false,
            };
            try {
              const ins = await supabase.from("subscriptions").insert(subRowModern as any).select("id").single();
              if (ins.error) throw ins.error;
              newSubId = (ins.data as any)?.id || null;
            } catch (_e1) {
              const freq = (() => {
                if (recFreq === "weekly") return "weekly";
                if (recFreq === "biweekly") return "weekly";
                if (recFreq === "monthly") return "monthly";
                if (recFreq === "quarterly") return "quarterly";
                if (recFreq === "yearly") return "yearly";
                return "monthly";
              })();
              const ins = await supabase.from("subscriptions").insert({
                user_id: user?.id,
                name,
                amount: amt,
                frequency: freq,
                next_due: nextStr,
                account_id: addAccountId || null,
                category_id: addCategoryId || null,
                auto_post: recAutoPost,
                notes: addNotes || null,
              } as any).select("id").single();
              if (!ins.error) newSubId = (ins.data as any)?.id || null;
            }
          } catch {}
        }
        rows.push({ user_id: user?.id, date: addDate, type: addType, amount: amt, account_id: addAccountId, category_id: addCategoryId || null, notes: addNotes || null, scope: currentScope, tags: addRecurring ? ["subscription"] : null, currency: accCurrencyMap.get(addAccountId) || currency, attachment_url: attachmentUrl, subscription_id: newSubId });
      }
      if (!rows.length) { showToast("Missing fields"); return; }
      createMutation.mutate(rows);
      if (another) {
        setAmountStr("");
        setAddNotes("");
        setAddReceipt(null);
        if (!splitOn) setAddCategoryId(""); else setSplits([]);
      } else {
        setAddOpen(false);
        setAmountStr("");
        setAddNotes("");
        setAddCategoryId("");
        setSplits([]);
        setAddReceipt(null);
      }
    } catch {}
  }

  

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: txKey });
      const prev = qc.getQueryData<TxRow[]>(txKey) ?? [];
      const removed = prev.find((t) => t.id === id) || null;
      qc.setQueryData<TxRow[]>(txKey, prev.filter((t) => t.id !== id));
      setLastDeleted(removed);
      if (undoTimer.current) { clearTimeout(undoTimer.current); undoTimer.current = null; }
      undoTimer.current = window.setTimeout(() => setLastDeleted(null), 7000);
      showToast("Transaction deleted", { actionLabel: "Undo", onAction: () => undoDelete(), durationMs: 7000 });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(txKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: txKey });
    },
  });

  

  // Inline edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const editForm = useForm<TxForm>({ resolver: zodResolver(txSchema) as any });
  const editType = editForm.watch("type");
  const editAvailableCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === (editType ?? "expense")),
    [categories, editType]
  );
  function startEdit(t: TxRow) {
    setEditingId(t.id);
    editForm.reset({
      date: t.date,
      type: t.type,
      amount: Number(t.amount || 0),
      account_id: t.account_id,
      category_id: t.category_id || "",
      notes: t.notes || "",
    });
  }
  function cancelEdit() {
    setEditingId(null);
  }

  function applyRulesToEditForm() {
    const rules = loadSmartRules();
    if (!rules?.length) return;
    const vals = editForm.getValues();
    const traced = applySmartRulesWithTrace(
      {
        date: vals.date,
        amount: Number((vals as any).amount || 0),
        type: vals.type,
        notes: null,
        account_id: vals.account_id || "",
        category_id: vals.category_id || "",
      },
      rules,
      { categories: categories ?? [], accounts: accounts ?? [] }
    );
    const res = traced.result;
    editForm.setValue("type", res.type, { shouldDirty: true });
    if (res.account_id) editForm.setValue("account_id", res.account_id, { shouldDirty: true });
    if (res.category_id) editForm.setValue("category_id", res.category_id, { shouldDirty: true });
  }

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string } & TxForm) => {
      const { error } = await supabase
        .from("transactions")
        .update({
          date: input.date,
          type: input.type,
          amount: Number(input.amount || 0),
          account_id: input.account_id,
          category_id: input.category_id,
          notes: input.notes || null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: txKey });
      const prev = qc.getQueryData<TxRow[]>(txKey) ?? [];
      const next = prev.map((t) =>
        t.id === vars.id
          ? {
              ...t,
              date: vars.date,
              type: vars.type as TxType,
              amount: Number(vars.amount || 0),
              account_id: vars.account_id,
              category_id: vars.category_id,
              notes: vars.notes || null,
              accounts: { name: accounts?.find((a) => a.id === vars.account_id)?.name },
              categories: { name: categories?.find((c) => c.id === vars.category_id)?.name },
            }
          : t
      );
      qc.setQueryData<TxRow[]>(txKey, next);
      return { prev };
    },
    onError: (_e, _vars, ctx) => ctx?.prev && qc.setQueryData(txKey, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: txKey }),
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const [lastDeleted, setLastDeleted] = useState<TxRow | null>(null);
  const undoTimer = useRef<number | null>(null);
  async function undoDelete() {
    if (!lastDeleted) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("transactions").insert({
      user_id: user?.id,
      date: lastDeleted.date,
      type: lastDeleted.type,
      amount: Number(lastDeleted.amount || 0),
      account_id: lastDeleted.account_id,
      category_id: lastDeleted.category_id,
      scope: currentScope,
      notes: lastDeleted.notes ?? null,
    });
    setLastDeleted(null);
    if (undoTimer.current) { clearTimeout(undoTimer.current); undoTimer.current = null; }
    qc.invalidateQueries({ queryKey: txKey });
  }
  const rowVirtualizer = useVirtualizer({
    count: txs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-[hsl(var(--bg)/0.6)] backdrop-blur rounded-xl p-3 border border-white/10 space-y-3 relative">
        <div className="flex items-center justify-between sm:hidden">
          <button
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-3 py-1.5 text-sm hover:bg-white/80 dark:hover:bg-zinc-900"
          >
            Filter
          </button>
        </div>
      {/* Floating Action Button (desktop only) */}
      <div className="hidden sm:block fixed right-5 [bottom:calc(env(safe-area-inset-bottom)+1.25rem)] z-40">
        <div className="relative">
          <button
            aria-label="Add transaction"
            ref={fabButtonRef}
            onMouseDown={() => { setFabHold(true); if (fabTimer.current) clearTimeout(fabTimer.current); fabTimer.current = window.setTimeout(() => { if (fabHold) setShowRadial(true); }, 450); }}
            onMouseUp={() => { if (fabTimer.current) { clearTimeout(fabTimer.current); fabTimer.current = null; } if (!showRadial) setAddOpen(true); setFabHold(false); }}
            onTouchStart={() => { setFabHold(true); if (fabTimer.current) clearTimeout(fabTimer.current); fabTimer.current = window.setTimeout(() => { if (fabHold) setShowRadial(true); }, 450); }}
            onTouchEnd={() => { if (fabTimer.current) { clearTimeout(fabTimer.current); fabTimer.current = null; } if (!showRadial) setAddOpen(true); setFabHold(false); }}
            className="h-14 w-14 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-lg flex items-center justify-center relative"
          >
            <span className="absolute inset-0 rounded-full ring-2 ring-[hsl(var(--accent)/0.4)] animate-pulse" />
            <Plus className="h-6 w-6" />
          </button>
          <AnimatePresence>
            {showRadial ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute -top-24 -left-16 h-40 w-40 pointer-events-auto">
                <div className="relative h-full w-full">
                  <button onClick={() => { setAddType("expense"); setShowRadial(false); setAddOpen(true); }} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-rose-500 text-white h-10 w-10 text-xs">Exp</button>
                  <button onClick={() => { setAddType("income"); setShowRadial(false); setAddOpen(true); }} className="absolute right-0 top-0 rounded-full bg-emerald-500 text-white h-10 w-10 text-xs">Inc</button>
                  <button onClick={() => { setAddType("transfer"); setShowRadial(false); setAddOpen(true); }} className="absolute right-2 bottom-0 rounded-full bg-sky-500 text-white h-10 w-10 text-xs">Trf</button>
                  <button onClick={() => { if (txs[0]) { const last = txs[0]; setAddType(last.type); setAddAccountId(last.account_id); setAddCategoryId(last.category_id || ""); } setShowRadial(false); setAddOpen(true); }} className="absolute left-1/2 -translate-x-1/2 top-0 rounded-full bg-purple-500 text-white h-10 w-10 text-[10px]">Last</button>
                  <button onClick={() => { setShowRadial(false); onPickReceipt(); }} className="absolute left-1/2 -translate-x-1/2 bottom-2 rounded-full bg-amber-500 text-white h-10 w-10 text-[10px]">Scan</button>
                </div>
                <button onClick={() => setShowRadial(false)} className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-zinc-500">Cancel</button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Hidden file input for receipt OCR */}
      <input
        ref={receiptInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (f) handleReceiptFile(f);
        }}
      />

      {/* Add Transaction Sheet */}
      <AnimatePresence>
        {addOpen ? (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="add-sheet-title">
            <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
            <motion.div initial={reduceMotion ? { opacity: 1 } : { y: "100%" }} animate={reduceMotion ? { opacity: 1 } : { y: 0 }} exit={reduceMotion ? { opacity: 0 } : { y: "100%" }} transition={{ duration: 0.26, type: "spring", bounce: 0.3 }} className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white dark:bg-zinc-950 border-t border-white/10 p-4 shadow-2xl" ref={addSheetRef} tabIndex={-1}>
              <h2 id="add-sheet-title" className="sr-only">Add transaction</h2>
              <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 dark:bg-zinc-900 p-1">
                  {(["expense","income","transfer"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setAddType(t)}
                      aria-pressed={addType === t}
                      aria-label={`${t[0].toUpperCase()+t.slice(1)} type`}
                      className={cn("px-3 py-1.5 text-xs rounded-full", addType === t ? "bg-white dark:bg-zinc-800 shadow" : "opacity-70")}
                    >
                      {t[0].toUpperCase()+t.slice(1)}
                    </button>
                  ))}
                </div>
                <button onClick={() => setAddOpen(false)} aria-label="Close" className="h-8 w-8 rounded-full bg-white/60 dark:bg-zinc-900/60 border border-white/20 flex items-center justify-center"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-4xl font-semibold tabular">{amountStr ? amountStr : "0"}</div>
                  <div className="mt-2">
                    <label className="block text-xs text-zinc-500">Date</label>
                    <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-zinc-500">Notes</label>
                    <input type="text" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-zinc-500">Receipt</label>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => setAddReceipt(e.target.files?.[0] || null)} className="block w-full text-xs" />
                    {addReceipt ? <div className="text-[10px] text-zinc-500 mt-1 truncate">{addReceipt.name}</div> : null}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={addRecurring} onChange={(e) => setAddRecurring(e.target.checked)} /> Recurring</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={splitOn} onChange={(e) => setSplitOn(e.target.checked)} /> Split</label>
                  </div>
                  {addRecurring && addType === "expense" && !splitOn ? (
                    <div className="mt-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-2">
                      <div className="text-xs font-medium mb-2">Recurring</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label className="block text-[11px] text-zinc-500">Name</label>
                          <input type="text" placeholder="e.g. Home Internet" value={recName} onChange={(e) => setRecName(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500">
                            <span>Presets:</span>
                            {(["Internet","Rent/Mortgage","Bank Loan","Phone","Utilities"] as const).map((p) => (
                              <button key={p} onClick={() => setRecName(p)} className="rounded-full px-2 py-0.5 ring-1 ring-inset ring-white/20 bg-white/50 dark:bg-zinc-900/40 text-[11px]">{p}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-500">Frequency</label>
                          <select value={recFreq} onChange={(e) => setRecFreq(e.target.value as any)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-500">Every</label>
                          <input type="number" min={1} value={recEvery} onChange={(e) => setRecEvery(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                        </div>
                        {recFreq === "monthly" || recFreq === "quarterly" || recFreq === "custom" ? (
                          <div>
                            <label className="block text-[11px] text-zinc-500">Day of month (1–28)</label>
                            <input type="number" min={1} max={28} placeholder="e.g. 5" value={recDayOfMonth} onChange={(e) => setRecDayOfMonth(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                          </div>
                        ) : null}
                        {recFreq === "weekly" || recFreq === "biweekly" ? (
                          <div>
                            <label className="block text-[11px] text-zinc-500">Weekday</label>
                            <select value={recWeekday} onChange={(e) => setRecWeekday(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                              <option value="">Same weekday</option>
                              <option value="0">Sun</option>
                              <option value="1">Mon</option>
                              <option value="2">Tue</option>
                              <option value="3">Wed</option>
                              <option value="4">Thu</option>
                              <option value="5">Fri</option>
                              <option value="6">Sat</option>
                            </select>
                          </div>
                        ) : null}
                        <div>
                          <label className="block text-[11px] text-zinc-500">Start</label>
                          <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-500">End (optional)</label>
                          <input type="date" value={recEndDate} onChange={(e) => setRecEndDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                        </div>
                        <div className="col-span-2 flex items-center justify-between">
                          <label className="inline-flex items-center gap-2 text-[11px]"><input type="checkbox" checked={recAutoPost} onChange={(e) => setRecAutoPost(e.target.checked)} /> Autopost</label>
                          <div className="text-[11px] text-zinc-600 dark:text-zinc-400">Next due: <span className="tabular font-medium">{computeNextDue()}</span></div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div>
                  {addType === "transfer" ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-zinc-500">From account</label>
                        <select value={addAccountId} onChange={(e) => setAddAccountId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                          <option value="">Select</option>
                          {(accounts ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500">To account</label>
                        <select value={addToAccountId} onChange={(e) => setAddToAccountId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                          <option value="">Select</option>
                          {(accounts ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-zinc-500">Account</label>
                        <select value={addAccountId} onChange={(e) => setAddAccountId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                          <option value="">Select</option>
                          {(accounts ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-xs text-zinc-500">Category</label>
                        </div>
                        {!splitOn ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(categories ?? []).filter(c => c.type === addType).map(c => {
                              const budget = budgetByCat.get(c.id || "") || 0;
                              const spent = spentByCatPeriod.get(c.id || "") || 0;
                              const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
                              const active = addCategoryId === c.id;
                              return (
                                <button key={c.id} onClick={() => setAddCategoryId(c.id)} className={cn("relative px-2 py-1 text-xs rounded-md ring-1 ring-inset", active ? "bg-white/80 dark:bg-zinc-900/60 ring-white/30" : "bg-white/50 dark:bg-zinc-900/40 ring-white/20")}>
                                  {c.name}
                                  {budget > 0 ? <span className="absolute left-0 bottom-0 h-0.5" style={{ width: `${pct}%`, background: pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#10b981" }} /> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {splits.map((s, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <select value={s.category_id} onChange={(e) => setSplits(arr => { const n = arr.slice(); n[idx] = { ...n[idx], category_id: e.target.value }; return n; })} className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                                  <option value="">Category</option>
                                  {(categories ?? []).filter(c => c.type === addType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input type="number" inputMode="decimal" placeholder="Amount" value={s.amount} onChange={(e) => setSplits(arr => { const n = arr.slice(); n[idx] = { ...n[idx], amount: e.target.value }; return n; })} className="w-28 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                                <button onClick={() => setSplits(arr => arr.filter((_, i) => i !== idx))} className="text-xs text-zinc-600 hover:underline">Remove</button>
                              </div>
                            ))}
                            <button onClick={() => setSplits(arr => [...arr, { category_id: "", amount: "" }])} className="text-xs text-zinc-600 hover:underline">Add split</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-2"><label className="text-xs text-zinc-500">Amount</label></div>
                  <div className="rounded-md border border-zinc-200/60 dark:border-zinc-800 p-2"><NumericKeypad value={amountStr} onChange={setAmountStr} /></div>
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => saveAdd(false)} className="rounded-md bg-zinc-900 text-white dark:bg-white dark:text-black px-3 py-2 text-sm">Save</button>
                    <button onClick={() => saveAdd(true)} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm">Save & Add Another</button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {/* Smart Insights */}
      <div className="-mt-2">
        <motion.div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" variants={stagger(0.04)} initial="initial" animate="animate">
          <motion.button
            variants={chip}
            onClick={() => { if (insights.topCatId) { setTypeFilter("expense"); setCategoryFilter(insights.topCatId); } }}
            className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20 hover:bg-white/70 dark:hover:bg-zinc-900/70",
              (typeFilter === "expense" && categoryFilter === (insights.topCatId || "")) && "bg-white/70 dark:bg-zinc-900/70 ring-white/30")}
            aria-label="Top category this month"
            title="Top category this month"
            aria-pressed={typeFilter === "expense" && categoryFilter === (insights.topCatId || "")}
          >
            <span className="text-zinc-600 dark:text-zinc-300">Top category</span>
            <span className="font-medium">{insights.topCatName || "—"}</span>
            {insights.topCatSpend > 0 ? <span className="text-zinc-600 dark:text-zinc-400">· {formatCurrency(insights.topCatSpend, currency, locale)}</span> : null}
          </motion.button>
          <motion.div variants={chip} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20">
            <span className="text-zinc-600 dark:text-zinc-300">Avg tx</span>
            <span className="font-medium">{formatCurrency(insights.avgSize, currency, locale)}</span>
          </motion.div>
          <motion.div variants={chip} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20">
            <span className="text-zinc-600 dark:text-zinc-300">Velocity</span>
            <span className="font-medium">{formatCurrency(insights.velocity, currency, locale)}/d</span>
          </motion.div>
          <motion.div variants={chip} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20">
            <span className="text-zinc-600 dark:text-zinc-300">Streak</span>
            <span className="font-medium">{insights.streak}d</span>
          </motion.div>
          <motion.button
            variants={chip}
            onClick={() => setRecChip("all")}
            aria-pressed={recChip === "all"}
            className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset",
              recChip === "all" ? "bg-white/70 dark:bg-zinc-900/70 ring-white/30" : "bg-white/50 dark:bg-zinc-900/50 ring-white/20")}
          >
            All
          </motion.button>
          <motion.button
            variants={chip}
            onClick={() => setRecChip("recurring")}
            aria-pressed={recChip === "recurring"}
            className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset",
              recChip === "recurring" ? "bg-white/70 dark:bg-zinc-900/70 ring-white/30" : "bg-white/50 dark:bg-zinc-900/50 ring-white/20")}
          >
            Recurring
          </motion.button>
        </motion.div>
      </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-medium">This period</h2>
            <button onClick={() => shiftMonth(1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="text-xs text-zinc-500">{dateFrom} – {dateTo}</div>
        </div>
        <div className={cn("grid grid-cols-2 sm:grid-cols-8 gap-2", mobileFiltersOpen ? "grid" : "hidden", "sm:grid")}>
          <div>
            <label className="block text-xs text-zinc-500">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div className="sm:ml-auto">
            <label className="block text-xs text-zinc-500">Search</label>
            <input type="text" placeholder="Search notes..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} ref={searchRef} className="w-full sm:w-48 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-transparent">Export</label>
            <div className="flex gap-2">
              <button onClick={() => { const params = new URLSearchParams(); if (dateFrom) params.set("date_from", dateFrom); if (dateTo) params.set("date_to", dateTo); if (typeFilter) params.set("type", typeFilter); if (accountFilter && accountFilter !== "all") params.set("account_id", accountFilter); if (categoryFilter && categoryFilter !== "all") params.set("category_id", categoryFilter); if (search) params.set("search", search); window.location.href = "/api/export/csv?" + params.toString(); }} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur px-3 py-1.5 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">Export CSV</button>
              <button onClick={clearFilters} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur px-3 py-1.5 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">Clear</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Dual display</label>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={!!(dualOverride ?? showDual)} onChange={(e) => {
                const on = e.target.checked;
                setDualOverride(on);
                try { localStorage.setItem("dual-display", on ? "1" : "0"); } catch {}
              }} />
              <button
                onClick={() => { setDualOverride(null); try { localStorage.removeItem("dual-display"); } catch {} }}
                className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
              >Reset</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Tag</label>
            <input type="text" placeholder="#tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          </div>
        </div>
        {/* Account filter chips */}
        <div className={cn("sm:col-span-4 -mb-1", mobileFiltersOpen ? "" : "hidden sm:block")}> 
          <div className="mt-1 flex items-center gap-2 overflow-x-auto no-scrollbar relative" ref={accountChipsContainerRef}>
            <button
              onClick={() => setAccountFilter("all")}
              ref={(el) => { accountChipRefs.current.set("all", el); }}
              className={cn("rounded-full px-3 py-1.5 text-xs ring-1 ring-inset", accountFilter === "all" ? "bg-white/12 ring-white/20" : "bg-white/5 ring-white/10")}
            >
              All accounts
            </button>
            {(accounts ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => setAccountFilter(a.id)}
                ref={(el) => { accountChipRefs.current.set(a.id, el); }}
                className={cn("rounded-full px-3 py-1.5 text-xs ring-1 ring-inset", accountFilter === a.id ? "bg-white/12 ring-white/20" : "bg-white/5 ring-white/10")}
              >
                {a.name}
              </button>
            ))}
            <motion.span
              className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-zinc-800/50 dark:bg-white/60"
              animate={{ left: accountUnderline.left, width: accountUnderline.width }}
              transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.25 }}
            />
          </div>
        </div>
        {/* Category filter chips */}
        <div className={cn("sm:col-span-4 -mb-1", mobileFiltersOpen ? "" : "hidden sm:block") }>
          <div className="mt-1 flex items-center gap-2 overflow-x-auto no-scrollbar relative" ref={categoryChipsContainerRef}>
            <button
              onClick={() => setCategoryFilter("all")}
              ref={(el) => { categoryChipRefs.current.set("all", el); }}
              className={cn("rounded-full px-3 py-1.5 text-xs ring-1 ring-inset", categoryFilter === "all" ? "bg-white/12 ring-white/20" : "bg-white/5 ring-white/10")}
            >
              All categories
            </button>
            {(categories ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                ref={(el) => { categoryChipRefs.current.set(c.id, el); }}
                className={cn("rounded-full px-3 py-1.5 text-xs ring-1 ring-inset", categoryFilter === c.id ? "bg-white/12 ring-white/20" : "bg-white/5 ring-white/10")}
              >
                {c.name}
              </button>
            ))}
            <motion.span
              className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-zinc-800/50 dark:bg-white/60"
              animate={{ left: categoryUnderline.left, width: categoryUnderline.width }}
              transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.25 }}
            />
          </div>
        </div>
        {/* Sticky totals */}
        <div className="sm:col-span-4 grid grid-cols-3 gap-2 mt-1">
          <div className="rounded-md bg-white/10 ring-1 ring-inset ring-white/10 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Income</div>
            <div className="text-sm font-medium text-emerald-500">{formatCurrency(totals.inc, currency, locale)}</div>
          </div>
          <div className="rounded-md bg-white/10 ring-1 ring-inset ring-white/10 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Expense</div>
            <div className="text-sm font-medium text-rose-500">{formatCurrency(totals.exp, currency, locale)}</div>
          </div>
          <div className="rounded-md bg-white/10 ring-1 ring-inset ring-white/10 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Net</div>
            <div className="text-sm font-medium">{formatCurrency(totals.net, currency, locale)}</div>
          </div>
        </div>
      </div>
      <></>

      

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
        {selectedIds.size > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 bg-white/60 dark:bg-zinc-900/60 backdrop-blur border-b border-zinc-200/60 dark:border-zinc-800">
            <div className="text-sm">{selectedIds.size} selected</div>
            <div className="sm:ml-auto flex items-center gap-2">
              <button onClick={() => { const ids = Array.from(selectedIds); bulkDeleteMutation.mutate(ids); }} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900">Delete selected</button>
              <div className="flex items-center gap-2">
                <select value={bulkType} onChange={(e) => setBulkType(e.target.value as any)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-xs">
                  <option value="">Type…</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
                <select value={bulkAccountId} onChange={(e) => setBulkAccountId(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-xs">
                  <option value="">Account…</option>
                  {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-xs">
                  <option value="">Category…</option>
                  {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => bulkApplyEdit()} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900">Apply</button>
                <button onClick={clearSelection} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900">Clear</button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="bg-zinc-50/80 dark:bg-zinc-900/60 px-3 py-2 text-sm font-medium grid grid-cols-5 sm:grid-cols-6 relative">
          <div>
            <input type="checkbox" onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()} checked={selectedIds.size > 0 && selectedIds.size === txs.length} aria-label="Select all" />
          </div>
          <div>Date</div>
          <div>Account</div>
          <div>Category</div>
          <div className="text-right">Amount</div>
          <div className="hidden sm:block"></div>
          <span className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </div>
        <div
          ref={parentRef}
          className="relative h-[60vh] overflow-auto"
          tabIndex={0}
          onKeyDown={onListKeyDown}
        >
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const t = txs[vi.index];
              const isChecked = selectedIds.has(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedIndex(vi.index)}
                  className={cn(
                    "grid grid-cols-5 sm:grid-cols-6 items-center border-t border-zinc-200/60 dark:border-zinc-800 px-3 py-2 text-sm transition-colors",
                    "hover:bg-white/60 dark:hover:bg-zinc-900/60 hover:shadow-sm",
                    selectedIndex === vi.index && "bg-[hsl(var(--accent)/0.05)] ring-1 ring-[hsl(var(--accent)/0.3)]"
                  )}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)` }}
                  onTouchStart={(e: any) => { (e.currentTarget as any)._sx = e.touches[0].clientX; }}
                  onTouchEnd={(e: any) => { const sx = (e.currentTarget as any)._sx || 0; const dx = (e.changedTouches?.[0]?.clientX || 0) - sx; if (dx <= -60) startEdit(t); if (dx >= 60) deleteMutation.mutate(t.id); }}
                >
                  {editingId === t.id ? (
                    <>
                      <div>
                        <input type="checkbox" checked={isChecked} onChange={(e) => handleRowCheckClick(vi.index, t.id, e)} aria-label="Select row" />
                      </div>
                      <div>
                        <input type="date" {...editForm.register("date")} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <select {...editForm.register("account_id")} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                          {(accounts ?? []).map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <select {...editForm.register("category_id")} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                          {editAvailableCategories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="text-right">
                        <input type="number" inputMode="decimal" {...editForm.register("amount")} className="w-28 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm text-right" />
                      </div>
                      <div className="hidden sm:flex justify-end gap-2">
                        <button
                          onClick={applyRulesToEditForm}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        >
                          Apply rules
                        </button>
                        <button
                          onClick={() => editForm.handleSubmit((v) => updateMutation.mutate({ id: t.id, ...(v as TxForm) }))()}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <input type="checkbox" checked={isChecked} onChange={(e) => handleRowCheckClick(vi.index, t.id, e)} aria-label="Select row" />
                      </div>
                      <div>{t.date}</div>
                      <div>{t.accounts?.name ?? "-"}</div>
                      <div className="flex items-center gap-2">
                        <span>{t.categories?.name ?? "-"}</span>
                        {t.notes ? (
                          <span title={t.notes}>
                            <FileText className="h-3.5 w-3.5 text-zinc-400" />
                          </span>
                        ) : null}
                        {t.attachment_url ? (
                          <button
                            type="button"
                            className="text-zinc-400 hover:text-zinc-600"
                            title="Preview attachment"
                            onClick={(e) => { e.stopPropagation(); openAttachmentPreview(t.attachment_url as string, e.currentTarget as HTMLElement); }}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {(() => {
                          let count = matchedCountCache.current.get(t.id);
                          if (count === undefined) {
                            const traced = applySmartRulesWithTrace(
                              {
                                date: t.date,
                                amount: Number(t.amount || 0),
                                type: t.type,
                                notes: t.notes || null,
                                account_id: t.account_id,
                                category_id: t.category_id || "",
                              },
                              rulesPreview,
                              { categories: categories ?? [], accounts: accounts ?? [] }
                            );
                            count = traced.matched.length;
                            matchedCountCache.current.set(t.id, count);
                          }
                          return count && count > 0 ? (
                            <span className="text-[10px] text-emerald-600">{count} rule(s)</span>
                          ) : null;
                        })()}
                      </div>
                      <div className={cn("text-right font-medium", t.type === "income" ? "text-emerald-600" : "text-rose-600")}
                      >
                        {(() => {
                          const signedOriginal = (t.type === "expense" ? -1 : 1) * Number(t.amount || 0);
                          const signedConverted = (t.type === "expense" ? -1 : 1) * conv(Number(t.amount || 0), t.currency as any, String(t.date));
                          const missing = t.currency && t.currency !== currency && (convertFx(1, t.currency as any, currency, String(t.date)) == null);
                          return (
                            <div className="flex flex-col items-end leading-tight">
                              <div className="inline-flex items-center gap-1">{formatCurrency(signedConverted, currency, locale)}{missing ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" title="No FX rate for this date; treated as 0" /> : null}</div>
                              {showDualEffective && t.currency && t.currency !== currency ? (
                                <div className="text-[10px] text-zinc-500 tabular">{formatCurrency(signedOriginal, t.currency as any, locale)}</div>
                              ) : null}
                              {t.id.startsWith("temp-") ? <div className="text-[10px] text-zinc-500">Pending…</div> : null}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="hidden sm:flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(t)}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(t.id)}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {isFetching ? (
            <div className="absolute inset-x-0 bottom-2 text-center text-zinc-500 text-xs">Loading…</div>
          ) : (txs ?? []).length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500">No transactions found</div>
          ) : null}
        </div>
      </div>
      {attachmentPreview ? (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="attachment-title">
          <div className="absolute inset-0 bg-black/40" onClick={closeAttachmentPreview} />
          <div className="absolute inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-10 bottom-10 max-w-[90vw] sm:w-[min(900px,90vw)] rounded-2xl bg-white/95 dark:bg-zinc-950/95 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden shadow-xl outline-none" tabIndex={-1} ref={modalRef}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200/60 dark:border-zinc-800">
              <div id="attachment-title" className="text-sm font-medium truncate max-w-[70%]">Attachment</div>
              <div className="flex items-center gap-2">
                {/* Zoom controls for images */}
                {(() => {
                  const url = String(attachmentPreview);
                  const isImg = /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif)$/i.test(url);
                  return isImg ? (
                    <div className="hidden sm:flex items-center gap-1">
                      <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs">−</button>
                      <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs">+</button>
                      <button onClick={() => setZoom(1)} className="ml-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs">Reset</button>
                    </div>
                  ) : null;
                })()}
                <a href={attachmentPreview} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">Open in new tab</a>
                <button onClick={closeAttachmentPreview} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900">Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
