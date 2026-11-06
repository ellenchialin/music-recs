<script setup lang="ts">
import { motion } from "motion-v";

// Decorative sun and turntable; fills a square parent.
// entrance=false starts in the final state, for when a view transition has already moved it into place
withDefaults(defineProps<{ recordDelay?: number; entrance?: boolean }>(), { recordDelay: 0.2, entrance: true });
</script>

<template>
  <div class="relative size-full">
    <motion.div
      aria-hidden="true"
      class="absolute inset-0 rounded-full bg-teal"
      :initial="entrance ? { scale: 0.6, opacity: 0 } : false"
      :animate="{ scale: 1, opacity: 1 }"
      :transition="spring.smooth"
    />
    <motion.div
      class="absolute inset-0 flex items-center justify-center"
      :initial="entrance ? { opacity: 0, scale: 0.6 } : false"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ ...spring.smooth, delay: recordDelay }"
    >
      <VinylRecord :entrance="entrance" />
    </motion.div>
  </div>
</template>
