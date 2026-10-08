import {
  BUILTIN_SESSIONS,
  builtinSegments,
  builtinSessionId,
  builtinTextId,
  joinSegments,
  loadBuiltinTexts,
  type BuiltinSessionDef,
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
 * Inserts or refreshes builtin texts and sessions. Idempotent (keyed by
 * `builtinKey`) and never overrides user choices (hidden/pinned) on refresh.
 */
export async function seedBuiltins(now = Date.now()): Promise<void> {
  const { app, meta } = await readSettings()
  if (meta.seedVersion >= SEED_VERSION) return
  // Loaded before the transaction: awaiting a dynamic import inside it would let the transaction commit early.
  const defs = await loadBuiltinTexts()

  await db.transaction('rw', [...SEGMENT_EDIT_TABLES, db.sessionTemplates], async () => {
    // Read in two queries, not two per text: hundreds of builtins are seeded while the app starts
    // (one full read of the segments beats an `anyOf` over hundreds of keys).
    const ids = defs.map((def) => builtinTextId(def.key))
    const existingTexts = await db.texts.bulkGet(ids)
    const active = activeSegmentsByText(await db.segments.toArray())
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
      const current = active.get(id)
      if (current) await replaceSegments(id, segments, current)
      else fresh.push(...segments.map((content, order) => newSegment(id, order, content)))
    }
    await db.texts.bulkPut(texts)
    await db.segments.bulkPut(fresh)

    const pinnedKey = defaultPinnedSessionKey(app.uiLang, app.contentFocus)
    for (const def of BUILTIN_SESSIONS) {
      const id = builtinSessionId(def.key)
      const existing = await db.sessionTemplates.get(id)
      await db.sessionTemplates.put(sessionRow(def, now, existing, pinnedKey, app))
    }
  })
  await updateMeta({ seedVersion: SEED_VERSION })
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
  await db.transaction('rw', SEGMENT_EDIT_TABLES, async () => {
    const active = activeSegmentsByText(await db.segments.toArray())
    for (const def of defs) {
      if (!def.variants) continue
      const id = builtinTextId(def.key)
      const segments = builtinSegments(def, form)
      await db.texts.update(id, { body: joinSegments(segments, def.splitMode), updatedAt: now })
      await replaceSegments(id, segments, active.get(id) ?? [])
    }
  })
}
