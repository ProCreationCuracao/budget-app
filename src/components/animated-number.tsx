"use client";

import { animate, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export default function AnimatedNumber({
  value,
  format,
  duration = 0.6,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const mv = useMotionValue(0);
  const prev = useRef(0);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      onUpdate: (v) => mv.set(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, mv]);

  useEffect(() => {
    setDisplay(mv.get());
    const unsub = mv.on("change", (v) => setDisplay(v as number));
    return () => unsub();
  }, [mv]);

  return <span aria-live="polite" aria-atomic="true">{format(display)}</span>;
}
