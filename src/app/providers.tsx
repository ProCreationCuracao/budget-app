"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const attr = document.documentElement.getAttribute("data-reduced-motion");
      setReduced(attr === "1");
      const onChange = (e: Event) => {
        const detail = (e as CustomEvent).detail as any;
        if (typeof detail?.enabled === "boolean") setReduced(detail.enabled);
      };
      window.addEventListener("app:reduced-motion-changed", onChange as any);
      return () => window.removeEventListener("app:reduced-motion-changed", onChange as any);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      const onLoad = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .catch(() => {});
      };
      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
