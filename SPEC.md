# Music Recs spec

Anyone can enter a few artists they like and get song recommendations with previews and reasons, and a blind test measures whether the recommendations really beat random picks.

Decisions already made are in `docs/ai-log.md`. When the spec and a decision disagree, the decision wins.

## Goals

**What the portfolio should show**: interaction design in a Vue 3 frontend, a recommendation algorithm, cost control for a public service, and a measurable eval.

**Out of scope**: accounts, social features, playlist sharing, exporting to Spotify (Spotify's API development mode allows only 5 users), and a mobile app. Uploading a Spotify export comes after the MVP.

## Stack

| Layer | Choice |
|---|---|
| Framework | Nuxt 4 (Vue 3 + strict TypeScript); pages in `app/pages/`, API in `server/api/` |
| State | Pinia |
| Data fetching | Nuxt's built-in `useFetch` / `useAsyncData` |
| Styling | Tailwind CSS |
| Utilities | VueUse |
| Database | Postgres 17 + Drizzle ORM; Docker locally, Neon in production |
| Validation | zod for API input, external API responses and LLM output |
| LLM | Claude Haiku 5.5 with structured output, only for writing reasons |
| External data | Last.fm API (search, similar artists, tags, top tracks) and iTunes Search API (previews, covers); neither needs user sign-in |
| Tests | Vitest + `@nuxt/test-utils`; Playwright for the main flows |
| Deployment | Vercel + Neon |
| CI | GitHub Actions: typecheck, lint, tests, E2E; a daily smoke test against the live site |

## User flow

1. Open the home page (`/`), enter 1–3 artists you like (with autocomplete) and press Recommend.
2. The recommendations page (`/recommendations?seed=…`, one screen, no scrolling) shows 10 records: cover, title, a 30-second preview and a one-line reason.
3. "Explore from here" on a record digs one level deeper (the URL gains `&explore=…`), up to 3 levels. The breadcrumb `Home › seeds › Pond` goes back to any level, the browser's Back button works too, and Home returns with the seeds for editing.
4. A mainstream ↔ obscure slider changes the recommendations. (Deferred.)
5. The Taste Check (`/taste-check`, linked from the recommendations page as "Fit your taste? →"): a blind test. Listen to 3 songs, rate each 1–5, then see which ones were picked for you.

## Features

**[Required]** is a must for the MVP; **[Deferrable]** gets cut first if time runs out.

### 1. Seed artists [Required]

- Autocomplete uses Last.fm `artist.search`, debounced on the client and cached on the server.
- Chosen artists live in Pinia, synced to localStorage.

### 2. Recommendations [Required]

The algorithm lives in `server/utils/recommend/` as pure functions:

1. Get Last.fm's similar artists (with a `match` score) for each seed.
2. Merge candidates: similar to more seeds and more similar scores higher.
3. Exclude the seeds themselves (and, when exploring, artists shown on earlier levels).
4. Popularity: weight by the log of listener counts. [Deferrable]
5. Take one track per artist and get its preview and cover from iTunes (trying the Taiwan, US and Japan stores in order). Without a preview, show "No preview" and no play button.

Every result is tagged with an `algo_version`.

### 3. Recommendation reasons [Deferrable: falls back to "Similar to A and B"]

- One LLM call writes the reasons for all 10 cards.
- Cached by seed set + recommended artist.
- A daily site-wide call limit; past it, fall back to rule-based reasons.

### 4. Explore from here [Required]

(Replaces the original feedback feature, where liking or disliking re-sorted the list: users couldn't follow the scoring behind it. See `docs/ai-log.md`.)

- Every record has "Explore from here →": that artist becomes the only seed for the next level.
- The next level excludes the original seeds and every record shown on earlier levels, so each level shows new artists.
- Up to 3 levels; at the deepest level Explore is hidden. The breadcrumb goes back to any level without refetching, on the record that was being viewed.
- When there are no new artists, stay on the current level and say so.

### 5. Taste Check (blind test) [Required]

- Each round has 3 songs: 1–2 from the recommendations, the rest a control group.
- Control group: random popular songs from the seeds' most common genre tags (same genre, so it's fair).
- Rate 1–5, then reveal which were recommended.
- Every rating is stored with the algorithm version.

### 6. Link previews

- Every page has Open Graph and Twitter card tags with absolute URLs and a 1200×630 image (`public/og-image.png`, source in `scripts/og-image.html`), so shared links show a title, description and picture.
- The recommendations page names the seeds ("Records like Tame Impala + Kokoroko"); the Taste Check asks "Do these picks fit your taste?".

## Anonymous identity and privacy

- A random ID is generated on the first visit and stored in a cookie.
- No email, name or any other personal data.
- Export upload (after the MVP): parsed in the browser; only aggregates go to the server.

## Cost and abuse

- External data is cached in Postgres for 30 days.
- Rate limits are stored in Postgres (Vercel is serverless, so in-memory counts are unreliable): per client per minute (10 for recommendations, 60 for autocomplete), storing only a salted hash of the IP. IPv6 clients count per /64, and `x-forwarded-for` is trusted only on Vercel. Over the limit returns 429 with `Retry-After`.
- Site-wide budgets per minute for external APIs (iTunes 20, Last.fm 200), and a 5-minute circuit breaker when iTunes answers 403/429. Over budget, a card's preview becomes a retryable error and a Last.fm failure becomes a 502.
- LLM: caching, a daily site-wide limit, and a monthly spend limit in the Anthropic console.
- External API responses keep only the fields we need and are validated with zod; preview and cover URLs must be https.

## Security

- Production responses carry a Content Security Policy, `frame-ancestors 'none'` and `X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`, a referrer policy, a permissions policy and HSTS.
- No HTML from data is rendered; Vue escapes all text.
- The blind test's POSTs use a `SameSite=Lax`, `httpOnly` visitor cookie and refuse requests whose `Origin` isn't this site (CSRF).
- API keys and the salt are server-only; the production client bundle is checked for them.

## Data model

| Table | Contents | Status |
|---|---|---|
| `artists` | Last.fm artists: name, MusicBrainz ID, listeners, tags, fetch time | Built |
| `artist_similar` | Similarity between artists | Built |
| `tracks` | Each artist's track, iTunes ID, preview URL, cover | Built |
| `visitors` | Anonymous ID, creation time | Built |
| `rate_limits` | Per-client rate-limit counts, external API budgets and the iTunes breaker | Built |
| `reason_cache` | Cached recommendation reasons (seed set + artist + prompt version) | Built |
| `blind_tests`, `blind_test_items` | Each round (visitor, seeds, algorithm version, control genre) and its three songs (which were recommended, ratings) | Built |

## API (draft)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/artists/search?q=` | Autocomplete |
| GET | `/api/recommendations?seed=&exclude=` | Seeds (plus artists to exclude when exploring) → recommendations, with previews only if already cached (others `pending`) |
| GET | `/api/previews?artist=` | One card's track and preview, for cards left `pending` |
| GET | `/api/reasons?seed=&exclude=` | LLM-written reasons for the same list (rebuilt on the server), `null` where there's none |
| POST | `/api/blind-tests` | Start a round |
| POST | `/api/blind-tests/:id/ratings` | Submit ratings → reveal |
| GET | `/api/stats` | Eval numbers |

## Eval

- **Main metric**: in the blind test, the average rating of recommended songs minus the control group's, with a confidence interval.
- Each visitor counts once (their own average), so a few heavy players don't skew the result.
- Secondary: comparisons across popularity settings and algorithm versions.
- Data from: me, friends, and interviewers trying it out.

## Schedule (one week from 2026-11-03)

| Day | Work |
|---|---|
| 1 | Nuxt skeleton, Docker Postgres, Drizzle schema, test setup, CI |
| 2 | Last.fm / iTunes clients (zod), caching; recommendation algorithm (pure functions, TDD) |
| 3 | `/api/recommendations`, home page: seed input, recommendation cards, previews |
| 4 | Explore from here, popularity slider |
| 5 | Rate limiting, deploy to Vercel + Neon; LLM reasons |
| 6 | Blind test, `/api/stats` |
| 7 | Buffer, README, play-testing |

The schedule is tight. If it slips, cut in this order: popularity slider → LLM reasons (use rule-based reasons) → Playwright.

**Status (2026-11-10)**: deployed with the Taste Check, `/api/stats` and link previews. The eval reached 30 visitors (recommended +1.09 over random, 95% CI +0.42 to +1.75) and its table is in the README. Playwright covers the main flow in CI. LLM reasons are built; the popularity slider is deferred.

## Acceptance criteria

- [x] Without an account, get recommendations and hear a preview within 30 seconds (6.5 s on 2026-11-10). Superseded by per-phase budgets from Core Web Vitals and Nielsen, checked daily by the smoke test. Uncached recommendations went from 4–5 s to about 2 s by showing the list before previews
- [x] Repeating a query with the same seeds calls no external API or LLM
- [x] Over the rate limit returns 429 and the page says so
- [x] A live demo works ([musicrecs.ellenchen.dev](https://musicrecs.ellenchen.dev/))
- [x] The blind test has ratings, and the README has a recommended-vs-control results table (growing past 30 visitors after the MVP)
- [x] CI passes; the README has an architecture diagram, demo link and eval results

## Risks

| Risk | Fallback |
|---|---|
| Too little Last.fm similarity data for obscure artists | Find candidates by tag instead |
| No preview in the iTunes Taiwan store (stores localize artist names) | Try the US and Japan stores in order; otherwise show "No preview" |
| Too few blind-test players | State the sample size clearly; start with friends |
| Last.fm terms of use | Non-commercial use, with attribution |
| iTunes rate limit (about 20 per minute) | Cache results for 30 days, including "checked, nothing found"; a site-wide budget and a circuit breaker |
| iTunes may throttle datacenter IPs (Vercel) | Check right after deploying; previews degrade to a retryable error instead of failing the page |
