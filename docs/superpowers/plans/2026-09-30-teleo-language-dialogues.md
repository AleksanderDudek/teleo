# Language dialogues — plan

**Status (2026-09-30): implemented** on branch `language-dialogues` — DECISIONS #101–#108.

Owner request (2026-09-30, translated): language sessions as an exchange of sentences. The language model must
change with the language being learnt. It works like this:
- a chat on screen, like Messenger;
- the BOT speaks first; the user sees what the bot says in the language being learnt and, under it, what it means
  in the user's language;
- then the user reads aloud what they see in the language being learnt (under it: the pronunciation written in the
  user's language, and lower still the meaning in the user's language);
- every word of the foreign sentence is highlighted in colour together with its counterpart in the translation
  (mainly the subject and the predicate, plus adjectives).
"Analyse the current system, use best practices, pick recommended, plan it and finish on your own."

## Analysis

- **No backend, no API keys, no paid services** (spec §0/5, CLAUDE.md). A generative LLM partner is therefore out;
  the conversation is a *script* shipped with the app. That is also what the request describes: the user reads a
  line they are shown, so the lines are known in advance.
- **"The language model must change"** maps onto what the app does own: the speech recogniser listens in the
  language being learnt (Web Speech `lang`, Whisper's forced language), the matcher normalises in that language
  (English contractions, Polish sound keys), and the bot speaks with a speechSynthesis voice of that language.
  All three already take a `Lang`; the dialogue player passes the *target* language instead of the UI language.
- **One language at a time (#92)**: the interface language is the user's language. With PL and EN the language
  being learnt is simply the other one — Polish users learn English, English users learn Polish. The content model
  keys every text by language so a third language only needs content (and matcher support).
- **Bible pattern (#85)** fits exactly: a reading is materialised as a hidden text and played as an ordinary run, so
  the matcher, coverage ladder, XP, streaks, daily goal and golden quarter-hour need no special case. A dialogue
  becomes a hidden text (`source: 'dialogue'`) whose segments are *the user's lines*; the bot's lines are
  presentation only (they are not attempts).
- **Player**: `SessionPlayer` is built around one big sentence. The chat needs its own screen, but reuses every
  engine piece: `useSpeechEngine(target)`, `useLiveSession` (continuous Web Speech, real-time acceptance),
  `useTapCapture` (Whisper / hands-free off), `evaluate` + `coverageNeeded`, `recordAttempt` / `skipEntry` /
  `finishRun` / `pauseRun`, `speak`/`stopSpeaking`, chime, feedback card (`DiffView`, `resultMessage`).
- **Resume / again** paths all navigate to `/play/:runId`; that route dispatches to the chat player when the run's
  text is a dialogue, so Today's resume, the summary's "again" and deep links keep working with no new route logic.

## Decisions (recommended)

1. **Scripted bilingual dialogues** (A1–A2, everyday situations), shipped as data: `src/content/dialogues.json`.
   Each line: who speaks (`bot` / `you`), the text in every language, and for the user's lines a pronunciation
   respelling per language. One bilingual script serves both directions (PL→EN and EN→PL).
2. **Word links as inline markup**: `{word(s)|id}` with ids `s1` (subject), `v1` (predicate), `a1` (adjective),
   `o1` (object). A token may carry several ids (`{Jestem|v1,s1}`: Polish drops the subject into the verb ending).
   Pure parser `parseGloss` in `src/domain/dialogue/gloss.ts`; the plain text (what is matched and spoken) is the
   markup without braces. A content test checks every line: same id set in every language, plain text clean,
   pronunciation present, and the matcher accepts the line read exactly.
3. **Colours by grammatical role, lines by the Polish school convention**: subject — lapis, one line; predicate —
   crimson, double line; adjective — verdigris, wavy line; object — violet, dashed line (the underlines of the
   Polish *rozbiór logiczny zdania*, familiar to every Polish pupil, and a second, colour-independent cue). Each
   linked word has a soft tint of its role colour; tapping / hovering / focusing a word lights it and its
   counterpart(s) in the other line. A legend sits at the top of the chat. Target-language spans carry `lang`.
4. **Pronunciation in the reader's spelling**, stressed syllable in CAPITALS: English lines for Polish readers in
   Polish orthography (`th` = tongue between the teeth), Polish lines for English readers in English spelling
   (`zh` as in *measure*). A "How to read it" note on the dialogue list explains the conventions.
5. **Turn flow**: bot typing dots → bot bubble (target text, translation) read aloud by speechSynthesis in the
   target language with the microphone paused → the user's bubble (target text, pronunciation, translation) →
   listening (live mode with Web Speech when hands-free is on, tap otherwise — the player's rules) → accepted:
   the bubble is "sent" (check, +XP, chime) and the bot answers; rejected: the feedback card with the coverage
   ladder's next rung; skip after three failed tries. Trailing bot lines are spoken, then the summary opens.
   Every bubble has a replay button (the user's one: "hear it first", with the mic paused).
6. **Gamification unchanged**: user lines are segments (XP `5 + words`, first-try bonus, daily goal, streak,
   golden quarter-hour, `bilingual` achievement for free); a whole dialogue = a text repetition (+20 %) and a clean
   run = session bonus. **No per-text achievements** for dialogues (they would flood the gallery), like readings.
7. **Storage**: no schema change — `TextItem.source` gains `'dialogue'` (backup validator accepts it; older app
   versions reject such a backup, the same trade-off as `'bible'`). Starting a dialogue creates/reuses
   `dialogue:<key>`; when a later app version changes its lines, the old segments are archived (#55) and new ones
   added, so unfinished runs still resume.
8. **Where it lives**: a Library card (like the Bible) → `/dialogues` (list; lights the Library tab) → start →
   `/play/:runId` (chat). The summary offers **"Next conversation"**.

## Phases (commit each)

1. Domain: `gloss.ts` (parser), `dialogue/types.ts`, `dialogue/turns.ts` (script ↔ run cursor), `learningLang`;
   unit tests first.
2. Content: eight bilingual dialogues + content validation test.
3. Storage/services: `source: 'dialogue'` (types, visibility, backup, practice), `services/dialogues.ts` (+ tests).
4. UI: role tokens (CSS), `GlossText`, dialogue list, chat player, route dispatch, Library card, tabs, summary
   "next conversation", i18n PL/EN, icons.
5. Verify (typecheck, lint, unit, e2e), docs (DECISIONS, CHANGELOG, README, CLAUDE.md).
