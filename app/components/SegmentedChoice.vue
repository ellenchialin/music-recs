<script setup lang="ts" generic="T extends string">
import { motion } from "motion-v";

// A few named options in one ink box, the chosen one filled. Radio buttons underneath, so arrow
// keys and screen readers work natively. Used for the popularity setting and the home's two ways in
const model = defineModel<T>({ required: true });
defineProps<{ options: readonly { value: T; label: string }[]; name: string; legend: string; busy?: boolean }>();
</script>

<template>
  <fieldset :aria-busy="busy" class="flex min-w-0 shrink-0 border-3 border-ink">
    <legend class="sr-only">{{ legend }}</legend>
    <label v-for="option in options" :key="option.value" class="relative cursor-pointer">
      <input v-model="model" type="radio" :name="name" :value="option.value" class="peer sr-only">
      <!-- One block that slides between the options (layout-id), under the label text -->
      <motion.span
        v-if="model === option.value"
        :layout-id="`${name}-choice`"
        aria-hidden="true"
        class="absolute inset-0 bg-ink"
        :transition="spring.snappy"
      />
      <span
        class="relative block px-3 py-1 text-sm font-bold whitespace-nowrap peer-checked:text-paper peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
      >{{ option.label }}</span>
    </label>
  </fieldset>
</template>
