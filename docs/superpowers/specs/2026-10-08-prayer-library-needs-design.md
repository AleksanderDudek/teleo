# Prayer library and filters by need — design

Owner request (2026-10-08): *"Use these prayers to be stored in our library. I want to introduce better filters based on
prayer needs in this app. Translate it for both languages present right now. Analyze the current system, use best
practices, pick recommended."* Attached: 133 English prayers in Teleo's builtin format (`lovy-prayers.texts.json`, 3,481
sentences built from what Prophet Lovy L. Elias said while leading prayer, each traced to a sermon video in
`lovy-prayers.trace.json`), grouped into nine areas of life. The owner was away; the choices below were made by Claude
with the stated reasons.

## What happens today

- **Builtin texts** live pre-segmented in `src/content/texts.json` (14 texts, DECISIONS #24), are imported statically
  into the main bundle and seeded into IndexedDB by `seedBuiltins` when `SEED_VERSION` grows. The library lists the
  texts of the interface language only (#92).
- **The library filters** by type (prayer / affirmation / text), source (all / builtin / mine), hidden, and a free-text
  search. Filters live in component state, so they are lost on the way back from a text. `tags` are stored but never
  shown or searched.
- With 14 texts this is enough. With 133 more in each language it is not: a person comes with a need — fear, a sick
  child, debt, a court case — and needs to find the prayer for it.

## Decisions

1. **The prayers ship as builtin texts in both languages.** `en.lovy-<slug>` as given; `pl.lovy-<slug>` translated
   sentence for sentence (same count and order, so the pair stays comparable and a test can hold it), in natural Polish
   prayer language with a fixed glossary ("w potężnym imieniu Jezusa", "mocą krwi Jezusa", "… jest moim udziałem").
   Polish first-person sentences that reveal the speaker's gender ("jestem wolny/wolna") use the existing m/f/n variant
   mechanism (#26): the neutral form rephrases without gender. Every text carries the tag *Prophet Lovy L. Elias* /
   *prorok Lovy L. Elias* — shown on the text and searchable — so the words are attributed. Sentences repeated in the
   source on purpose ("I will dream again.") stay repeated.
2. **The new content is loaded lazily.** It is ~250 kB of English and as much Polish; bundling it would double the
   start-up script for a file read once per content version. `src/content/prayers/{en,pl}.json` are dynamic imports
   (`loadBuiltinTexts()`), used only by seeding and by re-rendering gendered texts; Vite emits them as separate chunks,
   which the service worker still precaches, so the library works offline from the first launch. Core texts stay static.
3. **Needs are a language-independent taxonomy**, not free tags: nine areas (mind & emotions, health & body, family &
   relationships, finances & work, breakthrough & direction, deliverance & protection, spiritual life, stages of life,
   prayers for every day) with 43 needs (`src/domain/text/needs.ts`). Each text carries `needs: NeedId[]` (1–3, the
   first is its main need). Labels come from i18n, so one classification serves both languages, and a need can sit in
   any area's prayer (a prayer against generational sickness is both *healing* and *generational curses*). Existing
   builtins are classified too (classic prayers, Scripture, morning affirmations).
4. **`needs` is a plain optional field of the text row** — no index, no schema version: the library filters in memory
   (as it already does). Backups accept it as an optional string array; ids the app does not know are ignored when read,
   so a backup from a newer version still restores.
5. **The library asks "What do you pray for?"**: a row of area chips with counts; choosing an area opens a second row
   with its needs; the list narrows to texts with that need (or any need of the area). Only areas and needs that have a
   text in the current language appear (Polish has no Scripture texts, #65). A results line counts what is shown and
   offers *Clear filters*. Each card names its main need; a text's page lists its needs as links back to the filtered
   library.
6. **Filters live in the URL** (`/library?area=health&need=sleep&type=prayer&q=…`), replacing component state: the back
   arrow from a text returns to the same filtered list, and a need on a text page is a plain link. Updates replace the
   history entry, so typing in the search box does not fill the history.
7. **Own texts can carry needs too**: the editor has an optional *What is it for?* section with the same chips grouped by
   area; copying a builtin as one's own keeps its needs.
8. **Seeding**: `SEED_VERSION` 3 adds the new texts visible according to the content focus (#25/#64) and refreshes the
   needs of the old ones. Start-up waits only for the core texts; the library follows in the background in small
   transactions (found during testing: written in one go it delayed the first screen by seconds in Firefox and WebKit). Choosing a content focus now walks the builtin rows in the database instead of the bundled
   list, so it needs no content download. Nothing else changes: the session of the day still picks the least recently
   practised visible texts, so the new prayers will come up there too.

## Not done (on purpose)

- No builtin sessions for the new prayers (one text each is already a session via "Say it now", tasks and the builder).
- The source trace (sermon links per sentence) is not shipped — 1.4 MB that the app does not show; attribution is the
  tag.
- No need filter in the session builder's or task editor's text pickers (search is there; can follow if asked).

## Testing

- `needs.ts`: taxonomy integrity (every need in one area, ids unique), `needsOf` drops unknown ids, filter matching by
  area/need, counts per area/need.
- Content: every builtin has 1–3 known needs; every need is used; Lovy pairs EN/PL have equal sentence counts and equal
  needs; segments 3–40 words, no digits (existing rule) for every form.
- Seed: lazy content is seeded with needs; focus preferences reach the new texts; restore of an old backup re-seeds.
- Backup: `needs` optional and validated as strings.
- Library (e2e): choosing an area then a need narrows the list; the filter survives opening a text and going back.
