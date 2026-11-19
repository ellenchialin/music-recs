<script setup lang="ts">
import { POPULARITY_SETTINGS, type Popularity } from "~~/shared/types/popularity";

// The mainstream ↔ obscure slider as three named stops: with three stops the names are the point
const model = defineModel<Popularity>({ required: true });
defineProps<{ busy?: boolean }>();

const LABELS: Record<Popularity, string> = { obscure: "Obscure", balanced: "Balanced", mainstream: "Mainstream" };
const OPTIONS = POPULARITY_SETTINGS.map((value) => ({ value, label: LABELS[value] }));
</script>

<template>
  <SegmentedChoice v-model="model" :options="OPTIONS" name="popularity" legend="Popularity" :busy="busy" />
</template>
