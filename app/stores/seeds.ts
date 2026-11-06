import { skipHydrate } from "pinia";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";

export const MIN_SEEDS = 1;
export const MAX_SEEDS = 3;

export type AddResult = "added" | "duplicate" | "full" | "empty";

// The user's seed artists, kept in localStorage. Names only, nothing about the user
export const useSeedsStore = defineStore("seeds", () => {
  // initOnMounted: read only after mount, or server and client HTML differ (hydration mismatch)
  const seeds = useLocalStorage<string[]>("music-recs:seeds", [], { initOnMounted: true });

  // The limit used to be 5; trim old saved lists or the API returns 400
  watch(
    seeds,
    (list) => {
      if (list.length > MAX_SEEDS) seeds.value = list.slice(0, MAX_SEEDS);
    },
    { immediate: true },
  );

  const isReady = computed(() => seeds.value.length >= MIN_SEEDS);
  const isFull = computed(() => seeds.value.length >= MAX_SEEDS);

  const has = (name: string) => seeds.value.some((s) => normalizeArtistName(s) === normalizeArtistName(name));

  // Returns a result; the component decides what to tell the user
  function add(name: string): AddResult {
    const trimmed = name.trim();
    if (!trimmed) return "empty";
    if (has(trimmed)) return "duplicate";
    if (isFull.value) return "full";
    seeds.value = [...seeds.value, trimmed];
    return "added";
  }

  function remove(name: string) {
    seeds.value = seeds.value.filter((s) => s !== name);
  }

  // For "did you mean": swap in place, or just drop the misspelling if the suggestion is already a seed
  function replace(from: string, to: string) {
    if (has(to)) {
      remove(from);
      return;
    }
    seeds.value = seeds.value.map((s) => (s === from ? to.trim() : s));
  }

  // skipHydrate: otherwise the server's empty state overwrites the seeds from localStorage
  return { seeds: skipHydrate(seeds), isReady, isFull, add, remove, replace };
});
