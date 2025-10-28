"use client";

import { useEffect } from "react";

export default function NumericKeypad({ value, onChange, onSubmit, className }: { value: string; onChange: (v: string) => void; onSubmit?: () => void; className?: string; }) {
  function tap(k: string) {
    if (k === "del") {
      onChange(value.slice(0, -1));
    } else if (k === "ok") {
      onSubmit?.();
    } else if (k === ".") {
      if (!value.includes(".")) onChange(value ? value + "." : "0.");
    } else {
      onChange((value || "") + k);
    }
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const k = e.key;
      if ((k >= "0" && k <= "9") || k === ".") { e.preventDefault(); tap(k); }
      if (k === "Backspace") { e.preventDefault(); tap("del"); }
      if (k === "Enter") { e.preventDefault(); onSubmit?.(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onSubmit]);
  const keys = ["1","2","3","4","5","6","7","8","9",".","0","del"] as const;
  return (
    <div className={"grid grid-cols-3 gap-2 " + (className || "") }>
      {keys.map((k) => (
        <button key={k} onClick={() => tap(k)} className="rounded-md bg-white/70 dark:bg-zinc-900/60 backdrop-blur border border-zinc-200/60 dark:border-zinc-800 py-2 text-lg font-medium">
          {k === "del" ? "⌫" : k}
        </button>
      ))}
      {onSubmit ? (
        <button onClick={() => tap("ok")} className="col-span-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white py-2 font-medium">OK</button>
      ) : null}
    </div>
  );
}
