# Music Recs

![Music Recs: name a few artists or describe a vibe, and get records you can preview](public/og-image.png)

**Live demo: [musicrecs.ellenchen.dev](https://musicrecs.ellenchen.dev/)**

Pick up to three artists you love and get ten records to flip through, each with a 30-second preview and a one-line reason written by AI as you watch. Or describe what you're in the mood for, and an AI agent looks up artists that fit, showing each step as it works. From any record you can **explore** one level deeper, up to three levels, and every level shows artists you haven't seen yet. No account and no sign-in.

> **Status**: a portfolio project (November 2026). Recommendations, previews, streamed AI reasons, Explore, the popularity setting, "By vibe" (an AI agent that finds artists from a description), the Taste Check and its public results page are live. With 32 listeners, recommended songs beat random picks by about a point ([results](#results-algorithm-v2-2026-11-18)). Try it and [see whether the picks fit your taste](https://musicrecs.ellenchen.dev/).

## Features

- **Seed artists**: type-ahead search backed by Last.fm, with misspelled lookalikes filtered out (for example "radıohead" with a dotless ı). Choose 1–3 artists; they're remembered in the browser.
- **Or describe a vibe**: "By vibe" on the home page takes a sentence ("like Tame Impala, but for running", "lazy jazz for a rainy afternoon"). An AI agent looks up artists on Last.fm, each lookup shown as it happens, and suggests 1–3 to start from, each with a one-line why. They become your picks: remove any you don't want, then Recommend.
- **A crate of records**: ten recommendations shown like flipping through a record crate. Swipe, drag, click the side covers or use the arrow keys. Each record shows the artist, a representative track, which of your artists it's similar to, and a round play button for the preview.
- **Mainstream ↔ obscure**: a three-stop setting (Obscure / Balanced / Mainstream) re-ranks the records by how many listeners each artist has, while staying among the most similar ones. Explore, the reasons and the Taste Check keep the setting.
- **Explore from here**: dig from any record into artists similar to it, up to three levels deep. Each level excludes everything shown before, so you always get new names. A breadcrumb (`Home › Tame Impala + Kokoroko › Pond`) goes back to any level instantly, without refetching.
- **Shareable URLs**: the URL is the single source of truth (`/recommendations?seed=…&explore=…&popularity=…`), so reload, Back and shared links all show the same screen, rendered on the server, with a link preview (Open Graph) for chat apps and social sites.
- **Graceful gaps**: no preview in any store shows "No preview" with an Apple Music link; a temporary iTunes error affects only that record and offers a retry; an unknown artist suggests similar names.
- **Taste Check** ("Fit your taste?" on the recommendations page): a blind test. Listen to three unnamed songs, rate each 1–5, then see which were picked for you and which were random picks from the same genre. Results feed the eval below.
- **Public results** ([`/stats`](https://musicrecs.ellenchen.dev/stats)): everyone's ratings so far, led by one number (how much higher picked songs scored), with the same numbers per popularity setting and per algorithm version. It links back to your own recommendations.
- **One screen, every size**: both pages fit exactly one viewport from a 320px phone to a 1920px desktop, with motion that respects the system's reduced-motion setting.

## How it works

![Architecture: Nuxt pages call API routes (rate limit, zod, Server-Sent Events). Four services read and write a Postgres cache on Neon, which calls Last.fm and iTunes on a miss: Recommendations builds the list, Reasons streams optional AI reasons from Claude Haiku, the By vibe agent lets Claude Haiku choose Last.fm lookups to find artists, and the Taste Check runs the blind test](docs/diagrams/architecture.png)

<sub>Source: [`docs/diagrams/architecture.html`](docs/diagrams/architecture.html), drawn with the [diagram-design](https://github.com/cathrynlavery/diagram-design) skill in the site's own colors.</sub>

1. **Similar artists**: for each seed, take Last.fm's similar-artists list (cached in Postgres for 30 days).
2. **Merge by rank**: combine the lists with Reciprocal Rank Fusion, a common way search engines merge ranked lists. Rank *r* in a seed's list scores `1 / (5 + r)`, summed across seeds. Using ranks instead of raw similarity scores keeps one seed from taking most of the spots, while artists similar to several seeds still rank highest.
3. **Exclude**: drop the seeds themselves (matched by normalized name or MusicBrainz ID), plus everything already shown when exploring.
4. **Popularity** (optional): Obscure or Mainstream looks up Last.fm listener counts for the 30 most similar candidates and re-ranks them by rank again: similarity rank plus popularity rank, the latter weighted double. Balanced is the plain ranking and makes no extra calls.
5. **Previews**: for each of the top 10, take Last.fm's top track and find it on iTunes, trying the Taiwan, US and Japan stores in turn (stores localize artist names, e.g. BoA is 寶兒 in Taiwan). A small tiered matcher prefers the original title, then a version of it, and never a different artist's song. The list doesn't wait for this: it answers with cached previews, and the page asks `/api/previews` once for all the rest, which streams each one back as it's found, nearest record first, while the Play button shows a spinner.

6. **Reasons**: once the records are on screen, Claude Haiku 5.5 writes a one-line reason for each, marked "AI", in one call per list, streamed to the page so each reason shows as soon as it's written, the record on screen first. It's told to describe the sound rather than biography and to answer null when unsure; reasons are cached per seed set and capped at 300 calls a day site-wide. Every outcome has its own line: "Finding the words…" while writing, "Similar to …" when the model had nothing it was sure of, a note when the day's AI calls are used up, and a Retry that asks again only for the records still missing when the stream fails or takes too long.

**By vibe** works differently: Claude Haiku 5.5 runs as an agent with four read-only Last.fm tools (search, artist tags and listeners, similar artists, top artists for a tag) and one way to finish (`suggest_artists`). The server runs each lookup it asks for and streams every step to the page. It may only suggest artists its lookups returned, so every suggestion is a real Last.fm artist; an invented name goes back to it for another try. Each run gets at most six lookups, 30 seconds and a share of a daily cap, and stops when the visitor does.

Every result is tagged with an algorithm version, and every Taste Check round with its popularity setting, so blind-test ratings can compare both.

## Measuring it: the Taste Check

Recommendations are easy to show and hard to prove, so the site measures itself.

1. **A fair opponent**: each round mixes one or two recommended songs with popular songs from the seeds' most common Last.fm genre tag (its chart cached for 30 days), so recommendations can't win just by being the right style.
2. **Blind**: names and covers stay hidden until you've rated all three; which songs were recommended never leaves the server before that.
3. **One visitor, one vote**: each visitor's own difference (recommended average − random average) is computed first and then averaged across visitors, so one person playing twenty rounds counts once.
4. **Honest uncertainty**: a 95% confidence interval (Student's t) decides what the page says. Until it excludes zero, it says there's no clear difference yet.

Live numbers: the [results page](https://musicrecs.ellenchen.dev/stats) (or [`/api/stats`](https://musicrecs.ellenchen.dev/api/stats) as JSON), per algorithm version and per popularity setting. Known limit: clearing cookies makes a new visitor, so the count is an upper bound on real people.

### Results (algorithm v2, 2026-11-18)

| Listeners | Ratings | Picked for you | Random pick | Difference | 95% CI |
|---:|---:|---:|---:|---:|---:|
| 32 | 102 | 3.88 / 5 | 2.86 / 5 | **+1.02** | +0.36 to +1.68 |

Balanced rounds only; the [results page](https://musicrecs.ellenchen.dev/stats) has the live numbers.

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
| Tests | **Vitest** + `@nuxt/test-utils`, **Playwright** | Three Vitest projects: pure functions in Node, database tests against a real Postgres, components in happy-dom. Playwright drives the production build in Chromium through the three main flows (pick an artist and hear a preview, Explore, the Taste Check), with the cache seeded from recorded fixtures so no outside API is called |
| Hosting | **Vercel** + **Neon** | Serverless deploys with a managed Postgres |

## Engineering notes

- **Test-driven**: about 500 tests, plus Playwright end-to-end and a smoke test of the live site after each deploy and weekly against Core Web Vitals and Nielsen's response-time limits. The algorithm and rate limiting are pure functions with unit tests; caching and services run against a real test database; pages and components are tested in a simulated browser. External APIs are never called in tests: recorded fixtures stand in for them.
- **Show the list, then fill it in**: an uncached recommendation used to take 4–5 s because every preview was looked up before answering. Now the records appear in about 2 s (1.1 s of it the turntable animation) and each preview follows on its own.
- **Caching that won't lie**: "iTunes has no preview" is cached (so we don't ask again for 30 days); "iTunes is down" is not (so the preview comes back when it recovers).
- **Rate limiting**: fixed one-minute windows counted atomically in Postgres, because serverless instances don't share memory. IPv6 clients are grouped by /64, `x-forwarded-for` is trusted only behind Vercel's proxy, and only a salted hash of the IP is stored.
- **Protecting upstream APIs**: one uncached recommendation can make dozens of Last.fm and iTunes calls, so there's also a site-wide per-minute budget for each API and a circuit breaker that backs off iTunes for five minutes when it starts throttling.
- **Security**: in production, a Content Security Policy, `frame-ancestors 'none'` against clickjacking, `nosniff`, a referrer policy and HSTS. Media URLs from iTunes must be https. The Taste Check's POSTs refuse other origins (CSRF), a round can be rated once, and another visitor's round answers 404.
- **Privacy**: no accounts and no personal data. Your chosen artists are stored only in your browser. The Taste Check uses an anonymous random ID in an `httpOnly` cookie; the server keeps salted IP hashes for rate limiting and deletes them after about an hour.

## How I built it

I built this with [Claude Code](https://claude.com/claude-code) as a pair programmer, and I want to be clear about who did what.

- **Claude Code** wrote most of the code and tests, always test first, and explained each new concept with frontend analogies ([`docs/concepts.md`](docs/concepts.md)).
- **I** decided what to build and how it should feel: a recommender I'd use myself, a visual direction drawn from a reference illustration (after rejecting a first neon look as too childish), and which of Claude's proposals to take at each step. I checked every change in the browser and pushed back when something felt wrong. Some examples:
  - When the smoke test failed on a slow phone, I asked for the root cause instead of looser budgets; covers moved to WebP and the time from Play to sound dropped from 4.0 s to 1.3 s.
  - I tried a link to the results on the home page, saw it pull attention from the one action there, and moved it to the Taste Check.
  - I noticed the results page was a dead end and had it lead back to your own recommendations.
- Three core functions started as small exercises for me, from a failing test plus hints ([`docs/exercises/`](docs/exercises/)).

Every decision is logged in [`docs/ai-log.md`](docs/ai-log.md), with Claude's suggestion next to what I settled on, including the ones tried and reverted. The full spec is [`SPEC.md`](SPEC.md).

## Running it locally

Requirements: Node 24, pnpm, Docker, and a free [Last.fm API key](https://www.last.fm/api/account/create).

```bash
cp .env.example .env
```

Fill in `LASTFM_API_KEY`, and generate a salt for `RATE_LIMIT_SALT`. `ANTHROPIC_API_KEY` is optional: without it the AI reasons are off and records show "Similar to …".

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
| `pnpm test:smoke` | Times each step on the live site (desktop and a throttled phone) against budgets from Core Web Vitals and Nielsen's response-time limits. Also runs in GitHub Actions after each production deploy and weekly |
| `pnpm typecheck` / `pnpm lint` | Type check and lint |
| `pnpm db:studio` | Browse the cached data in Drizzle Studio |
| `pnpm record:lastfm` / `pnpm record:itunes` | Re-record API fixtures from the real APIs |
| `pnpm record:reasons` | Ask Claude for real reasons to check the prompt, and re-record its fixture (needs `ANTHROPIC_API_KEY`; costs a fraction of a cent) |

## Project structure

```
app/                 Vue pages, components, composables and stores
  pages/             index (pick artists), recommendations (the crate), taste-check (the blind test), stats (results)
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

## Credits

Artist data from [Last.fm](https://www.last.fm/). Previews and covers from the [iTunes Search API](https://performance-partners.apple.com/search-api). Non-commercial use.

The code is under the [MIT License](LICENSE); the music data, previews and covers belong to their owners and aren't covered by it.
