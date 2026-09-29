# Support banners, session sharing, mobile/PWA shell — plan

**Status (2026-09-29): implemented** on branch `mobile-shell` — DECISIONS #95–#100.

Owner request (2026-09-29): a thin support banner (buycoffee.to) at the top and the bottom of the app — at the
top a thin sticky one, always visible but never in the way; at the bottom a full-width one with the angel. After
every session: sharing the results and a support banner. And the whole interface and navigation brought up to the
best standards of mobile apps / PWAs. "Pick recommended", finish autonomously.

## Analysis

- Shell: `TabsLayout` = content column + bottom tab bar (left rail ≥ lg). No top bar: `PageHeader` is a plain block
  that scrolls away with its text "Back" link. In an installed PWA (no browser chrome — on iOS no back button at all)
  a long screen (a Bible book, Settings) leaves the user without a way back until they scroll up.
- `/bible` belongs to no tab, so no tab is lit there. Re-tapping the current tab does nothing (native: scroll to top).
- Dialogs are centred cards on phones (native: bottom sheets within thumb reach).
- Lazy screens load with no feedback on a slow connection. No install invitation (beforeinstallprompt / iOS hint).
- Support today: a Guardian word + coffee card in Settings and on the session summary, nowhere else.
- Summary: shares *the day* (not the session), its buttons sit at the very end of a long page.

## Decisions (recommended)

1. **Top support strip** — a thin (36 px) gilded ribbon under the status bar, sticky, one tap to buycoffee.to, not
   dismissible (owner: "visible all the time"). Shown on every screen of the app except where it would disturb:
   the session player (prayer in progress), onboarding and the friend-invitation page.
2. **Bottom support banner** — full-width stained-glass panel with the Guardian, the word for today (kept from the old
   card), one line about the free app and a gold "Buy a coffee" button. At the end of every tab screen (not on
   editing forms) and of the session summary. Replaces the Settings/summary support cards (one ask per screen).
3. **Session summary** — share *this session* (title, sentences said, first-try %, points, streak; the Bible share on
   a Bible reading) as a picture card + text, right under the numbers; the support banner at the end; the next step
   (next reading / again / home) in a sticky thumb-zone bar.
4. **App bar** — `PageHeader` gains a sticky compact bar under the strip: a 44 px back button on sub-screens (always
   reachable) and the screen title that fades in once the large title has scrolled away (large-title pattern).
5. **Tab bar** — a tab stays lit on its sub-screens (Bible → Library); tapping the current tab scrolls to the top;
   editing forms (text editor, session builder) hide the tab bar (focused task, no accidental leave) and their save
   bar moves down to the thumb zone.
6. **Platform polish** — view transitions between screens (cross-fade, chrome stays put; off with reduced motion),
   a thin gold progress line while a screen loads, bottom-sheet dialogs on phones, focus moved to the new screen for
   screen readers, `scroll-padding-top` so focus never hides under the sticky chrome, press feedback on cards, an
   "Install Teleo" row in Settings (native prompt on Chromium, instructions on iOS).

## Phases (commit each)

1. Support strip + banner + route handles; summary: session share + sticky actions.
2. Shell: sticky app bar, tab bar behaviour, form routes, view transitions, loading line, focus, CSS polish.
3. Bottom-sheet dialogs, install row.
4. Verify (unit, e2e in 4 browsers, screenshots light/dark), docs (DECISIONS, CHANGELOG, README).
