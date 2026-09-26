# Changelog

All notable changes to Teleo. Dates are in the Europe/Warsaw timezone.

## Unreleased — redesign "the gilded icon"

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
