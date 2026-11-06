<template>
  <!-- Respects the system's reduced-motion setting -->
  <MotionConfig reduced-motion="user">
    <div class="min-h-screen">
      <NuxtRouteAnnouncer />
      <NuxtPage />
    </div>
  </MotionConfig>
</template>
