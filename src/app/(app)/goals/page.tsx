import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GoalsClient from "./goals-client";
import FabMenu from "@/components/fab-menu";

export default async function GoalsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, currency, locale, start_of_month")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.display_name) redirect("/onboarding");

  const { data: goals } = await supabase
    .from("goals")
    .select("id,name,target_amount,target_date")
    .order("created_at", { ascending: false });

  const { data: contribs } = await supabase
    .from("goal_contributions")
    .select("id,goal_id,date,amount")
    .order("date", { ascending: false })
    .limit(5000);

  const now = new Date();
  const som = Math.min(Math.max((profile.start_of_month as number | null) ?? 1, 1), 28);
  const currentSomDate = new Date(now.getFullYear(), now.getMonth(), som);
  const baseStart = now >= currentSomDate ? currentSomDate : new Date(now.getFullYear(), now.getMonth() - 1, som);
  const nextStart = new Date(baseStart.getFullYear(), baseStart.getMonth() + 1, som);
  const startStr = baseStart.toISOString().slice(0, 10);
  const nextStartStr = nextStart.toISOString().slice(0, 10);
  const initialPeriodTotals: Record<string, number> = {};
  for (const c of contribs ?? []) {
    const d = (c as any).date as string;
    if (d >= startStr && d < nextStartStr) {
      const gid = (c as any).goal_id as string;
      initialPeriodTotals[gid] = (initialPeriodTotals[gid] ?? 0) + Number((c as any).amount || 0);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Goals</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Save toward your targets</p>
      <div className="mt-6">
        <GoalsClient currency={profile.currency ?? "USD"} locale={profile.locale ?? "en-US"} startOfMonth={profile.start_of_month ?? 1} initialGoals={(goals as any) ?? []} initialContribs={(contribs as any) ?? []} initialPeriodTotals={initialPeriodTotals} />
      </div>
      <FabMenu />
    </div>
  );
}
