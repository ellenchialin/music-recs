# Exercise 1: Normalizing artist names

About 30 minutes. One new concept: **Unicode normalization**. Characters that look the same can be different characters to the computer.

## Why this function exists

`artists.name_norm` has a unique constraint (checked by the previous step's schema tests). What goes in that column is decided by `normalizeArtistName`:

- Too loose (only `toLowerCase()`): `ＲＡＤＷＩＭＰＳ` and `RADWIMPS` become two artists, cached twice and recommended twice.
- Too strict (stripping accents): `Sigur Rós` becomes `sigur ros` and might collide with a different artist actually called Sigur Ros.

> **Frontend analogy**: you've surely written `input.trim().toLowerCase()` for a search box. This is the same thing, plus handling characters that look identical but aren't.

## Getting started

```bash
pnpm test:unit
```

The 5 tests in `normalize-artist-name.test.ts` are red with the message `TODO: exercise 1`. Everything else is green.

To rerun on every save while you work, use watch mode:

```bash
pnpm vitest --project unit normalize-artist-name
```

The file to write is `shared/utils/normalize-artist-name.ts` (it started in `server/utils/` and moved to `shared/` because the client needs it too). The tests are next to it in `normalize-artist-name.test.ts`. **Read the tests first**: each `it` names the rule it checks.

## Step 1: Experiment first (5 minutes)

**Before running each line, write down your prediction**, then run it and compare.

```bash
node -e 'console.log("Björk" === "Björk")'
```

**Prediction**: `true` or `false`?

```bash
node -e 'console.log("Björk".length, "Björk".length)'
```

**Prediction**: what are the two lengths?

```bash
node -e 'console.log("Björk".normalize("NFC") === "Björk")'
```

```bash
node -e 'console.log("ＲＡＤＷＩＭＰＳ".normalize("NFC"), "ＲＡＤＷＩＭＰＳ".normalize("NFKC"))'
```

**Prediction**: do NFC and NFKC treat full-width letters the same way?

```bash
node -e 'console.log("Sigur Rós".normalize("NFKC"))'
```

**Prediction**: does NFKC turn `ó` into `o`?

## Step 2: Implement it

Make all 5 tests green. If you get stuck, open the hints in order, **one at a time**.

<details>
<summary>Hint 1: Which methods you need</summary>

All built-in string methods, no packages: `normalize()`, `trim()`, `toLowerCase()`, `replace()`.

</details>

<details>
<summary>Hint 2: NFC or NFKC</summary>

Look back at the last two experiments in step 1. Which one handles both ways of storing ö and full-width letters, without removing accents?

</details>

<details>
<summary>Hint 3: Repeated whitespace</summary>

The regex `\s` matches any whitespace (space, tab, newline), and `+` means "one or more". The `g` in `/\s+/g` replaces every match, not just the first.

</details>

<details>
<summary>Hint 4: One test is still red and the values look identical</summary>

Vitest's error shows `Expected` (what the test wants) and `Received` (what you returned). When they look the same but the test is red, there's usually an invisible character. Print each character's code to compare:

```bash
node -e 'console.log([..."Björk"].map((c) => c.codePointAt(0).toString(16)))'
```

</details>

## Step 3: See the result

Once the tests are green, run lint and the type check:

```bash
pnpm lint
```

```bash
pnpm typecheck
```

## When you're done

Send me:

1. Where your **predictions in step 1 were wrong**
2. Your implementation

I'll ask a few "what if…" questions, then have you add a test case.
