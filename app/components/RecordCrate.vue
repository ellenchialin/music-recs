<script setup lang="ts">
import { AnimatePresence, motion, type PanInfo } from "motion-v";
import type { RecommendationCard } from "~~/shared/types/recommendations";

// reason: the LLM-written line, filled in by the page once /api/reasons answers; null or missing
// shows "Similar to …". While reasonsLoading, neither shows, so one never replaces the other
export type CrateCard = RecommendationCard & { reason?: string | null };

// Flip through recommendations like a record crate: the selected cover in the middle, the rest
// stacked to the sides. notice temporarily replaces the Explore button
const props = withDefaults(
  defineProps<{ cards: CrateCard[]; canExplore?: boolean; exploring?: boolean; notice?: string; reasonsLoading?: boolean }>(),
  { canExplore: true, exploring: false, notice: "", reasonsLoading: false },
);
const emit = defineEmits<{
  // Ask the page to fetch this artist's preview again after an error
  retry: [artist: string];
  explore: [artist: string];
}>();

// v-model:index so the page remembers the position when coming back from a deeper level
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

// The browser sends a click after a drag; `dragged` ignores it so it doesn't select a side cover
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

// Offset from the selected cover, as a percentage of cover width. initial: false so covers don't
// fan out from the middle on mount
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
    // Selected cover on top, side covers below
    zIndex: offset === 0 ? 20 : 10 - Math.abs(offset),
    dim: distance === 0 ? 0 : 0.25 + distance * 0.1,
  };
}

const player = usePreviewPlayer();
const isPlaying = computed(
  () => current.value.preview.status === "available" && player.playingUrl.value === current.value.preview.url,
);
const trackTitle = computed(() => current.value.track?.title ?? current.value.artist);
const loadingPreview = computed(() => current.value.preview.status === "pending");

function togglePreview() {
  if (current.value.preview.status === "available") void player.toggle(current.value.preview.url);
}

const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
const sourcesText = computed(() => `Similar to ${listFormat.format(current.value.sources)}`);
// The reason is cut off on narrow screens, so the whole of it and its sources open in a tooltip:
// on mouse hover right away (the browser's own title tooltip waits about a second), or on a tap
const tipOpen = ref(false);
const tipId = useId();
const reasonLine = useTemplateRef("reasonLine");
onClickOutside(reasonLine, () => (tipOpen.value = false));
watch(active, () => (tipOpen.value = false));
// Touch screens fire pointerenter before click, which would open and at once close the tooltip
function onReasonPointer(event: PointerEvent, open: boolean) {
  if (event.pointerType === "mouse") tipOpen.value = open;
}

const appleMusicUrl = computed(() => {
  const term = [current.value.artist, current.value.track?.title].filter(Boolean).join(" ");
  return `https://music.apple.com/tw/search?term=${encodeURIComponent(term)}`;
});
</script>

<template>
  <!-- Covers take the remaining height; info and controls are fixed. Two columns in short-landscape -->
  <section
    aria-roledescription="carousel"
    aria-label="Recommended artists"
    tabindex="0"
    class="flex h-full min-h-0 flex-col items-center gap-4 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-8 focus-visible:outline-ink short-landscape:flex-row short-landscape:gap-8"
    @keydown="onKeydown"
  >
    <!-- The cover is the smallest of 68% width, full height and 22rem. In two columns, side covers are
         clipped so they don't cover the info -->
    <div class="flex min-h-0 w-full flex-1 items-center justify-center [container-type:size] short-landscape:h-full short-landscape:overflow-hidden">
      <motion.div
        class="relative h-[var(--cover)] w-[var(--cover)] cursor-grab touch-pan-y [--cover:min(68cqw,100cqh,22rem)] [perspective:1200px] active:cursor-grabbing"
        drag="x"
        :drag-constraints="{ left: 0, right: 0 }"
        :drag-elastic="0.2"
        @drag-start="onDragStart"
        @drag-end="onDragEnd"
      >
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
          <!-- Each cover holds its own record, so the record travels with it and only slides out
               once that cover is selected. -z-10 puts it behind the cover but above the side covers -->
          <motion.div
            aria-hidden="true"
            data-testid="sleeve-record"
            class="absolute inset-[4%] -z-10 rounded-full bg-ink"
            :initial="{ x: '0%', rotate: 0 }"
            :animate="i === active ? { x: '34%', rotate: 90 } : { x: '0%', rotate: 0 }"
            :transition="i === active ? { ...spring.smooth, delay: 0.15 } : spring.smooth"
          >
            <svg viewBox="0 0 200 200" class="size-full">
              <circle cx="100" cy="100" r="80" fill="none" stroke-width="4" class="stroke-ink-soft" />
              <circle cx="100" cy="100" r="62" fill="none" stroke-width="4" class="stroke-ink-soft" />
              <circle cx="100" cy="100" r="34" :class="['fill-coral', 'fill-pink', 'fill-teal-deep'][i % 3]" />
              <circle cx="100" cy="100" r="5" class="fill-paper" />
            </svg>
          </motion.div>
          <img
            v-if="card.track?.artworkUrl"
            :src="card.track.artworkUrl"
            :alt="`Album cover for ${card.track.title} by ${card.artist}`"
            class="pointer-events-none size-full object-cover"
            draggable="false"
            :loading="Math.abs(i - active) > 2 ? 'lazy' : 'eager'"
          >
          <div v-else aria-hidden="true" class="flex size-full items-center justify-center bg-plum">
            <span class="font-wide text-[calc(var(--cover)*0.32)] leading-none font-black text-paper">{{ card.artist.charAt(0) }}</span>
          </div>
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

    <!-- Fixed row heights so changing records doesn't shift anything -->
    <div data-testid="record-info" class="flex w-full max-w-md shrink-0 flex-col items-center text-center short-landscape:w-[min(24rem,45%)]">
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
            <!-- One of three: a loading bar, the AI-written reason, or "Similar to …" -->
            <div
              ref="reasonLine"
              data-testid="record-reason"
              class="relative flex h-5 w-full items-center justify-center text-sm"
              @pointerenter="onReasonPointer($event, true)"
              @pointerleave="onReasonPointer($event, false)"
            >
              <template v-if="reasonsLoading">
                <motion.span
                  data-testid="reason-skeleton"
                  aria-hidden="true"
                  class="block h-2.5 w-2/3 bg-ink/15"
                  :animate="{ opacity: [1, 0.4, 1] }"
                  :transition="{ duration: 1.2, ease: 'easeInOut', repeat: Infinity }"
                />
                <span class="sr-only">Loading reason</span>
              </template>
              <button
                v-else-if="current.reason"
                type="button"
                class="flex max-w-full min-w-0 items-center gap-1.5 text-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                :aria-expanded="tipOpen"
                :aria-describedby="tipOpen ? tipId : undefined"
                @click="tipOpen = !tipOpen"
                @keydown.escape="tipOpen = false"
              >
                <span data-testid="ai-tag" aria-hidden="true" class="inline-flex shrink-0 items-center gap-1 bg-ink px-1.5 leading-5 font-bold text-paper">
                  <svg viewBox="0 0 10 10" class="size-2.5 fill-current"><path d="M5 0l1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2z" /></svg>AI</span>
                <span class="min-w-0 truncate"><span class="sr-only">AI-written reason: </span>{{ current.reason }}</span>
              </button>
              <span v-else class="min-w-0 truncate text-ink/70">{{ sourcesText }}</span>

              <AnimatePresence>
                <motion.div
                  v-if="tipOpen && current.reason"
                  :id="tipId"
                  role="tooltip"
                  class="absolute inset-x-0 bottom-full z-30 mx-auto mb-2 w-fit max-w-[min(22rem,calc(100vw-2rem))] border-3 border-ink bg-ink px-3 py-2 text-left text-sm text-paper"
                  :initial="{ opacity: 0, y: 4 }"
                  :animate="{ opacity: 1, y: 0 }"
                  :exit="{ opacity: 0, y: 4 }"
                  :transition="{ duration: 0.12 }"
                >
                  <p>{{ current.reason }}</p>
                  <p class="mt-1 text-paper-muted">{{ sourcesText }}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div data-testid="controls" class="mt-3 flex h-16 w-full items-center justify-center gap-4 sm:gap-5">
        <!-- Skip icons without a circle, so only Play is round. Hit area stays 44px -->
        <button
          type="button"
          aria-label="Previous record"
          :disabled="active === 0"
          class="flex size-11 shrink-0 items-center justify-center text-ink disabled:opacity-30"
          @click="go(active - 1)"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" class="size-7 fill-current"><path d="M5 4h3v16H5zM20 4v16L9 12z" /></svg>
        </button>

        <!-- One button for both states: while the preview loads it's disabled and shows a spinner, so
             nothing moves when the preview arrives. The track isn't known yet, so that label names the artist -->
        <motion.button
          v-if="current.preview.status === 'available' || loadingPreview"
          type="button"
          :disabled="loadingPreview"
          :aria-busy="loadingPreview"
          :aria-pressed="loadingPreview ? undefined : isPlaying"
          :aria-label="loadingPreview ? `Loading preview of ${current.artist}` : `${isPlaying ? 'Pause' : 'Play'} preview of ${trackTitle}`"
          class="flex size-16 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-teal text-ink"
          :while-press="{ scale: 0.92 }"
          :transition="spring.snappy"
          @click="togglePreview"
        >
          <motion.svg
            v-if="loadingPreview"
            aria-hidden="true"
            viewBox="0 0 24 24"
            class="size-7"
            :animate="{ rotate: 360 }"
            :transition="{ duration: 1, ease: 'linear', repeat: Infinity }"
          >
            <circle cx="12" cy="12" r="9" fill="none" stroke-width="3" class="stroke-ink/25" />
            <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke-width="3" stroke-linecap="round" class="stroke-ink" />
          </motion.svg>
          <!-- The play triangle is nudged right to look centered -->
          <svg v-else aria-hidden="true" viewBox="0 0 12 12" class="size-6 fill-current" :class="isPlaying ? '' : 'translate-x-0.5'">
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
          <button type="button" class="shrink-0 font-bold underline underline-offset-4" @click="emit('retry', current.artist)">Retry</button>
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

      <!-- Hidden at the deepest level rather than disabled; the breadcrumb goes back -->
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

      <p data-testid="position" class="mt-1 text-xs font-bold tabular-nums">{{ active + 1 }} / {{ count }}</p>
    </div>
  </section>
</template>
