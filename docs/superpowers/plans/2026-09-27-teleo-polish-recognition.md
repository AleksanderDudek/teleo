# Polish recognition: words said but not counted — plan

**Status (2026-09-27): implemented** — DECISIONS #89–#90.

Owner report (2026-09-27): reading Polish aloud, some words are not counted although they were said. Options
proposed: (1) a better model for spoken Polish, (2) a lower pass threshold for the words of a sentence.

## Analysis

- Every verdict (tap mode `evaluate`, live mode `matchPrefix`, live highlighting `progressOf`) goes through one
  word alignment (`domain/matcher/align.ts`) and one rule (`verdictOf`): ≥ 95 % of the words said and no extra
  word. Below 20 words that means *every* word, so one word the recogniser writes differently fails the sentence.
- Tolerance today: exact match; diacritics ignored; ≥ 4-letter words within one edit per five letters. Nothing
  else — and Polish recognisers produce other, systematic artefacts:
  - **split / merged words**: `w niebie` → `wniebie`, `niekształtowna` → `nie kształtowna`, `na wieki` →
    `nawieki`, `przede mną` → `przedemną`. A merge makes one source word *missing*, a split makes one spoken word
    *extra* — both reject the sentence although everything was said.
  - **spelling of the same sound**: `ó/u` (`Bóg`/`bug`), `rz/ż` (`morze`/`może`), `ch/h`. Short words (≤ 3
    letters) get no fuzzy tolerance at all, so `bóg` vs `bug` fails.
- Option (1): in Chrome/Edge/Safari the Web Speech engine is the vendor's cloud model — the strongest free Polish
  recogniser available, and not replaceable by the app. The in-browser Whisper models (tiny/base) are weaker for
  Polish; `small` (~250 MB) is slow on phones. A model change would not help most users.
- Option (2) for everyone would weaken the app's core promise (spec §6.1: honest checking).

## Recommended (and implemented)

1. **Matcher tolerance for recognition artefacts** (all users, strict mode too; test-first):
   - split/merge: one source word may be said as two spoken words, or two source words as one, when the
     concatenation is *exactly* the same word (ignoring diacritics / spelling of the same sound). Exact only, so a
     short extra word glued to a neighbour is still an extra word.
   - Polish sound keys: `ó`→`u`, `rz`→`ż`, `ch`→`h` before diacritics are removed; equal keys are a `near` match
     at any length. Polish only (in English `ch`/`h` are different sounds).
2. **"Gentle" becomes genuinely gentle** (option 2, opt-in): 85 % of the words instead of 95 % (a different word
   still counts as missing; extra words are still rejected). In a 7–19-word sentence one word may be lost.
3. **Discoverable**: after two failed tries on a sentence that was nearly right (no extra word, ≥ 75 % said), the
   Guardian offers "Check more gently" — one tap switches to Gentle.
4. Copy updated (Settings, "How do we check?"), DECISIONS, CHANGELOG.

Not now: Whisper `small` as an optional offline model; biasing Web Speech with the expected sentence (Chrome's
contextual-biasing API is new and on-device only).
