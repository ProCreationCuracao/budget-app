import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BudgetsClient from "./budgets-client";
import { buildFxConverter } from "@/lib/fx";
import FabMenu from "@/components/fab-menu";

export default async function BudgetsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, currency, locale, start_of_month, scope")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.display_name) redirect("/onboarding");

  const now = new Date();
  const som = Math.min(Math.max((profile.start_of_month as number | null) ?? 1, 1), 28);
  const currentSomDate = new Date(now.getFullYear(), now.getMonth(), som);
  const baseStart = now >= currentSomDate ? currentSomDate : new Date(now.getFullYear(), now.getMonth() - 1, som);
  const nextStart = new Date(baseStart.getFullYear(), baseStart.getMonth() + 1, som);
  const startStr = baseStart.toISOString().slice(0, 10);
  const nextStartStr = nextStart.toISOString().slice(0, 10);

  const { data: budgetsData } = await supabase
    .from("budgets")
    .select("id,name,amount,category_id,categories:category_id(name)")
    .eq("scope", profile.scope)
    .order("created_at", { ascending: false });

  const { data: periodTxs } = await supabase
    .from("transactions")
    .select("category_id, amount, type, date, currency")
    .eq("scope", profile.scope)
    .eq("type", "expense")
    .gte("date", startStr)
    .lt("date", nextStartStr);

  // Fetch FX and build converter to profile currency
  const { data: fxRows } = await supabase
    .from("fx_rates")
    .select("date,from_currency,to_currency,rate")
    .eq("user_id", session.user.id);
  const convertFx = buildFxConverter((fxRows || []) as any);
  const baseCurrency = ((profile?.currency as string | null) ?? "USD").toUpperCase();
  function conv(amount: number, from: string | null | undefined, dateISO: string): number {
    const src = (from || baseCurrency).toUpperCase();
    const v = convertFx(amount, src, baseCurrency, dateISO);
    if (v == null) return src === baseCurrency ? amount : 0;
    return v;
  }

  const initialSpent: Record<string, number> = {};
  for (const t of periodTxs ?? []) {
    const cid = (t as any).category_id as string | null;
    if (!cid) continue;
    initialSpent[cid] = (initialSpent[cid] ?? 0) + conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date));
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Budgets</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Plan your spending by category</p>
      <div className="mt-6">
        <BudgetsClient currency={profile.currency ?? "USD"} locale={profile.locale ?? "en-US"} startOfMonth={profile.start_of_month ?? 1} initialBudgets={(budgetsData as any) ?? []} initialSpent={initialSpent} />
      </div>
      <FabMenu />
    </div>
  );
}
