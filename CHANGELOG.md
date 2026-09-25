# Changelog

All notable changes to Teleo. Dates are in the Europe/Warsaw timezone.

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
