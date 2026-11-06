<script setup lang="ts">
import { motion } from "motion-v";

// A ring sector from angle a to b; two of them as highlights make the spin visible
function ringSector(a: number, b: number, inner = 46, outer = 88) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const point = (r: number, deg: number) => `${100 + r * Math.cos(rad(deg))} ${100 + r * Math.sin(rad(deg))}`;
  return `M ${point(outer, a)} A ${outer} ${outer} 0 0 1 ${point(outer, b)} L ${point(inner, b)} A ${inner} ${inner} 0 0 0 ${point(inner, a)} Z`;
}
const shines = [ringSector(-150, -105), ringSector(30, 75)];

// entrance=false starts with the tonearm already on the record
withDefaults(defineProps<{ entrance?: boolean }>(), { entrance: true });
</script>

<template>
  <div aria-hidden="true" data-testid="vinyl-record" class="relative aspect-square w-[64%]">
    <!-- Slower than a real 33⅓ rpm, which looks frantic -->
    <motion.div
      class="absolute inset-0"
      :animate="{ rotate: 360 }"
      :transition="{ duration: 4, ease: 'linear', repeat: Infinity }"
    >
      <svg viewBox="0 0 200 200" class="size-full" aria-hidden="true">
        <circle cx="100" cy="100" r="92" class="fill-ink" />
        <path v-for="(d, i) in shines" :key="i" :d="d" class="fill-ink-soft" />
        <circle cx="100" cy="100" r="80" fill="none" stroke-width="3" class="stroke-ink-soft" />
        <circle cx="100" cy="100" r="66" fill="none" stroke-width="3" class="stroke-ink-soft" />
        <circle cx="100" cy="100" r="52" fill="none" stroke-width="3" class="stroke-ink-soft" />
        <circle cx="100" cy="100" r="34" class="fill-pink" />
        <path d="M 100 66 A 34 34 0 0 0 100 134 Z" class="fill-coral" />
        <circle cx="100" cy="100" r="34" fill="none" stroke-width="3" class="stroke-ink" />
        <circle cx="100" cy="100" r="5" class="fill-teal" />
      </svg>
    </motion.div>

    <!-- Tonearm: doesn't spin; swings in from its pivot at the top right -->
    <motion.svg
      viewBox="0 0 200 200"
      class="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
      :style="{ originX: '86%', originY: '10%' }"
      :initial="entrance ? { rotate: -28 } : false"
      :animate="{ rotate: 0 }"
      :transition="{ ...spring.smooth, delay: 0.6 }"
    >
      <path
        d="M 172 20 L 176 96 L 146 138"
        fill="none"
        stroke-width="15"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="stroke-ink"
      />
      <path
        d="M 172 20 L 176 96 L 146 138"
        fill="none"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="stroke-paper"
      />
      <rect x="132" y="128" width="26" height="19" transform="rotate(-35 145 138)" stroke-width="3" class="fill-coral stroke-ink" />
      <circle cx="172" cy="20" r="15" stroke-width="3" class="fill-paper stroke-ink" />
      <circle cx="172" cy="20" r="5" class="fill-ink" />
    </motion.svg>
  </div>
</template>
