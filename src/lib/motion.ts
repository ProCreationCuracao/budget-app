export const page = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

export const card = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.18 } },
};

export const listItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.16 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14 } },
};

export const modal = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.16 } },
};

export const ringSweep = {
  initial: { '--pct': 0 } as any,
  animate: (pct: number) => ({ '--pct': pct } as any),
};

export const chip = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.12 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.1 } },
};

export const fab = {
  rest: { scale: 1, boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
  hover: { scale: 1.03, transition: { duration: 0.12 } },
  press: { scale: 0.98, transition: { duration: 0.08 } },
};

export const sheet = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] } },
  exit: { opacity: 0, y: 24, transition: { duration: 0.18 } },
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.18 } },
    exit: { opacity: 0, transition: { duration: 0.14 } },
  },
};

export const stagger = (delay = 0.04) => ({
  animate: { transition: { staggerChildren: delay } },
});
