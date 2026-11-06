<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { MIN_SEEDS } from '~/stores/seeds'
import {
  parseRecommendationsQuery,
  recommendationsLocation
} from '~/utils/recommendations-route'

const store = useSeedsStore()
const route = useRoute()
const router = useRouter()

const hint = computed(() =>
  store.seeds.length < MIN_SEEDS ? 'Add an artist first' : ''
)

// Entrance delays in seconds
const intro = {
  title: staggerStep,
  subtitle: staggerStep * 2,
  input: staggerStep * 3,
  action: staggerStep * 4,
  sunContent: 0.35
}

// Seeds are read from localStorage after mount, so don't render the tags before then
const mounted = ref(false)
const introDone = ref(false)
onMounted(() => {
  // Back from the breadcrumb (/?seed=…): load those seeds. This runs after the store reads
  // localStorage, so it wins; then clean the URL so a reload doesn't undo later edits
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

// Tells the recommendations page to hold the turntable briefly instead of flashing past
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
    <!-- Exactly one screen tall at every size, with the same padding as the recommendations page.
         One column: title, turntable (takes the remaining height), input, button.
         wide: left column with title, input and button; turntable on the right -->
    <!-- display: contents in one column, so `order` can put the turntable between title and input -->
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
          <!-- margin-top lines the letters up with the breadcrumb's (both values measured in the browser):
               0.4545rem is the breadcrumb's cap offset, 0.057em offsets the 1.18× stretch -->
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

      <!-- z-10 so the suggestion list covers what's below -->
      <div
        class="z-10 order-3 flex max-w-xl flex-col gap-y-3 short:gap-y-2 wide:my-auto"
      >
        <motion.div
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.input }"
        >
          <SeedInput />
        </motion.div>

        <!-- Height reserved for wrapped tags, so adding an artist doesn't shift the layout -->
        <div
          class="flex min-h-[4.75rem] items-start tall:sm:min-h-11 tall:md:max-lg:landscape:min-h-[5.75rem] tall:lg:min-h-11"
        >
          <h2 class="sr-only">Your artists</h2>
          <template v-if="mounted">
            <!-- No layout animation: it makes wrapping rows overlap -->
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

    <!-- Size container: the sun's diameter is the smaller of cqw and cqh -->
    <div
      class="order-2 flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]"
    >
      <!-- Same view-transition-name as the recommendations page turntable, so it morphs across -->
      <div
        class="aspect-square w-[min(100cqw,100cqh)] [view-transition-name:turntable] lg:w-[min(100cqw,100cqh,32rem)]"
      >
        <SunTurntable :record-delay="intro.sunContent" />
      </div>
    </div>
  </main>
</template>
