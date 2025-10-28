"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/nav-items";

export default function MobileTabBar() {
  const pathname = usePathname();
  const items = navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur" aria-label="Primary">
      <ul className="flex items-center justify-around px-2 py-2 pb-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400",
                  active && "text-zinc-900 dark:text-zinc-100"
                )}
                aria-current={active ? "page" : undefined}
              >
                <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", active && "nav-active-glow ring-1 ring-cyan-400/40")}>
                  <Icon className={cn("h-5 w-5", active ? "" : "opacity-70")} aria-hidden />
                </div>
                <span className="text-[11px] leading-none">{label}</span>
                {active ? <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[hsl(var(--accent))] tiny-progress-dot" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
