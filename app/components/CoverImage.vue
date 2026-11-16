<script setup lang="ts">
import { motion } from "motion-v";

// A sharp cover that fades in over the blurred one once its file has fully arrived, so a
// half-downloaded image never paints over the placeholder line by line
const props = defineProps<{ src: string; loading?: "lazy" | "eager" }>();

const loaded = ref(false);
const el = useCurrentElement<HTMLImageElement>();
watch(
  () => props.src,
  () => (loaded.value = false),
);
// Rendered on the server: the file may finish before Vue starts listening for load
onMounted(() => {
  if (el.value?.complete && el.value.naturalWidth > 0) loaded.value = true;
});
</script>

<template>
  <motion.img
    :src="src"
    alt=""
    :loading="loading"
    :data-loaded="loaded"
    draggable="false"
    class="pointer-events-none absolute inset-0 size-full object-cover"
    :initial="false"
    :animate="{ opacity: loaded ? 1 : 0 }"
    :transition="spring.smooth"
    @load="loaded = true"
  />
</template>
