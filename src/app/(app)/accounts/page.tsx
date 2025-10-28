import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountsManager from "@/components/accounts-manager";

export default async function AccountsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold">Accounts</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Manage wallets, bank and credit accounts</p>
      <div className="mt-4">
        <AccountsManager />
      </div>
    </div>
  );
}
