"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode, useMemo } from "react";
import { page as pageVariants } from "@/lib/motion";

export default function PageMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const variants = useMemo(() => {
    if (!reduced) return pageVariants;
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.2 } },
      exit: { opacity: 0, transition: { duration: 0.16 } },
    } as const;
  }, [reduced]);

  return (
    <motion.div initial="initial" animate="animate" exit="exit" variants={variants}>
      {children}
    </motion.div>
  );
}
