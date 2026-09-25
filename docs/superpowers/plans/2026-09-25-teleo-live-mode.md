# Live Mode (continuous real-time checking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a session starts, Teleo keeps listening and checks what the user says in real time: words of the current sentence light up as they are recognised; as soon as the sentence is complete and correct it shows a green check + "Great!" and moves on by itself; for repeated sentences/blocks a counter (e.g. `3/10`) fills up until the required number is reached.

**Architecture:** One continuous Web Speech recognition per session (no restart between sentences — restarting loses the first words and beeps on Android). A pure, DOM-free `LiveTracker` state machine consumes the growing transcript, matches it against the current segment with a *prefix* (semi-global) alignment, emits `progress / accepted / rejected` events and hands spill-over words to the next segment. The player only renders these events and records attempts through the existing `practice` service. Acceptance rules stay exactly those of spec §6 (≥ 95 % coverage, zero extra words); only *when* evaluation happens changes.

**Tech Stack:** existing matcher (`src/domain/matcher`), Web Speech API (`continuous = true`, interim results), React player, Vitest, Playwright with a streaming fake `SpeechRecognition`.

**Relation to the main plan:** implemented as **Stage 4b**, right after the base player (Stage 4a), so the player is built once with both modes. The spec's "hands-free" setting becomes this live mode (DECISIONS entry).

---

## Design decisions (to copy into docs/DECISIONS.md)

1. **Live mode = hands-free, on by default.** `AppSettings.handsFree` (spec §8.3) now means continuous real-time checking; default `true` (explicit owner request). Tap-per-sentence stays available (toggle in the player and in Settings). With the Whisper engine (v1.1, not streaming) hands-free falls back to "auto-listen 600 ms after each accepted sentence" (the spec's original hands-free).
2. **Single recognition session.** The engine restarts only when the browser ends recognition on its own (Chrome ~60 s limits, network blips); the tracker is told to `reset()` and continues with the current segment.
3. **Accept on interim results** when the whole sentence is matched (coverage 100 %). If coverage is ≥ 95 % but < 100 % (≥ 20-word sentences may omit one word), accept only once the sentence's last word has been heard or on a pause — never "Great!" before the user has finished.
4. **Spill-over is not "extra".** Words after the matched prefix belong to the next sentence. Leading words of the next window that repeat the *tail* of the previous sentence (interim revisions, the one omitted word) may be skipped (max 3, cost 0.5 each — more expensive than a match, so a genuine repetition such as `I am calm ×3` is never swallowed).
5. **Failed attempt** (recorded as a rejected attempt, counts towards "Skip after 3") when: a pause ≥ 1.5 s leaves an unmatched window, or the window grows beyond `sourceWords + 8` tokens without a match. The window is then discarded and the user simply says the sentence again — listening never stops.
6. **Repetition counter** is driven by a new `PlanEntry.item` (index of the template item). Consecutive blocks of the same item form a group: single-sentence items show a big `k/N` counter with pips; multi-sentence items (Hail Mary ×10) show `Hail Mary · k/N` above the current sentence.

## Files

- Modify `src/domain/session/types.ts`, `src/domain/session/expand.ts` (+ test): add `item: number` to `PlanEntry`; helper `repetitionInfo(plan, index) → { item, rep, reps, blockStart, blockEnd }`.
- Create `src/domain/matcher/live.ts` (+ `live.test.ts`): `matchPrefix`, `progressOf`.
- Create `src/domain/live/liveTracker.ts` (+ `liveTracker.test.ts`): the state machine.
- Modify `src/domain/speech/SpeechEngine.ts`, `WebSpeechEngine.ts` (+ tests): `continuous` option, `onTranscript(snapshot)`, `onEnd`, auto-restart.
- Modify `src/screens/SessionPlayer/*`: live controller hook `useLiveSession`, highlighted sentence, "Great!" check animation, repetition counter, live/tap toggle.
- Modify `src/i18n/{pl,en}.json`, `src/screens/Settings`, `docs/DECISIONS.md`.
- Create `e2e/live.spec.ts` + streaming mode in `e2e/fakeSpeech.ts`.

## Contracts

```ts
// src/domain/matcher/live.ts
export interface PrefixOptions extends EvaluateOptions {
  /** Normalized tail tokens of the previously accepted sentence (tolerated leading junk). */
  previousTail?: readonly string[];
}
export interface PrefixMatch {
  /** Evaluation of the sentence against the chosen prefix of the window. */
  result: MatchResult;
  /** Raw (whitespace) words of the window that belong to this sentence. */
  consumedRawWords: number;
}
/** Best acceptable way to say the whole `source` with a prefix of `window`, or null. */
export function matchPrefix(source: string, window: string, options: PrefixOptions): PrefixMatch | null;
export interface LiveProgress {
  /** Per raw source word: already heard (match/near). */
  covered: boolean[];
  /** Extra/wrong words inside what has been said so far. */
  errors: number;
  /** Index of the last covered raw source word, −1 if none. */
  lastCovered: number;
}
/** Which words of `source` the user has already said (free end gap on the source side). */
export function progressOf(source: string, window: string, lang: Lang): LiveProgress;

// src/domain/live/liveTracker.ts
export interface LiveTarget { entryIndex: number; source: string }
export type LiveEvent =
  | { type: 'progress'; entryIndex: number; progress: LiveProgress; window: string }
  | { type: 'accepted'; entryIndex: number; result: MatchResult; transcript: string }
  | { type: 'rejected'; entryIndex: number; result: MatchResult; transcript: string; cause: 'pause' | 'overflow' };
export interface LiveTracker {
  setTarget(target: LiveTarget | null): LiveEvent[]; // re-evaluates pending spill-over immediately
  update(transcript: string): LiveEvent[];            // full transcript of the current recognition (final + interim)
  pause(): LiveEvent[];                               // silence detected
  reset(): void;                                      // recognition restarted → transcript starts empty
}
export function createLiveTracker(options: { lang: Lang; strictness: Strictness; overflowWords?: number }): LiveTracker;
```

## Tasks

### Task L1: `PlanEntry.item` + repetition info (TDD)
- [ ] Failing tests: rosary PL plan → items `[0 ×4, 1 ×20, 2 ×2]`; `repetitionInfo(plan, 5)` → `{ item: 1, rep: 0, reps: 10, blockStart: 4, blockEnd: 5 }`; `repetitionInfo(plan, 7)` → rep 1; single-sentence item ×20 → reps 20.
- [ ] Implement, run `npx vitest run src/domain/session`, commit `feat(session): track template item and repetition index`.

### Task L2: `matchPrefix` / `progressOf` (TDD)
Test table (PL and EN):
| Source | Window | Expect |
|---|---|---|
| `Jestem spokojny i pewny siebie.` | `jestem spokojny i pewny siebie chleba naszego` | accepted, consumed 5 |
| same | `jestem spokojny i pewny` | null (incomplete) |
| same | `jestem bardzo spokojny i pewny siebie` | null (extra inside) |
| 20-word sentence | first 19 words | null (last word not heard yet) |
| 20-word sentence | 19 words without the 7th + `chleba` | accepted (last word heard), consumed 19 |
| `I am calm` (previousTail `am calm`) | `calm I am calm I am calm` | accepted, consumed 4 (skips the tail repetition) |
| `I am calm` (previousTail `i am calm`) | `I am calm I am calm` | accepted, consumed 3 (never swallows a genuine repetition) |
| `Mam 10 celów.` | `mam dziesięć celów i` | accepted, consumed 3 |
| `I am calm` | `um I am calm` | accepted, consumed 4 |
`progressOf('Jestem spokojny i pewny siebie.', 'jestem spokojny', 'pl')` → covered `[true, true, false, false, false]`, lastCovered 1, errors 0; with `jestem bardzo spokojny` → errors 1.
- [ ] Implement with a semi-global DP (free end gap on the spoken side for `matchPrefix`, on the source side for `progressOf`; ×10 integer costs as in `align.ts`), commit `feat(matcher): prefix matching and live progress`.

### Task L3: `LiveTracker` (TDD)
Scenarios: fluent three sentences in one growing transcript → three `accepted` in order with correct `consumed` boundaries; interim revision shrinking the transcript below the consumed boundary is clamped; repeated sentence ×3 → three accepts; mid-sentence extra word + `pause()` → `rejected` (cause `pause`) and the next `update` starts a fresh window; 8+ unmatched tokens → `rejected` (cause `overflow`); `reset()` after a restart; `setTarget(next)` immediately accepts spill-over already in the transcript; fillers ignored; `setTarget(null)` (session end) ignores further speech.
- [ ] Implement, commit `feat(live): real-time sentence tracker`.

### Task L4: engine streaming
- [ ] `SpeechStartOptions` gains `continuous?: boolean`, `onTranscript?: (text: string, isFinal: boolean) => void`, `onEnd?: () => void`; in continuous mode no silence auto-stop — `onSilence` still fires after 1.5 s without new results (tracker `pause()`), and an unexpected `end` triggers one automatic restart (then `onEnd` if restart fails).
- [ ] Fake-recognition unit tests; commit `feat(speech): continuous streaming mode`.

### Task L5: player integration
- [ ] `useLiveSession(run)` wires engine ↔ tracker ↔ `practice.recordAttempt` (accepted/rejected with `firstTry`), advances with an 800 ms "Great!" beat (spill-over is evaluated immediately, only the visual transition waits), shows Skip after 3 failed attempts, pauses on visibility change, stops at the end of the plan.
- [ ] Sentence rendering: covered words ink in (gold underline → full ink), current error word highlighted red; `aria-live` announces "Great!" and failures, not every word.
- [ ] Repetition UI: pips `k/N` for single-sentence groups, `Title · k/N` chip for multi-sentence groups; counter increments with a small check animation (reduced-motion aware).
- [ ] Live/tap toggle in the player header; Settings switch text updated.
- [ ] Commit `feat(player): live mode with real-time checking and repetition counters`.

### Task L6: e2e
- [ ] Fake `SpeechRecognition` streaming mode: emits the expected sentences word by word as interim results in ONE continuous recognition; test PL rosary decade completes hands-free with correct counters (Zdrowaś Maryjo 10/10), and a wrong sentence produces a rejection then success on repeat.
- [ ] Commit `test(e2e): live mode session`.
