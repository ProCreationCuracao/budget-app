import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { buildFxConverter } from "@/lib/fx";
import Link from "next/link";
import Sparkline from "@/components/sparkline";
import PageMotion from "@/components/page-motion";
import BudgetRing from "@/components/budget-ring";
import MonthSpendCardClient from "@/components/month-spend-card.client";
import AccountsCarousel from "@/components/accounts-carousel";
import LogoAvatar from "@/components/logo-avatar";
import RecentListSection from "@/components/recent-list-section.client";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, currency, locale, start_of_month, scope, show_dual_currency")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.display_name) {
    redirect("/onboarding");
  }
  const showDual = !!(profile as any)?.show_dual_currency;
  // Note: override via localStorage is handled client-side; dual-display header toggle lives in the UI component below.

  // Stabilize formatting inputs for SSR/CSR parity
  const userCurrency = (profile.currency as string | null) ?? "USD";
  const userLocale = (profile.locale as string | null) ?? "en-US";
  let effectiveCurrency = userCurrency;
  let effectiveLocale = userLocale;
  try {
    // If Intl rejects the provided currency/locale on the server, fall back to safe defaults
    new Intl.NumberFormat(userLocale, { style: "currency", currency: userCurrency }).format(0);
  } catch {
    effectiveCurrency = "USD";
    effectiveLocale = "en-US";
  }

  // FX rates and converter to profile currency
  const { data: fxRows } = await supabase
    .from("fx_rates")
    .select("date,from_currency,to_currency,rate")
    .eq("user_id", session.user.id);
  const convertFx = buildFxConverter((fxRows || []) as any);
  function conv(amount: number, from: string | null | undefined, dateISO: string): number {
    const src = (from || effectiveCurrency).toUpperCase();
    const v = convertFx(amount, src, effectiveCurrency, dateISO);
    if (v == null) return src === effectiveCurrency ? amount : 0;
    return v;
  }

  // Determine current budget period based on user's start_of_month preference (1..28)
  const now = new Date();
  const som = Math.min(Math.max(profile.start_of_month ?? 1, 1), 28);
  const currentSomDate = new Date(now.getFullYear(), now.getMonth(), som);
  const periodStart = now >= currentSomDate
    ? currentSomDate
    : new Date(now.getFullYear(), now.getMonth() - 1, som);
  const nextPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, som);
  const startStr = periodStart.toISOString().slice(0, 10);
  const nextStartStr = nextPeriodStart.toISOString().slice(0, 10);
  const prevPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, som);
  const prevStartStr = prevPeriodStart.toISOString().slice(0, 10);

  // Fetch this period's transactions and compute metrics
  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, type, date, category_id, currency")
    .eq("scope", profile.scope)
    .gte("date", startStr)
    .lt("date", nextStartStr);
  const { data: txsPrev } = await supabase
    .from("transactions")
    .select("amount, type, date, category_id, currency")
    .eq("scope", profile.scope)
    .gte("date", prevStartStr)
    .lt("date", startStr);

  const income = (txs || [])
    .filter((t) => t.type === "income")
    .reduce((sum, t: any) => sum + conv(Number(t.amount || 0), t.currency, String(t.date)), 0);
  const expense = (txs || [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t: any) => sum + conv(Number(t.amount || 0), t.currency, String(t.date)), 0);
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) : 0;

  const incomePrev = (txsPrev || [])
    .filter((t) => t.type === "income")
    .reduce((sum, t: any) => sum + conv(Number(t.amount || 0), t.currency, String(t.date)), 0);
  const expensePrev = (txsPrev || [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t: any) => sum + conv(Number(t.amount || 0), t.currency, String(t.date)), 0);
  const netPrev = incomePrev - expensePrev;
  const savingsPrev = incomePrev > 0 ? (netPrev / incomePrev) : 0;

  function pctDelta(current: number, prev: number) {
    if (!isFinite(prev) || prev === 0) return null;
    return (current - prev) / Math.abs(prev);
  }
  function deltaText(d: number | null) {
    if (d === null) return "";
    const v = Math.round(d * 100);
    if (!isFinite(v)) return "";
    return `${v >= 0 ? "+" : ""}${v}%`;
  }
  function deltaClass(d: number | null, invert = false) {
    if (d === null) return "text-zinc-500";
    const positive = d >= 0;
    const good = invert ? !positive : positive;
    return good ? "text-emerald-600" : "text-rose-600";
  }
  const incomeDelta = pctDelta(income, incomePrev);
  const expenseDelta = pctDelta(expense, expensePrev);
  const netDelta = pctDelta(net, netPrev);
  const savingsDelta = pctDelta(savingsRate, savingsPrev);

  function brandDomain(name: string) {
    const key = String(name || "").toLowerCase();
    const map: Record<string, string> = {
      netflix: "netflix.com",
      spotify: "spotify.com",
      apple: "apple.com",
      amazon: "amazon.com",
      adobe: "adobe.com",
      google: "google.com",
      microsoft: "microsoft.com",
      github: "github.com",
      dropbox: "dropbox.com",
      slack: "slack.com",
      notion: "notion.so",
      atlassian: "atlassian.com",
      figma: "figma.com",
      openai: "openai.com",
    };
    for (const k of Object.keys(map)) {
      if (key.includes(k)) return map[k];
    }
    const safe = key.replace(/[^a-z0-9]/g, "");
    return safe ? `${safe}.com` : "";
  }

  // Recent activity: latest 5
  const { data: recent } = await supabase
    .from("transactions")
    .select("id, date, amount, type, currency, notes, categories:category_id(name), accounts:account_id(name)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  const recentItems = (recent || []).map((t: any) => {
    const title = (Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name) ?? "Uncategorized";
    const subtitle = t.notes ?? (Array.isArray(t.accounts) ? t.accounts[0]?.name : t.accounts?.name) ?? "";
    const originalSigned = (t.type === "expense" ? -1 : 1) * Number(t.amount || 0);
    const convertedSigned = (t.type === "expense" ? -1 : 1) * conv(Number(t.amount || 0), (t as any).currency, String(t.date));
    const same = !t.currency || t.currency === effectiveCurrency;
    const missing = !same && (convertFx(1, (t as any).currency, effectiveCurrency, String(t.date)) == null);
    const originalCurrency = (t as any).currency || "USD";
    return { id: t.id as string, title, subtitle, originalSigned, convertedSigned, originalCurrency, same, missing };
  });

  // Build daily series for sparklines
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.max(1, Math.round((nextPeriodStart.getTime() - periodStart.getTime()) / msPerDay));
  const dayStr = (idx: number) => new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + idx).toISOString().slice(0, 10);
  const incomeSeries: number[] = Array.from({ length: days }, (_, i) => 0);
  const expenseSeries: number[] = Array.from({ length: days }, (_, i) => 0);
  const netSeries: number[] = Array.from({ length: days }, (_, i) => 0);
  for (const t of txs || []) {
    const s = String((t as any).date);
    const d = new Date(s);
    const idx = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate())) / msPerDay);
    if (idx >= 0 && idx < days) {
      const amt = conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date));
      if ((t as any).type === "income") incomeSeries[idx] += amt;
      if ((t as any).type === "expense") expenseSeries[idx] += amt;
    }
  }
  for (let i = 0; i < days; i++) netSeries[i] = incomeSeries[i] - expenseSeries[i];
  // cumulative net for area chart
  const netCumulative: number[] = [];
  for (let i = 0; i < days; i++) netCumulative[i] = (netCumulative[i - 1] ?? 0) + netSeries[i];
  const cashflowData = Array.from({ length: days }, (_, i) => {
    const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + i);
    const label = d.toLocaleDateString(profile.locale ?? "en-US", { month: "short", day: "numeric" });
    return { x: label, y: netCumulative[i] };
  });

  // Previous period cumulative net for compare overlay
  const daysPrevLen = Math.max(1, Math.round((periodStart.getTime() - prevPeriodStart.getTime()) / msPerDay));
  const incomePrevSeriesDaily: number[] = Array.from({ length: daysPrevLen }, () => 0);
  const expensePrevSeriesDaily: number[] = Array.from({ length: daysPrevLen }, () => 0);
  for (const t of txsPrev || []) {
    const s = String((t as any).date);
    const d = new Date(s);
    const idx = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(prevPeriodStart.getFullYear(), prevPeriodStart.getMonth(), prevPeriodStart.getDate())) / msPerDay);
    if (idx >= 0 && idx < daysPrevLen) {
      const amt = conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date));
      if ((t as any).type === "income") incomePrevSeriesDaily[idx] += amt;
      if ((t as any).type === "expense") expensePrevSeriesDaily[idx] += amt;
    }
  }
  const netPrevSeriesDaily: number[] = Array.from({ length: daysPrevLen }, (_, i) => (incomePrevSeriesDaily[i] - expensePrevSeriesDaily[i]));
  const netPrevCumulative: number[] = [];
  for (let i = 0; i < daysPrevLen; i++) netPrevCumulative[i] = (netPrevCumulative[i - 1] ?? 0) + netPrevSeriesDaily[i];
  const minLen = Math.min(days, daysPrevLen);
  const cashflowCompareData = Array.from({ length: days }, (_, i) => ({ x: cashflowData[i].x, y: i < minLen ? netPrevCumulative[i] : undefined as any }));

  // Month spend card series for current calendar month
  const calStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const calNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const calStartStr = calStart.toISOString().slice(0, 10);
  const calNextStr = calNext.toISOString().slice(0, 10);
  const { data: txsCal } = await supabase
    .from("transactions")
    .select("amount, type, date, currency")
    .eq("scope", (profile.scope as any))
    .gte("date", calStartStr)
    .lt("date", calNextStr);
  const daysInCal = Math.max(1, Math.round((calNext.getTime() - calStart.getTime()) / msPerDay));
  const expenseSeriesCal: number[] = Array.from({ length: daysInCal }, () => 0);
  for (const t of txsCal || []) {
    if ((t as any).type !== "expense") continue;
    const d = new Date(String((t as any).date));
    const idx = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(calStart.getFullYear(), calStart.getMonth(), calStart.getDate())) / msPerDay);
    if (idx >= 0 && idx < daysInCal) expenseSeriesCal[idx] += conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date));
  }
  const cumExpenseCal: number[] = Array.from({ length: daysInCal }, () => 0);
  for (let i = 0; i < daysInCal; i++) cumExpenseCal[i] = (cumExpenseCal[i - 1] ?? 0) + expenseSeriesCal[i];
  const totalSpentMonth = cumExpenseCal[cumExpenseCal.length - 1] ?? 0;
  const avgPerDay = totalSpentMonth / Math.max(1, daysInCal);
  const avgSeriesCal: number[] = Array.from({ length: daysInCal }, (_, i) => avgPerDay * (i + 1));
  const txCountCal = (txsCal || []).filter((t: any) => t.type === "expense").length;
  // Previous calendar month for MonthSpendCard compare
  const calPrevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const calPrevNext = new Date(now.getFullYear(), now.getMonth(), 1);
  const calPrevStartStr = calPrevStart.toISOString().slice(0, 10);
  const calPrevNextStr = calPrevNext.toISOString().slice(0, 10);
  const { data: txsCalPrev } = await supabase
    .from("transactions")
    .select("amount, type, date, currency")
    .eq("scope", (profile.scope as any))
    .gte("date", calPrevStartStr)
    .lt("date", calPrevNextStr);
  const totalSpentMonthPrev = (txsCalPrev || [])
    .filter((t: any) => t.type === "expense")
    .reduce((s: number, t: any) => s + conv(Number(t.amount || 0), t.currency, String(t.date)), 0);

  // Budget rings: fetch budgets and compute spent per category for this period
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id, name, amount, category_id")
    .eq("scope", profile.scope)
    .order("name", { ascending: true });
  const spentByCat = new Map<string, number>();
  for (const t of txs || []) {
    if ((t as any).type !== "expense") continue;
    const cid = (t as any).category_id as string | null;
    if (!cid) continue;
    spentByCat.set(cid, (spentByCat.get(cid) ?? 0) + conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date)));
  }
  const spentByCatPrev = new Map<string, number>();
  for (const t of (txsPrev || [])) {
    if ((t as any).type !== "expense") continue;
    const cid = (t as any).category_id as string | null;
    if (!cid) continue;
    spentByCatPrev.set(cid, (spentByCatPrev.get(cid) ?? 0) + conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date)));
  }

  // Upcoming subscriptions (active only), robust to legacy schemas
  let subs: any[] = [];
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, name, amount, next_charge_date, interval, every, active, account_id, logo_url, accounts:account_id(name,currency)")
      .eq("active", true)
      .eq("scope", profile.scope)
      .order("next_charge_date", { ascending: true })
      .limit(20);
    if (error) throw error;
    subs = (data as any) ?? [];
  } catch (_e1) {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, name, amount, next_charge_date, interval, every, active, account_id, logo_url, accounts:account_id(name,currency)")
        .eq("active", true)
        .order("next_charge_date", { ascending: true })
        .limit(20);
      if (error) throw error;
      subs = (data as any) ?? [];
    } catch (_e2) {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, name, amount, next_due, frequency, account_id, logo_url, accounts:account_id(name,currency)")
        .eq("active", true)
        .order("next_due", { ascending: true })
        .limit(20);
      if (!error) {
        const rows = (data as any[]) || [];
        const mapFreq = (f: string) => {
          const x = String(f || "monthly");
          if (x === "weekly") return { interval: "week", every: 1 } as const;
          if (x === "monthly") return { interval: "month", every: 1 } as const;
          if (x === "yearly") return { interval: "year", every: 1 } as const;
          if (x === "quarterly") return { interval: "month", every: 3 } as const;
          return { interval: "month", every: 1 } as const;
        };
        subs = rows.map((r) => ({
          id: r.id,
          name: r.name,
          amount: Number(r.amount || 0),
          next_charge_date: r.next_due,
          interval: mapFreq(r.frequency).interval,
          every: mapFreq(r.frequency).every,
          active: true,
          account_id: r.account_id ?? null,
          logo_url: r.logo_url ?? null,
          accounts: r.accounts ?? null,
        }));
      }
    }
  }

  // Insights: top category, avg daily spend (so far), no-spend streak
  const budgetsById = new Map((budgets || []).map((b: any) => [b.category_id, b]));
  let topCatName = "";
  let topCatSpend = 0;
  for (const [cid, amt] of spentByCat.entries()) {
    if (amt > topCatSpend) { topCatSpend = amt; topCatName = budgetsById.get(cid)?.name || ""; }
  }
  let lastExpenseDate: Date | null = null;
  for (const t of txs || []) {
    if ((t as any).type !== "expense") continue;
    const d = new Date(String((t as any).date) + "T00:00:00");
    if (!lastExpenseDate || d > lastExpenseDate) lastExpenseDate = d;
  }
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const streakDays = lastExpenseDate
    ? Math.max(0, Math.floor((Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate()) - Date.UTC(lastExpenseDate.getFullYear(), lastExpenseDate.getMonth(), lastExpenseDate.getDate())) / msPerDay))
    : 0;
  const daysSoFar = Math.max(1, Math.min(days, Math.floor((todayLocal.getTime() - periodStart.getTime()) / msPerDay) + 1));
  const expSoFar = expenseSeries.slice(0, daysSoFar).reduce((s, v) => s + v, 0);
  const avgDailySpend = expSoFar / daysSoFar;

  // This week at a glance
  const weekEnd = todayLocal;
  const weekStart = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate() - 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const weekSpend = (txs || [])
    .filter((t) => t.type === "expense")
    .filter((t) => String((t as any).date) >= weekStartStr && String((t as any).date) <= weekEndStr)
    .reduce((s, t: any) => s + conv(Number((t as any).amount || 0), t.currency, String(t.date)), 0);
  const daysWeekSoFar = Math.max(1, Math.floor((Date.UTC(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate()) - Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())) / msPerDay) + 1);
  const weekAvgPerDay = weekSpend / daysWeekSoFar;
  const budgetsTotal = (budgets || []).reduce((s: number, b: any) => s + Number(b.amount || 0), 0);
  const spentThisPeriod = (txs || [])
    .filter((t) => t.type === "expense")
    .reduce((s, t: any) => s + conv(Number((t as any).amount || 0), t.currency, String(t.date)), 0);
  const remainingBudget = Math.max(0, budgetsTotal - spentThisPeriod);

  // All Accounts Total (starting balances + net transactions)
  const { data: accountsAll } = await supabase
    .from("accounts")
    .select("id, starting_balance, currency")
    .eq("scope", profile.scope);
  const { data: txAll } = await supabase
    .from("transactions")
    .select("amount, type, account_id")
    .eq("scope", profile.scope);
  const deltaByAcc = new Map<string, number>();
  for (const t of (txAll || [])) {
    const k = (t as any).account_id as string;
    const amt = Number((t as any).amount || 0) * ((t as any).type === "income" ? 1 : -1);
    deltaByAcc.set(k, (deltaByAcc.get(k) ?? 0) + amt);
  }
  const todayISO = new Date().toISOString().slice(0, 10);
  const allAccountsTotal = (accountsAll || []).reduce((sum: number, a: any) => {
    const base = Number(a.starting_balance || 0) + (deltaByAcc.get(a.id) ?? 0);
    return sum + conv(base, (a as any).currency, todayISO);
  }, 0);

  return (
    <PageMotion>
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Welcome back</p>
        </div>

      {/* This Week at a Glance */}
      <div className="mt-3 -mb-1 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="This week at a glance">
        <a href={`/transactions?start=${weekStartStr}&end=${weekEndStr}&type=expense`} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20" aria-label="Week spend">
          <span className="text-zinc-600 dark:text-zinc-300">Week spend</span>
          <span className="font-medium">{formatCurrency(weekSpend, effectiveCurrency, effectiveLocale)}</span>
        </a>
        <a href={`/transactions?start=${weekStartStr}&end=${weekEndStr}&type=expense`} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20" aria-label="Average per day">
          <span className="text-zinc-600 dark:text-zinc-300">Avg/day</span>
          <span className="font-medium">{formatCurrency(weekAvgPerDay, effectiveCurrency, effectiveLocale)}</span>
        </a>
        <a href="/budgets" className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20" aria-label="Remaining budget">
          <span className="text-zinc-600 dark:text-zinc-300">Remaining</span>
          <span className="font-medium">{formatCurrency(remainingBudget, effectiveCurrency, effectiveLocale)}</span>
        </a>
      </div>
      </div>

      {/* Month Spend Card */}
      <div className="mt-4">
        <MonthSpendCardClient total={totalSpentMonth} currency={effectiveCurrency} locale={effectiveLocale} cumSeries={cumExpenseCal} avgSeries={avgSeriesCal} txCount={txCountCal} prevTotal={totalSpentMonthPrev} />
      </div>

      {/* Accounts Carousel */}
      <AccountsCarousel currency={effectiveCurrency} locale={effectiveLocale} />

      {/* Smart Insights */}
      <div className="mt-3 -mb-1 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20" aria-label="Top category" title="Top category this period">
          <span className="text-zinc-600 dark:text-zinc-300">Top category</span>
          <span className="font-medium">{topCatName || "—"}</span>
          {topCatSpend > 0 ? <span className="text-zinc-600 dark:text-zinc-400">· {formatCurrency(topCatSpend, effectiveCurrency, effectiveLocale)}</span> : null}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20" aria-label="Average daily spend">
          <span className="text-zinc-600 dark:text-zinc-300">Avg spend</span>
          <span className="font-medium">{formatCurrency(avgDailySpend, effectiveCurrency, effectiveLocale)}/d</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset bg-white/50 dark:bg-zinc-900/50 ring-white/20" aria-label="No-spend streak">
          <span className="text-zinc-600 dark:text-zinc-300">Streak</span>
          <span className="font-medium">{streakDays}d</span>
        </div>
      </div>

      <div className={"mt-4 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"}>
        <KpiCard
          title="All Accounts Total"
          iconKind="net"
          value={formatCurrency(allAccountsTotal, effectiveCurrency, effectiveLocale)}
          animatedValue={allAccountsTotal}
          formatKind="currency"
          currency={effectiveCurrency}
          locale={effectiveLocale}
          subtitle="Assets across all accounts"
        />
        <KpiCard
          title="This Month Spend"
          iconKind="spend"
          value={formatCurrency(totalSpentMonth, effectiveCurrency, effectiveLocale)}
          animatedValue={totalSpentMonth}
          formatKind="currency"
          currency={effectiveCurrency}
          locale={effectiveLocale}
          subtitle={calStart.toLocaleDateString(effectiveLocale, { month: "long" })}
        >
          <Sparkline data={expenseSeriesCal} stroke="hsl(var(--danger))" />
        </KpiCard>
        <KpiCard
          title="Income"
          iconKind="income"
          value={formatCurrency(income, effectiveCurrency, effectiveLocale)}
          animatedValue={income}
          formatKind="currency"
          currency={effectiveCurrency}
          locale={effectiveLocale}
          delta={deltaText(incomeDelta) || undefined}
          deltaClassName={deltaClass(incomeDelta)}
          subtitle="vs last period"
        >
          <Sparkline data={incomeSeries} stroke="hsl(var(--success))" />
        </KpiCard>
        <KpiCard
          title="Savings Rate"
          iconKind="savings"
          value={formatPercent(savingsRate, effectiveLocale)}
          animatedValue={savingsRate}
          formatKind="percent"
          locale={effectiveLocale}
          delta={deltaText(savingsDelta) || undefined}
          deltaClassName={deltaClass(savingsDelta)}
          subtitle="vs last period"
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Recent activity</h2>
          <Link href="/transactions" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">View all</Link>
        </div>
        <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
          <RecentListSection items={recentItems as any} currency={effectiveCurrency} locale={effectiveLocale} showDualDefault={showDual} />
        </div>
      </div>

      {/* Cashflow and heatmap removed as requested */}

      {/* Budget rings */}
      <div className={"mt-6"}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Budgets</h2>
          <Link href="/budgets" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">Manage</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(budgets ?? []).map((b: any) => {
            const curr = spentByCat.get(b.category_id) ?? 0;
            const prev = spentByCatPrev.get(b.category_id) ?? 0;
            const delta = curr - prev;
            const rollover = Math.max(0, Number(b.amount || 0) - prev);
            return (
              <div key={b.id} className="flex flex-col items-center">
                <BudgetRing label={b.name} spent={curr} budget={Number(b.amount || 0)} currency={effectiveCurrency} locale={effectiveLocale} />
                {rollover > 0 ? (
                  <div className="mt-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Rollover +{formatCurrency(rollover, effectiveCurrency, effectiveLocale, { maximumFractionDigits: 0 })}</div>
                ) : null}
                <div className={"mt-1 text-[10px] " + (delta <= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {delta <= 0 ? "−" : "+"}{formatCurrency(Math.abs(delta), effectiveCurrency, effectiveLocale, { maximumFractionDigits: 0 })} vs prev
                </div>
              </div>
            );
          })}
          {(budgets ?? []).length === 0 ? (
            <div className="col-span-2 text-sm text-zinc-500">No budgets yet — add one in Budgets.</div>
          ) : null}
        </div>
      </div>

      {/* Upcoming subscriptions */}
      <div className={"mt-6"}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Upcoming subscriptions</h2>
          <Link href="/subscriptions" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">Manage</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {(subs ?? []).map((s: any) => {
            const days = Math.ceil((new Date(String(s.next_charge_date)).getTime() - new Date().getTime()) / (1000*60*60*24));
            const due = days <= 0 ? "Due" : `Due in ${days}d`;
            const domain = brandDomain(s.name || "");
            const logo = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";
            return (
              <div key={s.id} className="min-w-[240px] rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-2">
                    <LogoAvatar name={s.name} logoUrl={(s.logo_url as any) || logo} />
                    <div className="text-sm font-medium truncate max-w-[160px]" title={s.name}>{s.name}</div>
                  </div>
                  <span className={"text-[10px] px-2 py-0.5 rounded-full " + (days <= 3 ? "bg-amber-500/15 text-amber-600" : "bg-zinc-500/10 text-zinc-600")}>{due}</span>
                </div>
                {(() => {
                  const srcCur = (Array.isArray(s.accounts) ? s.accounts[0]?.currency : s.accounts?.currency) || effectiveCurrency;
                  const converted = conv(Number(s.amount || 0), srcCur, String(s.next_charge_date));
                  const same = !srcCur || srcCur === effectiveCurrency;
                  const missing = !same && (convertFx(1, srcCur, effectiveCurrency, String(s.next_charge_date)) == null);
                  return (
                    <div className="mt-2 text-right leading-tight">
                      <div className="text-lg font-semibold tabular inline-flex items-center justify-end gap-1">
                        {formatCurrency(converted, effectiveCurrency, effectiveLocale)}
                        {missing ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" title="No FX rate for this date; treated as 0" /> : null}
                      </div>
                      {showDual && !same ? (
                        <div className="text-[10px] text-zinc-500 tabular">{formatCurrency(Number(s.amount || 0), srcCur, effectiveLocale)}</div>
                      ) : null}
                    </div>
                  );
                })()}
                <div className="text-xs text-zinc-500">{new Date(String(s.next_charge_date)).toLocaleDateString(effectiveLocale, { month: 'short', day: 'numeric' })}</div>
              </div>
            );
          })}
          {(subs ?? []).length === 0 ? (
            <div className="text-sm text-zinc-500">No upcoming subscriptions</div>
          ) : null}
        </div>
      </div>

      {/* Mobile FAB is rendered globally in app layout */}
    </div>
  </PageMotion>
  );
}
