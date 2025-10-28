"use client";

import { useEffect } from "react";
import { hydrateAppearanceFromStorage } from "@/lib/appearance";

export default function AppearanceHydrate() {
  useEffect(() => {
    hydrateAppearanceFromStorage();
    try {
      function setThemeMeta() {
        try {
          let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            document.head.appendChild(meta);
          }
          const root = document.documentElement;
          const style = getComputedStyle(root);
          const acc = style.getPropertyValue('--accent').trim();
          const color = acc ? `hsl(${acc})` : '#0ea5e9';
          meta.setAttribute('content', color);
        } catch {}
      }
      setThemeMeta();
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.attributeName === 'data-accent' || m.attributeName === 'class') {
            setThemeMeta();
          }
        }
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'class'] });
      return () => obs.disconnect();
    } catch {}
  }, []);
  return null;
}
