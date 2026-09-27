# Bible challenge, golden quarter-hour, leaderboard, sharing, support — plan

**Status (2026-09-27): implemented** on branch `bible-challenge` — see docs/DECISIONS.md #75–#88.

Owner request (2026-09-27): support link like gym-training-tracker, day/week/month leaderboard, gamified
reading of the whole Bible aloud in ~1-minute readings that always end on a finished sentence, a point
multiplier that promotes 5–15 minutes of reading a day, sharing the day's result to social media, more
gratification (visual + sound) for each finished sentence, and a clearer view of the already-said part of the
sentence. "Pick recommended", finish autonomously.

## Product decisions (recommended options)

1. **Golden quarter-hour** (all content). Segment XP ×2 while today's reading time is between 5 and 15 min;
   ×1 before 5 min and after 15 (no penalty — spec §9.1). Reading time is *estimated from accepted words*
   (EN 140, PL 110 words/min), so it is deterministic, the same in live and tap mode, and cannot be padded
   by pauses. Stacks with the streak multiplier. Today shows a 0–5–15 track; the player shows a "×2"
   badge while it applies; new achievements for days that reached 15 minutes.
2. **Bible challenge.** Whole Bible read aloud, sentence by sentence, through the existing matcher and
   practice transaction (XP, streaks, goal, golden quarter-hour all apply).
   - Texts: **KJV Pure Cambridge Edition** (EN) and **Biblia Gdańska 1881** (PL), both public domain
     (spec §13). Source: scrollmapper/bible_databases; normalised by `scripts/build-bible.mts` into
     `public/bible/<translation>/<book>.json` (loaded on demand, runtime-cached for offline) + `index.json`.
   - **Readings of ~1 minute** (the free-edition length; a constant): verses stream through a book;
     a reading closes at the first sentence end after the words of one minute; a chapter end closes it
     early once it has ≥ 60 % of a minute; a book's short tail joins the previous reading; a runaway
     sentence (> 2.5 min) may close at a `;`/`:`. The plan is computed at build time from one tested pure
     function and shipped as data, so reading ids are stable.
   - ≈ 5,600 readings per translation ≈ **the whole Bible in a year at 15 minutes a day** — the headline.
   - A reading is materialised on start as a hidden text (`source: 'bible'`) with its sentences as
     segments (long ones split at `;`/`:`/`,` like spec §7.2), then played as an ad-hoc run. Per-text
     achievements are not evaluated for Bible readings (they would flood the gallery).
   - A reading counts as read when its run ends with every sentence said or skipped (skip needs three
     failed tries; names trip the recogniser). Stored in a new `bibleReadings` table.
   - Global achievements: readings 1/7/30/100/365/1000, books 1/10/39/66, whole Bible.
   - Screens: `/bible` (translation, overall progress, next reading, books by testament) and
     `/bible/:translation/:book` (readings with verse ranges). Entry points: Today card (for users who chose
     prayers or both, or who already started), Library header link.
3. **Leaderboard** (Progress screen). Points = XP, split **day / week (Mon–Sun) / month**. No server exists and
   religious-practice data is GDPR art. 9 special-category data, so there is no global board. Instead:
   - personal board: current period vs your best periods, your rank among your own periods;
   - **friends board via links**: "Challenge a friend" shares a link carrying your name, character and
     current day/week/month points; opening it adds/updates that friend locally (new `friends` table). No
     accounts, nothing leaves the device unless the user shares.
4. **Share the day** (Today + Summary): a 1080×1080 card drawn on canvas in the gilded style (character,
   minutes, sentences, streak, points, Bible %), shared through the system sheet with the image; fallback:
   copy text, X / Facebook / WhatsApp links, download image; a preview of the exact text before sending.
5. **Support**: `https://buycoffee.to/uriel` (same as gym-training-tracker). The Guardian's "word for today"
   (a practice tip that changes daily) then a coffee button. Never during a session, never blocking, once
   per screen: session summary and Settings.
6. **Gratification**: synthesized gold chime per accepted sentence (Web Audio, no files; richer chord for a
   finished text / goal / level), gold sparks from the sentence, floating "+XP", a combo pill for first-try
   chains, header progress glow. Heard words in live mode get a gilded marker; unheard stay muted, plus a
   thin coverage bar under the sentence. Settings: "Sound effects" switch. Reduced motion respected.

## Data changes

- `DailyStats.readingMs` (estimated, optional on old rows), `TextItem.source` + `'bible'`, `TextItem.bible`
  metadata (translation, book, reading index, readings in book).
- `AppSettings.sounds` (default true), `AppSettings.displayName` (default: character name).
- Dexie v2: `bibleReadings` (key readingId), `friends` (key id). Backups: new tables optional on import.

## Phases (one commit each, tests first for domain rules)

1. Golden quarter-hour: pace + multiplier (domain), practice integration, Today track, player badge.
2. Gratification: sound, sparks, XP float, combo, heard-words marker, settings switch.
3. Support + share card.
4. Leaderboard: period aggregation, friend link codec (domain), friends table, Progress section, `/friend` route.
5. Bible: build script + data, readings/segments (domain), bible service, screens, achievements, Today card.
6. Verify (unit, e2e in 4 browsers, screenshots), docs (DECISIONS, CHANGELOG, README, privacy page).
