import {
  BUILTIN_SESSIONS,
  builtinSegments,
  builtinSessionId,
  builtinTextId,
  CORE_TEXTS,
  joinSegments,
  loadBuiltinTexts,
  loadLibraryTexts,
  type BuiltinSessionDef,
  type BuiltinTextDef,
} from '@/content'
import { db } from '@/db/schema'
import type { AppSettings, Segment, SessionTemplate, TextItem } from '@/db/types'
import { isListedTemplate } from '@/domain/text/visibility'
import type { ContentFocus, GrammaticalForm, Lang, TextType } from '@/domain/types'
import { readSettings, updateMeta } from './settings'
import { newSegment, replaceSegments, SEGMENT_EDIT_TABLES } from './texts'

/** Bump when builtin content changes; existing installs re-sync on next launch. */
export const SEED_VERSION = 3

const typeFocus = (type: TextType): 'prayers' | 'affirmations' | null =>
  type === 'prayer' ? 'prayers' : type === 'affirmation' ? 'affirmations' : null

/** Builtin visibility for a focus choice; the language gate is applied when listing (DECISIONS #92). */
function visible(focus: 'prayers' | 'affirmations' | null, prefs: Pick<AppSettings, 'contentFocus'>): boolean {
  if (prefs.contentFocus === 'own') return false
  if (prefs.contentFocus === 'both' || focus === null) return true
  return focus === prefs.contentFocus
}

/** The one builtin session pinned for a language + focus (Start button default). */
export function defaultPinnedSessionKey(uiLang: Lang, focus: ContentFocus): string | null {
  if (focus === 'own') return null
  const wantsPrayers = focus === 'prayers' || (focus === 'both' && uiLang === 'pl')
  const session = BUILTIN_SESSIONS.find((s) => s.lang === uiLang && s.focus === (wantsPrayers ? 'prayers' : 'affirmations'))
  return session?.key ?? null
}

/**
 * Inserts or refreshes builtin texts and sessions. Idempotent (keyed by `builtinKey`) and never overrides user choices
 * (hidden/pinned) on refresh. The app awaits only {@link seedCore} and lets {@link seedLibrary} follow.
 */
export async function seedBuiltins(now = Date.now()): Promise<void> {
  if (await seedCore(now)) await seedLibrary(now)
}

/**
 * The core texts and the sessions — what the first screen needs — in one transaction. Returns whether the prayer
 * library still has to follow; false when the content is up to date.
 */
export async function seedCore(now = Date.now()): Promise<boolean> {
  if ((await readSettings()).meta.seedVersion >= SEED_VERSION) return false
  await db.transaction('rw', [...SEGMENT_EDIT_TABLES, db.sessionTemplates, db.settings], async () => {
    const { app } = await readSettings()
    await writeBuiltinTexts(CORE_TEXTS, app, now)
    const pinnedKey = defaultPinnedSessionKey(app.uiLang, app.contentFocus)
    for (const def of BUILTIN_SESSIONS) {
      const id = builtinSessionId(def.key)
      const existing = await db.sessionTemplates.get(id)
      await db.sessionTemplates.put(sessionRow(def, now, existing, pinnedKey, app))
    }
  })
  return true
}

/**
 * How {@link seedLibrary} stays out of the way: it starts once the first screen is up, writes 20 texts per transaction
 * and pauses between two, so the screens' queries run in between instead of queueing behind the next write.
 */
const LIBRARY_DELAY_MS = 2000
const LIBRARY_CHUNK = 20
const LIBRARY_PAUSE_MS = 150
const pause = (ms: number) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve())

/** {@link seedLibrary} as the app runs it after start-up (tests call it without the pauses). */
export const seedLibraryInBackground = () => seedLibrary(Date.now(), { delayMs: LIBRARY_DELAY_MS, pauseMs: LIBRARY_PAUSE_MS })

/**
 * The prayer library (~7,000 sentences, DECISIONS #126), written after the app has started in small transactions so
 * the screens keep reading meanwhile; the interface language goes first. Then marks the content version as seeded —
 * an interrupted run starts over on the next launch.
 */
export async function seedLibrary(now = Date.now(), { delayMs = 0, pauseMs = 0 } = {}): Promise<void> {
  await pause(delayMs)
  const { app } = await readSettings()
  const own = (def: BuiltinTextDef) => (def.lang === app.uiLang ? 0 : 1)
  // Loaded before the transactions: awaiting a dynamic import inside one would let it commit early.
  const defs = (await loadLibraryTexts()).sort((a, b) => own(a) - own(b))
  for (let start = 0; start < defs.length; start += LIBRARY_CHUNK) {
    if (start > 0) await pause(pauseMs)
    await db.transaction('rw', [...SEGMENT_EDIT_TABLES, db.settings], async () => {
      // Read in the transaction: onboarding may change the focus or the grammatical form while the library is written.
      const { app } = await readSettings()
      await writeBuiltinTexts(defs.slice(start, start + LIBRARY_CHUNK), app, now)
    })
  }
  await updateMeta({ seedVersion: SEED_VERSION })
}

/** Writes builtin text rows and their segments. Must run inside a transaction covering {@link SEGMENT_EDIT_TABLES}. */
async function writeBuiltinTexts(defs: readonly BuiltinTextDef[], app: AppSettings, now: number): Promise<void> {
  const existingTexts = await db.texts.bulkGet(defs.map((def) => builtinTextId(def.key)))
  // A re-seed reads the segments once (one full read beats a query per text, or an `anyOf` over many keys).
  const active = existingTexts.some(Boolean) ? activeSegmentsByText(await db.segments.toArray()) : new Map<string, Segment[]>()
  const texts: TextItem[] = []
  const fresh: Segment[] = [] // segments of texts seen for the first time, written in one go
  for (const [index, def] of defs.entries()) {
    const id = builtinTextId(def.key)
    const segments = builtinSegments(def, app.grammaticalForm)
    const existing = existingTexts[index]
    texts.push({
      id,
      title: def.title,
      type: def.type,
      lang: def.lang,
      body: joinSegments(segments, def.splitMode),
      source: 'builtin',
      tags: def.tags,
      needs: def.needs,
      archived: existing?.archived ?? !visible(typeFocus(def.type), app),
      splitMode: def.splitMode,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      builtinKey: def.key,
    })
    if (existing) await replaceSegments(id, segments, active.get(id) ?? [])
    else fresh.push(...segments.map((content, order) => newSegment(id, order, content)))
  }
  await db.texts.bulkPut(texts)
  await db.segments.bulkPut(fresh)
}

/** Active segments grouped by text, each list in order (what `getActiveSegments` returns for one text). */
function activeSegmentsByText(segments: readonly Segment[]): Map<string, Segment[]> {
  const byText = new Map<string, Segment[]>()
  for (const segment of segments) {
    if (segment.archived) continue
    const list = byText.get(segment.textId)
    if (list) list.push(segment)
    else byText.set(segment.textId, [segment])
  }
  for (const list of byText.values()) list.sort((a, b) => a.order - b.order)
  return byText
}

function sessionRow(
  def: BuiltinSessionDef,
  now: number,
  existing: SessionTemplate | undefined,
  pinnedKey: string | null,
  prefs: Pick<AppSettings, 'contentFocus'>,
): SessionTemplate {
  return {
    id: builtinSessionId(def.key),
    name: def.name,
    pinned: existing?.pinned ?? def.key === pinnedKey,
    items: def.items.map((item) => ({ textId: builtinTextId(item.text), repeat: item.repeat })),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    source: 'builtin',
    archived: existing?.archived ?? !visible(def.focus, prefs),
    lang: def.lang,
    builtinKey: def.key,
    lastUsedAt: existing?.lastUsedAt,
  }
}

/**
 * Applies onboarding choices to builtin content: which builtins are visible and
 * which session is pinned. Explicit user choice → overrides previous state.
 */
export async function applyContentPreferences(uiLang: Lang, contentFocus: ContentFocus): Promise<void> {
  const prefs = { contentFocus }
  const pinnedKey = defaultPinnedSessionKey(uiLang, contentFocus)
  await db.transaction('rw', [db.texts, db.sessionTemplates], async () => {
    // The seeded rows, not the bundled list: the prayer library is not loaded for a change of focus.
    await db.texts
      .where('source')
      .equals('builtin')
      .modify((text) => {
        text.archived = !visible(typeFocus(text.type), prefs)
      })
    for (const def of BUILTIN_SESSIONS) {
      await db.sessionTemplates.update(builtinSessionId(def.key), {
        archived: !visible(def.focus, prefs),
        pinned: def.key === pinnedKey,
      })
    }
  })
}

/**
 * After the interface language changes (one language at a time, DECISIONS #92): when no session of the
 * new language is pinned, its default session is pinned, so Start offers something in that language
 * straight away. Pins of the other language stay for when it is switched back.
 */
export async function applyLanguage(uiLang: Lang, contentFocus: ContentFocus): Promise<void> {
  const key = defaultPinnedSessionKey(uiLang, contentFocus)
  if (!key) return
  await db.transaction('rw', [db.texts, db.sessionTemplates], async () => {
    const [templates, texts] = await Promise.all([db.sessionTemplates.toArray(), db.texts.toArray()])
    const byId = new Map(texts.map((text) => [text.id, text]))
    const pinned = templates.some((t) => t.pinned && !t.archived && isListedTemplate(t, byId, uiLang))
    if (!pinned) await db.sessionTemplates.update(builtinSessionId(key), { pinned: true })
  })
}

/** Re-renders gendered builtin affirmations after the grammatical form changes (spec §15 #20). */
export async function applyGrammaticalForm(form: GrammaticalForm, now = Date.now()): Promise<void> {
  const defs = await loadBuiltinTexts()
  const gendered = defs.filter((def) => def.variants)
  await db.transaction('rw', SEGMENT_EDIT_TABLES, async () => {
    const existing = await db.texts.bulkGet(gendered.map((def) => builtinTextId(def.key)))
    // Only texts that change: not yet seeded ones (the library may still be on its way) get the form when they are,
    // and onboarding applies the form even when it is the default one.
    const changes = gendered.flatMap((def, index) => {
      const segments = builtinSegments(def, form)
      const body = joinSegments(segments, def.splitMode)
      const text = existing[index]
      return text && text.body !== body ? [{ id: text.id, segments, body }] : []
    })
    if (changes.length === 0) return
    const active = activeSegmentsByText(await db.segments.toArray())
    for (const { id, segments, body } of changes) {
      await db.texts.update(id, { body, updatedAt: now })
      await replaceSegments(id, segments, active.get(id) ?? [])
    }
  })
}
