import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TransactionsClient from "./transactions-client";
import CsvImport from "./csv-import";

export default async function TransactionsPage() {
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
  const som = Math.min(Math.max((profile?.start_of_month as number | null) ?? 1, 1), 28);
  const currentSomDate = new Date(now.getFullYear(), now.getMonth(), som);
  const baseStart = now >= currentSomDate ? currentSomDate : new Date(now.getFullYear(), now.getMonth() - 1, som);
  const end = new Date(baseStart.getFullYear(), baseStart.getMonth() + 1, som - 1);
  const initialDateFrom = baseStart.toISOString().slice(0, 10);
  const initialDateTo = end.toISOString().slice(0, 10);

  const { data: initialAccounts } = await supabase
    .from("accounts")
    .select("id,name,type,currency")
    .eq("scope", profile.scope)
    .order("created_at", { ascending: true });

  const { data: initialCategories } = await supabase
    .from("categories")
    .select("id,name,type")
    .eq("scope", profile.scope)
    .order("name");

  const { data: initialTxs } = await supabase
    .from("transactions")
    .select("id,date,amount,type,currency,notes,attachment_url,account_id,category_id,accounts:account_id(name),categories:category_id(name)")
    .eq("scope", profile.scope)
    .gte("date", initialDateFrom)
    .lte("date", initialDateTo)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Manage and analyze your activity</p>
      <div className="mt-6">
        <div className="mb-6">
          <CsvImport currency={profile.currency ?? "USD"} locale={profile.locale ?? "en-US"} />
        </div>
        <TransactionsClient
          currency={profile.currency ?? "USD"}
          locale={profile.locale ?? "en-US"}
          startOfMonth={profile.start_of_month ?? 1}
          initialAccounts={(initialAccounts as any) ?? []}
          initialCategories={(initialCategories as any) ?? []}
          initialTxs={(initialTxs as any) ?? []}
          initialDateFrom={initialDateFrom}
          initialDateTo={initialDateTo}
        />
      </div>
      {/* Page-local FAB is implemented inside TransactionsClient */}
    </div>
  );
}
