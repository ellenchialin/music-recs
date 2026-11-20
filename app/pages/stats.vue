<script setup lang="ts">
import type { Popularity } from '~~/shared/types/popularity'
import type { RatingStats, StatsResult } from '~~/shared/types/stats'
import {
  homeLocation,
  parseRecommendationsQuery,
  recommendationsLocation,
  seedsLabel,
  tasteCheckLocation
} from '~/utils/recommendations-route'
import { formatDifference, formatInterval, headline } from '~/utils/stats-copy'
import { describeOverall } from '~/utils/taste-check-copy'

// /stats: everyone's Taste Check ratings. One headline number for the current algorithm version
// (Balanced rounds), then the same numbers per popularity setting and per version.
// ?seed=…&popularity=… only leads back: a visitor coming from their Taste Check returns to their list

const route = useRoute()
const from = computed(() => parseRecommendationsQuery(route.query))
const { data, error } = await useFetch<StatsResult>('/api/stats')

const latest = computed(() => data.value?.versions.at(-1) ?? null)
const settings = computed(() => data.value?.settings ?? [])
// Balanced alone would only repeat the headline
const showSettings = computed(() =>
  settings.value.some((s) => s.popularity !== 'balanced')
)
const versions = computed(() => data.value?.versions ?? [])

const SETTING_LABELS: Record<Popularity, string> = {
  obscure: 'Obscure',
  balanced: 'Balanced',
  mainstream: 'Mainstream'
}
const RATING_MAX = 5
const barWidth = (mean: number) =>
  `${Number(((mean / RATING_MAX) * 100).toFixed(1))}%`
const cells = (s: RatingStats) => [
  String(s.visitors),
  s.recommendedMean.toFixed(1),
  s.controlMean.toFixed(1),
  formatDifference(s.difference),
  formatInterval(s.ci)
]
const COLUMNS = [
  'Listeners',
  'Picked for you',
  'Random pick',
  'Difference',
  '95% interval'
]

useHead({ title: 'Results · Music Recs' })
useShareMeta(() => ({
  title: 'Do these recommendations work?',
  description:
    'Blind-test ratings from everyone who took the Taste Check: songs picked for them against random popular songs.'
}))
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="mx-auto w-full max-w-7xl shrink-0 px-4 pt-4 sm:px-8 sm:pt-6">
      <!-- One row: long seeds end in "…" so the current page's name always shows (a fade would
           need a gradient) -->
      <nav aria-label="Breadcrumb">
        <ol class="flex items-baseline gap-2 text-base whitespace-nowrap">
          <li class="shrink-0">
            <NuxtLink
              :to="homeLocation(from?.seeds ?? [])"
              class="font-bold underline underline-offset-4"
              >Home</NuxtLink
            >
          </li>
          <li v-if="from" class="flex min-w-0 items-baseline gap-2">
            <span aria-hidden="true" class="shrink-0">›</span>
            <NuxtLink
              :to="recommendationsLocation(from.seeds, [], from.popularity)"
              :aria-current="undefined"
              class="min-w-0 truncate font-bold underline underline-offset-4"
            >
              {{ seedsLabel(from.seeds) }}
            </NuxtLink>
          </li>
          <li class="flex shrink-0 items-baseline gap-2">
            <span aria-hidden="true">›</span>
            <span aria-current="page" class="font-bold">Results</span>
          </li>
        </ol>
      </nav>
    </header>

    <main
      class="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-10 sm:px-8 sm:pt-6"
    >
      <h1
        class="font-wide text-[clamp(1.75rem,7vw,3rem)] leading-tight font-black"
      >
        Does it work?
      </h1>
      <p class="mt-2 text-base font-medium sm:text-lg">
        In every Taste Check round, listeners rate songs picked for them and
        random popular songs from the same genre, without seeing any names.
        These are everyone's ratings so far.
      </p>

      <p
        v-if="error"
        role="alert"
        class="mt-6 border-3 border-ink bg-paper px-4 py-3 font-bold text-ink"
      >
        Couldn't load the results. Try again in a moment.
      </p>

      <section
        v-else-if="!latest"
        class="mt-6 border-3 border-ink bg-paper p-5 text-ink"
      >
        <p class="font-bold">No rounds have been rated yet.</p>
        <p class="mt-1">
          Pick a few artists, then take the Taste Check from your
          recommendations.
        </p>
        <NuxtLink
          to="/"
          class="mt-4 inline-block border-3 border-ink bg-teal px-5 py-2.5 font-wide text-lg font-black"
        >
          Pick artists
        </NuxtLink>
      </section>

      <template v-else>
        <section
          aria-labelledby="overall"
          class="mt-6 border-3 border-ink bg-paper p-5 text-ink"
        >
          <h2 id="overall" class="text-sm font-black tracking-wide uppercase">
            Algorithm {{ latest.algoVersion }}
          </h2>
          <p
            data-testid="headline"
            class="mt-2 flex flex-wrap items-baseline gap-x-3"
          >
            <span class="font-wide text-6xl leading-none font-black">{{
              formatDifference(latest.difference)
            }}</span>
            <span class="text-lg font-bold"
              >{{ headline(latest.difference) }}, out of {{ RATING_MAX }}</span
            >
          </p>
          <p class="mt-3 text-base">{{ describeOverall(latest) }}</p>

          <!-- Both averages on one 0–5 scale. Each bar carries its name and value, so the colour is
               never the only cue -->
          <ul class="mt-5 flex flex-col gap-3">
            <li
              v-for="bar in [
                {
                  label: 'Picked for you',
                  mean: latest.recommendedMean,
                  fill: 'bg-teal'
                },
                {
                  label: 'Random pick',
                  mean: latest.controlMean,
                  fill: 'bg-ink-soft'
                }
              ]"
              :key="bar.label"
              data-testid="average-bar"
            >
              <p class="flex justify-between text-sm font-bold">
                <span>{{ bar.label }}</span
                ><span class="tabular-nums">{{ bar.mean.toFixed(1) }}</span>
              </p>
              <div class="mt-1 h-5 border-3 border-ink">
                <div
                  data-fill
                  class="h-full"
                  :class="bar.fill"
                  :style="{ width: barWidth(bar.mean) }"
                />
              </div>
            </li>
          </ul>
          <p class="mt-4 text-sm">
            {{ latest.visitors }}
            {{ latest.visitors === 1 ? 'listener' : 'listeners' }} ·
            {{ latest.ratings }} ratings · 95% interval for the difference:
            {{ formatInterval(latest.ci) }}
          </p>
        </section>

        <section v-if="showSettings" aria-labelledby="by-setting" class="mt-8">
          <h2 id="by-setting" class="font-wide text-2xl font-black">
            By popularity setting
          </h2>
          <p class="mt-1 text-base">
            Rounds started from an Obscure or Mainstream list test that list.
            Balanced is the plain ranking above.
          </p>
          <div
            class="mt-3 overflow-x-auto border-3 border-ink bg-paper text-ink"
          >
            <table
              data-testid="by-setting"
              class="w-full text-left text-sm whitespace-nowrap"
            >
              <thead>
                <tr class="border-b-3 border-ink">
                  <th scope="col" class="px-3 py-2">Setting</th>
                  <th
                    v-for="column in COLUMNS"
                    :key="column"
                    scope="col"
                    class="px-3 py-2 text-right"
                  >
                    {{ column }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in settings" :key="s.popularity">
                  <th scope="row" class="px-3 py-2">
                    {{ SETTING_LABELS[s.popularity] }}
                  </th>
                  <td
                    v-for="(cell, i) in cells(s)"
                    :key="i"
                    class="px-3 py-2 text-right tabular-nums"
                  >
                    {{ cell }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section
          v-if="versions.length > 1"
          aria-labelledby="by-version"
          class="mt-8"
        >
          <h2 id="by-version" class="font-wide text-2xl font-black">
            By algorithm version
          </h2>
          <p class="mt-1 text-base">
            Each change to the ranking rules gets a new version, so they can be
            compared.
          </p>
          <div
            class="mt-3 overflow-x-auto border-3 border-ink bg-paper text-ink"
          >
            <table
              data-testid="by-version"
              class="w-full text-left text-sm whitespace-nowrap"
            >
              <thead>
                <tr class="border-b-3 border-ink">
                  <th scope="col" class="px-3 py-2">Version</th>
                  <th
                    v-for="column in COLUMNS"
                    :key="column"
                    scope="col"
                    class="px-3 py-2 text-right"
                  >
                    {{ column }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in versions" :key="v.algoVersion">
                  <th scope="row" class="px-3 py-2">{{ v.algoVersion }}</th>
                  <td
                    v-for="(cell, i) in cells(v)"
                    :key="i"
                    class="px-3 py-2 text-right tabular-nums"
                  >
                    {{ cell }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- Where to go next: back into the visitor's own flow, or into it for the first time -->
      <nav
        aria-label="Next"
        class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
      >
        <template v-if="from">
          <NuxtLink
            :to="recommendationsLocation(from.seeds, [], from.popularity)"
            class="border-3 border-ink bg-teal px-5 py-2.5 font-wide text-lg font-black text-ink"
            >Back</NuxtLink
          >
          <NuxtLink
            :to="tasteCheckLocation(from.seeds, from.popularity)"
            class="font-bold underline underline-offset-4"
            >Take another Taste Check</NuxtLink
          >
        </template>
        <NuxtLink
          v-else-if="latest"
          to="/"
          class="border-3 border-ink bg-teal px-5 py-2.5 font-wide text-lg font-black text-ink"
          >Pick artists</NuxtLink
        >
      </nav>

      <section aria-labelledby="method" class="mt-8">
        <h2 id="method" class="font-wide text-2xl font-black">
          How it's measured
        </h2>
        <ul class="mt-2 flex list-disc flex-col gap-1 pl-5 text-base">
          <li>
            <strong>A fair opponent:</strong> the random songs are popular ones
            from the same genre as your artists.
          </li>
          <li>
            <strong>Blind:</strong> names stay hidden until all three songs are
            rated.
          </li>
          <li>
            <strong>One listener, one vote:</strong> each listener's own
            difference is averaged first, so playing twenty rounds counts once.
          </li>
          <li>
            <strong>Honest about chance:</strong> a winner is only called once
            the 95% interval is entirely above or below zero.
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
