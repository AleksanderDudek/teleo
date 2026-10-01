# Your data: backups that survive the browser — plan

**Status (2026-10-01): implemented** on branch `data-backup` — DECISIONS #109–#116.

Owner request (2026-10-01, translated): add import and export of the app's data. The app is still bound to the
device's / browser's storage; I want to be able to export the data to preserve it. "Analyse the current system,
use best practices, pick recommended, plan it and finish on your own."

## Analysis — what exists

- `services/backup.ts` + `domain/backup/validate.ts`: a full JSON export of every IndexedDB table (one read
  transaction), strict validation with precise paths, import that **replaces everything** in one transaction
  (DECISIONS #46), delete-all. Optional tables for forward/backward compatibility (#88).
- Settings → "Backup": export (a download via `<a download>`), import (file input → "replace everything?" →
  reload), last backup date. Settings → Privacy: persistent-storage status + "ask for protected storage",
  delete-all. Today: a reminder every 30 days (spec §13). `navigator.storage.persist()` at every start (spec §10).

## Gaps

1. **Saving the file on phones.** A blob download is the only way out. In an installed PWA on iPhone it opens a
   preview at best; on Android it lands in Downloads, still on the same phone. A backup that is meant to outlive the
   phone or the browser belongs in Files / iCloud / Google Drive / e-mail — the system share sheet (Web Share with
   files) reaches all of them, and `canShare({ files })` says when it is available.
2. **Share needs a fresh tap.** iOS refuses `navigator.share` after async work (reading the database, encrypting);
   the file must be ready before the tap that shares it.
3. **Blind replace.** Import shows only the export date; nothing says what the file holds or that it is *older*
   than the data on this device (picking last month's file silently erases a month of progress). There is no undo.
4. **Error messages** show raw codes ("invalidShape", "unsupportedVersion").
5. **Sensitive data in the open.** Religious practice is special-category data (GDPR art. 9); once a backup travels
   to a cloud drive or e-mail it is plain JSON. No way to protect it.
6. **Discoverability.** Backup is one section among many in Settings; storage protection sits under Privacy.

## Decisions (recommended)

1. **A "Your data" screen** (`/settings/data`, Settings tab): what is on this device (sentences said, active days,
   points, own texts), whether the browser protects the storage (+ usage estimate, ask for protection), backup,
   restore, undo, delete-all. Settings keeps a short Backup section (last backup + link); Today's reminder links here.
2. **Two-step export**: "Create a backup" builds the file (optionally encrypted) and shows it (name, size); then
   **"Save to device"** (download) and — where files can be shared — **"Save to Files / cloud / send"** (share
   sheet), each a fresh tap. On iPhone/iPad the share sheet is the main action. The backup counts as made once a
   save or share happened (a cancelled share does not count).
3. **Optional password** (off by default): AES-256-GCM with a key from PBKDF2-SHA-256 (600,000 iterations, OWASP
   2023), random salt and IV, Web Crypto only (no dependency, no server). The envelope keeps the export date in
   clear for the preview; the data is unreadable without the password, and the password cannot be recovered (said
   plainly before saving). Asked for on import.
4. **Preview before replacing**: the file's date and app version, and its contents next to this device's —
   sentences said, active days, points, last active day, own texts, achievements, Bible readings; a warning when
   the file holds less progress or ends earlier than this device.
5. **Undo an import**: the data replaced by an import is kept on the device as a restore point (one, the latest;
   only when it held any progress) and can be brought back from "Your data". Dexie v3 adds the `restorePoints`
   table (new table only, never exported, cleared by delete-all).
6. **Readable errors** per failure (not a Teleo file, damaged, from a newer version — update first, wrong password).
7. **The file carries the app version** (`appVersion`, optional, informational); the format stays schema 1, so
   older versions still read plain backups.
8. Not done: merging two histories (counters, streaks and the XP ledger would double count — replace + undo is the
   safe, standard model); automatic backups to a folder (File System Access is desktop Chromium only).

## Phases (commit each)

1. Domain: `backup/crypto.ts` (envelope encrypt/decrypt), `backup/summary.ts` (contents, comparison), tests first.
2. Storage/services: Dexie v3 `restorePoints`, import with restore point, undo, prepared export, tests.
3. UI: Your data screen, save/share helper, preview + password dialogs, Settings/Today links, i18n.
4. Verify (unit, e2e incl. password and undo, 4 browsers, screenshots), docs.
