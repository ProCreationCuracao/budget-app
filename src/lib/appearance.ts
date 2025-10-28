"use client";

export type AccentName = "purple" | "aqua" | "emerald";

export function setAccent(name: AccentName) {
  try {
    localStorage.setItem("accent", name);
  } catch {}
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-accent", name);
    try { window.dispatchEvent(new CustomEvent("app:accent-changed", { detail: { accent: name } })); } catch {}
  }
}

export function setReducedMotion(enabled: boolean) {
  try {
    localStorage.setItem("reduced-motion", enabled ? "1" : "0");
  } catch {}
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-reduced-motion", enabled ? "1" : "0");
    try { window.dispatchEvent(new CustomEvent("app:reduced-motion-changed", { detail: { enabled } })); } catch {}
  }
}

export function hydrateAppearanceFromStorage() {
  if (typeof document === "undefined") return;
  try {
    const acc = (localStorage.getItem("accent") as AccentName | null) ?? null;
    if (acc) document.documentElement.setAttribute("data-accent", acc);
    const rm = localStorage.getItem("reduced-motion");
    if (rm != null) document.documentElement.setAttribute("data-reduced-motion", rm);
  } catch {}
}
