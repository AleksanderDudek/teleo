# Teleo redesign ("the gilded icon") — implementation plan

**Status (2026-09-26): implemented** on branch `redesign` — see docs/DECISIONS.md #67–#74 and CHANGELOG.

**Goal:** re-skin the app to the Claude Design project *Teleo Design System*
(`claude.ai/design/p/75c6f65d-80ba-4c0d-9028-2f073eaeb778`), without changing behaviour.

**Source of the design (read through DesignSync):** `readme.md` (foundations, voice, characters,
iconography), `tokens/*.css`, `components/**` (React primitives), `ui_kits/mobile/*` (Today, Library,
Sessions, Player, Summary, Progress, Settings, Onboarding). The design was derived from this repo, so
most screens keep their structure; what changes is the visual language plus a few additions.

## What the design changes

- **Palette** "gilded icon": vellum/ivory/umber, lapis = action, gold leaf = sacred/earned, cinnabar =
  live voice + error, verdigris = growth, azure = freeze; gold heatmap ramp. Dark theme "Vigil": night
  lapis ground, gold becomes the action colour, faint star field.
- **Type:** Alegreya SC (700, lowercase → small caps, gold-ink) for rubrics/inscriptions.
- **Icons:** Phosphor Duotone (umber outline over a gold-leaf fill layer) + 20 custom Teleo Glyphs;
  replaces lucide-react.
- **Motifs:** halo (IconHalo, mic medallion, ProgressRing), icon frame (gilded inner rule on the one hero
  card per screen), arch/lancet windows (ArchFrame), gilt rule under page headers.
- **Cast:** the Guardian (guiding angel, 7 moods) speaks through GuideBubble on Today, after a failed
  attempt, in dialogs, empty states, onboarding and the summary. Eight user characters; the chosen one
  shows as an Avatar in the Today header.
- **Onboarding** becomes 5 steps: welcome · character · what to practise · mic test · daily goal.

## Rules

- `src/domain/**`, `src/db/**` schema, `src/services/**` logic untouched, except the new
  `AppSettings.character` preference (spread over defaults, so old rows and backups stay valid).
- UI strings only via i18n, identical key sets in `pl.json` / `en.json`.
- WCAG AA, 44 px targets, reduced motion, focus rings; fonts self-hosted; no CDN.
- Accessible names used by e2e tests stay stable unless the test changes with them.

## Decisions (logged in docs/DECISIONS.md)

1. Phosphor Duotone paths are **generated at dev time** from `@phosphor-icons/core` (devDependency)
   into one typed module, rendered by the same `<Icon>` as the Teleo Glyphs — not the design's icon
   font (FOIT, whole-font precache, no type-checked names) and not `@phosphor-icons/react` (ships all six
   weights per icon, ~5× the bytes).
2. The devotional photographs in the design's `assets/imagery/` are **not shipped**: provenance and
   licence are unverified (spec §13 allows public-domain or own content only). ArchFrames hold the
   Guardian / garden instead; the component supports an image for later.
3. Language choice and the Polish grammatical form stay in onboarding (spec §11), folded into the
   welcome and "what to practise" steps of the design's 5-step flow.

## Phases

1. **Foundation** — icon generator + `Icon`; tokens, fonts, component classes in `src/index.css`;
   PWA/splash colours.
2. **Primitives** — restyle `src/components/ui/*`; add IconHalo, ArchFrame, SearchField, IconButton
   variants.
3. **Brand & domain UI** — Figure/Character/Guardian/Avatar/GuideBubble, AchievementBadge, TextCard,
   MicButton, DiffView, SegmentStage, StatTile, LevelBar, AchievementRow, TabBar.
4. **Screens** — Today, Library, Sessions, Player, Summary, Progress, Settings, Onboarding, then
   TextDetail, TextEditor, SessionBuilder, MicTest, errors.
5. **Verify** — typecheck, lint, unit, e2e; screenshots at 390 px light/dark against the UI kit.
6. **Docs** — DECISIONS, CHANGELOG, README.
