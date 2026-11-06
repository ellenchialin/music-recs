# Concept notes (for a frontend engineer)

Each concept starts with a frontend analogy, then points to where it lives in this project and how to see it for yourself. Things learned on the previous project (tables, migrations, transactions, advisory locks…) are in job-alert-triage's `docs/concepts.md`; this file covers only what's new.

## 1. Nuxt: frontend and backend in one project

> **Frontend analogy**: like Next.js's App Router + Route Handlers, but with Vue. `app/` is Vue code that runs in the browser (and during SSR); `server/` is the API, running on Node.

| Folder | Runs on | Contains |
|---|---|---|
| `app/pages/` | Browser + SSR | Pages; the file name is the route (`index.vue` → `/`) |
| `app/components/`, `app/composables/` | Browser + SSR | Components and `useXxx()`, auto-imported |
| `server/api/` | Node (Nitro) | API routes; the file name is the path (`server/api/artists/search.get.ts` → `GET /api/artists/search`) |
| `server/utils/` | Node | Shared server functions, auto-imported inside `server/`; the recommendation algorithm lives here |

**The boundary**: `app/` must not import from `server/`, or things like the database connection string would end up in the browser bundle. Types both sides need go in `shared/`.

**See it**: run `pnpm dev`, open http://localhost:3000 for the page, and open http://localhost:3000/api/... directly to see an API's JSON.

## 2. Two test environments

> **Frontend analogy**: like Jest's `testEnvironment: "node"` vs `"jsdom"`.

`vitest.config.ts` has separate projects:

- **`unit`**: `*.test.ts` in `server/` and `shared/`. Pure functions, no browser and no Nuxt; each test takes milliseconds.
- **`nuxt`**: `*.test.ts` in `app/`. Starts the Nuxt runtime (auto-imports, Pinia, router) with happy-dom for the DOM; mount components with `mountSuspended()`.

**Why split them**: the recommendation algorithm is the core of the project and has the most tests, so they run in the fastest environment.

**See it**: every line of `pnpm test` output starts with `|unit|`, `|db|` or `|nuxt|`.

## 3. This project's schema choices

Tables, migrations and unique constraints came up on the last project; this section records only the new trade-offs. The file is `server/db/schema.ts`, tested in `server/db/schema.db.test.ts`.

| Choice | Why | Alternative |
|---|---|---|
| `visitors.id` is a server-generated `uuid` | The ID goes in a cookie. Sequential IDs (1, 2, 3…) let you guess other people's; a random uuid doesn't | A `serial` ID plus a random token column: one more column, no benefit |
| `artists` is unique on `name_norm`, not `mbid` | Many lesser-known artists have no MusicBrainz ID on Last.fm, and Last.fm itself looks artists up by name | `mbid`: those artists couldn't be stored |
| `tags` is a `text[]` array column | Tags are only ever read as a whole, never updated one at a time | A separate `artist_tags` table: only worth it to look artists up by tag |
| `listeners >= 0` is a check constraint | The rule lives in the database, so no buggy code path can break it | Only checking in zod: another write path might skip it |
| `fetched_at` has a default | The 30-day cache expiry compares it to the current time | — |

> **Frontend analogy**: `name_norm` is like running `trim().toLowerCase()` on a search input before comparing. Display the original `name`; compare with the normalized `name_norm`.

**See it**: open the `artists` table in `pnpm db:studio`, or run `pnpm db:sandbox` and type `\d artists` to see the unique and check constraints.

## 4. External API clients: zod validation and a swappable fetch

The code is in `server/lastfm/`: `schemas.ts` (zod), `client.ts` (API calls) and `fixtures/` (recorded real responses).

### zod validates and translates

> **Frontend analogy**: after fetching from a backend you often write a `toViewModel()` to reshape the data for the UI. Here validation and reshaping live in the same schema.

Last.fm's raw responses are awkward: numbers are strings (`"8500398"`), a missing MBID is `""`, a one-item array becomes a single object, and every item carries image URLs we don't use. `schemas.ts` handles all of it, so the algorithm only sees clean `{ name, mbid: string | null, listeners: number }`.

If the format changes (say Last.fm renames a field), it throws right here instead of letting `undefined` flow into the algorithm and end up as `NaN` on screen.

### Why fetch is passed in

> **Frontend analogy**: in component tests you use MSW or mock `fetch` so the test never hits a real backend.

`createLastfmClient({ apiKey, fetch })` uses the global `fetch` by default; tests pass a fake that returns fixture content. That means:

- Tests need no network and no API key, so CI can run them.
- Tests can check that the right URL was requested (the first test in `client.test.ts`).
- Tests can simulate cases that are hard to trigger for real, like a 503 or an HTML response.

This is **dependency injection**: the caller provides what a function needs instead of the function fetching it itself.

### Fixtures are recorded, not hand-written

`pnpm record:lastfm` calls the real API and saves the response, HTTP status included, as JSON. Hand-written fake data tends to look the way you assume it does; recorded data has real quirks like `"listeners": "8500398"`. The one hand-made case (a single item becoming an object) is marked in its test.

**See it**: open `server/lastfm/fixtures/similar-not-found.json`. When an artist isn't found, Last.fm returns **HTTP 200** with the error in the body, which is why `client.ts` checks the body's `error` field and not just `res.ok`.

### A second client: same shape, different quirks

`server/itunes/` is built like `server/lastfm/` (schema + injected fetch + recorded fixtures). The differences all come from real behavior seen while recording:

| | Last.fm | iTunes |
|---|---|---|
| Errors | HTTP 200 + an `error` field; check the body | HTTP 4xx + `errorMessage`; `res.ok` is enough |
| Numbers, arrays | Numbers are strings and single items become objects; fixed in the schema | Already numbers and arrays |
| Unwanted data | — | Results can include other `kind`s such as music videos: **filter, then validate**, so one unrelated item can't fail the whole response |
| API key | Required | Not needed |

> **Frontend analogy**: one `fetch` wrapper pattern, two backends. What's shared is the habit (validate every response and convert it to your own types), not one do-everything function. Each client is about 40 lines; a shared layer would have to branch on two error formats.

**The store changes the data**: the `country` parameter picks a store. In the Taiwan store, 宇多田ヒカル is `Hikaru Utada`, and Radiohead's original "Creep" isn't there; the first result is the acoustic version. So picking the right song out of the results is a separate pure function, not just taking the first one.

## 5. Tiered picking: the best option first, then fall back

> **Frontend analogy**: `srcset`, or "use the 2x image if there is one, else 1x, else the default". A list of options from best to worst; take the first that exists.

External data often has no perfect answer: the iTunes Taiwan store has no original "Creep" by Radiohead, only an acoustic version. Some ways to handle that:

| Approach | Problem |
|---|---|
| Take the first result | For another song it might be a different artist's song with the same title |
| Accept only exact matches | Too strict; many songs would have no preview |
| Score every result and sort | Weights need tuning, the rules hide in numbers, and it's hard to test or explain |
| **Tiered picking** (`filter` the eligible ones, then `find(best) ?? find(next) ?? null`) | One rule per tier, one test per tier; adding a tier is one more `??` |

This project uses tiered picking. With few rules (three tiers) it's the easiest to read; scoring only pays off if there are five or six tiers that need to be weighed against each other.

Another principle: **return `null` rather than guess**. If no preview is found, the card shows no play button. If the wrong one is picked, the user hears someone else's song and thinks the recommendation is broken.

## 6. Caching: check the database, call the API only when needed

> **Frontend analogy**: TanStack Query's or SWR's `staleTime`. Fresh data is used as is; stale data is refetched. The difference is that this cache lives in Postgres, shared by every visitor and surviving server restarts.

`server/cache/lastfm.ts` follows **cache-aside**:

1. Look up the normalized name in `artists`.
2. Found and `isFresh(fetched_at, now)` (within 30 days) → return it, **no API call**.
3. Missing or stale → call Last.fm → write it back → return it.

What was learned on the last project all shows up here:

- **Upsert (`onConflictDoUpdate`)**: two visitors look up the same new artist at once; neither finds it, both call the API, both write. With an upsert, the second write becomes an update instead of a unique-constraint error.
- **Transaction**: refreshing a stale similar list means "delete the old rows, write the new ones, update `similar_fetched_at`". Think of restocking a shelf. Without a transaction, the clerk clears the old stock while the new stock is still on the cart: a customer walking in now (a concurrent request) sees an empty shelf and gets empty recommendations, and if the clerk is called away halfway (the write fails), the shelf stays empty until the next refetch. With a transaction, it's like restocking behind a curtain: everyone sees either the old shelf or the new one, and a failure halfway rolls everything back, leaving the old list in place.
- **`now` is passed in**: dependency injection again. Tests can pass "31 days later" without mocking the system clock.

**See it**: open `artists` and `artist_similar` in `pnpm db:studio`. The first lookup of an artist makes 2 API calls (about 700ms); the second makes none (about 3ms).

### Cache "nothing", never "broken"

> **Frontend analogy**: search for "zzqx" and the backend returns an empty array; SWR caches the empty array and doesn't refetch. A 500 error isn't stored as data, so the next request retries.

`server/cache/tracks.ts` handles the two cases differently:

| Case | Handling | Why |
|---|---|---|
| iTunes answers normally but no song matches | Store a row with a `null` preview (**negative caching**) | Otherwise every recommendation of this artist asks iTunes again and quickly hits its limit of about 20 a minute |
| iTunes fails (403, outage) | Store nothing and rethrow | Storing it would leave the artist without a preview for 30 days after iTunes recovers |

The tests `remembers that iTunes had nothing` and `does not cache anything when iTunes fails` check one case each.

## 7. The algorithm is a pipeline of pure functions

> **Frontend analogy**: a Redux selector (or a Vue computed). State in, the data the view needs out, no API calls, no mutations. The same input always gives the same output, so a test just prepares input and compares output.

Every step in `server/utils/recommend/` works like that:

```
each seed's similar list ──mergeCandidates──▶ merge, sum scores, sort
                         ──excludeArtists───▶ drop the seeds and artists already shown
                         ──take the top 10──▶ recommendations (tagged with algo_version)
```

Where the data comes from (cache, Last.fm) is `/api/recommendations`' job; the algorithm only takes the plain objects in `types.ts`. That means:

- Tests need no database or fixtures; a few hand-written items test one rule.
- Changing the data source (say, finding candidates by tag) doesn't change the algorithm.
- When the blind test compares algorithm versions, the same input always gives the same output (which is why equal scores sort by name instead of relying on `Map` or database order).

**Grouping with a Map** (exercise 3): when an artist appears in several seeds' lists, use `nameNorm` as the key to find the existing entry and add to its score instead of adding a new entry.

## 8. API routes: one job per layer

> **Frontend analogy**: components don't call `fetch` directly; they call a hook or service, which uses the API client. Components handle the view; services handle the data flow. Same layering, on the server.

`GET /api/recommendations?seed=Tame%20Impala&seed=Kokoroko` passes through four layers:

| Layer | File | Its one job |
|---|---|---|
| Route | `server/api/recommendations.get.ts` | Rate-limit, validate the query (zod), call the service, map errors to status codes (404, 502) |
| Service | `server/services/recommendations.ts` | Wire it together: seeds → cache → algorithm → a preview for each card; decide which errors to rethrow and which to handle |
| Cache | `server/cache/` | Check Postgres; call Last.fm or iTunes only when needed |
| Algorithm | `server/utils/recommend/` | Pure functions that don't know where the data comes from |

Tests follow the layers: the algorithm with hand-written data (unit), the cache and service with fake clients and a test database (db), and the route, now only a few lines, checked by hand with `curl`.

**Which layer catches an error?** It depends on how much it affects:

- One artist's preview fails (iTunes 403) → the service catches it for **that card** and returns `preview: { status: "error" }`; the other 9 are fine.
- A seed isn't found → no recommendations are possible, so it throws `SeedNotFoundError`, which the route turns into a 404 with suggested names.
- Last.fm is down → the route returns 502 without passing Last.fm's own error message to the client.

**How many API calls at once?** `mapLimit(items, 3, fn)` is like `Promise.all(items.map(fn))` with at most 3 in flight. All at once is faster but hits rate limits; one at a time never hits them but makes 10 artists slow.

## 9. Merging rankings: use ranks, not raw scores (v2)

> **Frontend analogy**: three review sites, one that usually gives 9+ and one that averages 6. Add the raw scores and the generous site decides the ranking. It's fairer to look at where each item ranks on each site.

v1 summed Last.fm's `match`. Kokoroko's top 10 similar artists were all above 0.8 while Tame Impala's dropped off faster, so Kokoroko took 5 of the 10 spots and Tame Impala only 1.

v2 uses **Reciprocal Rank Fusion** (a common way search engines merge result lists): rank `rank` in a seed's list scores `1 / (RANK_K + rank)`.

- Every seed's #1 scores the same, as does every #2, and so on, so the top 10 alternates between seeds.
- An artist recommended by several seeds sums their scores and still ranks high, as the spec requires.
- `RANK_K` balances the two: the larger it is, the smaller the gaps between ranks and the bigger the advantage of being recommended by several seeds. This project uses 5.

**The cost**: ranks throw away how large `match` was. If a seed's whole list is weak (its #1 is only 0.2), its #1 still counts as much as another seed's #1.

## 10. The home page: SSR, localStorage and autocomplete

### The SSR localStorage trap (`skipHydrate`)

> **Frontend analogy**: in Next.js, reading `localStorage` during render throws or causes a hydration mismatch, so you read it in `useEffect`. Nuxt is the same, with an extra Pinia pitfall.

Nuxt renders the page to HTML on the server first, then the browser takes over (hydration). The server has no `localStorage`, so the seed list is empty there. Pinia sends that **empty state** with the HTML, the browser applies it on hydration, overwriting the seeds read from localStorage, and then writes the empty array back to localStorage. The result: the seeds vanish on reload.

`app/stores/seeds.ts` has two fixes:

- `skipHydrate(seeds)`: tells Pinia not to use the server's value for this field.
- `useLocalStorage(..., { initOnMounted: true })`: reads localStorage only after mount, so the server and the browser's first render produce the same HTML (no hydration mismatch).

The test `keeps the browser's seeds when the server sent an empty state` reproduces the bug by simulating the server sending an empty state.

### Two autocomplete details

- **Debounce**: `refDebounced(query, 400)` waits until typing pauses for 400ms instead of calling the API on every key. 250ms was too short: normal typing often pauses that long between keys.
- **Late responses**: typing "ta", "tam", "tame" sends three requests that can come back in any order. Each request gets a number and only the latest one's result is used (`latestRequest`).

### One player for the whole page

`createSharedComposable` (VueUse): every card that calls `usePreviewPlayer()` gets the same state, like a tiny global store. Playing B stops A because there's only one `<audio>`.

## 11. Explore from here: the path is pure-function state

> **Frontend analogy**: the browser's Back/Forward, or React Router's history stack. Each level deeper pushes an entry; going back along the path drops everything after it.

`app/utils/explore-trail.ts` keeps the path as an array, with three things per level: the artist it came from (`null` for the first level), the recommendations, and which record is being viewed.

- `exploreFrom` and `backTo` return new arrays and never mutate the old one, so earlier levels stay untouched and going back needs no refetch.
- `excludedFor` builds the next level's exclusion list: the original seeds plus every record shown on every level, sent as the API's `exclude`.
- The record being viewed is bound to the crate with `v-model:index`: when the crate changes it, that level of the path changes too, and returning to a level opens the crate on that record.

The algorithm doesn't change: exploring is just another recommendation run with one seed and an exclusion list.

## 12. The URL is the single source of truth

> **Frontend analogy**: React Router's `useSearchParams`, or a product list with its filters in the URL. The view is computed from the URL, not from how many times a button was clicked.

`/recommendations?seed=Tame+Impala&seed=Kokoroko&explore=Pond`

- **Parsing**: `app/utils/recommendations-route.ts` turns the query into `{ seeds, explore }`. URLs can be hand-edited: extra, empty and duplicate values are dropped, keeping at most 3 seeds and 3 levels.
- **Fetching from the URL**: `useAsyncData` watches the URL and fetches level by level. With SSR the page arrives with results; coming from home (`lazy`), it shows the turntable first.
- **Never fetch twice**: each level's result is kept in `useState`, keyed by seeds + path. Server-fetched results travel to the browser with the page; exploring, going back and the Back button all check here first.
- **Exploring = changing the URL**: fetch the next level first and only `router.push` if it has new artists; when the URL changes, `useAsyncData` reruns and reads from the cache.

**The SSR pitfall**: using browser-only things in `setup` (`Audio`, `window`, `localStorage`) breaks server rendering. Create them only when needed (the preview player) or do it in `onMounted` (the seeds' localStorage).

## 13. Rate limiting: fixed windows and atomic counts in the database

> **Frontend analogy**: a button throttle, but on the server and counted separately for each person. Over the limit returns `429 Too Many Requests`, with `Retry-After` saying how many seconds to wait.

- **Fixed window**: time is cut into one-minute windows, each counted separately (`windowStart` in `server/utils/rate-limit.ts`). The downside is that around a boundary up to twice the limit can get through in a short time (20 at second 59, then 20 at second 0). Sliding windows or token buckets are smoother but store more state; fixed windows are enough here.
- **Counts in Postgres**: Vercel is serverless, so each request may run on a different instance and in-memory counts aren't shared.
- **Atomic increments**: `INSERT … ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`. The database does the increment in one step, so two concurrent requests can't both read 5 and write 6. Test: 25 requests at once with a limit of 20 lets exactly 20 through.
- **No raw IPs**: store the SHA-256 of salt + IP. The salt is a server secret (`RATE_LIMIT_SALT`), so the hash can't be reversed by hashing every possible IP.
- **Cleanup**: each write has a 1% chance to delete windows older than an hour; no scheduled job needed.

**Two pitfalls**:

1. **Caching the whole route** (`defineCachedEventHandler`) skips the limit on cache hits and replays the first caller's response headers to others. Cache only the Last.fm call (`defineCachedFunction`) and rate-limit outside it.
2. **SSR can't see the client IP**: when a page calls its own API during server rendering, the request doesn't go over the network, so the API sees no IP and every visitor's SSR shares one "unknown" bucket. `useApiFetch` forwards the client IP in `x-forwarded-for` during SSR (Vercel overwrites that header, so clients can't spoof it).
