# Exercise 3: Merging candidate artists

> This exercise uses v1's rule (score = sum of match). v2 later switched to ranks (`docs/concepts.md` section 9) and the code and tests were updated; this page is kept for the record.

About 30 minutes. One new concept: **grouping and summing with a Map**. When the same key appears several times, update the existing entry instead of adding a new one.

## Why this function exists

The user picks seed artists, and each seed has a similar list in the cache (`artist_similar`). A recommendation needs **one** ranked list, so the lists have to be merged:

| Seed | Similar list |
|---|---|
| Radiohead | Blur 0.8, Muse 0.5 |
| Coldplay | Muse 0.4 |

After merging, Muse appears once with 0.5 + 0.4 = 0.9, ahead of Blur (0.8). That's the spec's "similar to more seeds scores higher".

> **Frontend analogy**: you get an array from an API and store it as `{ [id]: item }` (Redux's `byId`), then look items up and update them by id instead of scanning the array. Same thing here, except a repeated id adds to the score.

## Getting started

```bash
pnpm vitest --project unit merge-candidates
```

6 tests are red with the message `TODO: exercise 3`.

The file to write is `server/utils/recommend/merge-candidates.ts`. The rules are in the comment above the function and the types are in `types.ts` next to it. **Read the tests first**: each `it` names the rule it checks.

## Step 1: Experiment first (5 minutes)

**Before running each line, write down your prediction**, then run it and compare.

```bash
node -e 'const m = new Map(); m.set("muse", 1); console.log(m.get("muse"), m.get("blur"), m.get("blur") ?? 0)'
```

**Prediction**: what does `get` return for a missing key?

```bash
node -e 'const m = new Map(); m.set("muse", 1); m.set("blur", 2); m.set("muse", 3); console.log([...m.values()], m.size)'
```

**Prediction**: after setting the same key twice, how many entries are there? In what order does `values()` return them?

```bash
node -e 'const box = { score: 1 }; const m = new Map([["muse", box]]); m.get("muse").score += 5; console.log(box.score)'
```

**Prediction**: if you change the object `get` returns, does the one in the Map change too?

```bash
node -e 'console.log(0 || "next", 0.1 || "next", [3, 1, 2].sort((a, b) => b - a))'
```

**Prediction**: what happens when the left side of `||` is 0? How does that relate to sorting "by name when scores are equal"?

## Step 2: Implement it

Make all 6 tests green. If you get stuck, open the hints in order, **one at a time**.

<details>
<summary>Hint 1: Overall structure</summary>

Two loops: the outer one over seeds, the inner one over that seed's similar list. Create a `Map<string, Candidate>` outside the loops, keyed by `nameNorm`.

</details>

<details>
<summary>Hint 2: What to do for each artist</summary>

Look it up with `get` first. If it's missing, create a new `Candidate` (score starting at 0, `sources` an empty array). Then add `weight * match` to the score, add the seed's name to `sources`, and `set` it back. The first and third experiments in step 1 are the key.

</details>

<details>
<summary>Hint 3: Turning the Map back into an array</summary>

`[...map.values()]`, in the order of the first `set`, so it still needs sorting.

</details>

<details>
<summary>Hint 4: The sort comparator</summary>

Highest score first is `b.score - a.score`. When scores are equal that's `0`, so chain a second comparison with `||`: names ascending, `a.nameNorm.localeCompare(b.nameNorm)`.

</details>

## Step 3: See the result

```bash
pnpm lint
```

```bash
pnpm typecheck
```

Then compare with `artist_similar` in Drizzle Studio: if the seeds are 宇多田ヒカル and another J-pop artist, which artists do you expect to rank high because both lists have them?

## When you're done

Send me:

1. Where your **predictions in step 1 were wrong**
2. Your implementation

I'll ask a few "what if…" questions, then have you add a test case.
