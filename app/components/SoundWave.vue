<script setup lang="ts">
import { motion } from "motion-v";

// 等化器式的音浪：幾根深藍直條輪流上下跳，直接畫在青綠太陽圓上。還沒選歌手時取代文字提示
// 每根的高度變化和延遲都不同，看起來才不像同步的節拍器
const bars = [
  { keyframes: [0.35, 1, 0.5, 0.85, 0.35], delay: 0 },
  { keyframes: [0.8, 0.4, 1, 0.55, 0.8], delay: 0.18 },
  { keyframes: [0.5, 0.9, 0.3, 1, 0.5], delay: 0.36 },
  { keyframes: [0.95, 0.55, 0.75, 0.35, 0.95], delay: 0.1 },
  { keyframes: [0.4, 0.7, 1, 0.45, 0.4], delay: 0.27 },
];
</script>

<template>
  <!-- 大小用百分比，跟著太陽圓縮放：寬約圓的一半、高約三分之一，放在圓心附近不會碰到圓邊
       role="img"：整組當成一張圖，螢幕閱讀器只念 aria-label，不念五根直條 -->
  <div role="img" aria-label="還沒有選歌手" class="flex h-[36%] w-[48%] items-end justify-center gap-[7%]">
    <!-- 減少動態效果開啟時（app.vue 的 MotionConfig），直條停在第一個高度，仍然看得出是音浪 -->
    <motion.span
      v-for="(bar, i) in bars"
      :key="i"
      class="h-full flex-1 origin-bottom bg-ink"
      :initial="{ scaleY: bar.keyframes[0] }"
      :animate="{ scaleY: bar.keyframes }"
      :transition="{ duration: 1.4, delay: bar.delay, repeat: Infinity, ease: 'easeInOut' }"
    />
  </div>
</template>
