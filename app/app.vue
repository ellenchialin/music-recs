<script setup lang="ts">
// Defaults for every page; pages with their own title or story override them
useHead({ title: "Music Recs" });
useShareMeta(() => ({
  title: "Music Recs",
  description: "Pick 1–3 artists you love. Get recommendations you can preview, then dig deeper from any of them.",
}));
</script>

<template>
  <!-- Respects the system's reduced-motion setting -->
  <MotionConfig reduced-motion="user">
    <!-- dvh, not screen: iOS Safari makes 100vh taller than the visible page, so every page scrolled -->
    <div class="min-h-dvh">
      <NuxtRouteAnnouncer />
      <NuxtPage />
    </div>
  </MotionConfig>
</template>
