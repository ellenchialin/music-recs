import { skipHydrate } from "pinia";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";

// 輸入 1–3 位喜歡的歌手（原本 SPEC 是 3–5 位，見 docs/ai-log.md）
export const MIN_SEEDS = 1;
export const MAX_SEEDS = 3;

export type AddResult = "added" | "duplicate" | "full" | "empty";

// 使用者選的種子歌手。存在 localStorage，重新整理頁面還在（SPEC：種子歌手）
// 只存歌手名字，沒有任何可識別使用者的資料
export const useSeedsStore = defineStore("seeds", () => {
  // VueUse 的 useLocalStorage：讀寫這個 ref 就是讀寫 localStorage，像 useState 自動同步到 storage
  // initOnMounted：等頁面在瀏覽器掛載後才讀 localStorage。伺服器端沒有 localStorage，
  // 先讀的話伺服器和瀏覽器渲染出來的 HTML 不一樣（hydration mismatch）
  const seeds = useLocalStorage<string[]>("music-recs:seeds", [], { initOnMounted: true });

  // 以前最多 5 位：舊的 localStorage 讀進來時只留前 MAX_SEEDS 位，不然 API 會回 400
  watch(
    seeds,
    (list) => {
      if (list.length > MAX_SEEDS) seeds.value = list.slice(0, MAX_SEEDS);
    },
    { immediate: true },
  );

  const isReady = computed(() => seeds.value.length >= MIN_SEEDS);
  const isFull = computed(() => seeds.value.length >= MAX_SEEDS);

  // 和後端同一套正規化：大小寫、空白不同也算同一位
  const has = (name: string) => seeds.value.some((s) => normalizeArtistName(s) === normalizeArtistName(name));

  // 回傳結果而不是直接顯示訊息：要不要提示、怎麼提示，由元件決定
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

  // 404 時點了「你是不是要找…」：把打錯的那位換掉，位置不變；建議的名字已經在清單裡就只拿掉打錯的
  function replace(from: string, to: string) {
    if (has(to)) {
      remove(from);
      return;
    }
    seeds.value = seeds.value.map((s) => (s === from ? to.trim() : s));
  }

  // skipHydrate：伺服器渲染時種子是空的，這份空狀態會隨頁面帶到瀏覽器；
  // 不跳過的話，它會蓋掉 localStorage 裡的種子，重新整理後就全不見了
  return { seeds: skipHydrate(seeds), isReady, isFull, add, remove, replace };
});
