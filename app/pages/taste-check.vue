<script setup lang="ts">
import { motion } from "motion-v";
import { describeOverall, describeRound } from "~/utils/taste-check-copy";
import { homeLocation, parseRecommendationsQuery, recommendationsLocation, seedsLabel } from "~/utils/recommendations-route";

// /taste-check?seed=…: a blind test of three unnamed songs, rated 1–5, then revealed. A round is created only on
// Start, so crawlers opening the page don't create rounds

type Song = { position: number; previewUrl: string };
type Revealed = { position: number; artist: string; title: string; isRecommended: boolean; rating: number };
type VersionStats = {
  algoVersion: string;
  visitors: number;
  recommendedMean: number;
  controlMean: number;
  difference: number;
  ci: [number, number] | null;
};

const route = useRoute();
const query = computed(() => parseRecommendationsQuery(route.query));
const player = usePreviewPlayer();

const phase = ref<"intro" | "starting" | "rating" | "revealing" | "revealed">("intro");
const roundId = ref("");
const songs = ref<Song[]>([]);
const ratings = ref<(number | null)[]>([null, null, null]);
const revealed = ref<Revealed[]>([]);
const error = ref("");
const stats = ref<VersionStats | null>(null);

const allRated = computed(() => ratings.value.every((r) => r !== null));
const resultFor = (position: number) => revealed.value.find((r) => r.position === position);

function messageFor(err: unknown) {
  const status = (err as { statusCode?: number }).statusCode;
  if (status === 429) return "Too many requests — try again in a minute";
  if (status === 422) return "Not enough songs with previews for these artists. Try other artists.";
  return "Something went wrong — try again in a moment";
}

async function start() {
  if (!query.value) return;
  player.stop();
  phase.value = "starting";
  error.value = "";
  try {
    const round = await $fetch<{ id: string; songs: Song[] }>("/api/blind-tests", {
      method: "POST",
      body: { seeds: query.value.seeds },
    });
    roundId.value = round.id;
    songs.value = round.songs;
    ratings.value = round.songs.map(() => null);
    revealed.value = [];
    phase.value = "rating";
  } catch (err) {
    error.value = messageFor(err);
    phase.value = "intro";
  }
}

async function reveal() {
  if (!allRated.value) return;
  player.stop();
  phase.value = "revealing";
  error.value = "";
  try {
    revealed.value = await $fetch<Revealed[]>(`/api/blind-tests/${roundId.value}/ratings`, {
      method: "POST",
      body: { ratings: ratings.value },
    });
    phase.value = "revealed";
    void loadStats();
  } catch (err) {
    error.value = messageFor(err);
    phase.value = "rating";
  }
}

async function loadStats() {
  try {
    const result = await $fetch<{ versions: VersionStats[] }>("/api/stats");
    stats.value = result.versions.at(-1) ?? null;
  } catch {
    stats.value = null;
  }
}

const roundSummary = computed(() => (revealed.value.length ? describeRound(revealed.value) : ""));

useHead({ title: "Taste Check · Music Recs" });
useShareMeta(() => ({
  title: "Do these picks fit your taste?",
  description: "Play three unnamed songs, rate each one, then see which were picked for you and which were random.",
}));
</script>

<template>
  <div class="flex h-dvh flex-col">
    <header class="mx-auto w-full max-w-7xl shrink-0 px-4 pt-4 sm:px-8 sm:pt-6">
      <nav aria-label="Breadcrumb" class="overflow-x-auto">
        <ol class="flex items-center gap-2 text-base whitespace-nowrap">
          <li>
            <NuxtLink :to="homeLocation(query?.seeds ?? [])" class="font-bold underline underline-offset-4">Home</NuxtLink>
          </li>
          <li v-if="query" class="flex items-center gap-2">
            <span aria-hidden="true">›</span>
            <NuxtLink :to="recommendationsLocation(query.seeds)" class="font-bold underline underline-offset-4">
              {{ seedsLabel(query.seeds) }}
            </NuxtLink>
          </li>
          <li class="flex items-center gap-2">
            <span aria-hidden="true">›</span>
            <span aria-current="page" class="font-bold">Taste Check</span>
          </li>
        </ol>
      </nav>
    </header>

    <main class="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pt-4 pb-4 sm:px-8 sm:pt-6 sm:pb-6">
      <section v-if="!query">
        <h1 class="font-wide text-4xl font-black sm:text-5xl">Pick an artist first</h1>
        <p class="mt-3 text-lg">Choose 1–3 artists you love, then take the Taste Check.</p>
        <NuxtLink to="/" class="mt-6 inline-block border-3 border-ink bg-teal px-5 py-2.5 font-wide text-lg font-black">
          Back to home
        </NuxtLink>
      </section>

      <template v-else>
        <h1 class="font-wide text-[clamp(1.75rem,7vw,3rem)] leading-tight font-black">Taste Check</h1>
        <!-- Before starting: what the test answers for the listener, then how it works.
             While rating, one line of instructions instead, so the round fits one screen -->
        <template v-if="phase === 'intro' || phase === 'starting'">
          <p class="mt-2 text-base font-medium sm:text-lg">
            Are these picks really better for you than random popular songs in the same genre? Find out with your own
            ears, without names getting in the way.
          </p>
          <ol data-testid="check-steps" class="mt-4 flex flex-col gap-1 text-base">
            <li><strong>1.</strong> Play three songs. You won't see who they're by.</li>
            <li><strong>2.</strong> Rate each one from 1 to 5.</li>
            <li><strong>3.</strong> See which were recommended for {{ seedsLabel(query.seeds) }} and which were random picks.</li>
          </ol>
          <p class="mt-3 text-sm">Ratings are anonymous. They're how this site measures whether its recommendations work.</p>
        </template>
        <p v-else-if="phase !== 'revealed'" class="mt-2 text-base sm:text-lg">
          Play each song and rate it, then reveal which were picked for you.
        </p>
        <p v-else class="mt-2 text-base font-medium sm:text-lg">{{ roundSummary }}</p>

        <p v-if="error" role="alert" class="mt-4 border-3 border-ink bg-paper px-4 py-3 font-bold text-ink">{{ error }}</p>

        <div v-if="phase === 'intro' || phase === 'starting'" class="mt-6">
          <motion.button
            type="button"
            :disabled="phase === 'starting'"
            class="border-3 border-ink bg-teal px-6 py-3 font-wide text-xl font-black text-ink disabled:cursor-wait disabled:opacity-70"
            :while-press="{ scale: 0.96 }"
            :transition="spring.snappy"
            @click="start"
          >
            {{ phase === "starting" ? "Finding songs…" : "Start" }}
          </motion.button>
        </div>

        <template v-else>
          <ol class="mt-6 flex flex-col gap-3">
            <motion.li
              v-for="song in songs"
              :key="`${roundId}-${song.position}`"
              data-testid="check-song"
              class="flex flex-wrap items-center gap-x-3 gap-y-2 border-3 border-ink bg-paper p-3 text-ink sm:gap-x-4"
              v-bind="fadeUp"
              :transition="{ ...spring.smooth, delay: song.position * staggerStep }"
            >
              <button
                type="button"
                :aria-label="`${player.playingUrl.value === song.previewUrl ? 'Pause' : 'Play'} song ${song.position + 1}`"
                :aria-pressed="player.playingUrl.value === song.previewUrl"
                class="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal text-ink"
                @click="player.toggle(song.previewUrl)"
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" class="size-5 fill-current">
                  <path v-if="player.playingUrl.value === song.previewUrl" d="M2 1h3v10H2zM7 1h3v10H7z" />
                  <path v-else d="M3 1l8 5-8 5z" />
                </svg>
              </button>

              <div class="min-w-0 flex-1">
                <!-- The name animates in when it mounts on reveal -->
                <motion.p
                  v-if="resultFor(song.position)"
                  class="truncate font-bold"
                  :initial="{ opacity: 0, y: 6 }"
                  :animate="{ opacity: 1, y: 0 }"
                  :transition="{ ...spring.smooth, delay: song.position * staggerStep }"
                >
                  {{ resultFor(song.position)!.artist }} — {{ resultFor(song.position)!.title }}
                </motion.p>
                <p v-else class="font-bold whitespace-nowrap">Song {{ song.position + 1 }}</p>
                <p
                  v-if="resultFor(song.position)"
                  class="mt-1 inline-block border-3 border-ink px-2 text-xs whitespace-nowrap font-black tracking-wide uppercase"
                  :class="resultFor(song.position)!.isRecommended ? 'bg-teal' : 'bg-paper'"
                >
                  {{ resultFor(song.position)!.isRecommended ? "Picked for you" : "Random pick" }}
                </p>
              </div>

              <!-- After the reveal, the score replaces the buttons so names and labels fit on phones -->
              <p
                v-if="resultFor(song.position)"
                class="shrink-0 font-wide text-lg font-black"
                :aria-label="`You rated it ${resultFor(song.position)!.rating} out of 5`"
              >
                {{ resultFor(song.position)!.rating }}/5
              </p>
              <fieldset v-else class="flex gap-1" :disabled="phase !== 'rating'">
                <legend class="sr-only">Rate song {{ song.position + 1 }} from 1 to 5</legend>
                <label v-for="score in 5" :key="score" class="cursor-pointer">
                  <input
                    v-model="ratings[song.position]"
                    type="radio"
                    class="peer sr-only"
                    :name="`rating-${song.position}`"
                    :value="score"
                  >
                  <span
                    class="flex size-8 items-center justify-center border-3 border-ink font-black sm:size-9 peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
                  >{{ score }}</span>
                </label>
              </fieldset>
            </motion.li>
          </ol>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <motion.button
              v-if="phase !== 'revealed'"
              type="button"
              :disabled="!allRated || phase === 'revealing'"
              class="border-3 border-ink bg-teal px-6 py-3 font-wide text-xl font-black text-ink disabled:cursor-not-allowed disabled:bg-paper/60 disabled:text-ink/60"
              :while-press="{ scale: 0.96 }"
              :transition="spring.snappy"
              @click="reveal"
            >
              {{ phase === "revealing" ? "Revealing…" : "Reveal" }}
            </motion.button>
            <template v-else>
              <motion.button
                type="button"
                class="border-3 border-ink bg-teal px-6 py-3 font-wide text-xl font-black text-ink"
                :while-press="{ scale: 0.96 }"
                :transition="spring.snappy"
                @click="start"
              >
                Play another round
              </motion.button>
              <NuxtLink :to="recommendationsLocation(query.seeds)" class="font-bold underline underline-offset-4">
                Back to recommendations
              </NuxtLink>
            </template>
            <p v-if="phase === 'rating' && !allRated" class="text-base font-medium">Rate all three to reveal</p>
          </div>

          <p v-if="phase === 'revealed' && stats" class="mt-4 text-base">{{ describeOverall(stats) }}</p>
        </template>
      </template>
    </main>
  </div>
</template>
