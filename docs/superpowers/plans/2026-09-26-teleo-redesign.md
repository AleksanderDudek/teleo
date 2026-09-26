# Teleo redesign — implementation plan

**Goal:** re-skin and re-lay-out the whole app to match the Claude Design project
`https://claude.ai/design/p/75c6f65d-80ba-4c0d-9028-2f073eaeb778`, without touching behaviour.

**Status (2026-09-26): blocked on reading the design.** The design link is a private Claude Design
project. From a headless session it returns HTTP 403, `DesignSync` needs `/design-login` (interactive
only), and the Artifact tool does not open Claude Design links. No local export was found
(`~/Downloads`, `~/Desktop`, repo). Nothing below has been implemented yet — re-skinning from guesses
would likely have to be thrown away.

## Unblocking (pick one)

1. Run `/design-login` once in an interactive Claude Code session on this machine, then re-run the
   task — `DesignSync get_project / list_files / get_file` can then read the project.
2. In Claude Design use "Send to Claude Code" / export, and drop the files into `design/` in this
   repo (HTML/CSS/screens are enough).
3. Minimum viable: screenshots of each screen (light + dark, phone width) into `design/screens/`.

## Current system (analysis)

- **Tokens are already centralised.** All colours are CSS custom properties in `src/index.css`
  (`:root` + `.dark`), mapped to Tailwind 4 utilities via `@theme inline` (`bg-surface`,
  `text-ink-soft`, …). Screens use utilities only; the only raw colours in TSX are the medal
  gradients in `components/AchievementBadge.tsx` and three `rgb(...)` shadows (`TextCard`, `Dialog`,
  `MicButton`). A palette swap is therefore mostly a token edit.
- **Type:** Alegreya (serif, spoken text + headings) and Instrument Sans (UI), self-hosted through
  `src/styles/fonts.css` (Decision 6: no third-party requests). Spoken-text size is driven by
  `--segment-size` / `html[data-font]`.
- **Component classes:** `.card`, `.rubric`, `.gilt-rule`, `.scripture`, `.tabular`, `.safe-bottom`
  in `@layer components`.
- **Primitives** (`src/components/ui/`): Button (+ `buttonClasses.ts`), Card, Chip, Dialog,
  EmptyState, PageHeader, Progress, Segmented, Stepper, Switch, Toasts.
- **Shell:** `app/TabsLayout.tsx` — 5 tabs (Today, Library, Sessions, Progress, Settings), bottom bar
  on phones, left rail at `lg`. Full-screen routes: `play/:runId`, `play/:runId/summary`, `onboarding`.
- **Screens by size** (largest first): SessionPlayer 475 lines, Settings 364, TextEditor 247,
  Onboarding 236, Sessions 225, Today 217, MicTest 211, TextDetail 185, SessionBuilder 191,
  SessionSummary 142, Library 137, Progress 135.
- **Data-viz:** `components/progress/` — Heatmap (`--heat-0..4`, `--heat-frozen`), FirstTryChart,
  Plant, StatTile; `LevelBar`, `AchievementBadge`.
- **e2e is reskin-safe:** selectors are `getByRole` (91) / `getByText` (23) / `getByTestId` (3),
  not classes. Accessible names and i18n strings must stay stable, or tests are updated with them.
- **PWA colours** are duplicated in `vite.config.ts` (`theme_color`, `background_color`),
  `index.html` (boot splash, `theme-color` meta) and `public/` icons.

## Rules for the redesign

- `src/domain/**`, `src/db/**`, `src/services/**` are not touched. Presentation only.
- Every new UI string goes into both `src/i18n/pl.json` and `en.json`.
- Keep WCAG AA (≥ 4.5:1 text, ≥ 3:1 UI), ≥ 44 px touch targets, `prefers-reduced-motion`, focus rings.
- Fonts stay self-hosted (`@fontsource*`); if the design uses a new family, add its package — never a
  CDN link (the CSP would block it anyway).
- Light and dark themes both come from the design; if the design has only one, derive the other and
  log it in `docs/DECISIONS.md`.
- One commit per phase, `feat(redesign): …` / `refactor(redesign): …`.

## Phases

1. **Extract** — read the design; write a token table (colour, type scale, radius, spacing, shadow,
   motion) and a screen → route map. Note every behavioural change the design implies (new screens,
   removed tabs); those need a decision entry, not a silent change.
2. **Tokens** — replace the palette and `@theme` values in `src/index.css`; update component classes;
   move the medal colours and the three `rgb()` shadows to tokens; sync PWA colours and the boot
   splash. Run the app: every screen should already look ~70 % right.
3. **Primitives** — restyle `src/components/ui/*` to the design's component specs (states: default,
   hover, active, focus, disabled, loading). Keep props/API unchanged so screens don't move.
4. **Shell** — TabsLayout (tab set, icons, bar/rail), PageHeader, RouteError/NotFound, PwaUpdatePrompt.
5. **Screens**, in usage order: Today → SessionPlayer (+ SegmentStage, DiffView, MicButton) →
   SessionSummary → Library → TextDetail → TextEditor → Sessions → SessionBuilder → Progress
   (+ charts) → Settings (+ Whisper, MicTest) → Onboarding.
6. **Verify** — `npm run typecheck && npm run lint && npm run test -- --run && npm run test:e2e`;
   screenshots via the dev server at 390 px and 1280 px, light + dark, compared side by side with
   the design; contrast check of every new text/background pair.
7. **Docs** — `docs/DECISIONS.md` entries, `CHANGELOG.md`, README screenshots if any.
