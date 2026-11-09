# AI collaboration log

Decisions settled after discussing them with Claude Code. "Claude's suggestion" is what Claude proposed; "Decision" is what I settled on.

## 2026-11-02 · The project

The previous project (a job-listing filter) stopped being interesting and wasn't a good fit to show publicly, so I switched to a new portfolio project.

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | What to build | A music or anime recommender, something I use every day | Music | I listen every day, so I can tell whether recommendations are good |
| 2 | Data source | Don't build on the Spotify API (from February 2026 development mode requires Premium, allows only a few users and disables several endpoints); use Last.fm (similar artists, tags) + Deezer (previews, covers) | Adopted | |
| 3 | Who it's for | An interactive platform anyone can use, not a personal tool | Adopted | Interviewers can try it directly |
| 4 | How others can use it without an account | Enter 3–5 favorite artists as a starting point; anonymous ID in a cookie | Adopted | |
| 5 | Interaction and eval | Like/dislike re-sorting, a popularity slider, a blind test; blind-test ratings are the eval data | Adopted | People playing it are labeling data |
| 6 | Privacy | No personal data; listening history only published as aggregates; raw exports never go in the repo | Adopted | |

## 2026-11-02 · Stack

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Frontend framework | — | Vue 3 (my call) | |
| 2 | Separate frontend and backend? | Nuxt 4 holds pages and API in one project; a split (Vite SPA + Hono) is closer to typical company setups but 20–30% more work | Nuxt 4 | The MVP has to be done in a week |
| 3 | Database and ORM | Postgres + Drizzle, reusing what I learned last time; Neon in production | Adopted | Postgres is the industry standard; ORMs are swappable but the concepts carry over |
| 4 | Where to store rate limits | Postgres: Vercel is serverless, so in-memory counts are unreliable; no extra Redis | Adopted | |

## 2026-11-03 · Way of working and schedule

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Way of working | Same as the previous project | Same, plus TDD (my call) | |
| 2 | How TDD fits with "test output isn't the main feedback" | Claude writes the tests first and explains in plain words what they check; after they pass, still look at the page or JSON. My exercises are "make the red test green", more focused than starting from scratch | Adopted | Reading test failures was hard on the last project |
| 3 | Schedule | Originally estimated two weeks | MVP in one week | |
| 4 | What to cut if a week isn't enough | In order: popularity slider → LLM reasons (use rule-based reasons) → Playwright | Adopted | |
| 5 | Project location | `~/dev/music-recs` | Adopted | |

## 2026-11-03 · Project skeleton

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | TypeScript version | Pin 5.9: TypeScript 7 just came out and typescript-eslint and vue-tsc don't support it yet | Adopted | |
| 2 | Postgres port | 5434: 5433 is taken by job-alert-triage, so both projects can run at once | Adopted | |
| 3 | How to add Tailwind | Tailwind v4's official `@tailwindcss/vite` plugin, not the `@nuxtjs/tailwindcss` module | Adopted | One less wrapper; setup is a single `@import` |
| 4 | How to split tests | Two Vitest projects: `unit` (pure functions, Node) and `nuxt` (components, happy-dom); add DB tests when the first table appears | Adopted | Pure-function tests don't need to boot Nuxt, which is much faster |
| 5 | What to use for UI motion | Motion for Vue (`motion-v`): declarative springs, `layout` reorder animations, `AnimatePresence` exit animations (CSS transitions can't do layout animations); `MotionConfig reduced-motion="user"` respects reduced motion everywhere | Adopted (I asked for a motion library) | Re-sorting after feedback and the blind-test reveal are interactions the portfolio should show |
| 6 | UI theme | — | Cyberpunk (my call) | |
| 7 | Features first or polish first | Only define design tokens now (colors, fonts, glow) and apply them to the skeleton; effects like glitches and scanlines wait for day 7. With tokens set, components written on days 3–6 are on-theme from the start, and polish only means adjusting tokens and adding effects | Adopted | |
| 8 | Where the theme colors come from | From the Edgerunners key art I provided: purple-black `#120c24`, cyan `#11c4e9`, red `#fc1636`, acid yellow `#ffe428`, orange, lavender; shapes with cut corners, diagonal stripes and bevels; italic Chakra Petch. Only the mood, no logo or characters | Adopted | |

## 2026-11-03 · Last.fm client

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | How to detect errors | Check the body's `error` field, not just the HTTP status: an unknown artist returns HTTP 200 + `{ error: 6 }` | Adopted | Found while recording fixtures |
| 2 | Where covers come from | Last.fm's artist images are all the same placeholder; take covers from the preview source (see iTunes below) | Adopted | |
| 3 | Test data | Record real responses with `pnpm record:lastfm`; fetch is injected, so tests never hit the network | Adopted | |

## 2026-11-03 · Preview source: iTunes instead of Deezer

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Which API for previews and covers | Use the iTunes Search API, not Deezer. Deezer isn't available in Taiwan (`/infos` returns `open: false`): searches return empty arrays and preview URLs are empty strings, so there are no previews locally and no real fixtures to record | Adopted | iTunes works in Taiwan, needs no key, and its preview URLs don't expire (so the spec's "cache only the Deezer ID" concern goes away and `tracks` can store URLs directly) |
| 2 | Which store to query | Default `country=TW`, configurable in the client | Adopted | Users are in Taiwan; a US deployment still queries the Taiwan store |
| 3 | Cover size | Replace `100x100bb` in the URL with `600x600bb` | Adopted | The API only lists up to 100px |

The cost: iTunes' rate limit is stricter than Deezer's (officially about 20 a minute), so caching matters more.

Why not just Last.fm: `track.getInfo` has **no previews** (`streamable` is `0` and there's no audio URL in the response). It does have covers: only the artist images are placeholders, and `track.getInfo`'s album art is real (Creep returns the original Pablo Honey at 300px). Previews need iTunes anyway and the same response includes a cover, so covers come from iTunes too. Last.fm's album art could be a fallback when iTunes finds no song (one more API call; not done for now).

## 2026-11-03 · pickTrack (exercise 2)

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | The wanted title has a version (`Creep (Acoustic)`) but iTunes only has the original | Return `null`; don't fall back to the original | Adopted | Recommending the acoustic version and then playing the original would feel wrong; one less tier makes behavior predictable |

## 2026-11-03 · Last.fm cache

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | How to store similar artists | A new `artist_similar` table (artist id + name + match) that does **not** reference `artists`. Listener counts and tags for the similar side are fetched only when needed | Adopted | Referencing `artists` would require one `getInfo` call for each of 50 similar artists first |
| 2 | Freshness of the similar list | Track `artists.similar_fetched_at` separately (null = never fetched); when stale, replace the whole list in one transaction | Adopted | Artist info and the similar list are two APIs, not always fetched together |
| 3 | How many similar artists to fetch | 50 | Adopted | Still 10+ left after excluding seeds and disliked artists |
| 4 | Cache key | Last.fm's autocorrected official name | Adopted | Known limitation: input that differs from the official name (an alias, say) misses every time. Autocomplete picks the official name, so it's fine in most cases |

## 2026-11-03 · Track cache

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | How to store each artist's track | A `tracks` table keyed by normalized artist name, one track per artist, not referencing `artists` | Adopted | Recommendations are similar artists, who aren't in `artists` |
| 2 | When iTunes finds nothing | Store a row with a `null` preview (negative cache); store nothing when iTunes errors | Adopted | Rate limits; errors are temporary and shouldn't be remembered for 30 days |
| 3 | When Last.fm has no top track | Return `null` and store nothing | Adopted | Rare, and asking Last.fm again is cheap |
| 4 | When the Taiwan store has nothing | Try Taiwan → Japan → US in order, stopping at the first match | Taiwan → **US** → Japan (I changed the order) | Previews for 宇多田ヒカル's top 8 similar artists went from 3 to 7; iTunes calls went from 8 to 16, cached for 30 days |
| 5 | Is a missing preview an error? | No. Day 3's `/api/recommendations` distinguishes three cases: no store has it → the card's `preview: { status: "unavailable" }` ("No preview" plus an Apple Music search link); iTunes errors temporarily → `preview: { status: "error" }`, not cached (shows retry); a seed isn't found (Last.fm error 6) → 404 with similar artists from `artist.search`, and the page suggests another search | Adopted (I asked for the page to show errors and suggestions) | A card without a preview is still a successful recommendation; each card catches its own iTunes error so one card can't break the list |

**Data issues (to handle when writing the algorithm; no decision needed yet)**

- Similar artists include aliases of the same person: 宇多田ヒカル's #1 is `Utada` (match 1).
- Tag spellings vary: `j-pop` and `JPop` both appear; normalize tags before picking control songs for the blind test.
- Search returns misspelled duplicates: `radıohead` (dotless ı) has 117 listeners; autocomplete may need a listener threshold.
- iTunes' first result often isn't the original: for "Radiohead Creep" the first hit is the acoustic version (the original isn't in the Taiwan store), followed by TLC's song of the same name. Picking needs a pure function: right artist, original title first, other versions only if there's no original.
- The iTunes Taiwan store spells artists differently from Last.fm: `宇多田ヒカル` vs `Hikaru Utada`. Artist matching can't be plain string comparison.
- Low preview hit rate: only 3 of 宇多田ヒカル's top 8 similar artists got a preview. Almost always because stores localize artist names: in the Taiwan store BoA → `寶兒`, Crystal Kay → `克莉絲朵凱兒`, Perfume's 「エレクトロ・ワールド」 → `Electro World`; in the Japan store Radiohead → `レディオヘッド`. No single store matches everyone, and 安室奈美恵 only has covers in all three stores. Handled with store fallback (see "Track cache" #4); only 安室奈美恵 still has no match.

## 2026-11-03 · Theme redesign: retro-modern futuristic

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | The neon cyberpunk look is too childish | — | Retro-modern futuristic, based on the illustration I provided (my call) | |
| 2 | Colors | From the illustration: pink `#f8527e` as the page background, navy `#131f39` as ink (text, thick lines, dark panels), teal `#1ec8bc` for primary actions and the sun; slate `#43797c`, plum `#533852` and coral `#d6665c` as small accents | Adopted | Ink on pink is about 5:1 contrast, readable for body text |
| 3 | Shapes | Drop glows, diagonal stripes, bevels, cut corners and monospace; use flat fills and thick ink lines, with the sun as the only circle | Adopted | Glows and bevels were the main source of the childish feel; the illustration itself is flat fills with outlines |
| 4 | Fonts | Headings from italic Chakra Petch → wide Archivo (`font-stretch: 125%`); body stays Noto Sans TC | Adopted | Italic sci-fi fonts look like a game UI; a wide sans looks like a retro poster |

## 2026-11-04 · Recommendation algorithm

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | The algorithm's input | Plain objects (`types.ts`: seed + similar list + weight), no database or API access; `/api/recommendations` loads the data from the cache | Adopted | Pure functions are easy to test; the spec requires it |
| 2 | Scoring | Sum `weight × match` across seeds; every seed's weight is 1 for now, with seeds added by "like" weighted lower later | Adopted | Similar to more seeds and more similar scores higher (spec) |
| 3 | Ties | Sort by `nameNorm` | Adopted | The same input gives the same order every time, so the blind test is reproducible |
| 4 | Excluding aliases | Same normalized name or same MBID counts as the same artist; artists without an MBID aren't compared by it | Adopted | Known limitation: `Utada` has no MBID on Last.fm, so it still gets recommended to 宇多田ヒカル fans. Could later be excluded by "dislike" or a small manual alias list |
| 5 | Excluding the seeds | `recommend()` adds the seeds (name + `seedMbid`) to the exclusion list itself instead of relying on the caller | Adopted | With Radiohead and Thom Yorke as seeds, each is in the other's list |
| 6 | Exclude first or take the top 10 first | Exclude first, so later candidates fill the spots | Adopted | Taking first then excluding leaves fewer than 10 |
| 7 | Version | `ALGO_VERSION = "v1"`, bumped whenever the rules change | Adopted | Blind-test ratings are stored with the version, so versions can be compared |

**What v1 showed with real data**

- Trying v1 with real data (seeds 宇多田ヒカル and 椎名林檎) showed three problems, left for v2:
  - **One seed's list drowns out another's**: 8 of the top 10 came from 宇多田ヒカル alone. Options: normalize each seed's scores separately, or guarantee each seed some spots.
  - **Collaboration credits**: `椎名林檎×斎藤ネコ` is the seed's own collaboration; a name containing a seed's name should be excluded.
  - **Bands and members**: `東京事変` is 椎名林檎's band, and both seeds recommend it, so it ranks first. Whether that's a duplicate is still undecided.

## 2026-11-04 · /api/recommendations

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | GET or POST | `GET /api/recommendations?seed=A&seed=B`, responding `{ algoVersion, seeds, recommendations }` | Adopted | Read-only; URLs can be shared and tested with curl |
| 2 | How many seeds | The API accepts 1–5; the spec's "at least 3" is enforced by the page | Adopted (later changed to 1–3; see "Number of seeds") | Testing with one seed is easier during development |
| 3 | Concurrent external API calls | At most 3 (`mapLimit`) | Adopted | Last.fm allows about 5 a second, iTunes about 20 a minute |
| 4 | Suggestions when a seed isn't found | Top 5 from `artist.search` with at least 1,000 listeners | Adopted | Filters out misspelled duplicates like radıohead |
| 5 | Last.fm down | 502, without passing on the original message | Adopted | |
| 6 | Artists for testing | Use Western artists for real-data trials from now on (Tame Impala, Justin Bieber, Kokoroko…) | Adopted (my call) | |

**Trying it with real data (Tame Impala, Justin Bieber, Kokoroko)**

- First request 6.4 seconds, second 0.03 seconds (all from cache); 8 of 10 cards had previews.
- Last.fm's autocorrect fixes small typos itself (`Tame Impalla` → Tame Impala); what it can't fix (`Kokoroco`) returns 404 with suggestions Kokoroko and LocoRoco.
- **One seed drowning out others again**: 5 from Kokoroko, 4 from Justin Bieber, and only Pond from Tame Impala. Every seed's #1 is close to 1, so whichever seed's list is denser at the top takes more spots. Top priority for v2.
- The 400 error message is zod's raw JSON; the page shouldn't show it directly.

## 2026-11-04 · Algorithm v2: seed balance

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | One seed drowning out the others | Score by rank: rank `rank` gets `weight / (5 + rank)`, summed (Reciprocal Rank Fusion); `ALGO_VERSION` becomes `v2` | Adopted (I asked to fix this first) | Every seed's #1 counts the same, so results alternate between seeds; artists recommended by several seeds still rank high |
| 2 | Value of `RANK_K` | 5: #5 for two seeds beats #1 for one; #10 for two lands between #2 and #3 | Adopted | Too small (1) makes rank gaps huge; too large (60, a common default) lets shared recommendations dominate |

Same seeds (Tame Impala, Justin Bieber, Kokoroko):

| | Kokoroko | Justin Bieber | Tame Impala | With preview |
|---|---|---|---|---|
| v1 | 5 | 4 | 1 | 8 / 10 |
| v2 | 3 | 4 | 3 | 9 / 10 |

The cost: the size of `match` is lost, so a seed with a weak list overall gets as many spots as any other.

## 2026-11-04 · Home page: seed input and recommendation cards

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Server-side cache for autocomplete | `GET /api/artists/search?q=` with Nitro's `defineCachedEventHandler` for a day, keyed by the normalized query | Adopted | No table needed for search. Known limitation: on Vercel the cache lives in each serverless instance's memory, so the hit rate is lower |
| 2 | When autocomplete finds nothing | Enter still adds the typed text | Adopted | Last.fm search is fuzzy ("kokoro" doesn't find Kokoroko); the recommendations API autocorrects and returns 404 with suggestions if it can't |
| 3 | Where chosen seeds go | On the sun, like the stickers on the gear in the illustration; on phones the order is title → input → seeds → button | Adopted | Gives the theme's only circle a real job; on phones the seeds are visible right after adding them |
| 4 | Where the normalization function lives | Moved from `server/utils/` to `shared/utils/` so the page uses the same rules for duplicates | Adopted | Server and client agree on what "the same artist" means |
| 5 | Cards without a preview | "No preview · Find it on Apple Music", linking to `music.apple.com/tw/search` | Adopted | Matches "Track cache" #5's unavailable state |
| 6 | Animations in component tests | Set `MotionGlobalConfig.skipAnimations = true` in `tests/setup/nuxt-setup.ts` | Adopted | happy-dom throws AbortError when cancelling animations; tests only check behavior |

**A bug found in the browser**: seeds disappeared on reload. The cause was SSR: the server has no localStorage, and Pinia sent the empty state to the browser, overwriting localStorage. Fixed with `skipHydrate` + `initOnMounted`, with a test that reproduces it (`docs/concepts.md` section 10).

## 2026-11-04 · Home page responsiveness and empty state

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Search box debounce | Already there (250ms); typing "tame impala" (11 characters) quickly in the browser sent only 1 request | No change | Confirmed working (later changed to 400ms; see the next section) |
| 2 | Before any artist is picked | A sound-wave animation on the sun (5 bars bouncing in turn) instead of the "no artists yet" text; screen readers still read the text | Adopted (my call, with a reference image) | |
| 3 | No scrolling on the home page below 1024px | The first screen uses `h-dvh`, and the sun shrinks to the remaining space with a container query (`min(100cqw, 100cqh)`); landscape (768+ wide) switches to two columns; below 520px tall the title shrinks and the subtitle goes | Adopted (my call). Scrolling is only needed once recommendations appear | Verified at 375×667, 390×844, 768×1024, 1023×768 and 812×375: exactly one screen each |
| 4 | Autocomplete shows "Tame İmpala" | Ignore accents and treat every kind of i as the same when checking duplicates; among lookalikes keep the one with the most listeners | Adopted | Same kind of duplicate as radıohead, but with 1,965 listeners it passes the threshold |

**A pitfall**: Nitro's cache keys drop spaces and punctuation, so "tame impala", "tame impala?" and "tameimpala" share one cache entry (`.nuxt/cache/nitro/handlers/`). After changing the suggestion rules, that folder must be cleared to see new results; in production the cache starts empty after a deploy.

## 2026-11-04 · Search request count, card layout

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Search still calls the API too often | Debounce 250ms → 400ms; remember results in the component so deleting and retyping doesn't request again | Adopted (my call, with a Network screenshot) | Normal typing often pauses more than 250ms between keys, which means a search every character or two; in the screenshot "daniel" was searched twice. Earlier tests with tool-typed input missed it because tools type too fast |
| 2 | Card covers don't fill the card | Fixed card height (128px on phones, 160px on desktop) with a square cover as tall as the card, flush left (like Spotify) | Adopted (my call) | |
| 3 | Cards in the grid have different heights | As above, fixed height; long titles, artists and "Similar to…" are truncated (full text on hover) | Adopted (my call) | The "No preview" card was taller by one line |

## 2026-11-04 · Number of seeds

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | How many seeds to pick | — | 1–3 (my call; the spec said 3–5) | More aren't needed; the client store and the API check change together, and the spec is updated |

Effects: "Similar to A and B" lists at most 3 seeds; with fewer seeds, v2's rank scores give each seed more spots (1 seed = all 10 spots).

## 2026-11-04 · Empty state becomes a turntable

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | What goes on the sun before any artist is picked | A turntable (`VinylRecord.vue`, inline SVG): an ink record with thick grooves and two sector highlights, a pink + coral label, the center hole showing teal; a paper tonearm with a thick ink outline and a coral head. The record spins once about every 4 seconds and the tonearm swings in after the record appears; nothing moves with reduced motion | Adopted (my call, replacing the sound wave) | A more concrete image of music than an equalizer; only theme tokens, keeping flat fills and thick lines |

## 2026-11-04 · Home title and centering the left column

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Center the left column vertically like the turntable | Add a `1fr` row above and below in the desktop and landscape grid so title, input and button are centered as a group | Adopted (my call) | At 1440×900 the left column's center and the sun's are both at y=448 |
| 2 | Title style | Inspired by how Neon Genesis Evangelion's title cards treat type (not its logo): Noto Serif at weight 900, width axis at 62.5%, uppercase, line height 0.8, each word stretched 1.18× taller; one line on phones, two on desktop | Try a version (my call) | The closest free Google Font to an ultra-bold, ultra-condensed serif; the `font-title` utility is only for the home title |

## 2026-11-04 · UI copy in English

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | UI language | — | All English (my call); `<html lang="en">`, listener counts abbreviated in English (4.7M listeners) | |
| 2 | English is longer than Chinese and doesn't fit on phones | Shorten: input hint "Type for suggestions, or press Enter", next to the button "Pick an artist first"; one size smaller button text on phones; card links say only "Apple Music" (`aria-label` reads the full "Find … on Apple Music") | Adopted | Still one screen with no scrolling at 375×667 |
| 3 | Cards overflow on the right on phones | Use `grid-cols-1` (`minmax(0, 1fr)`) for the list | Adopted | With a single column the track is `auto` and gets stretched by unbreakable English text inside cards; the shorter Chinese never triggered it |

## 2026-11-04 · Chosen artists become tags under the turntable

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Adding an artist replaces or covers the turntable, and the layout jumps | The turntable always spins on the sun; chosen artists are a row of tags under it, with "Your artists will appear here" when empty | Adopted (my call) | Adding or removing artists only touches the tag row |
| 2 | The sun shrinks when tags wrap | Reserve the tag row's height: two rows on phones (under 640) and in landscape, one row elsewhere; tags don't shrink (they wrap), no layout animation | Adopted | Adding the 1st to 3rd artist keeps the sun the same size: 188px at 375×667, 219px at 812×375, 512px at 1440×900 |
| 3 | On desktop the tags are far from the sun | Fix the sun area's height on desktop and center the sun and tags vertically as a group | Adopted | The tags sit 17px under the sun, and the group is level with the left column's center |

## 2026-11-04 · Tags under the input, Recommend at the bottom left

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Where the chosen-artist tags go | Move them from under the sun to between the input and the Recommend button | Adopted (my call; Claude agreed) | Reading top to bottom: type → see who was added → press Recommend; the feedback for Enter is right next to the input, and the sun becomes purely decorative, so its size stays put |
| 2 | Where the Recommend button goes | Desktop and landscape: the bottom of the left column (bottom left, near the navy ground strip), with title, input and tags centered in the left column. On phones it was already at the bottom | Adopted (my call) | |
| 3 | Very short screens don't fit | Below 520px tall: one-line title, input label for screen readers only, smaller tags | Adopted | 812×375 was 417px and scrolled; now exactly 375 |

Adding the 1st to 3rd artist: the sun stays 184px at 375×667, 441px at 768×1024, 327px at 812×375 and 512px at 1440×900; all four sizes are exactly one screen with no scrolling. On desktop the button lines up with the input's left edge (x=112), 20px above the navy ground strip.

## 2026-11-04 · Below 1024: title → turntable → input and tags → button

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Order on phones and portrait tablets | — | Title → turntable → input and chosen tags → Recommend button (my call) | The input and button sit in the lower half, within thumb reach |
| 2 | Same order in landscape (768+ wide)? | No, keep two columns | Adopted | At around 375px tall, a single column doesn't fit |
| 3 | With the input in the lower half, a list opening downward goes off screen | In one column the list opens upward (over the turntable, which is only decoration); in two columns it opens downward; the list has a max height and scrolls inside, and arrow-key selection scrolls the option into view | Adopted | At 375×667 the list used to reach 710px and made the page scrollable; now it stays inside. On desktop the max height is 18rem or 35% of the screen height (it overflowed by 4px before) |

Verified: the order is right at 375×667, 390×844 and 768×1024; adding the 1st to 3rd artist keeps the sun the same size (184, 358, 441px), and each is exactly one screen.

## 2026-11-04 · Recommendations become a record crate

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | How recommendations are shown | `RecordCrate.vue` replaces the card grid: the selected cover in the middle, the rest stacked to the sides (smaller with distance, turned inward 28°, under an increasingly dark ink layer), with a record sliding out from behind the selected one; under the cover come the artist, title and "Similar to …", then a round play button | Adopted (my call: like flipping through records, info under the cover, a round play button) | |
| 2 | How to move between records | Swipe (motion-v's `drag="x"`, changing records past 60px of offset plus velocity), click a side cover, round left/right arrows, or the arrow keys; shows "3 / 10" | Adopted | Swipe on phones, click on desktop, keyboard works too |
| 3 | Accessibility | The group is `aria-roledescription="carousel"`, each record a `slide` labeled "3 of 10: Artist"; the info under the cover is `aria-live`, so screen readers announce the new artist | Adopted | |
| 4 | Entrance | Covers start in their final positions (`initial: false`) and the group fades in with its parent | Adopted | Before, all covers stacked in the middle under dark overlays and then fanned out, which looked messy |

The old `RecommendationCard.vue` is gone. Verified: no horizontal scrolling at 1440×900 or 375×812; dragging the middle cover left with the mouse moves from record 1 to record 2.

## 2026-11-04 · Feedback replaced by Explore from here

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Like/dislike → re-sort | Tried after building it: after a like, the order changed instantly and looked like a new batch; a "Re-sort" button would require users to understand the scoring | Removed entirely (my call: users won't know about the scoring). The uncommitted feedback code, the `feedback` table and migration 0003 were deleted, and the table and migration records were removed from both local databases | |
| 2 | Without feedback, what shows off the algorithm and interaction | Three options: A. Skip to replace a record; B. dig deeper from a record; C. a familiar ↔ discover slider | B, named "Explore from here" (my choice) | Fits the record-crate idea best and demos well |
| 3 | How many levels | 5, with a disabled button and explanation at the deepest level | 3, and Explore is simply hidden at the deepest level (my call) | A disabled button is one more thing to understand; to change direction, go back along the path |
| 4 | Exclusion rule | Exclude the original seeds and every record shown on earlier levels | Adopted | Every level shows new artists |
| 5 | API | Keep `GET /api/recommendations` with an added `exclude` (up to 60); the algorithm is unchanged, still v2 | Adopted | The exclusion list is just one more input |
| 6 | Going back a level | Keep each level's result and viewed record on the client, so going back doesn't refetch | Adopted | |
| 7 | Exploring takes several seconds | The button shows "Finding more…" and is disabled | Adopted | Uncached artists took 1.8–5.2 seconds |

Verified (Tame Impala, Kokoroko → Pond → Mink Mussel Creek → Levitation Room): 4 levels of 10 records each, no repeats across levels, 32 artists excluded on level 3. The browser pane was hidden, so the level-change animation and button flow couldn't be checked visually; component and page tests cover them.

## 2026-11-04 · Recommendations move to their own page, /recommendations

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Recommendations under the home page or on their own page | Their own page, with the URL as the single source of truth: `/recommendations?seed=…&explore=…` | Adopted (I proposed splitting the page) | Home only handles input; Back, reload and shared links all work; the server can compute results up front |
| 2 | Put the Explore path in the URL? | Yes: each level deeper adds an `explore` param | Adopted | Back = up a level, and shared links include the explore position |
| 3 | Breadcrumb | One line: `Home › Tame Impala + Kokoroko › Pond › GUM` | Adopted | |
| 4 | When the URL's seeds differ from the home page's localStorage | The URL wins; Home links to `/?seed=…`, which the home page loads into the input before cleaning the URL to `/` | Adopted | People arriving from a shared link can keep editing |
| 5 | Loading state | The centered sun + turntable | Keep just the turntable, centered (my call) | |
| 6 | Timing | Now (the popularity slider moves later) | Now (my call) | The blind test will be its own page too |
| 7 | Refetch when going back a level or pressing Back? | Keep every fetched level in `useState` (keyed by seeds + path), along with each level's viewed record | Adopted | Pressing Back made 0 new requests |

**A bug found while splitting**: once the recommendations page rendered on the server it returned 500, because the preview player called `new Audio()` on creation and the server has no Audio. Now it's created on first play, with a test that reproduces the bug first. It went unnoticed before because recommendations only rendered in the browser.

## 2026-11-04 · The recommendations page is one screen too

| # | Question | Claude's suggestion | Decision | Reason |
|---|---|---|---|---|
| 1 | Should the recommendations page also not scroll? | Yes: it works like a player, swiping records won't accidentally scroll, and it matches the home page | Adopted (my call) | It was 891px tall at 375×667 and 980px at 1440×900 |
| 2 | How to make it fit | Covers scale with the remaining height (container query, max 22rem); the three info lines truncate to one line each; previous, play and next form one row `‹ ▶ ›`; the "No new artists" notice temporarily takes Explore's place | Adopted | |
| 3 | Where "3 / 10" goes | To the right of the title line | 12px at the very bottom (my call) | |
| 4 | Phones in landscape | Very short landscape screens (under 600px tall, `short-landscape`) switch to two columns, with side covers clipped at the left column's edge | Adopted | At first the check was "768+ wide and landscape", which made desktop two columns too, with side covers over the text on the right |
| 5 | The heading is cut off on phones | Font size follows screen width (`clamp(1.375rem, 6vw, 3rem)`) | Adopted | Wide Archivo at 3xl doesn't fit 375px |
| 6 | Previous/next look like the play button | Use a player's skip icons (bar + triangle) without a circle, so only Play is round | Adopted (my call, with a reference image) | |
| 7 | The navy ground strip at the bottom | Removed from both the recommendations page and the home page | Adopted (my call) | |

Verified at 375×667, 390×844, 768×1024, 812×375, 1023×768 and 1440×900: page height equals screen height and nothing scrolls sideways. Covers are 233, 243, 352, 201, 352 and 352px.

### Home → recommendations transition (2026-11-04)

With cached queries the recommendations page is fast, so the loading turntable appears for an instant and looks like an afterimage.

| # | Question | Decision | Status | Reason / alternatives |
|---|---|---|---|---|
| 1 | The turntable flashes past | Try C: View Transitions (`experimental.viewTransition`), with the same `view-transition-name: turntable` on both pages, so pressing Recommend moves the turntable from its home position to the center of the recommendations page | Adopted (I chose C and kept it after trying) | A: always play a "needle drop" entrance of about 0.8s; B: show only after a delay, with a minimum display time. C makes it look like the same turntable on both pages, the strongest sense of transition |
| 2 | When data comes back very fast | Arriving from home via Recommend (the `useState("needle-drop")` flag), the turntable stays at least 1.1s (about 0.55s to move plus a short spin) before the records appear; direct visits and Explore don't wait | Adopted | Without a minimum, the records replace it the moment it reaches the center, which still looks like an afterimage |
| 3 | The turntable that moved over replays its entrance (growing from small) | The recommendations turntable is in its final state at the moment of navigation (`entrance=false`); the flag is read in setup, not onMounted | Adopted | Deciding in onMounted was too late: the first render had already started the entrance |
| 4 | Unsupported browsers and reduced motion | Nuxt skips the view transition; without `startViewTransition`, the turntable plays its own entrance | Adopted | |

Verified (Chromium, 375 wide): the page changes about 0.1s after the press, the move ends at 0.7s, and the records appear at 1.3s.

## 2026-11-05 · Rate limiting

| # | Question | Decision | Status | Reason / alternatives |
|---|---|---|---|---|
| 1 | How to count | Fixed windows (one per minute) in `rate_limits(key, window_start, count)`, with an atomic upsert increment | Adopted | Sliding windows and token buckets are smoother, but this traffic doesn't need them |
| 2 | What the key is | IP only, stored as a salted SHA-256 (`RATE_LIMIT_SALT`); the anonymous ID only arrives on day 6, and clearing cookies gives a new one, so it can't stop abuse | Adopted | The spec originally said "anonymous ID and IP" |
| 3 | Which routes, and how many | Only routes that call external APIs: `/api/recommendations` 20 a minute, `/api/artists/search` 60 | Adopted (tune after play-testing) | |
| 4 | Old rows | Each write has a 1% chance to delete rows older than an hour | Adopted | A daily Vercel Cron cleanup is one more thing to configure |
| 5 | The autocomplete cache | Cache only the Last.fm call (`defineCachedFunction`), so every request passes the limit | Adopted | Caching the whole route skips the limit on cache hits, and concurrent requests for the same query get merged and counted once |
| 6 | SSR requests are counted as one IP | `useApiFetch` forwards the client IP in `x-forwarded-for` during SSR | Adopted | Found by testing: SSR calls the API without going over the network, so the API gets no IP and everyone shares the "unknown" bucket. Once deployed, 20 SSR page loads a minute site-wide would 429 everyone |
| 7 | What the page says | Recommendations page: "Too many requests / Wait a minute, then try again." + Try again; Explore: a one-line notice; autocomplete: "Too many searches", and Enter still adds the name | Adopted | Don't say "the data source has a problem": that's a different error |

Verified: 22 recommendation requests in a row return 429 from the 21st on, with `Retry-After` counting down to the next minute; the table holds only hashes; Try again recovers in the next minute.

## 2026-11-05 · Home layout: short windows, flex, title

| # | Question | Decision | Status | Reason / alternatives |
|---|---|---|---|---|
| 1 | In a desktop window that isn't full screen (e.g. 1280×600, 1024×620), the Recommend button falls off screen | `h-dvh` at every width: drop desktop's `lg:h-auto lg:min-h-dvh` and the turntable's `lg:min-h-[28rem]`; the title size also depends on height, `min(11vw, 14dvh)`; landscape gaps are `min(…, 2dvh)` | Adopted (my call) | Allowing scroll: the button would still need scrolling to reach |
| 2 | `md:landscape:` rules override `lg:` on desktop (in Tailwind's order landscape comes after lg), so desktop reserved an extra tag row and 16px more at the top | Rules meant only for landscape tablets become `md:max-lg:landscape:` | Adopted | A long-standing bug that only showed in short windows |
| 3 | Short-screen rules used `!` to beat responsive rules | No `!important`: `main.css` adds two complementary variants, `short` (height ≤ 520) and `tall` (height > 520). For properties set on both sides, responsive rules use `tall:` and short-screen rules use `short:`, so they never apply together and order doesn't matter | Adopted (my call: avoid !important) | |
| 4 | The space between the title's words disappears after a formatter splits the line ("MusicRecs") | Separate them with flex `gap` instead of a space character; the `h1` gets `aria-label="Music Recs"` for screen readers | Adopted (I asked for no space character) | A screen-reader-only space: still a space character, equally affected by line splitting |
| 5 | The home layout's grid (grid-template-areas, 1fr spacer rows) is hard to read | Use flex: one column on phones, two columns for `wide` (landscape tablets or desktops, a new custom variant). On phones the left column is `display: contents`, and `order` puts the turntable between the title and the input | Adopted (my call) | Drawing the turntable twice and hiding one: view-transition-name can't be duplicated |
| 6 | Below 768 wide the title flips between one and two lines (two lines at 650px, squeezing the sun to a dot) | No wrapping in one column, sized `min(18.5cqw, 10dvh)`: "MUSIC RECS" is 5.31 times its font size wide, so at 18.5cqw it fills 98% of the title area and always fits one line | Adopted (my call) | |
| 6b | Should the title switch between one and two lines by screen? | Always stacked in two lines (`flex-col`); in one column the size drops to `min(13cqw, 7dvh)`, on short screens `min(3rem, 8dvh)` | Adopted (my call; replaces #6's "one line in one column") | The cost: the sun gets smaller on small phones (375×667: 220 → 190px; only 37px at 320×568) |
| 7 | The home title should sit level with the recommendations breadcrumb | Same top, side and bottom padding as the recommendations page; `margin-top: calc(0.4545rem + 0.057em)` lines up the tops of both pages' capital letters (both values measured in the browser) | Adopted (my call) | Trimming the breadcrumb to cap height (`text-box`): the breadcrumb scrolls sideways, so letters taller than caps (l, Å) would be clipped |

Verified (button bottom ≤ screen height, no scrolling, one-line title in one column): 320×568, 375×667, 450×700, 642×653, 390×844, 768×1024, 812×375, 900×620, 1024×560, 1024×620, 1024×768, 1280×500, 1280×560, 1280×600, 1280×700, 1366×600, 1440×760, 1440×900, 1920×1080.

## 2026-11-06 · English docs and lean comments

| # | Question | Decision | Status | Reason / alternatives |
|---|---|---|---|---|
| 1 | Language of comments and docs | All English, like the UI; `CLAUDE.md` updated | Adopted (my call) | |
| 2 | How many comments | Only where needed and short: why (background, pitfalls, trade-offs), not what the code says; test names describe behavior, so most comments above tests were removed | Adopted (my call) | |

## 2026-11-09 · Security fixes before deploying

| # | Question | Decision | Status | Reason / alternatives |
|---|---|---|---|---|
| 1 | One uncached recommendation makes up to ~46 external calls, so many IPs together could get the Last.fm key or our server IP banned | Site-wide per-minute budgets for external calls (iTunes 20, Last.fm 200) in `rate_limits`; a 5-minute circuit breaker when iTunes answers 403/429; the per-IP recommendations limit drops from 20 to 10 | Adopted | Over budget, the wrapper throws the client's own error, so the existing handling applies with no new paths. Cost: with a cold cache the first visitors in a busy minute may see "Preview failed to load" more often |
| 2 | IPv6 address rotation bypasses the per-IP limit | Key IPv6 by its /64, IPv4 as is | Adopted | |
| 3 | `x-forwarded-for` is client-controlled outside Vercel | Trust it only when `VERCEL=1` | Adopted | Locally, SSR's internal requests share the "unknown" bucket; dev only |
| 4 | Frontend attacks (XSS, CSRF, clickjacking) | Media URLs must be https; production-only security headers: CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS | Adopted (I asked to check common frontend attacks) | CSRF doesn't apply yet (read-only GETs, no cookies). `script-src 'unsafe-inline'` stays until nonces are worth a module |

Verified with a production build: all headers present on pages and APIs; 10 records, 10 covers, fonts and a 30s preview load with no CSP errors; home → Recommend works. Neither the Last.fm key nor the salt is in the client bundle. Three requests with spoofed `x-forwarded-for` locally land in one bucket.
