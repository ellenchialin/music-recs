<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import type { RecommendationsResult, SeedNotFoundData } from "~~/shared/types/recommendations";
import { MIN_SEEDS } from "~/stores/seeds";

const store = useSeedsStore();

const result = ref<RecommendationsResult | null>(null);
const loading = ref(false);
// 種子找不到（404）：哪一位、建議的名字
const notFound = ref<SeedNotFoundData | null>(null);
// 其他錯誤（Last.fm 當機、網路斷線）
const failed = ref(false);
const resultsHeading = ref<HTMLElement | null>(null);
// 404、502 的提示標題：手機上提示出現在第一個畫面下方，把焦點移過去會自動捲到那裡
const feedbackHeading = ref<HTMLElement | null>(null);

// 還沒選到最少人數時，按鈕旁的提示
const hint = computed(() => (store.seeds.length < MIN_SEEDS ? `先選 ${MIN_SEEDS} 位歌手` : ""));

// 第一次載入的進場順序（秒）：太陽圓先出來，左邊的文字依序跟上，最後才是太陽圓上的音浪或種子
const intro = {
  title: staggerStep,
  subtitle: staggerStep * 2,
  input: staggerStep * 3,
  action: staggerStep * 4,
  sunContent: 0.35,
};

// 種子在掛載後才從 localStorage 讀出來（stores/seeds.ts 的 initOnMounted）。
// 讀到之前不畫太陽圓上的內容，不然會先閃一下「沒有種子」的音浪，再換成種子
const mounted = ref(false);
// 進場結束後，之後加入的種子馬上出現，不再等進場的延遲
const introDone = ref(false);
onMounted(() => {
  mounted.value = true;
  setTimeout(() => (introDone.value = true), 1000);
});
const sunContentDelay = (i = 0) => (introDone.value ? 0 : intro.sunContent + staggerStep * i);

async function fetchRecommendations() {
  if (!store.isReady || loading.value) return;
  loading.value = true;
  notFound.value = null;
  failed.value = false;
  try {
    // query 的陣列會變成 ?seed=A&seed=B&seed=C
    result.value = await $fetch<RecommendationsResult>("/api/recommendations", { query: { seed: store.seeds } });
    await nextTick();
    reveal(resultsHeading.value);
  } catch (err) {
    const error = err as { statusCode?: number; data?: { data?: SeedNotFoundData } };
    if (error.statusCode === 404 && error.data?.data) notFound.value = error.data.data;
    else failed.value = true;
    await nextTick();
    reveal(feedbackHeading.value);
  } finally {
    loading.value = false;
  }
}

// 把區塊的標題捲到畫面頂端，再把焦點移過去（鍵盤和螢幕閱讀器使用者知道內容換了）
// 只用 focus() 的話，瀏覽器只捲到「剛好看得到」，標題會停在畫面中間
function reveal(heading: HTMLElement | null) {
  if (!heading) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  heading.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  heading.focus({ preventScroll: true });
}

// 點了「你是不是要找…」：換掉打錯的種子，馬上重新推薦
function useSuggestion(seed: string, suggestion: string) {
  store.replace(seed, suggestion);
  void fetchRecommendations();
}

function removeMissing(seed: string) {
  store.remove(seed);
  notFound.value = null;
}
</script>

<template>
  <div>
    <!-- 第一個畫面：剛好一個螢幕高，不能捲動。1024px 以下用 h-dvh（手機瀏覽器網址列縮放時也準），
         太陽圓佔掉其他元素剩下的高度；桌機（lg）維持左右兩欄 -->
    <div class="flex h-dvh flex-col lg:h-auto lg:min-h-dvh">
      <header class="mx-auto hidden w-full max-w-7xl items-center px-8 py-5 lg:flex">
        <span class="font-wide text-lg font-extrabold">Music Recs</span>
      </header>

      <!-- 手機、直立平板：標題 → 輸入框 → 已選的歌手 → 推薦按鈕，由上往下；
           桌機和橫放的平板（寬 768 以上、橫向）：左欄標題、輸入、按鈕，右欄太陽圓，太陽圓才放得大；
           很矮的畫面（手機橫放，高 520 以下）：標題縮小、拿掉副標，才放得進一個畫面 -->
      <main
        class="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-x-12 gap-y-4 px-4 pt-6 pb-6 [grid-template-areas:'title''input''seeds''action'] [@media(max-height:520px)]:gap-y-2 [@media(max-height:520px)]:py-3 sm:gap-y-6 sm:px-8 sm:pt-10 md:landscape:grid-cols-[1.1fr_1fr] md:landscape:grid-rows-[auto_auto_1fr] md:landscape:[grid-template-areas:'title_seeds''input_seeds''action_seeds'] lg:grid-cols-[1.1fr_1fr] lg:grid-rows-[auto_auto_1fr] lg:gap-y-8 lg:pt-4 lg:pb-16 lg:[grid-template-areas:'title_seeds''input_seeds''action_seeds']"
      >
        <div class="[grid-area:title]">
          <motion.h1
            v-bind="fadeUp"
            :transition="{ ...spring.smooth, delay: intro.title }"
            class="font-wide text-[clamp(2.25rem,10vw,4.5rem)] leading-[0.9] font-black lg:text-[clamp(4rem,8vw,6.5rem)] lg:leading-[0.88] [@media(max-height:520px)]:text-4xl"
          >
            Music Recs
          </motion.h1>
          <motion.p
            v-bind="fadeUp"
            :transition="{ ...spring.smooth, delay: intro.subtitle }"
            class="mt-2 max-w-md text-base leading-relaxed font-medium sm:mt-4 sm:text-xl lg:mt-6 [@media(max-height:520px)]:hidden"
          >
            選 1–3 位喜歡的歌手，拿到附試聽的推薦。
          </motion.p>
        </div>

        <motion.div
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.input }"
          class="z-10 max-w-xl [grid-area:input] lg:mt-2"
        >
          <SeedInput :locked="loading" />
        </motion.div>

        <motion.div
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.action }"
          class="flex flex-wrap items-center gap-4 self-start [grid-area:action]"
        >
          <motion.button
            type="button"
            :disabled="!store.isReady || loading"
            :aria-busy="loading"
            class="border-3 border-ink bg-teal px-6 py-3 font-wide text-xl font-black text-ink disabled:cursor-not-allowed disabled:bg-paper/60 disabled:text-ink/60"
            :while-press="{ scale: 0.96 }"
            :transition="spring.snappy"
            @click="fetchRecommendations"
          >
            {{ loading ? "推薦中…" : "推薦給我" }}
          </motion.button>
          <p v-if="hint" class="text-base font-medium">{{ hint }}</p>
        </motion.div>

        <!-- 太陽圓上貼著已選的種子，像參考插畫裡貼在裝備上的標籤。
             container-type: size 讓太陽圓用 cqw/cqh 取「寬、高較小的那個」當直徑，手機上自動縮到放得下 -->
        <div class="flex min-h-0 items-center justify-center [container-type:size] [grid-area:seeds] lg:min-h-[28rem]">
          <div class="relative aspect-square w-[min(100cqw,100cqh)] lg:w-[min(100cqw,100cqh,32rem)]">
            <motion.div
              aria-hidden="true"
              class="absolute inset-0 rounded-full bg-teal"
              :initial="{ scale: 0.6, opacity: 0 }"
              :animate="{ scale: 1, opacity: 1 }"
              :transition="spring.smooth"
            />
            <div v-if="mounted" class="absolute inset-0 flex flex-col items-center justify-center px-4">
              <h2 class="sr-only">已選的歌手</h2>
              <!-- 音浪從圓心底部長出來，接著開始跳 -->
              <AnimatePresence>
                <motion.div
                  v-if="!store.seeds.length"
                  class="flex size-full origin-[50%_68%] items-center justify-center"
                  :initial="{ opacity: 0, scale: 0.6 }"
                  :animate="{ opacity: 1, scale: 1 }"
                  :exit="{ opacity: 0, scale: 0.6 }"
                  :transition="{ ...spring.smooth, delay: sunContentDelay() }"
                >
                  <SoundWave />
                </motion.div>
              </AnimatePresence>
              <ul class="flex flex-col items-center gap-2 sm:gap-3">
                <AnimatePresence>
                  <motion.li
                    v-for="(seed, i) in store.seeds"
                    :key="seed"
                    layout
                    class="flex max-w-full items-stretch border-3 border-ink bg-ink text-paper"
                    :class="i % 2 ? 'translate-x-6' : '-translate-x-4'"
                    :initial="{ opacity: 0, scale: 0.8 }"
                    :animate="{ opacity: 1, scale: 1 }"
                    :exit="{ opacity: 0, scale: 0.8 }"
                    :transition="{ ...spring.snappy, delay: sunContentDelay(i) }"
                  >
                    <span aria-hidden="true" class="w-3 shrink-0" :class="['bg-coral', 'bg-pink', 'bg-teal-deep'][i % 3]" />
                    <span class="truncate px-3 py-1.5 text-sm font-medium sm:px-4 sm:py-2.5 sm:text-base">{{ seed }}</span>
                    <button
                      type="button"
                      :aria-label="`移除 ${seed}`"
                      :disabled="loading"
                      class="shrink-0 px-3 text-lg font-bold text-paper-muted hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-paper-muted"
                      @click="store.remove(seed)"
                    >
                      ×
                    </button>
                  </motion.li>
                </AnimatePresence>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <!-- 參考插畫腳下的深色地面：從左邊畫出來 -->
      <motion.div
        aria-hidden="true"
        class="h-4 shrink-0 origin-left bg-ink sm:h-6"
        :initial="{ scaleX: 0 }"
        :animate="{ scaleX: 1 }"
        :transition="{ ...spring.smooth, delay: intro.subtitle }"
      />
    </div>

    <!-- 第一個畫面以下：錯誤提示和推薦結果，出現時才需要捲動 -->
    <div v-if="notFound || failed || result" class="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 sm:py-20">
      <!-- 種子找不到（404）：說是哪一位，給建議的名字 -->
      <section v-if="notFound" class="max-w-2xl border-3 border-ink bg-paper p-6 text-ink" role="alert">
        <h2 ref="feedbackHeading" tabindex="-1" class="scroll-mt-6 font-wide text-2xl font-black focus:outline-none">
          找不到「{{ notFound.seed }}」
        </h2>
        <template v-if="notFound.suggestions.length">
          <p class="mt-2 text-base">你是不是要找：</p>
          <div class="mt-3 flex flex-wrap gap-3">
            <button
              v-for="s in notFound.suggestions"
              :key="s"
              type="button"
              class="border-3 border-ink bg-teal px-4 py-2 font-bold"
              @click="useSuggestion(notFound.seed, s)"
            >
              {{ s }}
            </button>
          </div>
        </template>
        <p v-else class="mt-2 text-base">換個寫法試試，或從自動完成的建議裡選。</p>
        <button type="button" class="mt-4 font-bold underline underline-offset-4" @click="removeMissing(notFound.seed)">
          移除「{{ notFound.seed }}」
        </button>
      </section>

      <section v-else-if="failed" class="max-w-2xl border-3 border-ink bg-paper p-6 text-ink" role="alert">
        <h2 ref="feedbackHeading" tabindex="-1" class="scroll-mt-6 font-wide text-2xl font-black focus:outline-none">
          音樂資料暫時拿不到
        </h2>
        <p class="mt-2 text-base">可能是資料來源忙線中，等一下再試。</p>
        <button type="button" class="mt-4 border-3 border-ink bg-teal px-4 py-2 font-bold" @click="fetchRecommendations">
          重試
        </button>
      </section>

      <section v-if="result" :class="{ 'mt-16': notFound || failed }" :aria-busy="loading">
        <h2 ref="resultsHeading" tabindex="-1" class="scroll-mt-6 font-wide text-4xl font-black focus:outline-none sm:text-5xl">
          推薦給你
        </h2>
        <ol class="mt-8 grid gap-4 md:grid-cols-2">
          <motion.li
            v-for="(card, i) in result.recommendations"
            :key="card.artist"
            layout
            v-bind="fadeUp"
            :transition="{ ...spring.smooth, delay: staggerStep * i }"
          >
            <RecommendationCard :card="card" @retry="fetchRecommendations" />
          </motion.li>
        </ol>
      </section>
    </div>
  </div>
</template>
