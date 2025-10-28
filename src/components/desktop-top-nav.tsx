"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { navItems } from "@/components/nav-items";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DesktopTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const items = navItems;
  const supabase = createSupabaseBrowserClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const ulRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [underline, setUnderline] = useState<{ left: number; width: number; visible: boolean }>({ left: 0, width: 0, visible: false });

  useEffect(() => {
    const active = items.find((it) => pathname === it.href || pathname?.startsWith(it.href + "/"));
    const el = active ? linkRefs.current[active.href] : null;
    const parent = ulRef.current;
    if (!el || !parent) { setUnderline((u) => ({ ...u, visible: false })); return; }
    const elRect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const left = elRect.left - parentRect.left + 8; // small inset
    const width = elRect.width - 16; // match inset
    setUnderline({ left, width, visible: true });
  }, [pathname, items]);

  // Keyboard shortcuts: Alt+1..5 to navigate
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      const k = e.key;
      if (k < "1" || k > "5") return;
      // avoid when focused in input/textarea or editable
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || "").toLowerCase();
      const editable = (target as any)?.isContentEditable;
      if (tag === "input" || tag === "textarea" || editable) return;
      const idx = Number(k) - 1;
      const dest = items[idx]?.href;
      if (dest) {
        e.preventDefault();
        router.push(dest);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, router]);

  useEffect(() => {
    function onResize() {
      const ev = new Event("resize-active-underline");
      // trigger recalculation
      const active = items.find((it) => pathname === it.href || pathname?.startsWith(it.href + "/"));
      const el = active ? linkRefs.current[active.href] : null;
      const parent = ulRef.current;
      if (!el || !parent) return;
      const elRect = el.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      const left = elRect.left - parentRect.left + 8;
      const width = elRect.width - 16;
      setUnderline((u) => ({ ...u, left, width }));
      return ev;
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pathname, items]);

  return (
    <nav className="hidden sm:block border-b border-zinc-200/60 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/40 backdrop-blur" aria-label="Primary">
      <ul ref={ulRef} className="relative mx-auto max-w-6xl flex items-center gap-2 px-4 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                ref={(el) => { linkRefs.current[href] = el; }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm",
                  active
                    ? "text-zinc-900 dark:text-zinc-100 bg-white/70 dark:bg-zinc-900/50 ring-1 ring-inset ring-[hsl(var(--accent)/0.3)]"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-white/40 dark:hover:bg-zinc-900/40"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("h-4 w-4", active ? "" : "opacity-70")} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="ml-auto relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 100)}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white/40 dark:hover:bg-zinc-900/40 ring-1 ring-inset ring-transparent hover:ring-white/10"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="inline-block h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 ring-2 ring-white/40" aria-hidden />
            <span className="hidden md:inline">Account</span>
          </button>
          {menuOpen ? (
            <div role="menu" className="absolute right-0 mt-1 w-40 rounded-md border border-white/10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur shadow-lg p-1 text-sm">
              <a href="/settings" className="block rounded-md px-2 py-1.5 hover:bg-white/50 dark:hover:bg-zinc-900/60">Settings</a>
              <button
                onClick={async () => { try { await supabase.auth.signOut(); window.location.href = "/login"; } catch {} }}
                className="w-full text-left rounded-md px-2 py-1.5 hover:bg-white/50 dark:hover:bg-zinc-900/60"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </li>
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-[hsl(var(--accent))] shadow-[0_0_12px_hsl(var(--accent)/0.55)]"
          style={{
            left: underline.left,
            width: underline.width,
            opacity: underline.visible ? 1 : 0,
            transition: "left 240ms cubic-bezier(.2,.8,.2,1), width 240ms cubic-bezier(.2,.8,.2,1), opacity 160ms",
          }}
        />
      </ul>
    </nav>
  );
}
