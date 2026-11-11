import { mergeSuggestions, startsAWord, type Suggestion } from "~~/shared/utils/suggestion-match";

// Autocomplete for the seed input, as one flow per typed text:
// 1. At once: keep the names on screen that still match (narrowing never collapses the list).
// 2. After 150 ms: names we already know (/api/artists/known, milliseconds) join them.
// 3. After 400 ms: Last.fm's matches (/api/artists/search, 1–3 s) join below.
// An answer is used only if it's still for what's typed, and never while the list is closed
// (blur, Escape), so late answers can't reopen it. Failed requests aren't remembered.

const MIN_CHARS = 2;
const KNOWN_DEBOUNCE_MS = 150;
// 250ms was too short for Last.fm: normal typing often pauses that long between keys
const SEARCH_DEBOUNCE_MS = 400;
const MAX_SUGGESTIONS = 8;

const keyOf = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

export function useArtistSearch(query: Ref<string>) {
  const key = computed(() => keyOf(query.value));
  const shown = ref<Suggestion[]>([]);
  const dismissed = ref(false);
  const notice = ref("");

  // Complete answers (ours and Last.fm's both succeeded), reused when the same text comes back
  const complete = new Map<string, Suggestion[]>();
  // Texts Last.fm has answered or failed for; reactive so `searching` updates
  const settled = ref(new Set<string>());
  const settle = (k: string) => (settled.value = new Set(settled.value).add(k));

  // In flight or done, so the two steps share one request; a failure is forgotten and answers null
  const knownRequests = new Map<string, Promise<Suggestion[] | null>>();
  function known(k: string) {
    let request = knownRequests.get(k);
    if (!request) {
      request = $fetch<Suggestion[]>("/api/artists/known", { query: { q: k } }).catch(() => {
        knownRequests.delete(k);
        return null;
      });
      knownRequests.set(k, request);
    }
    return request;
  }

  watch(key, (k) => {
    dismissed.value = false;
    shown.value = complete.get(k) ?? shown.value.filter((s) => startsAWord(s.name, k));
  });

  watch(refDebounced(key, KNOWN_DEBOUNCE_MS), async (k) => {
    if (k.length < MIN_CHARS || complete.has(k)) return;
    const found = (await known(k)) ?? [];
    if (k !== key.value || complete.has(k)) return;
    shown.value = mergeSuggestions(shown.value, found.filter((s) => startsAWord(s.name, k)), MAX_SUGGESTIONS);
  });

  watch(refDebounced(key, SEARCH_DEBOUNCE_MS), async (k) => {
    if (k.length < MIN_CHARS || complete.has(k)) return;
    try {
      const [found, fromLastfm] = await Promise.all([
        known(k),
        $fetch<Suggestion[]>("/api/artists/search", { query: { q: k } }),
      ]);
      const answer = mergeSuggestions(found ?? [], fromLastfm, MAX_SUGGESTIONS);
      // Without our own matches it's incomplete: ask again next time this text comes back
      if (found) complete.set(k, answer);
      settle(k);
      if (k !== key.value) return;
      notice.value = "";
      // What's on screen keeps its place; the rest goes below
      shown.value = mergeSuggestions(shown.value, answer, MAX_SUGGESTIONS);
    } catch (err) {
      settle(k);
      if (k === key.value && (err as { statusCode?: number }).statusCode === 429) {
        notice.value = "Too many searches. Wait a moment, or press Enter to add the name.";
      }
    }
  });

  const suggestions = computed(() => (dismissed.value || key.value.length < MIN_CHARS ? [] : shown.value));
  // From the first keystroke, not after the debounce: Last.fm takes 1–3 s
  const searching = computed(() => key.value.length >= MIN_CHARS && !settled.value.has(key.value) && !complete.has(key.value));
  const noMatches = computed(() => settled.value.has(key.value) && shown.value.length === 0 && !notice.value);

  return {
    suggestions,
    searching,
    noMatches,
    notice,
    // Blur and Escape: close, and stay closed until the visitor types or comes back
    dismiss: () => (dismissed.value = true),
    reopen: () => (dismissed.value = false),
  };
}
