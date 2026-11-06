<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { MIN_SEEDS } from '~/stores/seeds'
import {
  parseRecommendationsQuery,
  recommendationsLocation
} from '~/utils/recommendations-route'

// 首頁只負責選種子；按 Recommend 換到 /recommendations，推薦結果、往下挖都在那一頁

const store = useSeedsStore()
const route = useRoute()
const router = useRouter()

// 還沒選到最少人數時，按鈕旁的提示
const hint = computed(() =>
  store.seeds.length < MIN_SEEDS ? 'Pick an artist first' : ''
)

// 第一次載入的進場順序（秒）：太陽圓先出來，左邊的文字依序跟上，最後是唱盤和下方的歌手標籤
const intro = {
  title: staggerStep,
  subtitle: staggerStep * 2,
  input: staggerStep * 3,
  action: staggerStep * 4,
  sunContent: 0.35
}

// 種子在掛載後才從 localStorage 讀出來（stores/seeds.ts 的 initOnMounted）。
// 讀到之前不畫歌手標籤
const mounted = ref(false)
// 進場結束後，之後加入的標籤馬上出現，不再等進場的延遲
const introDone = ref(false)
onMounted(() => {
  // 從推薦頁的麵包屑回來（/?seed=…）：輸入框換成那組種子，可以接著改。
  // 寫在 localStorage 讀完之後（store 的 onMounted 比這裡早註冊），才不會被舊的種子蓋掉；
  // 網址清回 /，之後重新整理不會又把使用者改過的種子換回去
  const fromUrl = parseRecommendationsQuery(route.query)
  if (fromUrl) {
    store.seeds = fromUrl.seeds
    void router.replace('/')
  }
  mounted.value = true
  setTimeout(() => (introDone.value = true), 1000)
})
const sunContentDelay = (i = 0) =>
  introDone.value ? 0 : intro.sunContent + staggerStep * i

// 推薦頁看到這個旗標，就先讓唱盤停在畫面中央一下（放唱針），再出現唱片，不會一閃而過
const needleDrop = useState('needle-drop', () => false)

function recommend() {
  if (!store.isReady) return
  needleDrop.value = true
  void navigateTo(recommendationsLocation(store.seeds))
}
</script>

<template>
  <main
    class="mx-auto flex h-dvh w-full max-w-7xl flex-col gap-x-12 gap-y-4 px-4 pt-4 pb-4 short:gap-y-2 tall:sm:gap-y-6 sm:px-8 sm:pt-6 sm:pb-6 wide:flex-row"
  >
    <!-- 整頁剛好一個螢幕高（h-dvh，手機瀏覽器網址列縮放時也準），不能捲動，所有寬度都一樣：
         視窗沒有全螢幕、高度不夠時，推薦按鈕也不會掉到畫面外。
         上、左右、下的留白和推薦頁一樣（推薦頁的麵包屑在哪，這頁的標題就在哪），換頁時不會跳。

         手機、直立平板（一欄）：標題 → 太陽圓（佔剩下的高度）→ 輸入框和標籤 → 推薦按鈕，由上往下（輸入和按鈕在下面，拇指搆得到）。
         橫放的平板、桌機（wide，兩欄）：左欄由上往下是標題、輸入框和標籤（上下置中）、推薦按鈕（左下角）；右欄是太陽圓。
         很矮的畫面（short，高 520 以下，手機橫放）：標題縮成一行、拿掉副標，才放得進一個畫面 -->
    <!-- 左欄。手機上是 display: contents：這層「消失」，裡面的標題、輸入框、按鈕直接排在 main 這一欄裡，
         再用 order 把太陽圓（order-2）排到標題（order-1）和輸入框（order-3）中間。
         兩欄時才是真的一欄：flex 1.1 比太陽圓的 1 寬一點 -->
    <div
      class="contents wide:flex wide:min-w-0 wide:flex-[1.1] wide:flex-col tall:wide:gap-y-[min(1.5rem,2dvh)] short:gap-y-2"
    >
      <div class="order-1 [container-type:inline-size]">
        <motion.h1
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.title }"
          aria-label="Music Recs"
          class="mt-[calc(0.4545rem+0.057em)] flex flex-col font-title text-[min(13cqw,7dvh)] leading-[0.8] short:text-[min(3rem,8dvh)] tall:wide:text-[clamp(3rem,min(11vw,14dvh),10rem)]"
        >
          <!-- 兩個字永遠上下疊。一欄時字級看標題區寬度（cqw）和畫面高度（dvh）取小的，兩欄時看寬、高，矮畫面再縮小。
               margin-top：字母頂端和推薦頁麵包屑的字母頂端對齊（0.4545rem 是麵包屑字母離行上緣的距離，
               0.057em 是標題拉高 1.18 倍後超出行上緣的部分，都在瀏覽器量的）。
               沒有空白字元，念出來的名字由 aria-label 給 -->
          <span class="origin-bottom-left scale-y-[1.18]">Music</span>
          <span class="origin-bottom-left scale-y-[1.18]">Recs</span>
        </motion.h1>
        <motion.p
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.subtitle }"
          class="mt-2 max-w-md text-base leading-relaxed font-medium sm:mt-4 sm:text-xl short:hidden"
        >
          Pick 1–3 artists you love.<br />Get recommendations you can preview.
        </motion.p>
      </div>

      <!-- 輸入框和已選歌手的標籤：打字 → 看到加了誰 → 按推薦，由上往下讀。
           兩欄時上下的 margin 都是 auto：夾在標題和按鈕中間置中。
           z-10：自動完成的選單蓋在下面的東西上面 -->
      <div
        class="z-10 order-3 flex max-w-xl flex-col gap-y-3 short:gap-y-2 wide:my-auto"
      >
        <motion.div
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.input }"
        >
          <SeedInput />
        </motion.div>

        <!-- 高度事先留好，加減歌手時其他東西不會跳：手機（640 以下）3 位會折成兩行，留兩行；
             橫放的平板左欄窄，也留兩行；其他寬度一行放得下，留一行。很矮的畫面標籤用小的尺寸，留小的兩行。
             沒有歌手時這塊是空的（不放提示文字），高度照樣留著。
             種子在掛載後才從 localStorage 讀出來，讀到之前不畫 -->
        <div
          class="flex min-h-[4.75rem] items-start tall:sm:min-h-11 tall:md:max-lg:landscape:min-h-[5.75rem] tall:lg:min-h-11"
        >
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
                  <span
                    aria-hidden="true"
                    class="w-2.5 shrink-0"
                    :class="['bg-coral', 'bg-pink', 'bg-teal-deep'][i % 3]"
                  />
                  <span
                    class="truncate py-1 pr-1 pl-3 text-sm font-medium tall:sm:py-1.5 tall:sm:text-base"
                    >{{ seed }}</span
                  >
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
      </div>

      <motion.div
        v-bind="fadeUp"
        :transition="{ ...spring.smooth, delay: intro.action }"
        class="order-3 flex flex-wrap items-center gap-4"
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
    </div>

    <!-- 太陽圓＋黑膠唱盤，純裝飾，一直在、一直轉。手機上在標題和輸入框中間（order-2），佔剩下的高度；兩欄時是右欄。
         container-type: size 讓太陽圓用 cqw/cqh 取「寬、高較小的那個」當直徑，放得下多大就多大 -->
    <div
      class="order-2 flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]"
    >
      <!-- 黑膠唱盤在太陽圓出現後放大出現，接著唱臂擺進來。
           view-transition-name 和推薦頁的唱盤同名：按 Recommend 換頁時，瀏覽器把它從這裡移到推薦頁中央 -->
      <div
        class="aspect-square w-[min(100cqw,100cqh)] [view-transition-name:turntable] lg:w-[min(100cqw,100cqh,32rem)]"
      >
        <SunTurntable :record-delay="intro.sunContent" />
      </div>
    </div>
  </main>
</template>
