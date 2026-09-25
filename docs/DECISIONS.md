# Decision log

Decisions taken where `docs/TELEO_SPEC.md` was silent, ambiguous, or out of date with the
tooling available when the project was initialised (2026-09-25). Newest entries at the bottom.
Each entry: **decision** — why.

## Tooling

1. **Scaffold = official `create-vite` React + TS template (Vite 8, TypeScript 6, oxlint).** —
   "Current stable" per spec §3. TypeScript 7 (native) exists, but the template still pins 6.x
   and parts of the ecosystem (e.g. typescript-eslint) do not support 7 yet. The template ships
   oxlint instead of ESLint, so linting uses oxlint (+ `jsx-a11y` plugin for accessibility).
2. **react-router 8 in data mode (`createHashRouter` + `RouterProvider`) instead of `<HashRouter>`.** —
   Same hash URLs (no 404 on GitHub Pages refresh), plus `useBlocker` to confirm leaving a running
   session and route-level lazy loading.
3. **Node 24 in CI and current GitHub Action majors** (checkout v7, setup-node v7,
   upload-pages-artifact v5, deploy-pages v5). — Vitest 5 and react-router 8 require Node ≥ 22,
   so the spec's `node-version: 20` would fail the build.
4. **Tests run in two Vitest projects**: `unit` (Node, `*.test.ts`) and `dom` (jsdom, `*.test.tsx`).
   — Domain modules are tested without any DOM, which enforces the "pure, no DOM dependency"
   requirement of spec §14 stage 2. `TZ=Europe/Warsaw` is forced for deterministic day logic.
5. **Strict TS extras** `noUncheckedIndexedAccess` and `noImplicitOverride`; `erasableSyntaxOnly`
   (template default) means no `enum`/`namespace` — string-literal unions are used instead.
6. **Fonts are self-hosted** (Alegreya for spoken text, Instrument Sans for UI) — no Google Fonts
   CDN, so no third-party requests (privacy) and the app renders identically offline.
7. **Production CSP via `<meta>`** (GitHub Pages cannot set headers). Only `'self'` plus Hugging
   Face origins (opt-in Whisper model download, v1.1).
8. **PWA updates use `registerType: 'prompt'`** — an auto-update could reload the page in the middle
   of a prayer session; the user reloads when convenient.
9. **Nothing is pushed to GitHub automatically.** Creating the (public) repository publishes the code
   and commit metadata; the owner does it with the steps in README.

## Data model

10. **Boolean fields are not Dexie indexes** (`texts.archived`, `sessionTemplates.pinned`,
    `attempts.accepted` from spec §10). — IndexedDB cannot index booleans; such an index silently
    stays empty. Those filters run in memory on small tables.
11. **`SessionRun.plan` stores `PlanEntry` objects** (`segmentId`, `textId`, `block`, `fullText`) and
    per-entry progress in `entries`. — A plain `segmentId[]` cannot tell which repetition of a text a
    segment belongs to, which spec §8.4 needs to count text repetitions ("Hail Mary ×10 → 10").
12. **Settings live in three rows of `settings`**: `app` (user preferences), `game` (freezes, cached XP
    total, counters that are not derivable from daily stats) and `meta` (schema/seed versions, backup
    timestamps).
13. **Extra fields**: `Segment.archived`, `DailyStats.{morning, evening, lastActivityAt,
    firstTryAccepted}`, `TextStats.{consecutiveFirstTry, bestConsecutiveFirstTry, memoryRuns,
    lastPracticedAt}`, `TextItem.builtinKey`, `SessionTemplate.{source, archived, lang, builtinKey,
    lastUsedAt, createdAt}`, `SessionRun.{title, textId, entries, lastActivityAt, mode}`. — Needed by
    achievements (`time.*`, `text.perfect`, `text.memory`), history-preserving edits and resume.

## Rules the spec left open

14. **Word count** = whitespace-separated chunks containing a letter or digit ("I'm" = 1 word). Used
    for XP (`5 + words`), segment length limits and editor hints. Coverage uses matcher tokens.
15. **Streak** = number of *active* days in the current chain; frozen days bridge a gap but add
    nothing (spec §9.7: "liczy się do ciągłości", not to `streak.N`). The chain may end today or
    yesterday (then the streak is "at risk" until the user speaks today).
16. **Freeze consumption** happens when the app opens: a gap of missed days is bridged only when the
    freezes cover the *whole* gap; otherwise the streak ends and the freezes are kept for later.
17. **Freeze earning**: +1 every time the streak reaches a multiple of 7 (7, 14, 21 …), max 2 stored.
18. **Comeback** = first activity after ≥ 3 full idle days (last active day ≥ 4 days ago).
19. **Morning** = accepted segment at local hour ∈ [day start, 08:00); **evening** = at/after 21:00 or
    after midnight but before the day start.
20. **Weekly rhythm** (`weekly.5of7.x4`) uses ISO weeks (Monday–Sunday).
21. **A session is "completed"** (+25 XP, counts for `session.*`) only when it reached the end with at
    least one accepted segment and **no skips**; a run that reached the end with skips is stored as
    `completed` but earns no bonus and is not counted.
22. **Text repetition** is counted only for blocks that cover the whole text in order; a template
    item with a subset of segments never produces a text repetition.
23. **`text.perfect`**: multi-segment text → one full repetition with every segment accepted on the
    first try; one-sentence text → 10 consecutive first-try accepts (spec §9.5).

## Content

24. **Builtin texts are stored pre-segmented** in `src/content/*.json`. — `Intl.Segmenter` is ICU
    based and ICU differs between browsers; builtin content must split identically everywhere.
    Short "Amen." sentences are merged into the preceding segment (spec §7.2 rule 5).
25. **Builtin language visibility**: after onboarding, builtin texts/sessions in the other language
    are hidden (can be unhidden in the library). The content focus hides the other type
    (prayers ↔ affirmations); "own texts" hides all builtins.
26. **PL affirmation forms**: the builtin "Poranek" set has masculine, feminine and neutral variants;
    the neutral variant rephrases gendered sentences ("Zachowuję spokój i skupienie."). Skipping
    onboarding selects the neutral form.
