<script setup lang="ts">
// Defaults for every page; pages with their own title or story override them
useHead({ title: "Music Recs" });
useShareMeta(() => ({
  title: "Music Recs",
  description: "Name a few artists or describe a vibe, and get ten records you can preview, with a way to dig deeper from any of them.",
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
