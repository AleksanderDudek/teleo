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
27. **Default pinned session**: Polish + prayers/both → "Dziesiątka różańca"; Polish + affirmations →
    "Poranne afirmacje"; English + affirmations/both → "Morning affirmations"; English + prayers →
    "Decade of the Rosary"; own texts → none (spec §13 market defaults, chosen via onboarding).
28. **Deleting a user text** removes the text, its segments, per-text stats and per-text achievements
    and drops it from session templates; attempts, daily stats and the XP ledger stay (history).
29. **First-try rate** of a run = first-try accepts / (accepted + skipped): a skipped sentence counts as
    a failed first try.
30. **Text day streak** (`text.streak.*`) advances on full-text repetitions, not on single sentences.
31. **Freeze bridging also runs inside the first accepted attempt of a day** (not only at start-up): an
    installed PWA resumed from memory could otherwise compute the streak multiplier and the 7-day
    freeze award on a broken chain.

## Matcher details (spec §6 left open)

32. Quote marks around a word don't block contraction expansion (`‘I’m’` → "i am"); `'re → are` for
    any word; `'d → would` only after pronouns/question words (so KJV `Hallow'd` near-matches
    "hallowed").
33. Digit tokens never near-match (`10000` ≠ `10001`); two digit groups merge only across a
    (narrow) no-break space followed by exactly three digits.
34. Polish number words are also recognised without diacritics (`dwadziescia` → 20), except `piec`
    (a common noun).
35. A one-letter difference in a longer word is a tolerated recognition error, which also accepts a
    different grammatical gender (`wdzięczna` for `wdzięczny`) — accepted trade-off of spec §6.3.
36. `empty`/`emptySource` results carry zero counts, no ops, index −1 and an empty transcript; the
    transcript of a result is the alternative exactly as received.

## Segmenter details

37. Abbreviation protection (spec §7.2) means a sentence ending in `itd.`, `itp.`, `r.` or `Dr.` merges
    with the next one; the user can split it in the editor.
38. ICU does not treat `…` as a sentence end; the segmenter splits after `…` + capital letter itself.
    Zero-word segments (`* * *`, `—`, emoji-only) are dropped; split points only count punctuation at
    the end of a word (`8:00` is not one).

## Live mode (owner request, 2026-09-25)

39. **Live mode = hands-free, on by default.** One continuous Web Speech recognition per session; each
    sentence is checked in real time and the next one starts listening immediately. Tap mode (one
    utterance per tap) stays available via the toggle in the player; with a non-streaming engine
    (Whisper) hands-free falls back to the spec's "auto-listen 600 ms after an accepted sentence".
40. **Acceptance rules are unchanged** (≥ 95 %, zero extra words); only the moment of evaluation
    changes. A sentence is accepted from interim results when every word was heard; below 100 %
    coverage (≥ 20-word sentences) only once its last word was heard, or on a pause.
41. **Spill-over is not "extra"**: words after the matched sentence belong to the next one. Up to 3
    leading words repeating the previous sentence's tail may be skipped (cost 0.5 each, so a genuine
    repetition such as `I am calm ×3` is never swallowed).
42. **Failed attempts in live mode**: a pause ≥ 1.5 s after a wrong attempt, more than `sentence + 8`
    words without a match, or an immediate restart of the sentence after a slip (restart detection)
    each record one rejected attempt; the user just says the sentence again — listening never stops.
43. **The "Great!" beat never blocks**: the praise pill and a check on the previous line appear while
    the next sentence is already shown and heard. Achievements unlocked mid-session appear as a quiet
    line under the praise (toasts would cover the text); the summary lists everything.
44. **Repetition counter** comes from `PlanEntry.item`: repeated one-sentence items show pips `k/N`,
    multi-sentence items show `Title · k/N`.

## Stage 7–8 details

45. **Reminders are .ics only** (spec §12 main solution: a daily recurring event with a floating local
    time and an alarm). The optional in-app/Periodic Background Sync notification is not implemented —
    it would need custom service-worker code for a feature Chrome only offers to engaged, installed
    PWAs; the calendar works everywhere.
46. **Backup import replaces everything** in one transaction after full validation, then reloads the app
    at Today (language, theme and stores follow the restored data). Delete-all requires typing the
    confirmation word.
47. **Memory mode**: chosen when starting a text or session (first letters / every other word / hidden);
    words reveal as they are said in live mode; the press-and-hold hint marks that sentence as hinted.
    Only a full repetition at the hidden level with no hinted sentence counts for `text.memory`.
48. **Listen first** pauses the microphone while speechSynthesis reads the sentence (the recogniser
    would otherwise hear the synthetic voice and accept it), then resumes listening; a time limit
    guards engines that never fire `end`.
49. **Figures use the sans face**: Alegreya's old-style zero reads like the letter "o" in statistics.
50. **Resume is offered only for runs with at least one processed sentence**; an untouched run is simply
    started again.
51. **Live mode and alternatives** (spec §5.2 "check all alternatives"): while streaming, the tracker
    follows the best hypothesis (word offsets must stay consistent between updates); when a pause
    settles a sentence, every hypothesis is evaluated. Tap mode always evaluates all of them.
52. **Recogniser restarts and revisions** in live mode: unmatched words are carried into the next
    recognition (a sentence spoken across a restart still counts; starting it again after the
    interruption is not a slip), and the end of the last accepted sentence is re-located by matching
    it again whenever interim words are revised.
53. **An empty capture is not an attempt**: "I didn't hear anything" is shown, but nothing is recorded
    (an accidental tap must not cost first-try credit). Live mode ignores silence the same way.
54. **Transcripts of rejected live-mode windows are stored** like any other attempt when "Save
    transcripts" is on (useful to understand rejections); turning the setting off stores none.
55. **Segments needed by an unfinished run are archived, never deleted**, when a text is edited or the
    affirmation form changes, so the run can still be resumed and finished.
