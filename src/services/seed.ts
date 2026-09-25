import {
  BUILTIN_SESSIONS,
  BUILTIN_TEXTS,
  builtinSegments,
  builtinSessionId,
  builtinTextId,
  joinSegments,
  type BuiltinSessionDef,
  type BuiltinTextDef,
} from '@/content'
import { db } from '@/db/schema'
import type { AppSettings, SessionTemplate, TextItem } from '@/db/types'
import type { ContentFocus, GrammaticalForm, Lang } from '@/domain/types'
import { readSettings, updateMeta } from './settings'
import { replaceSegments } from './texts'

/** Bump when builtin content changes; existing installs re-sync on next launch. */
export const SEED_VERSION = 1

const typeFocus = (def: BuiltinTextDef): 'prayers' | 'affirmations' | null =>
  def.type === 'prayer' ? 'prayers' : def.type === 'affirmation' ? 'affirmations' : null

/** Builtin visibility for a language + focus choice (DECISIONS #25). */
function visible(lang: Lang, focus: 'prayers' | 'affirmations' | null, prefs: Pick<AppSettings, 'uiLang' | 'contentFocus'>): boolean {
  if (lang !== prefs.uiLang) return false
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

  await db.transaction('rw', [db.texts, db.segments, db.attempts, db.sessionTemplates], async () => {
    for (const def of BUILTIN_TEXTS) {
      const id = builtinTextId(def.key)
      const segments = builtinSegments(def, app.grammaticalForm)
      const existing = await db.texts.get(id)
      const text: TextItem = {
        id,
        title: def.title,
        type: def.type,
        lang: def.lang,
        body: joinSegments(segments, def.splitMode),
        source: 'builtin',
        tags: def.tags,
        archived: existing?.archived ?? !visible(def.lang, typeFocus(def), app),
        splitMode: def.splitMode,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        builtinKey: def.key,
      }
      await db.texts.put(text)
      await replaceSegments(id, segments)
    }

    const pinnedKey = defaultPinnedSessionKey(app.uiLang, app.contentFocus)
    for (const def of BUILTIN_SESSIONS) {
      const id = builtinSessionId(def.key)
      const existing = await db.sessionTemplates.get(id)
      await db.sessionTemplates.put(sessionRow(def, now, existing, pinnedKey, app))
    }
  })
  await updateMeta({ seedVersion: SEED_VERSION })
}

function sessionRow(
  def: BuiltinSessionDef,
  now: number,
  existing: SessionTemplate | undefined,
  pinnedKey: string | null,
  prefs: Pick<AppSettings, 'uiLang' | 'contentFocus'>,
): SessionTemplate {
  return {
    id: builtinSessionId(def.key),
    name: def.name,
    pinned: existing?.pinned ?? def.key === pinnedKey,
    items: def.items.map((item) => ({ textId: builtinTextId(item.text), repeat: item.repeat })),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    source: 'builtin',
    archived: existing?.archived ?? !visible(def.lang, def.focus, prefs),
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
  const prefs = { uiLang, contentFocus }
  const pinnedKey = defaultPinnedSessionKey(uiLang, contentFocus)
  await db.transaction('rw', [db.texts, db.sessionTemplates], async () => {
    for (const def of BUILTIN_TEXTS) {
      await db.texts.update(builtinTextId(def.key), { archived: !visible(def.lang, typeFocus(def), prefs) })
    }
    for (const def of BUILTIN_SESSIONS) {
      await db.sessionTemplates.update(builtinSessionId(def.key), {
        archived: !visible(def.lang, def.focus, prefs),
        pinned: def.key === pinnedKey,
      })
    }
  })
}

/** Re-renders gendered builtin affirmations after the grammatical form changes (spec §15 #20). */
export async function applyGrammaticalForm(form: GrammaticalForm, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.texts, db.segments, db.attempts], async () => {
    for (const def of BUILTIN_TEXTS) {
      if (!def.variants) continue
      const id = builtinTextId(def.key)
      const segments = builtinSegments(def, form)
      await db.texts.update(id, { body: joinSegments(segments, def.splitMode), updatedAt: now })
      await replaceSegments(id, segments)
    }
  })
}
