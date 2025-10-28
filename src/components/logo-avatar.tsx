"use client";

import { motion } from "framer-motion";

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

export default function LogoAvatar({ logoUrl, name }: { logoUrl?: string | null; name: string }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const domain = !logoUrl ? brandDomain(name) : "";
  const derived = !logoUrl && domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";
  if (logoUrl || derived) {
    return (
      <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.16, ease: [0.22,1,0.36,1] as any }} className="inline-flex items-center justify-center h-6 w-6 rounded-md overflow-hidden ring-1 ring-inset ring-black/10 dark:ring-white/10 bg-white/90 dark:bg-zinc-900/90">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || derived} alt="" className="h-full w-full object-cover" />
      </motion.span>
    );
  }
  // Colored initial fallback
  const hue = (letter.charCodeAt(0) * 29) % 360;
  const bg = `hsl(${hue} 70% 45%)`;
  return (
    <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.16, ease: [0.22,1,0.36,1] as any }} className="inline-flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-semibold text-white ring-1 ring-inset ring-black/10" style={{ background: bg }} aria-hidden>
      {letter}
    </motion.span>
  );
}
