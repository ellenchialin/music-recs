<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import { MIN_SEEDS } from "~/stores/seeds";
import { parseRecommendationsQuery, recommendationsLocation } from "~/utils/recommendations-route";

// 首頁只負責選種子；按 Recommend 換到 /recommendations，推薦結果、往下挖都在那一頁

const store = useSeedsStore();
const route = useRoute();
const router = useRouter();

// 還沒選到最少人數時，按鈕旁的提示
const hint = computed(() => (store.seeds.length < MIN_SEEDS ? "Pick an artist first" : ""));

// 第一次載入的進場順序（秒）：太陽圓先出來，左邊的文字依序跟上，最後是唱盤和下方的歌手標籤
const intro = {
  title: staggerStep,
  subtitle: staggerStep * 2,
  input: staggerStep * 3,
  action: staggerStep * 4,
  sunContent: 0.35,
};

// 種子在掛載後才從 localStorage 讀出來（stores/seeds.ts 的 initOnMounted）。
// 讀到之前不畫歌手標籤
const mounted = ref(false);
// 進場結束後，之後加入的標籤馬上出現，不再等進場的延遲
const introDone = ref(false);
onMounted(() => {
  // 從推薦頁的麵包屑回來（/?seed=…）：輸入框換成那組種子，可以接著改。
  // 寫在 localStorage 讀完之後（store 的 onMounted 比這裡早註冊），才不會被舊的種子蓋掉；
  // 網址清回 /，之後重新整理不會又把使用者改過的種子換回去
  const fromUrl = parseRecommendationsQuery(route.query);
  if (fromUrl) {
    store.seeds = fromUrl.seeds;
    void router.replace("/");
  }
  mounted.value = true;
  setTimeout(() => (introDone.value = true), 1000);
});
const sunContentDelay = (i = 0) => (introDone.value ? 0 : intro.sunContent + staggerStep * i);

// 推薦頁看到這個旗標，就先讓唱盤停在畫面中央一下（放唱針），再出現唱片，不會一閃而過
const needleDrop = useState("needle-drop", () => false);

function recommend() {
  if (!store.isReady) return;
  needleDrop.value = true;
  void navigateTo(recommendationsLocation(store.seeds));
}
</script>

<template>
  <div>
    <!-- 整頁剛好一個螢幕高，不能捲動。1024px 以下用 h-dvh（手機瀏覽器網址列縮放時也準），
         太陽圓佔掉其他元素剩下的高度；桌機（lg）維持左右兩欄 -->
    <div class="flex h-dvh flex-col lg:h-auto lg:min-h-dvh">
      <header class="mx-auto hidden w-full max-w-7xl items-center px-8 py-5 lg:flex">
        <span class="font-wide text-lg font-extrabold">Music Recs</span>
      </header>

      <!-- 手機、直立平板：標題 → 太陽圓 → 輸入框 → 已選歌手的標籤 → 推薦按鈕，由上往下（輸入和按鈕在下面，拇指搆得到）；
           桌機和橫放的平板（寬 768 以上、橫向）：左欄是標題、輸入、標籤（上下各一列 1fr 的空白，整組上下置中），
           推薦按鈕在左欄最下面（左下角）；右欄是太陽圓和黑膠唱盤，太陽圓才放得大；
           很矮的畫面（手機橫放，高 520 以下）：標題縮小成一行、拿掉副標、輸入框的標籤文字只給螢幕閱讀器，才放得進一個畫面 -->
      <main
        class="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-rows-[auto_minmax(0,1fr)_auto_auto_auto] gap-x-12 gap-y-4 px-4 pt-6 pb-6 [grid-template-areas:'title''record''input''tags''action'] [@media(max-height:520px)]:gap-y-2 [@media(max-height:520px)]:py-3 sm:gap-y-6 sm:px-8 sm:pt-10 md:landscape:grid-cols-[1.1fr_1fr] md:landscape:grid-rows-[1fr_auto_auto_auto_1fr_auto] md:landscape:[grid-template-areas:'._record''title_record''input_record''tags_record''._record''action_record'] lg:grid-cols-[1.1fr_1fr] lg:grid-rows-[1fr_auto_auto_auto_1fr_auto] lg:gap-y-5 lg:pt-2 lg:pb-8 lg:[grid-template-areas:'._record''title_record''input_record''tags_record''._record''action_record']"
      >
        <div class="[grid-area:title]">
          <motion.h1
            v-bind="fadeUp"
            :transition="{ ...spring.smooth, delay: intro.title }"
            class="font-title text-[clamp(3.5rem,17vw,7rem)] leading-[0.8] lg:text-[clamp(6.5rem,11vw,10rem)] lg:leading-[0.78] [@media(max-height:520px)]:text-5xl"
          >
            <!-- 每個字拉高 1.18 倍；手機一行、桌機（含橫放平板）兩行疊起來 -->
            <span class="inline-block origin-bottom-left scale-y-[1.18]">Music</span> <span class="inline-block origin-bottom-left scale-y-[1.18] md:landscape:block lg:block [@media(max-height:520px)]:!inline-block">Recs</span>
          </motion.h1>
          <motion.p
            v-bind="fadeUp"
            :transition="{ ...spring.smooth, delay: intro.subtitle }"
            class="mt-2 max-w-md text-base leading-relaxed font-medium sm:mt-4 sm:text-xl lg:mt-6 [@media(max-height:520px)]:hidden"
          >
            Pick 1–3 artists you love.<br>Get recommendations you can preview.
          </motion.p>
        </div>

        <motion.div
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.input }"
          class="z-10 max-w-xl [grid-area:input] lg:mt-2"
        >
          <SeedInput />
        </motion.div>

        <!-- 已選歌手的標籤，緊接在輸入框下面：打字 → 看到加了誰 → 按推薦，由上往下讀。
             高度事先留好，加減歌手時其他東西不會跳：手機（640 以下）3 位會折成兩行，留兩行；
             橫放時左欄窄，也留兩行；其他寬度一行放得下，留一行。很矮的畫面（高 520 以下）標籤用小的尺寸，留小的兩行。
             沒有歌手時這塊是空的（不放提示文字），高度照樣留著。
             種子在掛載後才從 localStorage 讀出來，讀到之前不畫 -->
        <div class="flex min-h-[4.75rem] max-w-xl items-start [grid-area:tags] sm:min-h-11 md:landscape:min-h-[5.75rem] lg:min-h-11 [@media(max-height:520px)]:!min-h-[4.75rem]">
          <h2 class="sr-only">Your artists</h2>
          <template v-if="mounted">
            <!-- 標籤不縮（flex-none）：放不下就換行，不要把前一個擠到被截斷；
                 不用 layout 動畫，會換行的一排用它容易疊在一起 -->
            <ul aria-label="Your artists" class="flex flex-wrap gap-2">
              <AnimatePresence>
                <motion.li
                  v-for="(seed, i) in store.seeds"
                  :key="seed"
                  class="flex max-w-full flex-none items-stretch border-3 border-ink bg-ink text-paper"
                  :initial="{ opacity: 0, y: 8 }"
                  :animate="{ opacity: 1, y: 0 }"
                  :exit="{ opacity: 0, scale: 0.8 }"
                  :transition="{ ...spring.snappy, delay: sunContentDelay(i) }"
                >
                  <span aria-hidden="true" class="w-2.5 shrink-0" :class="['bg-coral', 'bg-pink', 'bg-teal-deep'][i % 3]" />
                  <span class="truncate py-1 pr-1 pl-3 text-sm font-medium sm:py-1.5 sm:text-base [@media(max-height:520px)]:!py-1 [@media(max-height:520px)]:!text-sm">{{ seed }}</span>
                  <button
                    type="button"
                    :aria-label="`Remove ${seed}`"
                    class="shrink-0 px-2.5 text-lg leading-none font-bold text-paper-muted hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-paper-muted"
                    @click="store.remove(seed)"
                  >
                    ×
                  </button>
                </motion.li>
              </AnimatePresence>
            </ul>
          </template>
        </div>

        <motion.div
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.action }"
          class="flex flex-wrap items-center gap-4 self-start [grid-area:action]"
        >
          <motion.button
            type="button"
            :disabled="!store.isReady"
            class="border-3 border-ink bg-teal px-5 py-2.5 font-wide text-lg font-black text-ink sm:px-6 sm:py-3 sm:text-xl disabled:cursor-not-allowed disabled:bg-paper/60 disabled:text-ink/60"
            :while-press="{ scale: 0.96 }"
            :transition="spring.snappy"
            @click="recommend"
          >
            Recommend
          </motion.button>
          <p v-if="hint" class="text-base font-medium">{{ hint }}</p>
        </motion.div>

        <!-- 右欄（手機在標題和輸入框之間）：太陽圓＋黑膠唱盤，純裝飾，一直在、一直轉。
             container-type: size 讓太陽圓用 cqw/cqh 取「寬、高較小的那個」當直徑，手機上自動縮到放得下 -->
        <div class="flex min-h-0 items-center justify-center [container-type:size] [grid-area:record] lg:min-h-[28rem]">
          <!-- 黑膠唱盤在太陽圓出現後放大出現，接著唱臂擺進來 -->
          <!-- view-transition-name 和推薦頁的唱盤同名：按 Recommend 換頁時，瀏覽器把它從這裡移到推薦頁中央 -->
          <div class="aspect-square w-[min(100cqw,100cqh)] [view-transition-name:turntable] lg:w-[min(100cqw,100cqh,32rem)]">
            <SunTurntable :record-delay="intro.sunContent" />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
