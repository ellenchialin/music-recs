<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import { MAX_SEEDS, type AddResult } from "~/stores/seeds";
import { listMaxHeight } from "~/utils/fit-list";

const props = defineProps<{ locked?: boolean }>();

const store = useSeedsStore();
const query = ref("");
const { suggestions, searching, noMatches, notice: searchNotice, dismiss, reopen } = useArtistSearch(query);
// Highlighted suggestion; -1 means Enter adds the typed text
const active = ref(-1);
const message = ref("");

// The list changes as answers arrive; keep the same name highlighted wherever it moved to
watch(suggestions, (next, previous) => {
  const name = previous[active.value]?.name;
  active.value = name ? next.findIndex((s) => s.name === name) : -1;
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
    active.value = -1;
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
    dismiss();
    active.value = -1;
  }
}

// The list scrolls inside a max height; keep the highlighted option in view
async function revealActive() {
  await nextTick();
  document.getElementById(optionId(active.value))?.scrollIntoView?.({ block: "nearest" });
}

// Names we only know from similar-artist lists have no count
const listeners = (n: number | null) =>
  n === null ? "" : `${new Intl.NumberFormat("en", { notation: "compact" }).format(n)} listeners`;
const listboxId = "seed-suggestions";

const hint = computed(
  () =>
    message.value ||
    searchNotice.value ||
    (noMatches.value ? "No matches. Press Enter to add it anyway." : "") ||
    (store.isFull ? `You've picked ${MAX_SEEDS} artists` : "Type for suggestions, or press Enter"),
);

// Keep the open list inside what's visible: on phones the keyboard hides the lower half without
// changing 100dvh, so the list's CSS height could push its top off screen
const root = useTemplateRef("root");
const list = useTemplateRef<{ $el: HTMLElement } | HTMLElement>("list");
function fitList() {
  const viewport = window.visualViewport;
  const listEl = list.value && "$el" in list.value ? list.value.$el : list.value;
  if (!viewport || !root.value || !listEl) return;
  listEl.style.maxHeight = "";
  const cap = parseFloat(getComputedStyle(listEl).maxHeight) || 320;
  const opensUp = listEl.getBoundingClientRect().top < root.value.getBoundingClientRect().top;
  const height = listMaxHeight({
    list: listEl.getBoundingClientRect(),
    viewport: { top: viewport.offsetTop, height: viewport.height },
    opensUp,
    cap,
  });
  listEl.style.maxHeight = `${height}px`;
}
watch(
  () => suggestions.value.length > 0,
  (open) => open && void nextTick(fitList),
);
useEventListener(() => (import.meta.client ? window.visualViewport : null), "resize", () => suggestions.value.length && fitList());
useEventListener(() => (import.meta.client ? window.visualViewport : null), "scroll", () => suggestions.value.length && fitList());
const optionId = (i: number) => `seed-suggestion-${i}`;
</script>

<template>
  <div ref="root" class="relative">
    <label for="seed-input" class="block text-base font-bold sm:text-lg short:sr-only">Add an artist you love</label>
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
      class="mt-2 w-full border-3 border-ink bg-paper short:mt-0 px-4 py-2.5 text-lg sm:py-3 text-ink placeholder:text-ink/50 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ink disabled:opacity-60"
      @keydown="onKeydown"
      @focus="reopen"
      @blur="dismiss"
    >
    <p id="seed-input-hint" class="mt-2 min-h-5 text-sm font-medium sm:min-h-6 sm:text-base" aria-live="polite">
      <template v-if="!message && !searchNotice && searching">
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="mr-1.5 inline size-3.5 align-[-2px]"
          :animate="{ rotate: 360 }"
          :transition="{ duration: 1, ease: 'linear', repeat: Infinity }"
        >
          <circle cx="12" cy="12" r="9" fill="none" stroke-width="3" class="stroke-ink/25" />
          <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke-width="3" stroke-linecap="round" class="stroke-ink" />
        </motion.svg>Searching…
      </template>
      <template v-else>{{ hint }}</template>
    </p>

    <!-- Opens upward on one-column layouts, where the input sits low (over the decorative turntable) -->
    <AnimatePresence>
      <motion.ul
        v-if="suggestions.length"
        :id="listboxId"
        ref="list"
        role="listbox"
        class="absolute inset-x-0 bottom-full z-10 mb-2 max-h-[min(20rem,45dvh)] overflow-y-auto border-3 border-ink bg-ink text-paper md:landscape:top-full md:landscape:bottom-auto md:landscape:mb-0 md:landscape:-mt-8 lg:top-full lg:bottom-auto lg:mb-0 lg:-mt-8 lg:max-h-[min(18rem,35dvh)]"
        :initial="{ opacity: 0, y: -6 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: -6 }"
        :transition="spring.snappy"
      >
        <!-- mousedown, not click: the input blurs and closes the list before click fires -->
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
