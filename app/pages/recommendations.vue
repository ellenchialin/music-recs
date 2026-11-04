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
} from "~/utils/recommendations-route";

// /recommendations?seed=…&explore=…：推薦結果和 Explore from here 的路徑都由網址決定，
// 所以上一頁＝回上一層，重新整理、分享連結都看到同一個畫面

const route = useRoute();
const router = useRouter();
const query = computed(() => parseRecommendationsQuery(route.query));

// 查過的每一層存起來（key 是「種子 ＋ 路徑」）：回上一層、按上一頁都不用重新查詢。
// useState：伺服器端查好的結果會跟著頁面送到瀏覽器，打開就不必再查一次
const levels = useState<Record<string, RecommendationsResult>>("recommendation-levels", () => ({}));
// 每一層看到第幾張：回到那一層時從那一張開始
const viewing = useState<Record<string, number>>("recommendation-viewing", () => ({}));
const levelKey = (seeds: string[], path: string[]) =>
  JSON.stringify([seeds.map(normalizeArtistName), path.map(normalizeArtistName)]);

type Loaded = { trail: Trail; notFound: SeedNotFoundData | null; failed: boolean };

// 第 0 層用使用者的種子；往下挖的每一層只用那位歌手當種子，排除原本的種子和上面各層看過的唱片
async function fetchLevel(seeds: string[], path: string[], above: Trail): Promise<RecommendationsResult> {
  const key = levelKey(seeds, path);
  const cached = levels.value[key];
  if (cached) return cached;
  const artist = path.at(-1);
  const result = await $fetch<RecommendationsResult>("/api/recommendations", {
    query: artist ? { seed: artist, exclude: excludedFor(above, seeds) } : { seed: seeds },
  });
  levels.value[key] = result;
  return result;
}

// 依網址一層一層查。錯誤不往外丟，轉成狀態：404 給建議的名字，其他顯示「暫時拿不到」
async function load(q: NonNullable<typeof query.value>): Promise<Loaded> {
  const trail: Trail = [];
  try {
    for (let depth = 0; depth <= q.explore.length; depth++) {
      const path = q.explore.slice(0, depth);
      const result = await fetchLevel(q.seeds, path, trail);
      // 分享連結裡某一層已經沒有新歌手（資料變了）：停在上一層
      if (depth > 0 && !result.recommendations.length) break;
      trail.push({ artist: path.at(-1) ?? null, result, index: 0 });
    }
    return { trail, notFound: null, failed: false };
  } catch (err) {
    const error = err as { statusCode?: number; data?: { data?: SeedNotFoundData } };
    if (error.statusCode === 404 && error.data?.data) return { trail: [], notFound: error.data.data, failed: false };
    return { trail, notFound: null, failed: true };
  }
}

// lazy：從首頁換過來時先顯示唱盤，不等查完才換頁。網址變了（往下挖、回上一層）就重新跑 load，查過的層直接從 levels 拿
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

// 換層的動畫方向：往下挖從右邊滑進來（1），回上一層（麵包屑、上一頁）從左邊（-1）
const direction = ref(1);
watch(
  () => query.value?.explore.length ?? 0,
  (depth, previous) => (direction.value = depth >= previous ? 1 : -1),
);

const exploring = ref(false);
// 往下挖沒有新歌手、或查詢失敗時，唱片箱下方的一行提示
const exploreMessage = ref("");
watch(currentKey, () => (exploreMessage.value = ""));

// Explore from here：先查下一層，有新歌手才改網址；沒有就停在這層並提示
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
  } catch {
    exploreMessage.value = "Couldn't load more artists — try again in a moment";
  } finally {
    exploring.value = false;
  }
}

// 換到別張唱片：記住看到第幾張，提示（例如沒有新歌手）收起來
function onIndexChange(index: number) {
  viewing.value[currentKey.value] = index;
  exploreMessage.value = "";
}

// 試聽載入失敗時的重試：丟掉這一層的結果重查
function retryLevel() {
  const { [currentKey.value]: _, ...rest } = levels.value;
  levels.value = rest;
  void refresh();
}

// 種子找不到時點了建議的名字：換掉網址裡那一位
function useSuggestion(seed: string, suggestion: string) {
  const seeds = query.value?.seeds.map((s) => (s === seed ? suggestion : s)) ?? [suggestion];
  void router.replace(recommendationsLocation(seeds));
}

function removeMissing(seed: string) {
  const seeds = query.value?.seeds.filter((s) => s !== seed) ?? [];
  void router.replace(seeds.length ? recommendationsLocation(seeds) : homeLocation([]));
}

// 麵包屑：Home › Tame Impala + Kokoroko › Pond › GUM。最後一個是目前所在，其他是連結
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

// 換層之後把焦點移到標題：螢幕閱讀器使用者知道內容換了（不捲動，路由換頁時已經回到頂端）
const heading = ref<HTMLElement | null>(null);
watch(currentKey, async () => {
  await nextTick();
  heading.value?.focus({ preventScroll: true });
});

useHead({ title: () => (currentLevel.value?.artist ? `More like ${currentLevel.value.artist} · Music Recs` : "Music Recs") });
</script>

<template>
  <div class="flex h-dvh flex-col">
    <!-- 整頁剛好一個螢幕高，不能捲動：麵包屑、標題、唱片箱的資訊和操作高度固定，封面佔剩下的空間 -->
    <header class="mx-auto w-full max-w-7xl shrink-0 px-4 pt-4 sm:px-8 sm:pt-6">
      <!-- 麵包屑：Home 帶著種子回首頁重新輸入；後面是 Explore 的路徑。手機上只有一行，太長就左右捲 -->
      <nav aria-label="Breadcrumb" class="overflow-x-auto">
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
    </header>

    <main class="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-x-clip px-4 pt-4 pb-4 sm:px-8 sm:pt-6 sm:pb-6">
      <!-- 網址沒有種子 -->
      <section v-if="!query" class="max-w-2xl">
        <h1 class="font-wide text-4xl font-black sm:text-5xl">Pick an artist first</h1>
        <p class="mt-3 text-lg">Choose 1–3 artists you love, then come back for recommendations.</p>
        <NuxtLink to="/" class="mt-6 inline-block border-3 border-ink bg-teal px-5 py-2.5 font-wide text-lg font-black">
          Back to home
        </NuxtLink>
      </section>

      <!-- 查詢中：置中的唱盤 -->
      <div v-else-if="loadingFirst" role="status" class="flex flex-1 items-center justify-center py-10">
        <span class="sr-only">Finding recommendations…</span>
        <div class="size-[min(70vw,22rem)]">
          <SunTurntable :record-delay="0.1" />
        </div>
      </div>

      <!-- 種子找不到（404）：說是哪一位，給建議的名字 -->
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
        <h1 class="font-wide text-2xl font-black">Music data is unavailable</h1>
        <p class="mt-2 text-base">The data source may be busy. Try again in a moment.</p>
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

        <!-- 唱片箱：左右疊的封面會超出內容寬度，由 main 的 overflow-x-clip 裁掉，頁面不會左右捲。
             每一層是一個唱片箱（key 不同）：往下挖時舊的往左滑出、新的從右邊滑進來，回上一層相反 -->
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
