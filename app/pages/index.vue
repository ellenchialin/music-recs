<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { MIN_SEEDS } from '~/stores/seeds'
import { MAX_DESCRIPTION_LENGTH } from '~~/shared/types/describe'
import {
  parseRecommendationsQuery,
  recommendationsLocation
} from '~/utils/recommendations-route'

const store = useSeedsStore()
const route = useRoute()
const router = useRouter()

// Two ways in: pick artists by name, or describe a vibe and let the agent find artists
type StartMode = 'artists' | 'vibe'
const MODES = [
  { value: 'artists', label: 'By artist' },
  { value: 'vibe', label: 'By vibe' }
] as const
const mode = ref<StartMode>('artists')
const description = ref('')

// Two examples taking turns, so the box shows both a mood and an artist-based request
const EXAMPLES = [
  'e.g. Like Tame Impala, but for running',
  'e.g. Lazy jazz for a rainy afternoon'
]
const example = ref(0)
useIntervalFn(() => {
  if (!description.value) example.value = (example.value + 1) % EXAMPLES.length
}, 4000)

const hint = computed(() => {
  // Short, like "Add an artist first", so it stays beside the wider "Find artists"
  if (mode.value === 'vibe')
    return description.value.trim() ? '' : 'Describe it first'
  return store.seeds.length < MIN_SEEDS ? 'Add an artist first' : ''
})

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

// Tells the describe page to start at once; a reload or shared link waits for a click instead
const describeNow = useState('describe-now', () => false)

function findArtists() {
  const q = description.value.trim()
  if (!q) return
  describeNow.value = true
  void navigateTo({ path: '/describe', query: { q } })
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
          Name a few artists, or just describe what you're in the mood for.
        </motion.p>
      </div>

      <!-- z-10 so the suggestion list covers what's below -->
      <div
        class="z-10 order-3 flex max-w-xl flex-col gap-y-3 short:gap-y-2 wide:my-auto"
      >
        <motion.div
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: intro.input }"
          class="flex flex-col gap-y-3 short:gap-y-2"
        >
          <SegmentedChoice
            v-model="mode"
            :options="MODES"
            name="start-mode"
            legend="Start from"
            class="self-start"
          />
          <!-- Both ways share one grid cell, so the block is always as tall as the taller one and
               switching moves nothing. The other one stays laid out but invisible and inert -->
          <div class="grid">
            <div
              data-testid="start-artists"
              :inert="mode !== 'artists'"
              class="col-start-1 row-start-1 flex flex-col gap-y-3 short:gap-y-2"
              :class="{ invisible: mode !== 'artists' }"
            >
              <SeedInput />
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
                        :transition="{
                          ...spring.snappy,
                          delay: sunContentDelay(i)
                        }"
                      >
                        <span
                          aria-hidden="true"
                          class="w-2.5 shrink-0"
                          :class="
                            ['bg-coral', 'bg-pink', 'bg-teal-deep'][i % 3]
                          "
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
            <div
              data-testid="start-vibe"
              :inert="mode !== 'vibe'"
              class="col-start-1 row-start-1 flex flex-col"
              :class="{ invisible: mode !== 'vibe' }"
            >
              <!-- Same type and short-screen rules as SeedInput's label, hint and box -->
              <label
                for="vibe"
                class="block text-base font-bold sm:text-lg short:sr-only"
                >Describe what you're in the mood for</label
              >
              <textarea
                id="vibe"
                v-model="description"
                :maxlength="MAX_DESCRIPTION_LENGTH"
                :placeholder="EXAMPLES[example]"
                class="mt-2 h-24 w-full resize-none border-3 border-ink bg-paper px-4 py-2.5 text-lg text-ink placeholder:text-ink/50 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ink short:mt-0 short:h-14"
                @keydown.enter.exact.prevent="findArtists"
              />
              <p
                class="mt-2 min-h-5 text-sm font-medium sm:min-h-6 sm:text-base"
              >
                An artist, a mood, a moment. Press Enter to search.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        v-bind="fadeUp"
        :transition="{ ...spring.smooth, delay: intro.action }"
        class="order-3 flex flex-wrap items-center gap-4"
      >
        <motion.button
          v-if="mode === 'vibe'"
          type="button"
          :disabled="!description.trim()"
          class="border-3 border-ink bg-teal px-5 py-2.5 font-wide text-lg font-black text-ink sm:px-6 sm:py-3 sm:text-xl disabled:cursor-not-allowed disabled:bg-paper/60 disabled:text-ink/60"
          :while-press="{ scale: 0.96 }"
          :transition="spring.snappy"
          @click="findArtists"
        >
          Find artists
        </motion.button>
        <motion.button
          v-else
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
