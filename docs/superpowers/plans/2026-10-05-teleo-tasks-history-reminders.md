# Daily tasks, history, reminders, support link — implementation plan

Design: [../specs/2026-10-05-daily-tasks-history-reminders-design.md](../specs/2026-10-05-daily-tasks-history-reminders-design.md).
Branch `daily-tasks-history-reminders`, one commit per phase, merged with `--no-ff`. Every phase ends green:
`npm run lint`, `npm run typecheck`, `npm run test -- --run`; e2e at the end.

1. **Support link by language** — `supportUrl(lang)`, strings, privacy page, DECISIONS; Fluentum port (separate repo).
2. **Tasks: data and rules** — Dexie v5 (`tasks`, `taskLog`), row types, backup tables + validator, `src/domain/tasks`
   (pure, tested), `src/services/tasks.ts`, `startRun({ kind: 'task' })`, task log in `recordAttempt`, delete cascade.
3. **Tasks: screens** — Today section, Sessions card, `/tasks`, `/tasks/new`, `/tasks/:id/edit`, text detail action,
   summary line, i18n.
4. **History** — `runHistoryRow`, `useHistory`, `/progress/history`, links from Progress and the summary, i18n.
5. **Reminders** — `reminderTimes` + `notifications` settings (migration, validator), multi-event .ics, Settings section,
   `src/domain/reminders/{times,nudge}.ts`, `src/services/reminders.ts` (permission, badge, periodic sync), root hooks,
   custom service worker (`injectManifest`), i18n.
6. **Docs and verification** — DECISIONS, CHANGELOG, README, CLAUDE.md, spec §12 note; e2e suite in all browsers;
   code review; merge.
