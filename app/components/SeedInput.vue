<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import { MAX_SEEDS, type AddResult } from "~/stores/seeds";

type Suggestion = { name: string; listeners: number };

// locked：推薦中時由頁面傳 true，暫時不能加種子（查詢用的是按下按鈕那一刻的種子）
const props = defineProps<{ locked?: boolean }>();

const store = useSeedsStore();
const query = ref("");
const suggestions = ref<Suggestion[]>([]);
// 鍵盤選到第幾個建議；-1 = 沒有選，Enter 就加打的字
const active = ref(-1);
const message = ref("");
// 自動完成被速率限制擋住（429）時的提示；下一次查成功就收起來
const searchNotice = ref("");

// 停止打字 400ms 後才查，不是每按一個鍵就打一次 API（像 lodash.debounce）
// 250ms 太短：一般打字時字和字之間就常停超過 250ms，等於每打一兩個字查一次
const DEBOUNCE_MS = 400;
const debouncedQuery = refDebounced(query, DEBOUNCE_MS);

// 查過的字記住結果：刪掉幾個字再打回來時直接用，不再打 API
const cache = new Map<string, Suggestion[]>();
const cacheKey = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

// 打字很快時，舊的請求可能比新的晚回來；只採用最後一次送出的結果
let latestRequest = 0;
watch(debouncedQuery, async (q) => {
  const key = cacheKey(q);
  const id = ++latestRequest;
  if (key.length < 2) {
    suggestions.value = [];
    return;
  }
  const cached = cache.get(key);
  if (cached) {
    suggestions.value = cached;
    active.value = -1;
    return;
  }
  try {
    const result = await $fetch<Suggestion[]>("/api/artists/search", { query: { q: key } });
    cache.set(key, result);
    if (id === latestRequest) {
      suggestions.value = result;
      active.value = -1;
      searchNotice.value = "";
    }
  } catch (err) {
    // 自動完成失敗不擋路：使用者還是可以打完整的名字按 Enter
    if (id !== latestRequest) return;
    suggestions.value = [];
    if ((err as { statusCode?: number }).statusCode === 429) {
      searchNotice.value = "Too many searches. Wait a moment, or press Enter to add the name.";
    }
  }
});

const messages: Record<Exclude<AddResult, "added">, string> = {
  duplicate: "Already added",
  full: `Up to ${MAX_SEEDS} artists. Remove one to add another.`,
  empty: "",
};

function add(name: string) {
  const result = store.add(name);
  message.value = result === "added" ? "" : messages[result];
  if (result === "added" || result === "duplicate") {
    query.value = "";
    suggestions.value = [];
    active.value = -1;
    latestRequest++;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (props.locked) return;
  const count = suggestions.value.length;
  if (event.key === "ArrowDown" && count) {
    event.preventDefault();
    active.value = (active.value + 1) % count;
    revealActive();
  } else if (event.key === "ArrowUp" && count) {
    event.preventDefault();
    active.value = (active.value - 1 + count) % count;
    revealActive();
  } else if (event.key === "Enter") {
    event.preventDefault();
    add(suggestions.value[active.value]?.name ?? query.value);
  } else if (event.key === "Escape") {
    suggestions.value = [];
    active.value = -1;
  }
}

// 建議清單有最大高度、超過會在裡面捲動；用方向鍵選的時候，把選到的那一個捲進看得到的範圍
async function revealActive() {
  await nextTick();
  document.getElementById(optionId(active.value))?.scrollIntoView?.({ block: "nearest" });
}

const listeners = (n: number) => `${new Intl.NumberFormat("en", { notation: "compact" }).format(n)} listeners`;
const listboxId = "seed-suggestions";
const optionId = (i: number) => `seed-suggestion-${i}`;
</script>

<template>
  <div class="relative">
    <!-- 很矮的畫面（手機橫放）視覺上藏起來，螢幕閱讀器仍然念 -->
    <label for="seed-input" class="block text-base font-bold sm:text-lg [@media(max-height:520px)]:sr-only">Add an artist you love</label>
    <!-- ARIA combobox：螢幕閱讀器會念出「有幾個建議、現在選到哪一個」 -->
    <input
      id="seed-input"
      v-model="query"
      type="text"
      role="combobox"
      autocomplete="off"
      :aria-expanded="suggestions.length > 0"
      :aria-controls="listboxId"
      :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
      aria-describedby="seed-input-hint"
      :disabled="store.isFull || locked"
      placeholder="e.g. Tame Impala"
      class="mt-2 w-full border-3 border-ink bg-paper [@media(max-height:520px)]:mt-0 px-4 py-2.5 text-lg sm:py-3 text-ink placeholder:text-ink/50 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ink disabled:opacity-60"
      @keydown="onKeydown"
      @blur="suggestions = []"
    >
    <p id="seed-input-hint" class="mt-2 min-h-5 text-sm font-medium sm:min-h-6 sm:text-base" aria-live="polite">
      {{ message || searchNotice || (store.isFull ? `You've picked ${MAX_SEEDS} artists` : "Type for suggestions, or press Enter") }}
    </p>

    <!-- 手機、直立平板：輸入框在畫面下半部，建議清單往上開（蓋住上面的唱盤，那只是裝飾）；
         桌機和橫放：輸入框在上面，往下開。清單有最大高度，超過在裡面捲動 -->
    <AnimatePresence>
      <motion.ul
        v-if="suggestions.length"
        :id="listboxId"
        role="listbox"
        class="absolute inset-x-0 bottom-full z-10 mb-2 max-h-[min(20rem,45dvh)] overflow-y-auto border-3 border-ink bg-ink text-paper md:landscape:top-full md:landscape:bottom-auto md:landscape:mb-0 md:landscape:-mt-8 lg:top-full lg:bottom-auto lg:mb-0 lg:-mt-8 lg:max-h-[min(18rem,35dvh)]"
        :initial="{ opacity: 0, y: -6 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: -6 }"
        :transition="spring.snappy"
      >
        <!-- mousedown 而不是 click：click 前 input 會先 blur，選單已經關掉 -->
        <li
          v-for="(s, i) in suggestions"
          :id="optionId(i)"
          :key="s.name"
          role="option"
          :aria-selected="i === active"
          class="flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2.5"
          :class="i === active ? 'bg-teal text-ink' : 'hover:bg-ink-soft'"
          @mousedown.prevent="add(s.name)"
        >
          <span class="font-medium">{{ s.name }}</span>
          <span class="text-sm" :class="i === active ? 'text-ink' : 'text-paper-muted'">{{ listeners(s.listeners) }}</span>
        </li>
      </motion.ul>
    </AnimatePresence>
  </div>
</template>
