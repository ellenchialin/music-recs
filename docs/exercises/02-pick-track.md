# Exercise 2: Picking the right song from search results

About 30 minutes. One new concept: **tiered picking**. Look for the best match first; only if there isn't one, drop a tier and look again.

## Why this function exists

Recommendation cards need a preview. We search iTunes with Last.fm's "artist + title", but the first result often isn't the song we want. These are recorded real results (`server/itunes/fixtures/search-radiohead-creep.json`) for "Radiohead Creep":

| # | Title | Artist |
|---|---|---|
| 1 | Creep (Acoustic) | Radiohead |
| 2 | Creep (feat. Radiohead) [Very 2021 Rmx] | Thom Yorke |
| 3 | Creep | TLC |
| 4 | Creep | Daniela Andrade |
| 5 | Creep (SAN) | ATEEZ |

Matching on the title alone picks TLC. Taking the first result happens to work here, but not for every song. So it becomes a pure function with rules and tests.

> **Frontend analogy**: in an image component you may have written "use the 2x image if there is one, else 1x, else a placeholder". Same pattern: a list of options from best to worst; take the first that exists.

## Getting started

```bash
pnpm test:unit
```

The 7 tests in `pick-track.test.ts` are red with the message `TODO: exercise 2`.

To rerun while you work:

```bash
pnpm vitest --project unit pick-track
```

The file to write is `server/utils/pick-track.ts`. The comment at the top lists the rules. **Read the tests first**: each `it` names the rule it checks.

## Step 1: Experiment first (5 minutes)

**Before running each line, write down your prediction**, then run it and compare.

```bash
node -e 'console.log([1, 2, 3].find((n) => n > 5))'
```

**Prediction**: what does `find` return when nothing matches?

```bash
node -e 'console.log(undefined ?? "second", null ?? "second", 0 ?? "second", 0 || "second")'
```

**Prediction**: what do the four print? How do `??` and `||` differ?

```bash
node -e 'console.log(undefined ?? undefined ?? "third")'
```

**Prediction**: can `??` be chained?

```bash
node -e 'console.log("Creeping Death".startsWith("Creep"), "Creep (Acoustic)".startsWith("Creep ("))'
```

**Prediction**: why does the test `does not treat a different song...` rule out the first check?

## Step 2: Implement it

Make all 7 tests green. If you get stuck, open the hints in order, **one at a time**.

<details>
<summary>Hint 1: Split it in two</summary>

First filter the eligible candidates (rule 1: right artist, has a preview), then pick from them (rules 2 and 3). Use `filter` to filter and `find` to pick.

</details>

<details>
<summary>Hint 2: Case and whitespace</summary>

Exercise 1's `normalizeArtistName` works for titles too: it only does NFKC, trim, lowercase and space collapsing, nothing artist-specific. Import it from `./normalize-artist-name` and normalize both sides (`want` and every result).

</details>

<details>
<summary>Hint 3: How to say "original first, then a version"</summary>

Look back at the third experiment in step 1. `find` returns `undefined` when nothing matches, which chains neatly with `??`. If the last tier finds nothing, return `null`, not `undefined` (check the return type).

</details>

<details>
<summary>Hint 4: What counts as a version</summary>

The title has to start with "original title + separator". The real data has three separators: `" ("`, `" ["` and `" - "` (each with a leading space). An array's `some` checks whether any of them matches.

</details>

## Step 3: See the result

Once the tests are green:

```bash
pnpm lint
```

```bash
pnpm typecheck
```

Then open `server/itunes/fixtures/search-utada-first-love.json` next to the last test: why does picking with `宇多田ヒカル` return `null`? Is that the right behavior?

## When you're done

Send me:

1. Where your **predictions in step 1 were wrong**
2. Your implementation

I'll ask a few "what if…" questions, then have you add a test case.
