import type { Transition } from "motion-v";

// 全站共用的動態參數。改手感只改這裡，所有互動一起變。
export const spring = {
  // 一般互動：卡片進場、重新排序
  smooth: { type: "spring", stiffness: 260, damping: 30 },
  // 按鈕按壓、喜歡／不喜歡：短而有彈性
  snappy: { type: "spring", stiffness: 500, damping: 28 },
} satisfies Record<string, Transition>;

// 清單項目依序進場的間隔（秒）
export const staggerStep = 0.06;

// 由下往上淡入，給 <motion.div v-bind="fadeUp"> 用
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};
