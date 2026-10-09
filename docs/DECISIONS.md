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

## Offline Whisper engine (stage 8a, spec §5.3)

56. **Models `onnx-community/whisper-tiny` and `onnx-community/whisper-base`, dtype `q8`** (`encoder_model_quantized.onnx`,
    `decoder_model_merged_quantized.onnx` + 5 JSON files: ≈ 44 MB / ≈ 80 MB, checked with the Hub API). — The smallest complete
    set: `q4`/`bnb4` decoders keep fp32 token embeddings (87 MB / 124 MB) and fp32 is 2.5× bigger without a measurable gain on
    Polish test sentences; on single-threaded WebAssembly a q4 encoder was ~12 % slower than q8. Sizes shown to users include
    the 27 MB runtime (tiny ≈ 70 MB, base ≈ 107 MB).
57. **WebGPU when the device has an adapter, WebAssembly otherwise.** The same q8 files run on both (onnxruntime runs the int8
    ops it lacks on the GPU on the CPU); measured on an Apple-silicon Mac, whisper-base: ≈ 2.2 s per utterance on WebGPU,
    ≈ 2.7 s on WebAssembly. Any WebGPU failure (session or inference) moves the worker to WebAssembly for the session.
    WebAssembly is single-threaded (GitHub Pages cannot send COOP/COEP, so no SharedArrayBuffer); Safari < 26 gets the plain
    (non-asyncify) build, as transformers.js does.
58. **Self-hosted onnxruntime-web runtime under `ort/<version>/`.** A Vite plugin copies the needed files from
    `node_modules/onnxruntime-web/dist` (and serves them from there in dev). The worker reads the binary from Cache Storage and
    passes it as `env.wasm.wasmBinary`, using the loader bundled in `onnxruntime-web/webgpu`: no CDN (the production CSP allows
    'self' scripts only) and no `blob:` imports (`env.useWasmCache = false`). onnxruntime's own
    `new URL('ort-wasm-….wasm', import.meta.url)` references are marked `@vite-ignore`, or Vite would emit a second 27 MB copy.
59. **Cache policy.** Model files live in transformers.js' Cache Storage bucket (`transformers-cache`, keyed by Hub URL) and
    are written only by the explicit download in Settings. At any other time the worker's `env.fetch` answers locally with 404,
    so loading a model never touches the network and a missing file surfaces as `model-missing`. The runtime is stored in
    `teleo-ort` by the same download (the versioned path makes cache-first safe; older versions are pruned) and is also covered
    by a Workbox runtime `CacheFirst` route for `/teleo/ort/`; it is never precached (`globIgnores`). The ~550 kB worker chunk
    is precached (`maximumFileSizeToCacheInBytes` = 3 MiB), so Whisper works offline once downloaded. "Downloaded" means every
    model file and the current runtime are cached — after an onnxruntime upgrade Settings offers a (runtime-only) download
    again rather than fetching 27 MB unasked. Persistent storage is requested with the download; deleting the last model also
    deletes the runtime.
60. **Capture and silence.** `getUserMedia` (mono, echo cancellation, noise suppression) → `MediaRecorder` (one Blob) plus an
    `AnalyserNode` read every 50 ms. A frame is speech when its RMS is ≥ 3× the noise floor (the quietest frame of the last
    5 s) and ≥ 0.008, for at least 150 ms (a tap on the phone is not speech; a steady hum is noise). The utterance ends 1.5 s
    after the last speech, after 8 s without any speech, or at 60 s. The recording is decoded and resampled to 16 kHz mono with
    OfflineAudioContext (pure-JS fallback). The microphone stays open 8 s after an utterance so hands-free continues without a
    new prompt or delay; leaving the screen or hiding the app closes it at once.
61. **Whisper never transcribes silence.** The decoded recording is checked for speech again; without speech the result is
    empty (Whisper invents "Napisy stworzone przez społeczność Amara.org" or loops on silence). Output is capped at
    16 tokens/s + 24 (≤ 440), recordings over 30 s are chunked (30 s windows, 5 s stride), and `[…]` tags and subtitle credits
    are removed from the text.
62. **Engine resolution.** `auto`: Web Speech when the browser has it (live mode), otherwise Whisper if its model is downloaded;
    `whisper`: only with a downloaded model (the UI shows `model-missing` with a link to the speech settings); `webspeech`: only
    Web Speech. Whisper uses tap mode with the hands-free auto-listen fallback; its `stop()` takes seconds and may reject, and
    `useTapCapture` drops a result that arrives after `cancel()` (a skipped sentence must not get a late verdict).
63. **Privacy notice.** When recognition runs on the device (Whisper, or on-device Web Speech) the first-use dialog says the
    audio stays on the device instead of naming the browser vendor.

## Bilingual content library (owner request, 2026-09-26)

64. **Builtin visibility no longer depends on the interface language** (supersedes #25's language gate): both PL and EN
    builtin texts/sessions show together, filtered only by content focus (prayers/affirmations/both/own). The interface
    language still picks the default *pinned* quick-start session (`defaultPinnedSessionKey`) and drives speech
    recognition for texts without a per-segment language override; each text keeps recognising in its own `lang`
    regardless of the UI language. This is how "missing translation → falls back to English" works in practice: a
    builtin only seeded in English (no PL counterpart) simply appears in English for every user instead of being hidden.
65. **New builtin content**: `en.psalm-91` (KJV, public domain) and `en.verses-of-strength` (13 KJV verses on courage and
    strength, incl. Philippians 4:13 "through Christ which strengtheneth me") ship English-only — no Polish translation is
    attempted for Scripture, to avoid misquoting a specific Bible translation from memory. `en.through-christ` /
    `pl.przez-jezusa-chrystusa` are original "I am" identity affirmations framed as "Through Jesus Christ, I am …" (not a
    verbatim copy of any source), written directly in both languages since they carry no translation-accuracy risk; the
    Polish set follows the existing masculine/feminine/neutral variant pattern (#26), rephrasing with God/Jesus as the
    grammatical subject for the neutral form where a plain adjective would force a gender.
66. **The auto-generated "session of the day" stays in the interface language** even though both languages are now
    visible in the library: `dailyItems` filters candidates by `text.lang === uiLang` so one run never switches the
    speech recogniser's language sentence to sentence. Manually built sessions/texts (library, "say now", custom
    templates) are unaffected and can mix or pick the other language freely.


## Redesign "the gilded icon" (Claude Design project *Teleo Design System*, 2026-09-26)

67. **The design system leads the visual language** (tokens, type, icons, motifs, the illustrated cast), the spec keeps
    leading behaviour. The spec's "calm palette (warm white / deep green / gold)" (§11) is superseded by the design's
    palette drawn from the devotional imagery: vellum/umber, lapis for actions, gold leaf for the sacred and the earned,
    cinnabar for the live voice and errors, verdigris for growth, azure for a streak freeze; dark theme "Vigil" (night
    lapis, gold becomes the action colour). The previous palette is kept in the design project's `guidelines/legacy/`.
68. **Phosphor Duotone is generated, not shipped as a font or a React package.** `npm run icons:phosphor` extracts the
    duotone paths of the icons Teleo uses from `@phosphor-icons/core` (MIT, devDependency) into
    `src/components/icons/phosphor.ts`; `<Icon>` renders them and the 20 custom Teleo Glyphs through the same two layers
    (gilded fill + ink outline). Versus the design's icon font: no font-display flash, no whole-font precache, icon names
    are type-checked. Versus `@phosphor-icons/react`: that package carries all six weights per icon (~5× the bytes).
    `lucide-react` is removed.
69. **The devotional photographs of the design (`assets/imagery/`) are not shipped.** Their provenance and licence are
    unverified, and spec §13 allows only public-domain or own content. `ArchFrame` supports an image; the windows hold the
    Guardian and the garden instead, which the design also shows.
70. **The illustrated cast is drawn in code** (`components/brand/Figure.tsx`): fixed pigments, no bitmaps, no network.
    The user's figure is a new preference `AppSettings.character` (default `anna`); backups without it still import
    (validator treats it as optional), an unknown value is rejected.
71. **The Guardian's voice** (first person, warm, never scolding) is limited to: the Today greeting line, the
    encouragement after a rejected attempt (`guardianLine`: extra / different / missing word, or the way out after three
    failures — the precise reason stays in the feedback card below), dialogs about pausing and "How do we check?", empty
    states and onboarding. Nothing is said for an empty recognition — the card's "I didn't hear anything" already is.
72. **Onboarding follows the design's five steps** (welcome · character · what to practise · microphone · goal) but keeps
    what the spec requires and the design left out: the interface language (on the welcome step), the Polish grammatical
    form (on the practise step) and the recogniser's privacy notice before the first use of the microphone (§5.2, on the
    microphone step). The character picker is a radio group (single choice), not the design's pressed buttons.
73. **Accessibility over literal fidelity where they conflict.** The microphone's inner gold hairline is a span, not an
    `outline` (which would have hidden the focus ring); the stop icon on the cinnabar disc uses the paper colour (the
    design's fixed ivory failed 3:1 on the dark theme's lighter cinnabar). Figures are `role="img"` with a name, or
    hidden when the name is already written next to them.
74. **`<Card>`'s default padding lives in the components layer** (`.card-pad`), so a padding utility passed by a screen
    wins. Before, `cn` joined `p-5` and e.g. `p-0` without merging and the CSS order silently kept `p-5`.

## Bible challenge, golden quarter-hour, leaderboard, sharing (owner request, 2026-09-27)

75. **Golden quarter-hour** (all content): sentences said while today's reading time is between 5 and 15 minutes earn
    ×2 XP, stacked on the streak multiplier; before and after it XP is plain (no penalty, spec §9.1). It promotes a daily
    5–15 minute habit without punishing short or long days. Achievements for days with ≥ 15 minutes (1/7/30/100/365).
76. **Reading time is an estimate from accepted words** (EN 140, PL 110 words/min; `domain/reading/pace.ts`), stored as
    `DailyStats.readingMs` (optional for old rows and backups). Recogniser durations differ between live and tap mode and
    engines, and pauses would pad them; words said cannot be padded. The same pace sizes Bible readings.
77. **Gratification per sentence**: a synthesized Web Audio chime (no audio files) that climbs a pentatonic scale with
    first-try sentences in a row (pentatonic: consecutive notes never clash), a fuller chord for a finished text, goal or
    level; gold sparks; the XP just earned; a combo pill from 3 in a row. "Sound effects" switch, on by default; audio is
    unlocked by the microphone tap and never plays while the page is hidden. The chime is soft on purpose: in live mode the
    microphone is open (echo cancellation and the recogniser ignore short tones in practice).
78. **Heard words in live mode** get a gilded marker (gold-soft background, gold underline, joined across spaces) plus a
    coverage bar; unheard words keep ≥ 3:1 contrast (large text). The marker and bar live outside the sentence's text
    node so its text stays exactly the sentence (e2e fake speech reads it).
79. **Sharing** follows gym-training-tracker: system share sheet with a 1080×1080 card drawn on canvas (square fits every
    feed uncropped), else copy + X/Facebook/WhatsApp links + download, and a preview of the exact text first. Polish posts
    use nominal phrasing or plurals keyed on the sentence count, so no gendered verbs are needed. The card uses the user's
    figure (fixed pigments serialise cleanly into an image).
80. **Support link** `https://buycoffee.to/uriel` (same as gym-training-tracker), with the same rules: never during a
    session, never blocking, once per screen — the session summary (without a second Guardian) and Settings. The Guardian
    offers a practice tip that changes daily first, so the block is worth reading on its own.
81. **No global leaderboard.** There is no server (project principle), and religious practice is GDPR art. 9 special-
    category data; a global board would need accounts and a processor. Instead: a **personal board** (current day/week/
    month vs your own periods; weeks Monday–Sunday) and a **friends board built from links**: a challenge link carries a
    small versioned card (name, figure, streak, current day/week/month points, a random per-install id); opening it adds or
    updates that friend on this device only. Cards are strictly validated (size, keys, ranges); your own and older cards
    are ignored; a friend's card from an earlier period counts as 0. `/friend` is reachable before onboarding.
82. **Bible texts**: KJV Pure Cambridge Edition (EN) and Biblia Gdańska 1881 (PL), both public domain (spec §13), from
    scrollmapper/bible_databases. Not the "KJV" module there (GPL because of its Strong's markup); the four verses empty in
    the PCE file are filled with the same public-domain words from the 1769 KJV file. Modern Polish Catholic translations
    are copyrighted, so Gdańska is the public-domain choice. All-caps chapter openings ("IN the beginning") are normalised;
    divine names printed in capitals (LORD, GOD) are kept.
83. **Readings of about one minute that always end on a finished sentence** (the "free edition" length; one constant, so a
    longer paid length could be added without changing ids): the planner closes at the first sentence end after a minute
    of words, at a chapter end once 60 % of a minute is read, at a `;`/`:` after 2.5 minutes, at any verse end after 4, and
    folds a short book tail into the previous reading. It runs at build time (`npm run bible`) and the plan ships as data,
    so reading ids (`<translation>.<BOOK>.<index>`) are stable. Result: ≈ 5,000 readings per translation, median ≈ 1.1 min
    ≈ the whole Bible in about a year at 15 minutes a day.
84. **Bible files are fetched on demand and runtime-cached** (stale-while-revalidate, `teleo-bible` cache), never
    precached: ≈ 9 MB in all. A book read once works offline.
85. **A reading is materialised as a hidden text** (`source: 'bible'`, sentences as segments, long ones split like spec
    §7.2) when started, and played as an ordinary run, so the matcher, XP, streaks, goal and golden quarter-hour need no
    special case. Hidden from the library, pickers and the session of the day (`isListedText`). Per-text achievements are
    not evaluated for readings (they would add ~13 rules × 5,000 texts to the gallery).
86. **A reading counts when every sentence was said or skipped** (skipping needs three failed tries; unusual names can
    defeat a recogniser), stored once in `bibleReadings`; XP comes only from sentences said, and a run with a skip gets no
    session bonus. Books count in whichever translation they were finished; testaments and the whole Bible follow from
    books. The next reading continues after the last one finished, wrapping round to any left behind.
87. **Where the challenge appears**: its own screen `/bible` (reached from Library and Today) instead of a sixth tab. The
    Today card shows for users who chose prayers (or both) in onboarding, or who already started — worldview neutrality
    (spec §1) for users who chose affirmations only.
88. **Storage v2**: Dexie version 2 adds `bibleReadings` and `friends` (new tables only, no data migration). Backups list
    them as optional tables: older backups still import (read as empty), and older app versions ignore the extra keys.

## Polish recognition: words said but not counted (owner report, 2026-09-27)

89. **The matcher, not the model, is the lever.** In Chrome/Edge/Safari the Web Speech engine is the vendor's cloud
    model — the strongest free Polish recogniser, which the app cannot replace; the in-browser Whisper tiny/base are
    weaker in Polish and `small` (~250 MB) is too slow on phones. Lowering the pass mark for everyone would break the
    honest-checking promise (spec §6.1). The failures come from systematic recogniser artefacts, so those are forgiven:
    - **split / merged words** — one source word said as two spoken words, or two as one (`niekształtowna` →
      `nie kształtowna`, `w niebie` → `wniebie`), accepted when the pieces make up *exactly* that word (ignoring only
      diacritics and spellings of one sound), so a short extra word glued to a neighbour is still an extra word;
    - **Polish sound keys** — `ó`=`u`, `rz`=`ż`, `ch`=`h` (`Bóg`/`bug`, `morze`/`może`) count as a near match at any
      word length; Polish only (in English `ch` and `h` differ). Compared next to the diacritic-free form, never
      instead of it (`wiekow` must still match `wieków`).
    Both apply in strict mode, in tap and live mode and in live highlighting (one alignment for all).
90. **Gentle mode needs 85 % of the words** (was 95 % like strict; a different word still only counts as missing, extra
    words still fail). One word may be lost from 7 words up. Opt-in: the Guardian offers "Check more gently" after two
    failed tries on one sentence that were nearly right (nothing extra, ≥ 75 % of the words said).

## One language at a time (owner request, 2026-09-27)

91. **The language comes from the browser**, not an onboarding question: the first launch takes Polish when the
    browser prefers it, English otherwise (`detectUiLang`); Settings can change it later. The onboarding welcome step
    no longer shows a language picker.
92. **One language at a time** (supersedes #64): the interface language is also the language of the prayers and
    texts, the sessions, the Bible translation (KJV for English, Gdańska for Polish), the text editor and the
    microphone test. Other-language texts, sessions and Bible progress stay stored (and in backups) and come back
    when the language is switched. Listing rules live in `domain/text/visibility.ts` (a user session takes the
    language of its texts). Removed from the interface: the library's language chips, PL/EN labels on text cards,
    the language choice in the editor, the mic test and the Bible screen; the Polish grammatical form is shown only
    for Polish. On a language switch, if no session of the new language is pinned, its default one is pinned so Start
    offers something straight away. The language switch itself names each language in its own language
    ("Polski", "English") so everyone can find theirs.

## Coverage ladder (owner request, 2026-09-27)

93. **Each try of a sentence is gentler: 90 % → 80 % → 70 %** (supersedes spec §6.1's 95 %, the §6.4 strict/gentle
    modes and #90). The coverage a try needs follows the rejected tries on that sentence in this run
    (`run.entries[i].attempts`, so it survives pause/resume): 90 % on the first, 80 % on the second, 70 % on the third
    and every later one; each new sentence — and each repetition of it — starts at 90 % again. "At least" stays
    literal (`ceil`), so a sentence under 10 words needs every word on its first try and a 2–3-word one needs every
    word on every rung. `COVERAGE_LADDER` / `coverageNeeded` in `domain/matcher/evaluate.ts`; the live tracker takes the
    rung with its target, and the player re-sets the same sentence with the next rung after a rejection so the words
    already heard (a fresh start after a slip) are checked again at once. The skip-after-three-fails rule stays.
    The spec §6.6 cases keep their inputs; on the first try two words left out of 20 (90 %) now pass, three (85 %) fail.
94. **A misheard word is a word not said, on every rung** (the old gentle-mode rule for everyone): it lowers coverage but
    never rejects on its own — the recogniser often writes a word said differently. A word *added* to the text still
    fails the try (spec §6.1/2); so does a word glued to a neighbour. The Strict/Gentle setting and the Guardian's
    "Check more gently" offer are gone; Settings explains the ladder, the feedback card says what the next try needs,
    "How do we check?" describes it. Each attempt stores the coverage it needed (`Attempt.threshold`, replacing
    `strictness`, per spec §6.4's "stored with every attempt"); older rows and backups keep their `strictness` key
    and still import. The onboarding microphone check uses the last rung (70 %); the mic test the first (90 %).

## Support banners, session sharing, mobile shell (owner request, 2026-09-29)

95. **Support ribbon at the top** (supersedes #80's "summary and Settings only"): a thin (36 px) gilded band under the
    status bar, sticky, one tap to buycoffee.to, not dismissible (owner: "visible all the time"). It is on every screen
    outside a session — all tab screens, sub-screens, editing forms and the session summary — and never in the session
    player (a prayer in progress), onboarding or the friend-invitation page. No animation, one line.
96. **Support window at the bottom**: a full-width night-lapis stained-glass panel (fixed pigments, the same painted
    panel in both themes) with the Guardian, his word for today (kept from #80), one line about the free app and a gold
    "Buy a coffee" button. At the end of every tab screen and of the session summary; editing forms (text editor,
    session builder) leave it out. It replaces the Settings and summary support cards (one ask per screen); a second
    Guardian on the summary is accepted — the owner asked for the angel there.
97. **After a session: share the session**, not only the day — its title, sentences said, first-try rate, points and
    streak (plus the Bible share after a reading) as the same 1080×1080 card and a post (#79's rules: nominal Polish,
    preview first). It sits right under the numbers; "Share today" stays on Today. The next step (home / again / next
    reading) is a sticky thumb-zone bar: one main button and one round one, so it stays low on a phone.
98. **App bar, the large-title way**: `PageHeader` renders a compact bar that sticks under the ribbon — a 44 px back
    button on sub-screens (an installed app has no browser back button, iOS none at all) and the screen title, which
    fades in once the large title has scrolled under it. Back stays "up" navigation to a fixed parent (`backTo`), not
    history; the Bible now goes up to the library. `scroll-padding-top` keeps focused elements clear of the chrome.
99. **Tab bar behaviour**: a tab stays lit on its sub-screens, and the Bible lights Library (`app/tabs.ts`); tapping
    the current tab at its top level scrolls back to the top; editing forms hide the tab bar on phones (a focused task
    with its own save bar, which moves down to the thumb zone) via the route handle `{ form: true }`. Screen changes
    from the tab bar and back buttons cross-fade with the View Transitions API (ribbon and tab bar stay put; off with
    reduced motion, plain navigation where unsupported). A thin gold line shows while a lazy screen loads. After a
    screen change focus moves to the content unless the new screen placed it (screen readers start on the new screen).
100. **Platform polish**: dialogs are bottom sheets on phones (handle, safe-area padding, slide-up) and centred panels
    from `sm` up; cards answer a press on touch screens. **Install**: the browser's `beforeinstallprompt` is kept at
    startup (its mini-infobar suppressed) and offered as "Install Teleo" in Settings; on iPhone/iPad the two Share-menu
    steps are shown instead; nothing is shown inside the installed app or where installing is impossible. No manifest
    shortcuts: the manifest has one language and would show Polish names to English users (#91–92).


## Language dialogues (owner request, 2026-09-30)

*Superseded by #117 (2026-10-02): the feature moved to its own app, Fluentum.*

101. **Scripted bilingual dialogues; the other language is the one learnt.** No backend and no API keys (spec §0/5), so
    there is no generative partner: eight A1–A2 everyday conversations ship as data (`src/content/dialogues.json`),
    one bilingual script per conversation serving both directions. The interface language is the user's own (#92);
    the language learnt is the other one (`learningLang`) — Polish users learn English, English users learn Polish.
    "The language model follows the language being learnt" means: the recogniser (Web Speech `lang`, Whisper's forced
    language), the matcher's normalisation and the speechSynthesis voice all use the target language (so do the
    on-device check and the privacy notice). Every text is keyed by language, so a third language needs content (and
    matcher support), not a new model.
102. **Word links are inline markup with grammatical roles**, `{word|id}` with ids `s`/`v`/`a`/`o` = subject,
    predicate, adjective, object; a word may carry several ids (Polish puts the subject into the verb ending:
    `{Poproszę|v1,s1}`). Colours follow the role (lapis, crimson, verdigris, violet — tokens `--role-*`, ≥ 4.5:1 on
    the bubbles in both themes), with the underlines of Polish school sentence analysis (subject one line, predicate
    two, adjective wavy, object dashed) as a cue that does not depend on colour. Colour by role rather than one colour
    per pair: the same colours teach the grammar across sentences. Pairs show by pointing (hover with a mouse, tap on
    a touch screen) and in each bubble's word list, which is also the keyboard and screen-reader route, so the words
    themselves are not tab stops. "Adjective" includes predicative ones ("ready", "late"); nominal parts of predicates
    and adverbials stay unlinked. Polish user lines avoid gendered forms (no past tense, no adjectives about the
    speaker), so they fit everyone without the grammatical-form choice of #26.
103. **A dialogue is a hidden text** `dialogue:<target>:<key>` (`source: 'dialogue'`) of the user's lines in the target
    language, played as an ordinary run like a Bible reading (#85): matcher, coverage ladder, XP, streaks, goal, golden
    quarter-hour and first-try credit apply unchanged; the partner's lines come from the script and are not attempts.
    Never listed (`isHiddenText`) and no per-text achievements (a lesson, not a text one repeats; the gallery stays
    about prayers and affirmations). The whole dialogue said is a text repetition (+20 %), a clean run earns the
    session bonus, and English practice on a day of Polish prayers earns `bilingual`. A later script change is synced
    by `replaceSegments` (lines already spoken are archived, #55). Backups accept the new source; an older app version
    refuses such a backup, as with `'bible'`.
104. **One route for every run**: `/play/:runId` hands runs of a dialogue text to the chat player (its own lazy chunk),
    so Today's resume, the summary's "once more" and links need no new logic. After a dialogue the summary offers
    **"Next conversation"** (the next one not finished yet, wrapping round) with home as the round button — the Bible's
    "Next reading" pattern; the scripts load only on that tap.
105. **Turn flow**: the partner "types" (0.75 s of dots), shows the line with its meaning and says it (speechSynthesis
    in the target language, the voice picked as for listen first); only then does the user's bubble appear (line,
    pronunciation, meaning) and, with hands-free on, listening starts — live mode with Web Speech (one recognition per
    turn, stopped the moment the line is accepted), tap mode with Whisper or hands-free off. The microphone is always
    closed while a line is read aloud (the recogniser would accept the synthetic voice, #48). Without speechSynthesis
    the partner's line stays on screen for a reading pause (about three words a second, at least 1.5 s). "Listen
    first" reads the user's line before listening. Rejections, the coverage ladder, empty captures (#53) and
    skip-after-three behave as in the player; leaving pauses the run (resumable the same day) and returns to the list.
106. **Pronunciation is a respelling in the reader's own spelling**, the stressed syllable in capitals — the owner asked
    for "the pronunciation in the user's language", and IPA is unreadable for most learners. English lines for Polish
    readers use Polish orthography (`th` = tongue between the teeth, `ł` for w, `ii`/`uu` long vowels); Polish lines
    for English readers use English spelling (`zh`, `y`, `ee`, `oo`). Written by hand (rule-based respelling of English
    is unreliable) and shown on the current turn only, so the history stays compact; the list screen explains the
    conventions.
107. **Content rules**: numbers written as words (recognisers disagree on digits), US spelling in English user lines
    (the recogniser is en-US), no names the user must say, no cultural traps (floor numbering differs between the US
    and Poland). `dialogues.test.ts` checks the markup, the same link ids in both languages, pronunciations, icons and
    figures, and that the matcher accepts every user line as a recogniser writes it.
108. **Where it lives**: a Library card under the Bible (it lights the Library tab) opens `/dialogues` — title, the title
    in the target language, scene, level, the user's lines and how often it was finished. Not a sixth tab and not on
    Today, which stays as it was.

## Your data: backups that survive the browser (owner request, 2026-10-01)

109. **A "Your data" screen** (`/settings/data`, under the Settings tab) holds everything about the data: what is on this
    device (sentences said, active days, points, own texts), whether the browser protects the storage, backup,
    restore, undo and delete-all (moved here from Settings → Privacy). Settings keeps a short Backup section (last
    backup + link) and a link from Privacy; Today's 30-day reminder (spec §13) opens this screen. Backup was one
    section among many in Settings and storage protection sat under Privacy — the owner did not find them.
110. **Two-step export: create, then save or share.** "Create a backup" builds the file (all tables in one read and,
    with a password, the encryption); then "Download the file" and — where `canShare({ files })` says so — "Save to
    the cloud or send", the system share sheet that reaches Files, iCloud Drive, Google Drive, e-mail and messengers,
    i.e. somewhere the browser's storage cannot take with it. Each is a fresh tap: iOS refuses `navigator.share` after
    slow async work. On iPhone/iPad the share sheet is the main button (a download in an installed app may only open a
    preview). The backup counts as made (`lastBackupAt`) after a download or a completed share, not a cancelled one.
    Changing the password options discards the prepared file. No File System Access picker (desktop Chromium only).
111. **Optional password protection** (off by default): AES-256-GCM, key from PBKDF2-SHA-256 with 600,000 iterations
    (OWASP 2023), a random 16-byte salt and 12-byte nonce per file, Web Crypto only (no dependency, nothing sent). The
    password is NFC-normalised; the readable header (app, format, export date, app version) is bound to the ciphertext
    as additional authenticated data. A file's envelope is checked before any work: known algorithms, salt/nonce
    sizes, 1–10,000,000 iterations (a crafted file must not freeze the app). At least 8 characters, typed twice, with
    a plain warning that a lost password cannot be recovered. Reason: religious practice is special-category data
    (GDPR art. 9) and backups are meant to leave the device — into cloud drives and mailboxes.
112. **Restore shows what it will do**: a protected file asks for its password first (a wrong password and a modified
    file are the same GCM failure, reported as one message); then the file's date and app version and its contents
    next to this device's (sentences, active days, points, last active day, own texts, achievements, Bible readings),
    with a warning when the file ends earlier or holds less progress — the common mistake of restoring last month's
    file. Errors are worded per cause (not a Teleo file / damaged / from a newer version: update first / wrong
    password) instead of raw codes.
113. **A restore can be undone — by switching, never by discarding**: in the same transaction that replaces the data,
    the data it replaces is kept as the restore point (Dexie v3, new table `restorePoints`, one row, only when it holds
    any progress — a fresh install has nothing to keep). "Undo the restore" *exchanges* it with the data in place:
    whatever was done since the restore (days of practice) becomes the restore point in turn and is offered as "Back to
    the restored backup", so no switch loses anything (an undo that simply reinstated the old copy would silently drop
    weeks of later progress — found in review). A failed import writes nothing; a later import replaces the point;
    delete-all clears it; it is never exported (not in `ALL_TABLES`). Replace + switch instead of merging two
    histories: day aggregates, streaks, text repetitions and the XP ledger would double count.
114. **The file format stays schema 1**: plain backups gain an optional `appVersion` (shown before a restore; older
    versions ignore it). A protected file is the same header with `encrypted` instead of `data` — an older version
    reports it as damaged rather than misreading it. Protected files are named `…-protected.json`.
115. **Storage status**: whether the browser promised persistence (`navigator.storage.persisted()`), the space Teleo
    uses (`estimate()`, including the cached app, Bible books and speech models), and "Ask to protect the data" when it
    is not persisted — with the honest reason backups matter even when it is (a new phone, a cleared browser) and the
    Safari caveat (site data of a site not added to the Home Screen can be cleared after 7 days without a visit).
116. **Not done**: merging a backup into existing data (see #113); automatic backups to a chosen folder (File System
    Access, desktop Chromium only); opening backup files with Teleo (file handlers / share target, Chromium only). The
    backup reminder stays every 30 days (spec §13); the screen suggests a weekly habit.

## Language dialogues move to their own app (owner request, 2026-10-02)

117. **The language dialogues leave Teleo for a separate app, Fluentum.** Teleo stays about prayers, affirmations and
    memorising sentences; learning a language is another purpose with its own audience, and it grows better on its
    own. Everything of the feature is removed — the `/dialogues` screen and route, the Library card, the chat player
    and its dispatch in `/play/:runId`, the summary's "Next conversation", the scripts, the role colours and chat
    styles, their strings and the seven icons added for them. Hidden texts are Bible readings only again (never
    listed, no per-text achievements, #85). Supersedes #101–#108, which stay above as history.
118. **Schema v4 deletes what the dialogues left on the device; the progress earned with them stays.** The upgrade
    removes texts with `source: 'dialogue'`, their segments, text stats, per-text achievements and — unlike #28 —
    their session runs (nothing in Teleo can show them any more, and a run whose text is gone cannot be resumed, so
    Today must not offer it). Attempts, daily stats and the XP ledger are kept — points, daily goals and streak days
    are not taken back, the same rule as deleting a user text (#28), so attempts may name a text or run that is gone.
    Older backups still restore: the validator keeps accepting `source: 'dialogue'`, and the one path that writes a
    backup into the tables (`replaceAll`, used by import and by switching to a restore point) drops the same rows
    first — so neither an old file nor a restore point kept before the upgrade brings them back (such a point keeps
    them until it is used; its summary is unaffected, dialogue texts never counted as own texts). Which rows belong to
    retired dialogues is decided once, in `src/domain/backup/retired.ts` (pure, unit-tested), and used by both. The
    backup format stays schema 1.

## Daily tasks, session history, reminders, the support link by language (owner request, 2026-10-05)

119. **The support link follows the interface language.** The Polish interface links to buycoffee.to/uriel, the
    English one to buymeacoffee.com/atd_uriel (`src/components/support/links.ts`, used by the ribbon, the window and
    the privacy page). The interface language is detected from the browser at first start (Polish when preferred,
    English otherwise) and already decides which texts are listed — so a Polish speaker gets Polish texts and the
    Polish link, everybody else the English pair; Settings can change it, and the link follows.
120. **Daily tasks** (`tasks`, `taskLog`, schema v5): any text can be a task — said N times a day (1–10) for D days
    (1–365) from a start day. Counting is by full repetition: inside `recordAttempt`'s transaction a completed
    full-text block logs one row for every active task of that text covering the day, so any session counts, not
    only one started from Today's "Say it" (which runs the remaining repetitions and carries `taskId`). Progress is
    derived from the log per day, capped at the day's target, never stored. Deleting a user text deletes its tasks
    and their log (#28 extended). Not done on purpose: task points and achievements (the text's repetition rewards
    already pay; a bonus would pay twice) and per-task reminder hours (the fixed hours serve every task, the calendar
    event names each). Tasks are the user's own commitments, so they are listed whatever the interface
    language (unlike texts and sessions under the one-language rule) — the badge and the reminders count them the same
    way; the editor keeps a task's text in its picker even when the language no longer lists it. Changing a task's
    text empties its log (what was said was the old text).
121. **Session history** (`/progress/history`): every run on record, newest first and grouped by day — what it was
    about (its texts link to the library or the Bible, a task badge to the tasks) and what was done (lines said of
    all, skips, first-try rate, points, minutes until the end or the last activity), with sessions and minutes for
    the last 7 and 30 days and all time. A row is derived from the run row (`src/domain/session/history.ts`); nothing
    new is written, so every session since v1.0 is already there. Minutes are wall-clock from the start to the end or
    the last activity, so a run paused and resumed later counts its pause; a summary opened later shows that run's
    numbers but not today's level banner or the tasks' standing.
122. **Reminders without a server.** Web Push needs a push service and a backend to drive it (spec §0, §12), so:
    (a) fixed reminder hours — one to three, default 07:00 · 13:00 · 21:00 — replace the single `reminderTime`,
    which old settings rows and backups still provide (`appSettingsFrom`); (b) the calendar file holds one daily
    event per hour and one bounded event per current task (`RRULE:FREQ=DAILY;UNTIL=<last day>`, at the first hour)
    — the one reminder that always rings, on every platform; (c) device notifications, off by default and asking
    for permission: while the app is open a notification at each hour when nothing was said yet or a task is still
    due (`ReminderEffects`), the app icon's badge counts the task repetitions left today, and on Chrome Android with
    the app installed a periodic background sync lets the service worker check now and then and show one
    notification a day once an hour has passed. iOS has no periodic sync and only Web Push in the background, so the
    Settings copy says plainly what each platform does. The service worker is now our own file (`src/sw.ts`,
    vite-plugin-pwa `injectManifest`) with the precache, navigation fallback and runtime caches it had; it opens the
    database in Dexie's dynamic mode through `src/db/name.ts` (never the schema: it must never upgrade or create
    anything) and keeps the day it last notified in Cache Storage, so it writes nothing to the database. Notification
    copy lives in `src/domain/reminders/nudge.ts`, not in the i18n files — the worker carries no i18next.

## Long sentences in the player (owner request, 2026-10-06)

123. **A long sentence is finished before it is judged** (refines #40–#42). Bible segments run to 40 words (median 21 in
    the KJV), and two live-mode rules cut them short. (a) *Restart detection* fired on the sentence's first word alone once
    any word had been misheard, so the next "And" / "A" inside the verse rejected the try mid-sentence — on real verses
    with one misheard word, 56 % of KJV and 27 % of PBG segments. A restart now has to open with the sentence's first
    three words (fewer for a shorter sentence) and must not sit where the text repeats its own opening ("and to every
    beast…, and to every fowl…"); the same sweep finds no premature rejection left. Words before a clean start that hold
    nothing of the sentence (an "okay", a word to someone else) are dropped instead of costing a failed try (#53 in
    spirit). (b) *Every 1.5 s pause settled the sentence.* A short pause now settles it only when the speaker reached the
    end (fewer than two words left after the last one heard, or about as many words said as the sentence has) or what
    was said already passes; in the middle of a sentence the tracker answers `holding` and the player waits 2.5 s more
    (`MID_SENTENCE_HOLD_MS`) — any new word cancels the wait. It applies to every sentence: in memory mode recalling the
    next words is the same pause. Tap mode has no live transcript to tell, so its utterance silence grows with the
    sentence instead: 1.5 s up to 10 words, +60 ms per word, at most 3 s (`utteranceSilenceMs`, Web Speech and Whisper).
124. **The player is a fixed-viewport screen; the verdict is drawn on the sentence.** The page used to grow with the
    content under a `sticky` footer: after a failed try the sentence appeared twice (stage and diff card), the Guardian
    and the card landed under the controls, and phones with collapsing browser bars pushed the microphone below the
    fold. Now the player is a `100dvh` column — header, a scrolling middle, the controls — so the microphone never moves.
    The diff is drawn on the stage sentence (same colours, legend under it) until a word of the next try is heard; a
    compact strip docked above the microphone carries the message, the next rung and "How do we check?", plus the
    Guardian and his line where the screen is at least 740 px tall (`tall:` variant). Speech errors and the offline
    notice sit in the same dock. Sentences over 24 words are set one size step smaller (`.scripture-long`); a new
    sentence starts at the top of the middle, a verdict scrolls the sentence's first line into view, and while a long
    verse is read aloud the middle follows the words heard so nobody scrolls mid-sentence.

## Prayer library and filters by need (owner request, 2026-10-08)

Design: [superpowers/specs/2026-10-08-prayer-library-needs-design.md](superpowers/specs/2026-10-08-prayer-library-needs-design.md).

125. **Texts say what they are prayed for; the library filters by need.** A language-independent taxonomy of nine areas
    of life and 43 needs (`src/domain/text/needs.ts`); labels live in i18n (`needs.areas.*`, `needs.items.*`), so one
    classification serves both languages. A text row carries an optional `needs: string[]` — main need first, no index,
    no schema version (the library filters in memory, as before); every builtin has one to three needs and every need
    is used (content test). Ids the app does not know are ignored when read (`needsOf`), so backups accept any strings
    and a newer backup still restores. The library asks *What do you pray for?*: area chips with counts, then the needs
    of the chosen area; counts follow every other filter, and only areas/needs with something to show appear. A card
    names its main need; a text page lists its needs as links (`/library?need=…`). All library filters live in the URL
    (`src/domain/text/libraryFilter.ts`, replacing component state, updates replace the history entry), and a card
    passes that URL in the link state, so the back arrow returns to the same filtered list. The editor offers the
    same needs (optional, in the order chosen); a copy keeps them. Search covers titles, words and tags.
126. **The prayer library ships as two lazy chunks, in both languages.** 133 prayers of Prophet Lovy L. Elias
    (`src/content/prayers/en.json`, given; `pl.json`, translated sentence for sentence — same count and order, held by
    a test — with a fixed glossary and m/f/n forms where the speaker's gender shows, #26). Every text is tagged
    *Prophet Lovy L. Elias* / *prorok Lovy L. Elias* (shown on the text page, searchable); the per-sentence sermon
    trace is not shipped. These are the first builtins that are neither public domain nor written for the project — an
    exception to the content rule of spec §13 made at the owner's request, with texts the owner supplied. Bundling ~0.6 MB of JSON would double the start-up script for data read once per content
    version, so `loadBuiltinTexts()` imports them dynamically — only seeding and the grammatical form need them; the
    chunks are still precached, so the library works offline from the first launch. Gendered sentences are stored
    inline as `{m,f,n}` and expanded on load (`expandLibraryText`), half the size of three full lists. `SEED_VERSION` 3
    adds them visible under the content focus; a change of focus walks the seeded rows instead of the bundled list.
    **The app does not wait for the library:** start-up awaits `seedCore` (core texts + sessions, as before), and
    `seedLibraryInBackground` writes the ~7,000 library sentences 2 s later, 20 texts per transaction with 150 ms
    between them, the interface language first — written in one go they kept Firefox and WebKit from showing the first
    screen for seconds, and back-to-back chunks starved the screens' sequential queries. Each chunk reads the focus and
    grammatical form inside its transaction, so choices made in onboarding meanwhile apply; `applyGrammaticalForm`
    touches only texts that exist and change. The version is marked only when the whole library is in (an interrupted
    run starts over on the next launch). `<html data-library="loading|ready">` reports it; e2e tests wait for `ready`
    after onboarding instead of racing the writes. Seeding reads texts and segments once per transaction (no query per
    text), and `replaceSegments` writes only new or moved segments.

## Guided tour and mobile-first polish (owner request, 2026-10-08)

127. **After the setup, a guided tour the app performs** (after the one in the owner's *Your Events*). The setup wizard
    configures Teleo but never showed how to use it. Now Today invites once — *Shall I show you around?* — with
    *Show me* / *Not now* (a sheet on phones); a walkthrough nobody agreed to is the most skipped pattern, so it is an
    invitation, and declining counts as seen. The tour is a story, not captions: the screen is dimmed, one control is
    lit (`data-tour` attributes, so screens carry no tour logic), and the app walks — Start, the day's goal, the
    library opened on *peace of heart* through its URL (#125), the first prayer listed, *Say it now*, *From memory*,
    *Set as daily task*, the Sessions and Progress tabs, back to Start. The panel docks to the screen edge away from
    the lit control instead of floating beside it: on a 390 px phone a beside-the-control tooltip has nowhere to go,
    a sheet always has. Forward-only (steps navigate, with `replace`, so the back button does not walk the tour);
    Skip, the close button and Escape end it at any step; focus stays in the panel, the step count is announced,
    reduced motion drops the light's transition. Steps showing a text are left out up front when no visible text of
    the language has the need (e.g. *own texts* only); an anchor that never appears is skipped after ~3 s.
    `meta.tourVersion` holds the version taken or declined — per install, like the seed version; bumping
    `TOUR_VERSION` re-offers a redesigned tour. Settings → *Show me around* replays it. Script and rules are pure
    (`src/domain/tour/tour.ts`), the host and overlay live in `src/components/tour/`, mounted in the tab layout so the
    tour survives its own navigations. e2e tests decline the invitation in `finishOnboarding`; `tour.spec.ts` walks it.
128. **Mobile first, from a UX audit at 390 px in both languages and themes** (owner request: "easy to use and
    follow"). What changed, and why:
    - *Library* — with ~140 texts per language the alphabetical list buried the classic prayers (Ojcze nasz at #92).
      Unfiltered it now opens with **Start here** (own texts, texts said before, texts of visible sessions), then all
      texts; under a need, texts *mainly* for it come first (`needRank`). Type, source and hidden moved into a
      **Filters** sheet, the Bible became a compact link, so results start on the first screen. Chip rows scroll
      without scrollbars and fade at the edge; the result count is a `role="status"` instead of a live region
      around the whole list.
    - *Text page* — the text right under *Say it now / From memory / Set as daily task*; statistics and achievements
      fold into *Your progress with this text*; copy/edit, hide and delete live in a **More** sheet. "Hide text"
      became "Hide from the library" (next to "From memory" it read like hiding the words) and offers Undo.
    - *Today* — Start prefers an unfinished run, then **a task still due today**, then the session; day 0 shows no
      points bar or golden quarter-hour. *Progress* before the first session: the garden and one invitation.
      Tasks follow the interface language like texts (#92). Untouched runs are not history.
    - *Onboarding* — a PL/EN choice on the welcome step; the English mic phrase is "Good morning"; focus cards are a
      radio group with one lit choice; the goal step keeps presets only; "Skip setup".
    - *Everywhere* — 44 px touch targets (an invisible `::before` extension keeps small buttons' look); the interface
      says *sentence*, never *segment*; session cards keep Start and From memory, the rest in a More sheet; the
      support window appears on the five main screens only (not under a text, a reading or the Data screen).
    - Not changed on purpose: the sticky support strip (the owner's choice; making it scroll away touches the
      safe-area offsets of the app bar and needs a device check), Settings' engine control, the player layout.
    e2e guards: no main screen may be wider than the phone (`smoke.spec.ts`).

## One text's history (owner request, 2026-10-09)

129. **Every time a text was said, on its own page.** The session history (#119–#122) lists sessions; a person asked
    to see "each prayer" there. Rather than a second log, the history screen takes `?text=<id>`
    (`/progress/history?text=…`): only runs in which that text was *said* — at least one of its sentences answered
    or skipped, not merely planned (a rosary left after the Our Father does not count for the Hail Mary) — with the
    row's sentence counts and the totals limited to that text's sentences. The text page links to it (*History of
    this text*) under its folded progress. Pure rules in `src/domain/session/history.ts` (`saidText`,
    `runHistoryRow(run, textId)`), the filter in `useHistory`; nothing new is stored.
