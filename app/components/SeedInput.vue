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
    }
  } catch {
    // 自動完成失敗不擋路：使用者還是可以打完整的名字按 Enter
    if (id === latestRequest) suggestions.value = [];
  }
});

const messages: Record<Exclude<AddResult, "added">, string> = {
  duplicate: "已經加過這位了",
  full: `最多 ${MAX_SEEDS} 位，先拿掉一位再加`,
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
  } else if (event.key === "ArrowUp" && count) {
    event.preventDefault();
    active.value = (active.value - 1 + count) % count;
  } else if (event.key === "Enter") {
    event.preventDefault();
    add(suggestions.value[active.value]?.name ?? query.value);
  } else if (event.key === "Escape") {
    suggestions.value = [];
    active.value = -1;
  }
}

const listeners = (n: number) => `${new Intl.NumberFormat("zh-Hant", { notation: "compact" }).format(n)} 位聽眾`;
const listboxId = "seed-suggestions";
const optionId = (i: number) => `seed-suggestion-${i}`;
</script>

<template>
  <div class="relative">
    <label for="seed-input" class="block text-base font-bold sm:text-lg">加入喜歡的歌手</label>
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
      placeholder="例如 Tame Impala"
      class="mt-2 w-full border-3 border-ink bg-paper px-4 py-2.5 text-lg sm:py-3 text-ink placeholder:text-ink/50 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ink disabled:opacity-60"
      @keydown="onKeydown"
      @blur="suggestions = []"
    >
    <p id="seed-input-hint" class="mt-2 min-h-5 text-sm font-medium sm:min-h-6 sm:text-base" aria-live="polite">
      {{ message || (store.isFull ? `已經選了 ${MAX_SEEDS} 位` : "打幾個字會出現建議；找不到也可以直接按 Enter") }}
    </p>

    <AnimatePresence>
      <motion.ul
        v-if="suggestions.length"
        :id="listboxId"
        role="listbox"
        class="absolute inset-x-0 top-full z-10 -mt-7 sm:-mt-8 border-3 border-ink bg-ink text-paper"
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
