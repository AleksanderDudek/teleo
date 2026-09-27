# Coverage ladder: 90 % → 80 % → 70 % per sentence — plan

**Status (2026-09-27): implemented** — DECISIONS #93–#94.

Owner request (2026-09-27): "the modes should look like this: 90 % at the start, then 80 %, then 70 % after mistakes.
At most three times, then 70 % for good."

## Analysis

- Today two modes (Settings): **strict** — 95 % of the words and a different word rejects the sentence outright;
  **gentle** — 85 %, a different word only counts as not said. Extra words fail in both (spec §6.1/2).
- In strict mode a misheard word rejects the sentence whatever the coverage — so a percentage alone would not help
  the original complaint (Polish words said but written differently by the recogniser).
- A rejected try is already stored per sentence: `run.entries[i].attempts` (a pending entry only has failed tries),
  kept across a pause/resume. Tap and live mode record a rejection the same way (live: pause, overflow, restart).
- The live tracker keeps its target after a rejection, so a new requirement must reach it with the target.

## Decision (recommended)

1. **One rule for everyone — the coverage ladder**: a sentence's 1st try needs 90 % of its words, the 2nd 80 %, the
   3rd and every later one 70 %. Each new sentence starts at 90 % again. Replaces the strict/gentle setting and the
   Guardian's "Check more gently" offer (the ladder does it by itself).
2. **A misheard word counts as not said**, on every rung — it lowers coverage but never rejects on its own. Extra
   words still reject (spec §6.1/2 stays).
3. Percent is "at least": `ceil(p × words)` as before, so a short sentence may still need every word on the 1st try.
4. **Visible**: after a failed try the feedback card says what the next try needs ("Next try: 80 % of the words is
   enough"); "How do we check?" and Settings explain the ladder.
5. Each attempt stores the coverage it needed (`threshold`, replacing `strictness`) — spec §6.4's "mode stored with
   every attempt" for honest statistics.

## Implementation (test-first for the matcher)

- `domain/matcher/evaluate.ts`: `COVERAGE_LADDER = [0.9, 0.8, 0.7]`, `coverageNeeded(failedTries)`; `EvaluateOptions`
  loses `strictness` (threshold defaults to the 1st rung); the `'wrong'` reject reason goes; `MatchResult.threshold`.
- `domain/live/liveTracker.ts`: `LiveTarget.threshold`; the re-located last sentence keeps its own threshold.
- Player: threshold from the entry's failed tries (tap + live); the live target key includes it. Mic test: 1st rung;
  onboarding mic step: last rung.
- `AppSettings.strictness` and the `Strictness` type removed (old rows/backups keep the key harmlessly);
  `Attempt.threshold` (optional in backups).
- i18n: remove the strictness and gentle-offer keys; add the ladder copy.
- Tests: matcher (ladder rungs, spec §6.6 table re-expressed), live tracker (threshold per target), result message,
  backup validation, e2e (a nearly-right sentence fails at 90 % and passes at 80 % on the 2nd try).
