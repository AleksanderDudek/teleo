# Changelog

All notable changes to Teleo. Dates are in the Europe/Warsaw timezone.

## Unreleased

### Support, sharing and a native-feeling shell

- A thin support ribbon at the top of every screen outside a session, and a full-width stained-glass window with the
  Guardian and a “Buy a coffee” button at the end of each screen and after every session.
- After a session: share your result (the session’s picture card and post) right under the numbers; the next step sits
  in a bar within thumb reach.
- Navigation like a native app: a sticky bar with the back button and the screen title, tab bar that lights the right
  tab (the Bible under Library) and scrolls to the top when tapped again, editing forms without the tab bar, smooth
  screen transitions, a loading line, bottom-sheet dialogs on phones.
- “Install Teleo” in Settings (and the steps for iPhone and iPad).

### One language at a time

- No language question at the start: Teleo follows the browser's language, and Settings can change it.
- Each language has its own prayers, texts, sessions and Bible: in Polish no English texts appear (and vice versa).
  Language filters and PL/EN labels are gone from the library, editor, microphone test and Bible screen.

### Polish recognition

- Words the recogniser writes together or apart (“w niebie” → “wniebie”, “niekształtowna” → “nie kształtowna”) and
  the same sound spelled differently (“Bóg” → “bug”, “morze” → “może”) now count as said.

### Checking that gets gentler with each try

- A sentence needs 90% of its words on the first try, 80% on the second and 70% from the third on; each new sentence
  starts at 90% again. After a failed try the card says what the next one needs.
- A word heard as a different one only counts as not said; a word added to the text still fails the try.
- Replaces the Strict/Gentle setting: one rule for everyone.

### The Bible challenge, golden quarter-hour, leaderboard

- **Bible challenge:** read the whole Bible aloud (KJV or Biblia Gdańska, public domain), sentence by sentence, in
  readings of about one minute that always end on a finished sentence — about a year at 15 minutes a day. Progress by
  book and testament, "Read next", Bible achievements, available offline once a book is loaded.
- **Golden quarter-hour:** every sentence counts double between 5 and 15 minutes of reading a day; a track on Today, a
  ×2 badge in the player, achievements for golden days.
- **More joy per sentence:** a gold chime that climbs with each sentence in a row, sparks, the XP earned, combos; a
  "Sound effects" switch. Heard words in live mode are clearly marked in gold.
- **Leaderboard:** points by day, week and month against your own best, and against friends who share their card by link
  (no accounts, no server).
- **Share your day:** a gilded picture card with your figure and numbers, shared through the system sheet or social links.
- **Support the author:** a coffee link (buycoffee.to) on the summary and in Settings, after the Guardian's word for today.

### Redesign "the gilded icon"

- New visual language from the *Teleo Design System*: vellum, lapis and gold leaf drawn from Byzantine icons and
  stained glass; dark theme "Vigil" with a faint star field; Alegreya SC inscriptions; halo, icon-frame, arch and
  gilt-rule motifs.
- Phosphor Duotone icons (gilded fill under an ink outline) and 20 custom Teleo Glyphs replace lucide-react.
- The Guardian, a guiding angel, greets you on Today, encourages you after a slip, and appears in dialogs, empty
  states, onboarding and the summary. Choose your own character (four women, four men); it becomes your avatar.
- Onboarding in five steps; the summary and the garden sit in stained-glass windows.
- Fix: padding given to a card is no longer overridden by the card's default.
- New screenshots for the install sheet and README.

## 1.1.1 — 2026-09-26

- End-to-end suite also runs in WebKit (iPhone) and Firefox; CI installs all three engines.
- Firefox without Web Speech: the player explains it and links to the offline Whisper engine.
- Leaving a session asks "pause?" only once it has progress.
- Licence: all rights reserved (LICENSE). Published at https://aleksanderdudek.github.io/teleo/.

## 1.1.0 — 2026-09-25

Spec stage 8 (v1.1) plus the owner's live-listening request.

- **Live listening** (default hands-free mode): one continuous recognition per session; each sentence is
  checked in real time, heard words ink in, a completed sentence gets a non-blocking "Great!", repeated
  items show a counter; restart detection, recogniser restarts/revisions handled.
- **Offline Whisper engine** (whisper-tiny / whisper-base, q8) in a Web Worker with WebGPU or WebAssembly;
  downloaded only on request, self-hosted runtime, works fully offline and in Firefox.
- **Memory mode**: first letters → every other word → hidden text, words reveal as they are said; the
  hidden level earns "By Heart".
- **Listen first**: sentences read aloud with speechSynthesis, microphone paused meanwhile.
- Manifest screenshots, offline notice for cloud recognition, final-review fixes (see DECISIONS #45–#63).

## 1.0.0 — 2026-09-25

Spec stages 0–7 (MVP).

- Library of builtin public-domain prayers (PL/EN) and original affirmations, own texts with automatic
  sentence/line segmentation and manual split/merge/edit.
- Sessions of 1–150 sentences with repetitions, drag-and-drop builder, resume the same day.
- Speech comparison engine (≥ 95 % coverage, zero extra words, tolerant to recognition slips) and the
  Web Speech engine with on-device preference.
- Session player (tap mode), summary, XP, 20 levels + circles, 49 achievements (per text automatically),
  streaks with freezes, daily goal, Today dashboard, Progress (garden, heatmap, first-try trend).
- Onboarding, settings, JSON backup/import, .ics reminders, privacy policy, PWA (installable, offline).
