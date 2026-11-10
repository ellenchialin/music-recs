# Music Recs

**Live demo: [musicrecs.ellenchen.dev](https://musicrecs.ellenchen.dev/)**

Pick up to three artists you love and get ten records to flip through, each with a 30-second preview. From any record you can **explore** one level deeper, up to three levels, and every level shows artists you haven't seen yet. No account and no sign-in.

> **Status**: a one-week portfolio project (November 2026). Recommendations, previews, Explore and the Taste Check are live. With 30 visitors, recommended songs beat random picks by about a point ([results](#results-algorithm-v2-2026-11-10)). Try it and [see whether the picks fit your taste](https://musicrecs.ellenchen.dev/).

## Features

- **Seed artists**: type-ahead search backed by Last.fm, with misspelled lookalikes filtered out (for example "radıohead" with a dotless ı). Choose 1–3 artists; they're remembered in the browser.
- **A crate of records**: ten recommendations shown like flipping through a record crate. Swipe, drag, click the side covers or use the arrow keys. Each record shows the artist, a representative track, which of your artists it's similar to, and a round play button for the preview.
- **Explore from here**: dig from any record into artists similar to it, up to three levels deep. Each level excludes everything shown before, so you always get new names. A breadcrumb (`Home › Tame Impala + Kokoroko › Pond`) goes back to any level instantly, without refetching.
- **Shareable URLs**: the URL is the single source of truth (`/recommendations?seed=…&explore=…`), so reload, Back and shared links all show the same screen, rendered on the server, with a link preview (Open Graph) for chat apps and social sites.
- **Graceful gaps**: no preview in any store shows "No preview" with an Apple Music link; a temporary iTunes error affects only that record and offers a retry; an unknown artist suggests similar names.
- **Taste Check** ("Fit your taste?" on the recommendations page): a blind test. Listen to three unnamed songs, rate each 1–5, then see which were picked for you and which were random picks from the same genre. Results feed the eval below.
- **One screen, every size**: both pages fit exactly one viewport from a 320px phone to a 1920px desktop, with motion that respects the system's reduced-motion setting.

## How it works

```mermaid
flowchart LR
  UI["Nuxt pages<br/>(Vue 3, Pinia)"] -->|GET /api/recommendations| Route
  Route["API route<br/>rate limit + zod"] --> Service["Service<br/>seeds → candidates → previews"]
  Service --> Algo["recommend()<br/>pure functions"]
  Service --> Cache["Postgres cache<br/>30-day TTL"]
  Cache -->|miss| Lastfm["Last.fm<br/>similar artists, top tracks"]
  Cache -->|miss| Itunes["iTunes Search<br/>previews, covers"]
```

1. **Similar artists**: for each seed, take Last.fm's similar-artists list (cached in Postgres for 30 days).
2. **Merge by rank**: combine the lists with Reciprocal Rank Fusion, a common way search engines merge ranked lists. Rank *r* in a seed's list scores `1 / (5 + r)`, summed across seeds. Using ranks instead of raw similarity scores keeps one seed from taking most of the spots, while artists similar to several seeds still rank highest.
3. **Exclude**: drop the seeds themselves (matched by normalized name or MusicBrainz ID), plus everything already shown when exploring.
4. **Previews**: for each of the top 10, take Last.fm's top track and find it on iTunes, trying the Taiwan, US and Japan stores in turn (stores localize artist names, e.g. BoA is 寶兒 in Taiwan). A small tiered matcher prefers the original title, then a version of it, and never a different artist's song.

Every result is tagged with an algorithm version so blind-test ratings can compare versions.

## Measuring it: the Taste Check

Recommendations are easy to show and hard to prove, so the site measures itself.

1. **A fair opponent**: each round mixes one or two recommended songs with popular songs from the seeds' most common Last.fm genre tag, so recommendations can't win just by being the right style.
2. **Blind**: names and covers stay hidden until you've rated all three; which songs were recommended never leaves the server before that.
3. **One visitor, one vote**: each visitor's own difference (recommended average − random average) is computed first and then averaged across visitors, so one person playing twenty rounds counts once.
4. **Honest uncertainty**: a 95% confidence interval (Student's t) decides what the page says. Until it excludes zero, it says there's no clear difference yet.

Live numbers: [`/api/stats`](https://musicrecs.ellenchen.dev/api/stats). Known limit: clearing cookies makes a new visitor, so the count is an upper bound on real people.

### Results (algorithm v2, 2026-11-10)

| Visitors | Ratings | Picked for you | Random pick | Difference | 95% CI |
|---:|---:|---:|---:|---:|---:|
| 30 | 96 | 3.97 / 5 | 2.88 / 5 | **+1.09** | +0.42 to +1.75 |

Recommended songs scored about one point higher on a five-point scale, and the whole confidence interval is above zero, so the gap isn't noise. Caveats: most players found the site through me, so they aren't a random sample, and nothing checks that a song was actually heard before it was rated.

## Stack and why

| Area | Choice | Why |
|---|---|---|
| Framework | **Nuxt 4** (Vue 3, strict TypeScript) | Pages and API in one project, with server rendering. A separate SPA + API would be closer to many company setups, but too much for a one-week MVP |
| State | **Pinia**, **VueUse** | Seeds in a small store synced to localStorage (with an SSR-safe hydration fix) |
| Styling | **Tailwind CSS v4** | Design tokens in one `@theme` block; custom `short` / `tall` / `wide` variants keep responsive rules from competing, with no `!important` |
| Motion | **Motion for Vue** (`motion-v`) | Springs, layout animations and enter/exit transitions that CSS transitions can't do, plus a View Transition that morphs the turntable between pages |
| Database | **Postgres 17** + **Drizzle ORM** | Caches Last.fm and iTunes data and stores rate-limit counters. Docker locally, Neon in production |
| Validation | **zod** | Every external API response and every request is validated and reshaped at the boundary, so bad data never reaches the algorithm |
| Data | **Last.fm API**, **iTunes Search API** | No user sign-in needed. Spotify was ruled out: its development mode now allows only a few users. Deezer was ruled out: it isn't available in Taiwan |
| Tests | **Vitest** + `@nuxt/test-utils`, **Playwright** | Three Vitest projects: pure functions in Node, database tests against a real Postgres, components in happy-dom. Playwright drives the production build in Chromium for the main flow, with the cache seeded from recorded fixtures so no outside API is called |
| Hosting | **Vercel** + **Neon** | Serverless deploys with a managed Postgres |

## Engineering notes

- **Test-driven**: 264 tests. The algorithm and rate limiting are pure functions with unit tests; caching and services run against a real test database; pages and components are tested in a simulated browser. External APIs are never called in tests: recorded fixtures stand in for them.
- **Caching that won't lie**: "iTunes has no preview" is cached (so we don't ask again for 30 days); "iTunes is down" is not (so the preview comes back when it recovers).
- **Rate limiting**: fixed one-minute windows counted atomically in Postgres, because serverless instances don't share memory. IPv6 clients are grouped by /64, `x-forwarded-for` is trusted only behind Vercel's proxy, and only a salted hash of the IP is stored.
- **Protecting upstream APIs**: one uncached recommendation can make dozens of Last.fm and iTunes calls, so there's also a site-wide per-minute budget for each API and a circuit breaker that backs off iTunes for five minutes when it starts throttling.
- **Security**: in production, a Content Security Policy, `frame-ancestors 'none'` against clickjacking, `nosniff`, a referrer policy and HSTS. Media URLs from iTunes must be https. The Taste Check's POSTs refuse other origins (CSRF), a round can be rated once, and another visitor's round answers 404.
- **Privacy**: no accounts and no personal data. Your chosen artists are stored only in your browser. The Taste Check uses an anonymous random ID in an `httpOnly` cookie; the server keeps salted IP hashes for rate limiting and deletes them after about an hour.

The reasoning behind each decision, including the ones that were tried and reverted, is in [`docs/ai-log.md`](docs/ai-log.md). Concepts are explained for a frontend engineer in [`docs/concepts.md`](docs/concepts.md). The full spec is [`SPEC.md`](SPEC.md).

## Running it locally

Requirements: Node 24, pnpm, Docker, and a free [Last.fm API key](https://www.last.fm/api/account/create).

```bash
cp .env.example .env
```

Fill in `LASTFM_API_KEY`, and generate a salt for `RATE_LIMIT_SALT`:

```bash
openssl rand -hex 32
```

Then:

```bash
pnpm install
```

```bash
pnpm db:up
```

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

Open http://localhost:3000.

| Command | Purpose |
|---|---|
| `pnpm test` | All Vitest tests (needs `pnpm db:up` for the database tests) |
| `pnpm test:e2e` | Build, then run the Playwright tests (needs `pnpm db:up`; once: `pnpm exec playwright install chromium`) |
| `pnpm test:smoke` | Times each step on the live site (desktop and a throttled phone) against budgets from Core Web Vitals and Nielsen's response-time limits. Also runs daily in GitHub Actions |
| `pnpm typecheck` / `pnpm lint` | Type check and lint |
| `pnpm db:studio` | Browse the cached data in Drizzle Studio |
| `pnpm record:lastfm` / `pnpm record:itunes` | Re-record API fixtures from the real APIs |

## Project structure

```
app/                 Vue pages, components, composables and stores
  pages/             index (pick artists), recommendations (the crate), taste-check (the blind test)
  components/        RecordCrate, SeedInput, SunTurntable, VinylRecord
server/
  api/               HTTP routes: validation, rate limiting, error mapping
  services/          Wiring: recommendations, rate limits, external API budgets
  cache/             Cache-aside over Postgres for Last.fm and iTunes data
  utils/recommend/   The recommendation algorithm (pure functions)
  lastfm/, itunes/   API clients with zod schemas and recorded fixtures
  db/                Drizzle schema and generated migrations
shared/              Types and helpers used by both sides
docs/                Decision log, concept notes, exercises
```

## What's next

- **More eval data**: keep the results table current as more people play, and compare algorithm versions once there's a v3.
- **Recommendation reasons** written by an LLM, cached and capped per day. Until then, each record says which of your artists it's similar to.
- **More end-to-end tests**: Explore and the Taste Check. The main flow (pick an artist → recommendations → hear a preview) is covered.
- **A mainstream ↔ obscure slider** (deferred).

## Credits

Artist data from [Last.fm](https://www.last.fm/). Previews and covers from the [iTunes Search API](https://performance-partners.apple.com/search-api). Non-commercial use.
