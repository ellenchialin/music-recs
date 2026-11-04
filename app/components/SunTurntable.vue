<script setup lang="ts">
import { motion } from "motion-v";

// 青綠太陽圓＋黑膠唱盤（純裝飾）。大小由外層決定：外層要是正方形，這裡填滿它。
// 首頁的右欄、推薦頁的載入狀態都用它
// recordDelay：太陽圓出現後，唱盤晚多久才放大出現（首頁要等左邊的字先進場）
withDefaults(defineProps<{ recordDelay?: number }>(), { recordDelay: 0.2 });
</script>

<template>
  <div class="relative size-full">
    <motion.div
      aria-hidden="true"
      class="absolute inset-0 rounded-full bg-teal"
      :initial="{ scale: 0.6, opacity: 0 }"
      :animate="{ scale: 1, opacity: 1 }"
      :transition="spring.smooth"
    />
    <motion.div
      class="absolute inset-0 flex items-center justify-center"
      :initial="{ opacity: 0, scale: 0.6 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ ...spring.smooth, delay: recordDelay }"
    >
      <VinylRecord />
    </motion.div>
  </div>
</template>
