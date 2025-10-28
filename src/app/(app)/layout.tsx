import Link from "next/link";
import { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MobileTabBar from "@/components/mobile-tab-bar";
import FabMenu from "@/components/fab-menu";
import { Settings } from "lucide-react";
import ToastHost from "@/components/toast";
import QueueSyncOnMount from "@/components/queue-sync-on-mount";
import AppearanceHydrate from "@/components/appearance-hydrate";
import DesktopTopNav from "@/components/desktop-top-nav";
import NotificationsBell from "@/components/notifications-bell";
import OverviewScopeSwitcher from "@/components/overview-scope-switcher";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <div className="min-h-screen">
      <header className="hero text-white px-4 py-3 flex items-center justify-between">
        <Link href="/settings" aria-label="Settings" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 shadow-sm flex items-center justify-center">
          <Settings className="h-5 w-5" />
        </Link>
        <OverviewScopeSwitcher />
        <div className="flex items-center gap-2">
          <NotificationsBell />
          {session ? (
            <form action={signOut}>
              <button type="submit" className="hidden sm:inline-flex rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-3 py-1.5 text-sm">Sign out</button>
            </form>
          ) : null}
        </div>
      </header>
      <DesktopTopNav />
      <main className="pb-20 sm:pb-0">{children}</main>
      <ToastHost />
      <AppearanceHydrate />
      <QueueSyncOnMount />
      <FabMenu />
      <MobileTabBar />
    </div>
  );
}
