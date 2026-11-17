<script setup lang="ts">
import { motion } from "motion-v";
import { POPULARITY_SETTINGS, type Popularity } from "~~/shared/types/popularity";

// The mainstream ↔ obscure slider as three named stops. Radio buttons rather than a draggable
// range: with three stops the names are the point, and arrow keys and screen readers work natively
const model = defineModel<Popularity>({ required: true });
defineProps<{ busy?: boolean }>();

const LABELS: Record<Popularity, string> = { obscure: "Obscure", balanced: "Balanced", mainstream: "Mainstream" };
</script>

<template>
  <fieldset :aria-busy="busy" class="flex min-w-0 shrink-0 border-3 border-ink">
    <legend class="sr-only">Popularity</legend>
    <label v-for="setting in POPULARITY_SETTINGS" :key="setting" class="relative cursor-pointer">
      <input v-model="model" type="radio" name="popularity" :value="setting" class="peer sr-only">
      <!-- One block that slides between the stops (layout-id), under the label text -->
      <motion.span
        v-if="model === setting"
        layout-id="popularity-choice"
        aria-hidden="true"
        class="absolute inset-0 bg-ink"
        :transition="spring.snappy"
      />
      <span
        class="relative block px-3 py-1 text-sm font-bold whitespace-nowrap peer-checked:text-paper peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
      >{{ LABELS[setting] }}</span>
    </label>
  </fieldset>
</template>
