# Daily tasks, session history, reminders, support link by language — design

**Status (2026-10-05): approved by the owner in advance** ("plan it out and then finish on your own"); the open questions
below were decided by Claude with the stated reasons. Implemented on branch `daily-tasks-history-reminders`.

## Owner request (2026-10-05, translated)

1. A history log: every session recorded, so it can be analysed — a preview of what it was about and what was done, with a
   link to the affirmation or the task in the library.
2. For everyone outside Poland, donations go to `https://buymeacoffee.com/atd_uriel`. Tie it to the language: Polish
   detected → Polish interface and Polish texts; English → English and that link.
3. Local push notifications for Android and iOS from the installed PWA: reminders of sessions at fixed hours of the day,
   and reminders of the tasks set. Two goals: build the habit of using the app, and remind the user of their goals in it.
4. Any affirmation can be added as a set of tasks for a day — e.g. an affirmation for two weeks, said three times a day —
   configurable.

## Analysis

- **History already exists as data.** Every run is a `sessionRuns` row (plan, entries, status, XP, start/end, title,
  template or text) and every try an `attempts` row; both are kept forever and exported in backups. What is missing is a
  screen. The run summary screen (`/play/:runId/summary`) already renders any run.
- **"Polish → Polish interface and texts" already holds** (DECISIONS #91–#92: the language comes from the browser; one
  language at a time). Only the support link is fixed to buycoffee.to.
- **Notifications at fixed hours are not possible from a PWA without a push server**, on either platform: Web Push needs a
  server to hold subscriptions and send at the right time (Cloudflare/GitHub "free" tiers are still a backend, and the
  subscription endpoint of a prayer app is sensitive data); the Notification Triggers API never shipped; a page's timers die
  when the installed app is suspended (iOS always, Android soon). What works: (a) calendar events (.ics) — the existing
  solution, reliable everywhere, free; (b) notifications while the app is open; (c) the **app-icon badge**
  (`navigator.setAppBadge`), which persists after the app closes, on iOS 16.4+ Home Screen apps and Android Chrome; (d) on
  Android Chrome, **Periodic Background Sync**, which wakes the service worker now and then (at Chrome's discretion, at
  most every 12 h, only for installed, used apps) and may show a notification. Teleo's spec (§12) names (d) as an optional
  extra; DECISIONS #45 deferred it because it needs a custom service worker. The owner now asks for it, so it is built —
  with honest copy about its limits.
- **Tasks fit the engine.** A "repetition" of a text is already detected in `recordAttempt` (a full-text block complete →
  `textStats.repetitions`, `textCompleted` in the outcome). A task is a text to repeat N times a day over a date range;
  progress = repetitions logged per day. Runs of several repetitions already exist (`repeat` in a template item;
  the player shows `Title · k/N`).

## Decisions

### 1. Session history
- Screen **`/progress/history`** (Progress tab), reached from a card at the top of Progress ("Session history") and from
  the summary screen's title ("All sessions"). Rows grouped by day (newest first), 30 at a time with "Show more".
- A row: title, when (time), mode (memory), state (completed / paused / in progress), lines `accepted/total`, skips, XP,
  duration (`(endedAt ?? lastActivityAt) − startedAt`), first-try rate; the texts of the run as chips linking to
  `/library/:textId` (hidden Bible readings link to `/bible`); a task badge linking to `/tasks/:taskId` when the run was
  started from a task. Tapping the row opens `/play/:runId/summary`.
- A header strip for analysis: sessions and minutes in the last 7 and 30 days, total sessions.
- Pure helper `runHistoryRow(run)` in `src/domain/session/history.ts` (tested); the list query in `useHistory`.

### 2. Support link by language
- `supportUrl(lang)`: `pl` → `https://buycoffee.to/uriel`, `en` → `https://buymeacoffee.com/atd_uriel`
  (`src/components/support/links.ts`). Strings that name the site are per language already (`support.note`,
  `support.buttonLabel`): English ones say buymeacoffee.com. Privacy page names both sites. The same change is ported to
  Fluentum (same owner, same intent), as a separate commit there.

### 3. Reminders
- **Fixed reminder times** replace the single time: `AppSettings.reminderTimes: string[]` (`HH:MM`, 1–3 entries, default
  `['07:00', '13:00', '21:00']`), editable in Settings → Reminders (time inputs, add/remove). Old `reminderTime` is read
  as the single entry when `reminderTimes` is missing (settings rows and backups from before).
- **Calendar export** builds one file with one daily event per reminder time plus one daily event per active task (its
  title and "×3 a day", `RRULE:FREQ=DAILY;UNTIL=<endDay>`, at the first reminder time). `src/domain/reminders/ics.ts` gains
  a multi-event builder; the old single-event builder stays as a thin wrapper for its tests.
- **Device notifications** (`AppSettings.notifications: boolean`, default off): a switch in Settings asks for
  `Notification` permission. When on:
  - while the app is open (also a background tab), at each reminder time a notification is shown through the service
    worker registration if nothing was said today — "Time for Teleo · 2 tasks left today" / "…say at least one sentence";
  - the **app badge** shows the number of task repetitions still due today (cleared when none, or when notifications are
    off); synced on start and after every attempt (live query in the root);
  - on Chrome Android with the app installed, `periodicSync.register('teleo-reminders', { minInterval: 12 h })`; the
    service worker's `periodicsync` handler reads the database (settings, today's stats, tasks, task log), and if a
    reminder time has passed today and nothing was said, shows one notification per day (the day it last notified is
    kept in a Cache Storage entry, so no race with the page's settings writes). Tapping a notification opens the app.
  - Settings copy says plainly: iPhone — add to the Home Screen; notifications show while the app is open and the badge
    counts tasks left; Android — may also remind you when closed, as the system allows; the calendar reminder is the one
    that always rings.
- **Service worker** switches from `generateSW` to `injectManifest` with `src/sw.ts` (workbox precaching, navigation
  fallback with the privacy page denylist, the `ort/` cache-first and `bible/` stale-while-revalidate routes,
  `cleanupOutdatedCaches`, the prompt-update `SKIP_WAITING` message) plus the `periodicsync`, `notificationclick` handlers.
  The decision logic is a pure, tested function `reminderNudge(...)` in `src/domain/reminders/nudge.ts`; the worker opens
  the database **without a declared version** (Dexie dynamic mode), so it never triggers an upgrade.

### 4. Daily tasks
- **Model** (Dexie v5): `tasks { id, textId, timesPerDay (1–10), startDay, endDay (dayKeys, inclusive), createdAt,
  archived }` and `taskLog { id, taskId, dayKey, runId, timestamp }`. Indexes: `tasks: id, textId, endDay`;
  `taskLog: id, taskId, [taskId+dayKey], dayKey`. Both exported in backups as optional tables (old files restore).
- **Counting:** inside `recordAttempt`'s transaction, when a full-text block of text T completes on day D, one `taskLog`
  row is added for every non-archived task of T whose range covers D (any session counts, not only one started from the
  task). The outcome carries `taskProgress: { taskId, done, of }[]` for the player and summary. Deleting a user text deletes
  its tasks and log (DECISIONS #28 extended). Runs started from a task carry `taskId`.
- **Screens:** Today shows **"Today's tasks"** above the pinned sessions: a card per task due today — title (link to the
  text), pips `done/of`, "Say it" (starts a run of the remaining repetitions, `startRun({ kind: 'task', taskId })`), a
  check when done. Sessions tab gets a **"Daily tasks"** card linking to `/tasks` (manage: active and finished, add,
  edit, archive, delete; each shows day `k of n`, today `done/of`, overall `done/total`). `/tasks/new` and
  `/tasks/:id/edit` (form handle): text picker (the session builder's), times per day (stepper, default 3), start date
  (date input, default today), length in days (chips 7 · 14 · 21 · 30 + stepper, default 14). Text detail gets **"Set as
  a daily task"** (→ `/tasks/new?text=<id>`). The summary shows the task progress line after a run that advanced a task.
- **Pure rules** in `src/domain/tasks/`: `endDayFor`, `isTaskActiveOn`, `taskDayIndex`, `taskProgress` (done today,
  done overall, remaining today, total), `remainingRepeats` (tested).

## Not done, on purpose
- Web Push / any server-sent notification (project principle: no backend).
- Task achievements and XP bonuses (tasks reuse the text's repetition rewards; a bonus would double-pay).
- Per-task reminder times (the fixed times serve every task; the calendar event names each task).

## Testing
- Unit: Dexie v5 upgrade from v4 data; task rules; task log written by `recordAttempt`; `startRun({ kind: 'task' })`;
  history row helper; reminder times (`nextReminderAt`, `passedToday`), nudge decision, multi-event .ics; settings
  migration of `reminderTime`; backup validator for the new tables and fields; i18n key parity.
- e2e (Chromium + WebKit + Firefox): create a task from a text, see it on Today, say it, see `1/3` and the history row
  with its link; English interface shows the buymeacoffee link; reminder times → .ics download with three events; the
  offline shell still opens (custom service worker); backup round trip includes tasks.
