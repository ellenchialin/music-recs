<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import type { RecommendationsResult, SeedNotFoundData } from "~~/shared/types/recommendations";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";
import { canExplore, excludedFor, type Trail } from "~/utils/explore-trail";
import {
  homeLocation,
  parseRecommendationsQuery,
  recommendationsLocation,
  seedsLabel,
  tasteCheckLocation,
} from "~/utils/recommendations-route";

// /recommendations?seed=…&explore=…: the URL decides everything, so Back goes up a level

const route = useRoute();
const router = useRouter();
const query = computed(() => parseRecommendationsQuery(route.query));

// Every level fetched so far, keyed by seeds + path, so going back never refetches.
// useState also carries server-fetched results to the browser
const levels = useState<Record<string, RecommendationsResult>>("recommendation-levels", () => ({}));
// The record being viewed on each level
const viewing = useState<Record<string, number>>("recommendation-viewing", () => ({}));
const levelKey = (seeds: string[], path: string[]) =>
  JSON.stringify([seeds.map(normalizeArtistName), path.map(normalizeArtistName)]);

const api = useApiFetch();

type Loaded = { trail: Trail; notFound: SeedNotFoundData | null; failed: boolean; rateLimited: boolean };

// Level 0 uses the user's seeds; deeper levels use one artist and exclude everything shown above
async function fetchLevel(seeds: string[], path: string[], above: Trail): Promise<RecommendationsResult> {
  const key = levelKey(seeds, path);
  const cached = levels.value[key];
  if (cached) return cached;
  const artist = path.at(-1);
  const result = await api<RecommendationsResult>("/api/recommendations", {
    query: artist ? { seed: artist, exclude: excludedFor(above, seeds) } : { seed: seeds },
  });
  levels.value[key] = result;
  return result;
}

// Fetches level by level. Errors become state instead of being thrown
async function load(q: NonNullable<typeof query.value>): Promise<Loaded> {
  const trail: Trail = [];
  try {
    for (let depth = 0; depth <= q.explore.length; depth++) {
      const path = q.explore.slice(0, depth);
      const result = await fetchLevel(q.seeds, path, trail);
      // A shared link whose level has nothing new anymore: stop at the level above
      if (depth > 0 && !result.recommendations.length) break;
      trail.push({ artist: path.at(-1) ?? null, result, index: 0 });
    }
    return { trail, notFound: null, failed: false, rateLimited: false };
  } catch (err) {
    const error = err as { statusCode?: number; data?: { data?: SeedNotFoundData } };
    if (error.statusCode === 404 && error.data?.data) {
      return { trail: [], notFound: error.data.data, failed: false, rateLimited: false };
    }
    return { trail, notFound: null, failed: true, rateLimited: error.statusCode === 429 };
  }
}

// lazy: navigate immediately and show the turntable while loading. Reruns when the URL changes
const { data, status, refresh } = useAsyncData(
  "recommendations",
  () => (query.value ? load(query.value) : Promise.resolve(null)),
  { watch: [query], lazy: true },
);

const trail = computed(() => data.value?.trail ?? []);
const currentLevel = computed(() => trail.value.at(-1));
const currentKey = computed(() =>
  query.value ? levelKey(query.value.seeds, query.value.explore.slice(0, trail.value.length - 1)) : "",
);
const loadingFirst = computed(() => status.value === "pending" && !data.value);

// Coming from home, hold the turntable even if data is instant, so it doesn't flash past like an
// afterimage. Direct visits (reload, shared link) show results right away
const NEEDLE_DROP_MS = 1100;
const needleDrop = useState("needle-drop", () => false);
// Read in setup, not onMounted: the first render must already be right
const fromHome = import.meta.client && needleDrop.value;
const holding = ref(fromHome);
// A turntable that morphed in from home skips its own entrance animation
const morphed = fromHome && "startViewTransition" in document;
onMounted(() => {
  if (!fromHome) return;
  needleDrop.value = false;
  setTimeout(() => (holding.value = false), NEEDLE_DROP_MS);
});
const showTurntable = computed(() => loadingFirst.value || holding.value);

// Slide in from the right when exploring (1), from the left when going back (-1)
const direction = ref(1);
watch(
  () => query.value?.explore.length ?? 0,
  (depth, previous) => (direction.value = depth >= previous ? 1 : -1),
);

const exploring = ref(false);
const exploreMessage = ref("");
watch(currentKey, () => (exploreMessage.value = ""));

// Fetch the next level first and only change the URL if it has new artists
async function explore(artist: string) {
  const q = query.value;
  if (!q || !canExplore(trail.value) || exploring.value) return;
  exploring.value = true;
  exploreMessage.value = "";
  const path = [...q.explore.slice(0, trail.value.length - 1), artist];
  try {
    const result = await fetchLevel(q.seeds, path, trail.value);
    if (!result.recommendations.length) {
      exploreMessage.value = "No new artists here — try another record";
      return;
    }
    direction.value = 1;
    await nextTick();
    await router.push(recommendationsLocation(q.seeds, path));
  } catch (err) {
    exploreMessage.value =
      (err as { statusCode?: number }).statusCode === 429
        ? "Too many requests — try again in a minute"
        : "Couldn't load more artists — try again in a moment";
  } finally {
    exploring.value = false;
  }
}

function onIndexChange(index: number) {
  viewing.value[currentKey.value] = index;
  exploreMessage.value = "";
}

// Preview errors aren't cached, so refetching this level retries iTunes
function retryLevel() {
  const { [currentKey.value]: _, ...rest } = levels.value;
  levels.value = rest;
  void refresh();
}

function useSuggestion(seed: string, suggestion: string) {
  const seeds = query.value?.seeds.map((s) => (s === seed ? suggestion : s)) ?? [suggestion];
  void router.replace(recommendationsLocation(seeds));
}

function removeMissing(seed: string) {
  const seeds = query.value?.seeds.filter((s) => s !== seed) ?? [];
  void router.replace(seeds.length ? recommendationsLocation(seeds) : homeLocation([]));
}

// Home › Tame Impala + Kokoroko › Pond › GUM
const crumbs = computed(() => {
  const q = query.value;
  if (!q) return [];
  return [
    { label: seedsLabel(q.seeds), to: recommendationsLocation(q.seeds) },
    ...trail.value.slice(1).map((level, i) => ({
      label: level.artist!,
      to: recommendationsLocation(q.seeds, q.explore.slice(0, i + 1)),
    })),
  ];
});

// Move focus to the heading on level change so screen reader users know the content changed
const heading = ref<HTMLElement | null>(null);
watch(currentKey, async () => {
  await nextTick();
  heading.value?.focus({ preventScroll: true });
});

useHead({ title: () => (currentLevel.value?.artist ? `More like ${currentLevel.value.artist} · Music Recs` : "Music Recs") });
</script>

<template>
  <div class="flex h-dvh flex-col">
    <!-- One screen tall: everything has a fixed height except the covers, which take the rest -->
    <header class="mx-auto flex w-full max-w-7xl shrink-0 items-baseline gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
      <!-- One line; scrolls sideways when too long -->
      <nav aria-label="Breadcrumb" class="min-w-0 flex-1 overflow-x-auto">
        <ol class="flex items-center gap-2 text-base whitespace-nowrap">
          <li class="flex items-center gap-2">
            <NuxtLink :to="homeLocation(query?.seeds ?? [])" class="font-bold underline underline-offset-4">Home</NuxtLink>
          </li>
          <li v-for="(crumb, i) in crumbs" :key="i" class="flex items-center gap-2">
            <span aria-hidden="true">›</span>
            <NuxtLink v-if="i < crumbs.length - 1" :to="crumb.to" class="font-bold underline underline-offset-4">
              {{ crumb.label }}
            </NuxtLink>
            <span v-else aria-current="page" class="font-bold">{{ crumb.label }}</span>
          </li>
        </ol>
      </nav>
      <!-- Always tests the original seeds' recommendations, whichever level is showing -->
      <NuxtLink v-if="query" :to="tasteCheckLocation(query.seeds)" class="shrink-0 font-bold whitespace-nowrap underline underline-offset-4">
        Fit your taste? →
      </NuxtLink>
    </header>

    <main class="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-x-clip px-4 pt-4 pb-4 sm:px-8 sm:pt-6 sm:pb-6">
      <section v-if="!query" class="max-w-2xl">
        <h1 class="font-wide text-4xl font-black sm:text-5xl">Pick an artist first</h1>
        <p class="mt-3 text-lg">Choose 1–3 artists you love, then come back for recommendations.</p>
        <NuxtLink to="/" class="mt-6 inline-block border-3 border-ink bg-teal px-5 py-2.5 font-wide text-lg font-black">
          Back to home
        </NuxtLink>
      </section>

      <div v-else-if="showTurntable" role="status" class="flex flex-1 items-center justify-center py-10">
        <span class="sr-only">Finding recommendations…</span>
        <!-- Same view-transition-name as the home turntable -->
        <div class="size-[min(70vw,22rem)] [view-transition-name:turntable]">
          <SunTurntable :record-delay="0.1" :entrance="!morphed" />
        </div>
      </div>

      <section v-else-if="data?.notFound" class="max-w-2xl border-3 border-ink bg-paper p-6 text-ink" role="alert">
        <h1 class="font-wide text-2xl font-black">Can&apos;t find "{{ data.notFound.seed }}"</h1>
        <template v-if="data.notFound.suggestions.length">
          <p class="mt-2 text-base">Did you mean:</p>
          <div class="mt-3 flex flex-wrap gap-3">
            <button
              v-for="s in data.notFound.suggestions"
              :key="s"
              type="button"
              class="border-3 border-ink bg-teal px-4 py-2 font-bold"
              @click="useSuggestion(data.notFound.seed, s)"
            >
              {{ s }}
            </button>
          </div>
        </template>
        <p v-else class="mt-2 text-base">Try another spelling, or pick one of the suggestions as you type.</p>
        <button type="button" class="mt-4 font-bold underline underline-offset-4" @click="removeMissing(data.notFound.seed)">
          Remove "{{ data.notFound.seed }}"
        </button>
      </section>

      <section v-else-if="data?.failed && !currentLevel" class="max-w-2xl border-3 border-ink bg-paper p-6 text-ink" role="alert">
        <template v-if="data.rateLimited">
          <h1 class="font-wide text-2xl font-black">Too many requests</h1>
          <p class="mt-2 text-base">Wait a minute, then try again.</p>
        </template>
        <template v-else>
          <h1 class="font-wide text-2xl font-black">Music data is unavailable</h1>
          <p class="mt-2 text-base">The data source may be busy. Try again in a moment.</p>
        </template>
        <button type="button" class="mt-4 border-3 border-ink bg-teal px-4 py-2 font-bold" @click="refresh()">Try again</button>
      </section>

      <section v-else-if="currentLevel" :aria-busy="exploring" class="flex min-h-0 flex-1 flex-col">
        <h1
          ref="heading"
          tabindex="-1"
          class="shrink-0 truncate font-wide text-[clamp(1.375rem,6vw,3rem)] leading-tight font-black focus:outline-none short-landscape:text-2xl"
        >
          {{ currentLevel.artist ? `More like ${currentLevel.artist}` : "Recommended for you" }}
        </h1>

        <!-- Side covers overflow and are clipped by main's overflow-x-clip. One crate per level (key) -->
        <motion.div v-bind="fadeUp" :transition="spring.smooth" class="mt-4 min-h-0 flex-1 sm:mt-6">
          <AnimatePresence mode="wait" :initial="false">
            <motion.div
              :key="currentKey"
              class="h-full"
              :initial="{ opacity: 0, x: 48 * direction }"
              :animate="{ opacity: 1, x: 0 }"
              :exit="{ opacity: 0, x: -48 * direction }"
              :transition="spring.smooth"
            >
              <RecordCrate
                :index="viewing[currentKey] ?? 0"
                :cards="currentLevel.result.recommendations"
                :can-explore="canExplore(trail)"
                :exploring="exploring"
                :notice="exploreMessage"
                @update:index="onIndexChange"
                @explore="explore"
                @retry="retryLevel"
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </section>
    </main>

  </div>
</template>
