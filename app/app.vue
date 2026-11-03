<template>
  <!-- reduced-motion="user"：系統開了「減少動態效果」時，位移動畫自動關掉 -->
  <MotionConfig reduced-motion="user">
    <div class="min-h-screen">
      <NuxtRouteAnnouncer />
      <NuxtPage />
    </div>
  </MotionConfig>
</template>
