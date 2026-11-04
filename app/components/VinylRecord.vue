<script setup lang="ts">
import { motion } from "motion-v";

// 太陽圓上的黑膠唱盤（一直都在）：唱片慢慢轉，唱臂從旁邊擺進來放到唱片上
// 畫法照全站主題：大塊平塗、粗墨線，顏色只用 main.css 的 token（fill-ink、stroke-ink-soft…）

// 唱片上兩塊扇形的反光，轉起來才看得出在轉。從圓心出發、半徑 46～88 之間、角度 a 到 b 的扇環
function ringSector(a: number, b: number, inner = 46, outer = 88) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const point = (r: number, deg: number) => `${100 + r * Math.cos(rad(deg))} ${100 + r * Math.sin(rad(deg))}`;
  return `M ${point(outer, a)} A ${outer} ${outer} 0 0 1 ${point(outer, b)} L ${point(inner, b)} A ${inner} ${inner} 0 0 0 ${point(inner, a)} Z`;
}
const shines = [ringSector(-150, -105), ringSector(30, 75)];

// entrance：false 時唱臂一開始就放在唱片上（不擺進來）
withDefaults(defineProps<{ entrance?: boolean }>(), { entrance: true });
</script>

<template>
  <!-- 純裝飾：螢幕閱讀器跳過，已選的歌手由下方的標籤清單念 -->
  <div aria-hidden="true" data-testid="vinyl-record" class="relative aspect-square w-[64%]">
    <!-- 唱片：一圈約 4 秒，比真的 33⅓ 轉慢，看起來比較從容。減少動態效果開啟時不轉 -->
    <motion.div
      class="absolute inset-0"
      :animate="{ rotate: 360 }"
      :transition="{ duration: 4, ease: 'linear', repeat: Infinity }"
    >
      <svg viewBox="0 0 200 200" class="size-full" aria-hidden="true">
        <circle cx="100" cy="100" r="92" class="fill-ink" />
        <path v-for="(d, i) in shines" :key="i" :d="d" class="fill-ink-soft" />
        <!-- 溝紋：粗線而不是細線，和全站的粗墨線一致 -->
        <circle cx="100" cy="100" r="80" fill="none" stroke-width="3" class="stroke-ink-soft" />
        <circle cx="100" cy="100" r="66" fill="none" stroke-width="3" class="stroke-ink-soft" />
        <circle cx="100" cy="100" r="52" fill="none" stroke-width="3" class="stroke-ink-soft" />
        <!-- 中間的標籤：桃紅，左半邊珊瑚橘，轉的時候看得出方向 -->
        <circle cx="100" cy="100" r="34" class="fill-pink" />
        <path d="M 100 66 A 34 34 0 0 0 100 134 Z" class="fill-coral" />
        <circle cx="100" cy="100" r="34" fill="none" stroke-width="3" class="stroke-ink" />
        <!-- 中心孔：露出後面的青綠太陽圓 -->
        <circle cx="100" cy="100" r="5" class="fill-teal" />
      </svg>
    </motion.div>

    <!-- 唱臂：不跟著轉。從右上的軸心擺進來，停在唱片外圈 -->
    <motion.svg
      viewBox="0 0 200 200"
      class="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
      :style="{ originX: '86%', originY: '10%' }"
      :initial="entrance ? { rotate: -28 } : false"
      :animate="{ rotate: 0 }"
      :transition="{ ...spring.smooth, delay: 0.6 }"
    >
      <!-- 臂桿：紙色填色＋墨色粗描邊 -->
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
      <!-- 唱頭：珊瑚橘 -->
      <rect x="132" y="128" width="26" height="19" transform="rotate(-35 145 138)" stroke-width="3" class="fill-coral stroke-ink" />
      <!-- 軸心 -->
      <circle cx="172" cy="20" r="15" stroke-width="3" class="fill-paper stroke-ink" />
      <circle cx="172" cy="20" r="5" class="fill-ink" />
    </motion.svg>
  </div>
</template>
