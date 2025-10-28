import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, currency, locale, start_of_month, theme, show_dual_currency")
    .eq("id", session.user.id)
    .single();

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Manage your preferences</p>
      <div className="mt-4">
        <SettingsClient
          initialDisplayName={profile?.display_name ?? ""}
          email={session.user.email ?? ""}
          currency={profile?.currency ?? "USD"}
          locale={profile?.locale ?? "en-US"}
          startOfMonth={(profile?.start_of_month as number | undefined) ?? 1}
          initialTheme={(profile?.theme as string | undefined) ?? "system"}
          initialShowDualCurrency={!!profile?.show_dual_currency}
        />
      </div>
    </div>
  );
}
