import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SubscriptionsClient from "./subscriptions-client";
import FabMenu from "@/components/fab-menu";

export default async function SubscriptionsPage() {
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

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id,name,amount,interval,every,next_charge_date,account_id,category_id,active,auto_post,accounts:account_id(name),categories:category_id(name)")
    .order("next_charge_date", { ascending: true });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Subscriptions</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Track recurring charges</p>
      <div className="mt-6">
        <SubscriptionsClient currency={profile.currency ?? "USD"} locale={profile.locale ?? "en-US"} startOfMonth={profile.start_of_month ?? 1} initialSubs={(subs as any) ?? []} />
      </div>
      <FabMenu />
    </div>
  );
}
