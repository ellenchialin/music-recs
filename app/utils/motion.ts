import type { Transition } from "motion-v";

// Shared motion settings: change the feel here and every interaction follows
export const spring = {
  smooth: { type: "spring", stiffness: 260, damping: 30 },
  snappy: { type: "spring", stiffness: 500, damping: 28 },
} satisfies Record<string, Transition>;

// Seconds between staggered items
export const staggerStep = 0.06;

// For <motion.div v-bind="fadeUp">
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};
