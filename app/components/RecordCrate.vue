<script setup lang="ts">
import { AnimatePresence, motion, type PanInfo } from "motion-v";
import type { RecommendationCard } from "~~/shared/types/recommendations";

// 推薦結果像翻唱片箱：選到的封面在中間、最大；其他的往左右疊，越遠越小、往內轉。
// 左右滑（或拖、按箭頭、按鍵盤左右鍵、點旁邊的封面）換一張；資訊和圓形播放鍵在封面下方
// canExplore：還能不能再往下挖（最多 3 層，由頁面決定）；exploring：下一層正在查（第一次可能要好幾秒）；
// notice：暫時取代 Explore 按鈕的一行提示（例如往下挖沒有新歌手）
const props = withDefaults(
  defineProps<{ cards: RecommendationCard[]; canExplore?: boolean; exploring?: boolean; notice?: string }>(),
  { canExplore: true, exploring: false, notice: "" },
);
const emit = defineEmits<{
  // 試聽暫時無法載入時，請頁面重新查詢（錯誤沒有被快取，重查會再試一次 iTunes）
  retry: [];
  // Explore from here：以這位歌手為種子往下挖
  explore: [artist: string];
}>();

// 目前選到第幾張。用 v-model:index 讓頁面記住：從下一層回來時停在當時看的那張。
// 每一層是不同的唱片箱（頁面用不同的 key），換一批推薦時自然從頭開始
const active = defineModel<number>("index", { default: 0 });
const current = computed(() => props.cards[active.value]!);
const count = computed(() => props.cards.length);

function go(index: number) {
  active.value = Math.min(Math.max(index, 0), count.value - 1);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowRight") go(active.value + 1);
  else if (event.key === "ArrowLeft") go(active.value - 1);
  else return;
  event.preventDefault();
}

// 滑動：往左滑超過 60px（或甩得夠快）看下一張，往右看上一張
// 拖曳結束時瀏覽器還會送一個 click，用 dragged 擋掉，不然會變成「點了旁邊那張」
let dragged = false;
function onDragStart() {
  dragged = true;
}
function onDragEnd(_event: PointerEvent, info: PanInfo) {
  const swipe = info.offset.x + info.velocity.x * 0.2;
  if (swipe < -60) go(active.value + 1);
  else if (swipe > 60) go(active.value - 1);
  setTimeout(() => (dragged = false), 0);
}
function onSlideClick(index: number) {
  if (!dragged) go(index);
}

// 每張封面相對選到那張的位置：0 = 中間；±1、±2… 往左右疊。用自己寬度的百分比，封面多大都一樣。
// 一出現就在最後的位置（initial: false），進場交給外層的淡入，不要所有封面先疊在中間再散開
const SPREAD = [0, 62, 90, 108];
const SCALE = [1, 0.8, 0.66, 0.56];
function placement(index: number) {
  const offset = index - active.value;
  const distance = Math.min(Math.abs(offset), 3);
  const side = Math.sign(offset);
  return {
    animate: {
      x: `${side * SPREAD[distance]!}%`,
      scale: SCALE[distance],
      rotateY: side * -28,
      opacity: Math.abs(offset) > 3 ? 0 : 1,
    },
    // 選到的那張在最上面（20），後面滑出來的黑膠在它下面（15），旁邊的封面再下面
    zIndex: offset === 0 ? 20 : 10 - Math.abs(offset),
    dim: distance === 0 ? 0 : 0.25 + distance * 0.1,
  };
}

const player = usePreviewPlayer();
const isPlaying = computed(
  () => current.value.preview.status === "available" && player.playingUrl.value === current.value.preview.url,
);
const trackTitle = computed(() => current.value.track?.title ?? current.value.artist);

function togglePreview() {
  if (current.value.preview.status === "available") void player.toggle(current.value.preview.url);
}

// 「Similar to A, B and C」：Intl.ListFormat 依英文的習慣接上逗號和 and
const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
const sourcesText = computed(() => `Similar to ${listFormat.format(current.value.sources)}`);

// 沒有試聽時給一個到 Apple Music 搜尋的連結
const appleMusicUrl = computed(() => {
  const term = [current.value.artist, current.value.track?.title].filter(Boolean).join(" ");
  return `https://music.apple.com/tw/search?term=${encodeURIComponent(term)}`;
});
</script>

<template>
  <!-- 整組是一個 carousel：可以用 Tab 進來，再用左右鍵換唱片。
       高度由外層決定（推薦頁剛好一個畫面）：封面區佔掉剩下的空間，下面的資訊和操作高度固定；
       很矮的橫向畫面（手機橫放，short-landscape）改成左右兩欄：左邊封面、右邊資訊和操作 -->
  <section
    aria-roledescription="carousel"
    aria-label="Recommended artists"
    tabindex="0"
    class="flex h-full min-h-0 flex-col items-center gap-4 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-8 focus-visible:outline-ink short-landscape:flex-row short-landscape:gap-8"
    @keydown="onKeydown"
  >
    <!-- 封面區：container-type: size 讓封面取「區域寬的 68%、區域高、22rem」中最小的，畫面矮就跟著縮。
         兩欄時旁邊疊出去的封面在這一欄的邊緣裁掉，不蓋到右邊的資訊 -->
    <div class="flex min-h-0 w-full flex-1 items-center justify-center [container-type:size] short-landscape:h-full short-landscape:overflow-hidden">
      <!-- 唱片箱：封面的大小用 --cover 控制，旁邊的封面會超出這個寬度，交給外層裁切 -->
      <motion.div
        class="relative h-[var(--cover)] w-[var(--cover)] cursor-grab touch-pan-y [--cover:min(68cqw,100cqh,22rem)] [perspective:1200px] active:cursor-grabbing"
        drag="x"
        :drag-constraints="{ left: 0, right: 0 }"
        :drag-elastic="0.2"
        @drag-start="onDragStart"
        @drag-end="onDragEnd"
      >
        <!-- 從選到的封面後面滑出來的黑膠：每次換唱片重新滑一次 -->
        <motion.div
          :key="`disc-${active}`"
          aria-hidden="true"
          class="absolute inset-[4%] z-[15] rounded-full bg-ink"
          :initial="{ x: '0%', rotate: 0 }"
          :animate="{ x: '34%', rotate: 90 }"
          :transition="{ ...spring.smooth, delay: 0.15 }"
        >
          <svg viewBox="0 0 200 200" class="size-full">
            <circle cx="100" cy="100" r="80" fill="none" stroke-width="4" class="stroke-ink-soft" />
            <circle cx="100" cy="100" r="62" fill="none" stroke-width="4" class="stroke-ink-soft" />
            <circle cx="100" cy="100" r="34" :class="['fill-coral', 'fill-pink', 'fill-teal-deep'][active % 3]" />
            <circle cx="100" cy="100" r="5" class="fill-paper" />
          </svg>
        </motion.div>

        <motion.div
          v-for="(card, i) in cards"
          :key="card.artist"
          role="group"
          aria-roledescription="slide"
          :aria-label="`${i + 1} of ${count}: ${card.artist}`"
          :aria-current="i === active"
          class="absolute inset-0 select-none"
          :class="i === active ? '' : 'cursor-pointer'"
          :style="{ zIndex: placement(i).zIndex }"
          :initial="false"
          :animate="placement(i).animate"
          :transition="spring.smooth"
          @click="onSlideClick(i)"
        >
          <img
            v-if="card.track?.artworkUrl"
            :src="card.track.artworkUrl"
            :alt="`Album cover for ${card.track.title} by ${card.artist}`"
            class="pointer-events-none size-full object-cover"
            draggable="false"
            :loading="Math.abs(i - active) > 2 ? 'lazy' : 'eager'"
          >
          <!-- 沒有封面：梅紫方塊＋歌手名字的第一個字（大小跟著封面） -->
          <div v-else aria-hidden="true" class="flex size-full items-center justify-center bg-plum">
            <span class="font-wide text-[calc(var(--cover)*0.32)] leading-none font-black text-paper">{{ card.artist.charAt(0) }}</span>
          </div>
          <!-- 旁邊的封面蓋一層深藍，越遠越暗，選到的那張最亮 -->
          <motion.div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 bg-ink"
            :initial="false"
            :animate="{ opacity: placement(i).dim }"
            :transition="spring.smooth"
          />
        </motion.div>
      </motion.div>
    </div>

    <!-- 資訊和操作：每一行高度固定，換唱片時不會跳 -->
    <div data-testid="record-info" class="flex w-full max-w-md shrink-0 flex-col items-center text-center short-landscape:w-[min(24rem,45%)]">
      <!-- 歌手、歌名、和哪些種子相似；換唱片時淡出淡入，螢幕閱讀器會念新的歌手 -->
      <div aria-live="polite" class="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            :key="current.artist"
            class="flex w-full flex-col items-center"
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: -8 }"
            :transition="{ duration: 0.18 }"
          >
            <h3 class="w-full truncate font-wide text-2xl leading-tight font-black sm:text-3xl" :title="current.artist">
              {{ current.artist }}
            </h3>
            <p class="mt-0.5 h-6 w-full truncate text-base sm:h-7 sm:text-lg" :title="current.track?.title">
              {{ current.track?.title }}
            </p>
            <p class="h-5 w-full truncate text-sm text-ink/70" :title="sourcesText">{{ sourcesText }}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <!-- 上一張、播放、下一張一排（像播放器）。沒有試聽時中間換成說明文字 -->
      <div data-testid="controls" class="mt-3 flex h-16 w-full items-center justify-center gap-4 sm:gap-5">
        <!-- 上一張、下一張用播放器的「跳到上一首／下一首」圖示（直線＋三角形），沒有圓底：
             只有播放鍵是圓的，才不會搞混。可點範圍維持 44px -->
        <button
          type="button"
          aria-label="Previous record"
          :disabled="active === 0"
          class="flex size-11 shrink-0 items-center justify-center text-ink disabled:opacity-30"
          @click="go(active - 1)"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" class="size-7 fill-current"><path d="M5 4h3v16H5zM20 4v16L9 12z" /></svg>
        </button>

        <!-- 圓形播放鍵 -->
        <motion.button
          v-if="current.preview.status === 'available'"
          type="button"
          :aria-pressed="isPlaying"
          :aria-label="`${isPlaying ? 'Pause' : 'Play'} preview of ${trackTitle}`"
          class="flex size-16 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-teal text-ink"
          :while-press="{ scale: 0.92 }"
          :transition="spring.snappy"
          @click="togglePreview"
        >
          <!-- 播放：三角形（往右偏一點，看起來才置中）；暫停：兩條直線 -->
          <svg aria-hidden="true" viewBox="0 0 12 12" class="size-6 fill-current" :class="isPlaying ? '' : 'translate-x-0.5'">
            <path v-if="isPlaying" d="M2 1h3v10H2zM7 1h3v10H7z" />
            <path v-else d="M2 1l9 5-9 5z" />
          </svg>
        </motion.button>

        <p v-else-if="current.preview.status === 'unavailable'" class="flex min-w-0 items-center gap-2 text-sm sm:text-base">
          <span class="shrink-0 text-ink/70">No preview</span>
          <a
            :href="appleMusicUrl"
            target="_blank"
            rel="noopener"
            :aria-label="`Find ${trackTitle} on Apple Music`"
            class="truncate font-bold underline underline-offset-4"
          >
            Apple Music
          </a>
        </p>

        <p v-else class="flex min-w-0 items-center gap-2 text-sm sm:text-base">
          <span class="truncate text-ink/70">Preview failed to load</span>
          <button type="button" class="shrink-0 font-bold underline underline-offset-4" @click="emit('retry')">Retry</button>
        </p>

        <button
          type="button"
          aria-label="Next record"
          :disabled="active === count - 1"
          class="flex size-11 shrink-0 items-center justify-center text-ink disabled:opacity-30"
          @click="go(active + 1)"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" class="size-7 fill-current"><path d="M16 4h3v16h-3zM4 4v16l11-8z" /></svg>
        </button>
      </div>

      <!-- Explore from here：從這張往下挖。到最深時不顯示（想換方向可以點上方的麵包屑回去）；
           有提示時（例如沒有新歌手）提示暫時放在這個位置。高度固定，內容換了也不會跳 -->
      <div class="mt-2 flex h-7 items-center justify-center" aria-live="polite">
        <p v-if="notice" class="text-sm font-medium sm:text-base">{{ notice }}</p>
        <button
          v-else-if="canExplore"
          type="button"
          :aria-label="`Explore artists like ${current.artist}`"
          :disabled="exploring"
          :aria-busy="exploring"
          class="font-bold underline underline-offset-4 disabled:no-underline disabled:opacity-40"
          @click="emit('explore', current.artist)"
        >
          {{ exploring ? "Finding more…" : "Explore from here →" }}
        </button>
      </div>

      <!-- 目前位置：12px 小字放在最下面 -->
      <p data-testid="position" class="mt-1 text-xs font-bold tabular-nums">{{ active + 1 }} / {{ count }}</p>
    </div>
  </section>
</template>
