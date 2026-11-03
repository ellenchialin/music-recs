<script setup lang="ts">
import { motion } from "motion-v";
</script>

<template>
  <main class="relative mx-auto max-w-2xl overflow-hidden px-4 py-16">
    <!-- 背景的紅色斜劃，純裝飾 -->
    <motion.div
      aria-hidden="true"
      class="pointer-events-none absolute -top-10 right-6 h-64 w-1.5 rotate-[24deg] bg-neon-red shadow-glow-red"
      :initial="{ scaleY: 0, opacity: 0 }"
      :animate="{ scaleY: 1, opacity: 1 }"
      :transition="{ ...spring.smooth, delay: staggerStep * 3 }"
    />

    <motion.p
      v-bind="fadeUp"
      :transition="spring.smooth"
      class="inline-block skew-slash bg-neon-yellow px-2 py-0.5 font-mono text-xs font-semibold tracking-[0.25em] text-void uppercase"
    >
      signal found
    </motion.p>
    <motion.h1
      v-bind="fadeUp"
      :transition="{ ...spring.smooth, delay: staggerStep }"
      class="mt-4 font-display text-5xl font-bold tracking-tight text-neon-cyan italic [text-shadow:0_0_18px_rgb(17_196_233/0.45)]"
    >
      Music Recs
    </motion.h1>
    <motion.div
      aria-hidden="true"
      class="mt-3 h-2 w-40 stripes text-neon-red"
      :initial="{ scaleX: 0, originX: 0 }"
      :animate="{ scaleX: 1 }"
      :transition="{ ...spring.smooth, delay: staggerStep * 2 }"
    />
    <motion.p
      v-bind="fadeUp"
      :transition="{ ...spring.smooth, delay: staggerStep * 2 }"
      class="mt-6 clip-corner border-l-2 border-neon-cyan bg-surface px-4 py-3 text-ink-muted"
    >
      輸入喜歡的歌手，拿到附試聽的推薦。
    </motion.p>
  </main>
</template>
