<script setup lang="ts">
import { motion } from "motion-v";
import type { RecommendationCard } from "~~/shared/types/recommendations";

const props = defineProps<{ card: RecommendationCard }>();
// 試聽暫時無法載入時，請頁面重新查詢（錯誤沒有被快取，重查會再試一次 iTunes）
const emit = defineEmits<{ retry: [] }>();

const player = usePreviewPlayer();
const isPlaying = computed(
  () => props.card.preview.status === "available" && player.playingUrl.value === props.card.preview.url,
);

const sourcesText = computed(() => `和 ${props.card.sources.join("、")} 相似`);
// 沒有試聽時給一個到 Apple Music 搜尋的連結
const appleMusicUrl = computed(() => {
  const term = [props.card.artist, props.card.track?.title].filter(Boolean).join(" ");
  return `https://music.apple.com/tw/search?term=${encodeURIComponent(term)}`;
});

function togglePreview() {
  if (props.card.preview.status === "available") void player.toggle(props.card.preview.url);
}
</script>

<template>
  <!-- 固定高度：每張卡片一樣高，格線才整齊；封面是正方形，高度等於卡片高度，貼齊左邊（參考 Spotify 的卡片）
       文字太長就截斷，不讓卡片長高 -->
  <article class="flex h-32 overflow-hidden bg-ink text-paper sm:h-40">
    <img
      v-if="card.track?.artworkUrl"
      :src="card.track.artworkUrl"
      :alt="`${card.artist}〈${card.track.title}〉的專輯封面`"
      class="aspect-square h-full shrink-0 object-cover"
      loading="lazy"
    >
    <!-- 沒有封面時用歌手名字的第一個字 -->
    <div v-else aria-hidden="true" class="flex aspect-square h-full shrink-0 items-center justify-center bg-plum">
      <span class="font-wide text-4xl font-black text-paper sm:text-5xl">{{ card.artist.charAt(0) }}</span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
      <h3 class="truncate font-wide text-lg leading-tight font-black sm:text-2xl" :title="card.artist">{{ card.artist }}</h3>
      <p v-if="card.track" class="mt-0.5 truncate text-sm sm:text-base" :title="card.track.title">{{ card.track.title }}</p>
      <p class="truncate text-xs text-paper-muted sm:text-sm" :title="sourcesText">{{ sourcesText }}</p>

      <div class="mt-auto">
        <motion.button
          v-if="card.preview.status === 'available'"
          type="button"
          :aria-pressed="isPlaying"
          :aria-label="`${isPlaying ? '暫停' : '試聽'}〈${card.track?.title ?? card.artist}〉`"
          class="inline-flex items-center gap-2 bg-teal px-3 py-1.5 text-sm font-bold text-ink sm:px-4 sm:py-2 sm:text-base"
          :while-press="{ scale: 0.95 }"
          :transition="spring.snappy"
          @click="togglePreview"
        >
          <!-- 播放：三角形；暫停：兩條直線 -->
          <svg aria-hidden="true" viewBox="0 0 12 12" class="size-3 fill-current sm:size-3.5">
            <path v-if="isPlaying" d="M2 1h3v10H2zM7 1h3v10H7z" />
            <path v-else d="M2 1l9 5-9 5z" />
          </svg>
          {{ isPlaying ? "暫停" : "試聽" }}
        </motion.button>

        <p v-else-if="card.preview.status === 'unavailable'" class="flex items-center gap-2 text-sm whitespace-nowrap">
          <span class="text-paper-muted">暫無試聽</span>
          <a :href="appleMusicUrl" target="_blank" rel="noopener" class="truncate font-bold text-teal underline underline-offset-4">
            Apple Music 找找看
          </a>
        </p>

        <p v-else class="flex items-center gap-3 text-sm whitespace-nowrap">
          <span class="text-paper-muted">試聽暫時無法載入</span>
          <button type="button" class="font-bold text-teal underline underline-offset-4" @click="emit('retry')">重試</button>
        </p>
      </div>
    </div>
  </article>
</template>
