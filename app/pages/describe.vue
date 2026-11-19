<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import { MAX_DESCRIPTION_LENGTH, type AgentStep, type DescribeEvent, type DescribeStopReason } from "~~/shared/types/describe";
import { recommendationsLocation } from "~/utils/recommendations-route";
import { readSse } from "~/utils/sse";

// /describe?q=…: describe a vibe, and an agent finds 1–3 artists to start recommendations from.
// Each lookup it makes shows as it happens; its suggestions become the visitor's picks, which they
// can change before recommending. Starts by itself only when coming from home: a reload or a shared
// link waits for "Find artists", so nobody spends an AI run just by opening a URL

const route = useRoute();
const router = useRouter();
const store = useSeedsStore();

const description = ref(typeof route.query.q === "string" ? route.query.q : "");
const phase = ref<"idle" | "running" | "done" | "stopped">("idle");
const steps = ref<AgentStep[]>([]);
// Why the suggested artists fit; artists the visitor adds themselves have none
const whyFor = ref<Record<string, string>>({});
const stopped = ref<DescribeStopReason | "user" | null>(null);
const suggested = computed(() => Object.keys(whyFor.value).length > 0);
let controller: AbortController | null = null;

// The model takes a second or two before its first lookup and between lookups, with nothing to show
// yet; this line says it's working. A running lookup shows its own progress instead
const thinking = computed(() => {
  if (phase.value !== "running" || steps.value.some((s) => s.status === "running")) return null;
  return steps.value.length ? "Deciding what to look up next…" : "Reading your description…";
});

const MESSAGES: Record<DescribeStopReason | "user", string> = {
  off: "Describing a vibe isn't available right now.",
  limit: "That's all the searching for today. Try again tomorrow.",
  timeout: "That took too long. Try again.",
  failed: "Something went wrong. Try again.",
  nothing: "Couldn't find artists for that. Try naming an artist, a genre or a mood.",
  user: "Stopped.",
};

function onEvent({ event, data }: { event: string; data: string }) {
  const payload = { type: event, ...JSON.parse(data) } as DescribeEvent;
  if (payload.type === "step") {
    const { type: _, ...step } = payload;
    const at = steps.value.findIndex((s) => s.id === step.id);
    steps.value = at < 0 ? [...steps.value, step] : steps.value.map((s, i) => (i === at ? step : s));
  } else if (payload.type === "suggestion") {
    whyFor.value = Object.fromEntries(payload.artists.map((a) => [a.name, a.why]));
    // The picks the visitor reviews are the same seeds the home page keeps
    store.seeds = payload.artists.map((a) => a.name);
  } else if (payload.type === "done") {
    phase.value = "done";
  } else {
    stopped.value = payload.why;
    phase.value = "stopped";
  }
}

async function find() {
  const text = description.value.trim();
  if (!text || phase.value === "running") return;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  phase.value = "running";
  steps.value = [];
  whyFor.value = {};
  stopped.value = null;
  // The URL shows what was searched, so it can be shared or reloaded
  void router.replace({ query: { q: text } });
  try {
    const body = await $fetch<ReadableStream<Uint8Array>>("/api/describe", {
      method: "POST",
      body: { description: text },
      responseType: "stream",
      signal,
    });
    await readSse(body, onEvent);
    // The connection closed without saying how it ended
    if (phase.value === "running") {
      stopped.value = "failed";
      phase.value = "stopped";
    }
  } catch {
    if (signal.aborted) return;
    stopped.value = "failed";
    phase.value = "stopped";
  }
}

function stop() {
  controller?.abort();
  stopped.value = "user";
  phase.value = "stopped";
}
onBeforeUnmount(() => controller?.abort());

// Set by the home page's "Find artists"
const describeNow = useState("describe-now", () => false);
onMounted(() => {
  if (!describeNow.value) return;
  describeNow.value = false;
  void find();
});

const needleDrop = useState("needle-drop", () => false);
function recommend() {
  if (!store.isReady) return;
  needleDrop.value = true;
  void navigateTo(recommendationsLocation(store.seeds));
}

useHead({ title: "By vibe · Music Recs" });
useShareMeta(() => ({
  title: "Describe a vibe, get records",
  description: "Describe what you're in the mood for. An AI looks up artists that fit, and you pick where to start.",
}));
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="mx-auto w-full max-w-7xl shrink-0 px-4 pt-4 sm:px-8 sm:pt-6">
      <nav aria-label="Breadcrumb">
        <ol class="flex items-center gap-2 text-base whitespace-nowrap">
          <li><NuxtLink to="/" class="font-bold underline underline-offset-4">Home</NuxtLink></li>
          <li class="flex items-center gap-2">
            <span aria-hidden="true">›</span>
            <span aria-current="page" class="font-bold">By vibe</span>
          </li>
        </ol>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-10 sm:px-8 sm:pt-6">
      <h1 class="font-wide text-[clamp(1.75rem,7vw,3rem)] leading-tight font-black">What are you in the mood for?</h1>

      <form class="mt-4 flex flex-col gap-2" @submit.prevent="find">
        <label for="vibe" class="sr-only">Describe what you're in the mood for</label>
        <textarea
          id="vibe"
          v-model="description"
          :maxlength="MAX_DESCRIPTION_LENGTH"
          rows="3"
          placeholder="e.g. Like Tame Impala, but for running"
          class="w-full resize-none border-3 border-ink bg-paper px-3 py-2 text-base text-ink placeholder:text-ink/50 focus:outline-3 focus:outline-offset-2 focus:outline-ink"
          @keydown.enter.exact.prevent="find"
        />
        <div class="flex flex-wrap items-center gap-4">
          <motion.button
            v-if="phase === 'running'"
            type="button"
            class="border-3 border-ink bg-paper px-5 py-2 font-wide text-lg font-black text-ink"
            :while-press="{ scale: 0.96 }"
            :transition="spring.snappy"
            @click="stop"
          >Stop</motion.button>
          <motion.button
            v-else
            type="button"
            :disabled="!description.trim()"
            class="border-3 border-ink bg-teal px-5 py-2 font-wide text-lg font-black text-ink disabled:cursor-not-allowed disabled:bg-paper/60 disabled:text-ink/60"
            :while-press="{ scale: 0.96 }"
            :transition="spring.snappy"
            @click="find"
          >Find artists</motion.button>
          <p class="text-sm">An artist, a mood, a moment.</p>
        </div>
      </form>

      <!-- Each lookup as the agent makes it: announced politely, so screen readers follow along -->
      <ol v-if="steps.length || thinking" aria-label="What the AI looked up" aria-live="polite" class="mt-6 flex flex-col gap-2">
        <AnimatePresence>
          <motion.li
            v-for="step in steps"
            :key="step.id"
            data-testid="agent-step"
            class="flex items-baseline gap-2 text-base"
            v-bind="fadeUp"
            :transition="spring.smooth"
          >
            <motion.span
              v-if="step.status === 'running'"
              aria-hidden="true"
              class="w-4 shrink-0 text-center font-black"
              :animate="{ opacity: [1, 0.3, 1] }"
              :transition="{ duration: 1, repeat: Infinity }"
            >…</motion.span>
            <span v-else aria-hidden="true" class="w-4 shrink-0 text-center font-black">{{ step.status === "done" ? "✓" : "✕" }}</span>
            <!-- One run of text, so a long step wraps like a sentence on phones -->
            <p class="min-w-0">
              <span data-testid="step-label" class="font-bold">{{ step.label }}</span>
              {{ " " }}
              <span v-if="step.status === 'done'" data-testid="step-detail" class="text-ink/70">{{ step.summary }}</span>
              <span v-else-if="step.status === 'failed'" data-testid="step-detail" class="text-ink/70">Couldn't look this up</span>
            </p>
          </motion.li>
          <!-- One key throughout, so the line changes its words in place instead of re-entering -->
          <motion.li
            v-if="thinking"
            key="thinking"
            class="flex items-baseline gap-2 text-base text-ink/70 italic"
            v-bind="fadeUp"
            :transition="spring.smooth"
          >
            <motion.span
              aria-hidden="true"
              class="w-4 shrink-0 text-center font-black not-italic"
              :animate="{ opacity: [1, 0.3, 1] }"
              :transition="{ duration: 1, repeat: Infinity }"
            >…</motion.span>
            <span data-testid="agent-thinking">{{ thinking }}</span>
          </motion.li>
        </AnimatePresence>
      </ol>

      <p v-if="stopped" role="alert" class="mt-6 border-3 border-ink bg-paper px-4 py-3 font-bold text-ink">
        {{ MESSAGES[stopped] }}
        <NuxtLink v-if="stopped === 'off' || stopped === 'limit'" to="/" class="whitespace-nowrap underline underline-offset-4">Pick artists by name</NuxtLink>
      </p>

      <!-- The suggestions are the visitor's picks now: remove any, then recommend -->
      <section v-if="suggested" aria-labelledby="picks" class="mt-8">
        <h2 id="picks" class="font-wide text-2xl font-black">Start from these artists</h2>
        <ul aria-label="Your artists" class="mt-3 flex flex-col gap-3">
          <AnimatePresence>
            <motion.li
              v-for="(seed, i) in store.seeds"
              :key="seed"
              class="flex flex-col gap-1"
              v-bind="fadeUp"
              :transition="{ ...spring.smooth, delay: i * staggerStep }"
            >
              <span class="flex max-w-full items-stretch self-start border-3 border-ink bg-ink text-paper">
                <span aria-hidden="true" class="w-2.5 shrink-0" :class="['bg-coral', 'bg-pink', 'bg-teal-deep'][i % 3]" />
                <span class="truncate py-1 pr-1 pl-3 text-base font-medium">{{ seed }}</span>
                <button
                  type="button"
                  :aria-label="`Remove ${seed}`"
                  class="shrink-0 px-2.5 text-lg leading-none font-bold text-paper-muted hover:text-paper"
                  @click="store.remove(seed)"
                >×</button>
              </span>
              <span v-if="whyFor[seed]" class="text-sm">{{ whyFor[seed] }}</span>
            </motion.li>
          </AnimatePresence>
        </ul>
        <!-- No search box here: this is for reviewing the picks; adding artists by name is the
             home page's "By artist" -->
        <div class="mt-5 flex flex-wrap items-center gap-4">
          <motion.button
            type="button"
            :disabled="!store.isReady"
            class="border-3 border-ink bg-teal px-6 py-3 font-wide text-xl font-black text-ink disabled:cursor-not-allowed disabled:bg-paper/60 disabled:text-ink/60"
            :while-press="{ scale: 0.96 }"
            :transition="spring.snappy"
            @click="recommend"
          >Recommend</motion.button>
          <p v-if="!store.isReady" class="text-base font-medium">Keep at least one artist</p>
        </div>
      </section>
    </main>
  </div>
</template>
