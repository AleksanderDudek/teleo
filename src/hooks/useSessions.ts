import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { SessionRun, SessionTemplate, TextItem } from '@/db/types'
import { countTemplateSegments } from '@/domain/session'
import { isListedTemplate } from '@/domain/text/visibility'
import type { Lang } from '@/domain/types'
import { findResumableRun, segmentsByText } from '@/services/sessions'

export interface TemplateEntry {
  template: SessionTemplate
  segmentCount: number
  texts: Map<string, TextItem>
  /** Active segment count per text (for "3 of 4 segments"). */
  textSegmentCounts: Map<string, number>
}

/** The session templates of one language with their expanded size, kept live. */
export function useTemplates(lang: Lang): TemplateEntry[] | undefined {
  return useLiveQuery(async () => {
    const [templates, texts] = await Promise.all([db.sessionTemplates.toArray(), db.texts.toArray()])
    const textMap = new Map(texts.map((t) => [t.id, t]))
    const entries: TemplateEntry[] = []
    for (const template of templates.filter((t) => isListedTemplate(t, textMap, lang))) {
      const segments = await segmentsByText(template.items)
      entries.push({
        template,
        segmentCount: countTemplateSegments(template.items, segments),
        texts: textMap,
        textSegmentCounts: new Map([...segments].map(([id, list]) => [id, list.length])),
      })
    }
    return entries.sort(
      (a, b) =>
        Number(b.template.pinned) - Number(a.template.pinned) ||
        (b.template.lastUsedAt ?? 0) - (a.template.lastUsedAt ?? 0) ||
        a.template.name.localeCompare(b.template.name),
    )
  }, [lang])
}

/** Today's unfinished run (resume banner), `null` when there is none. */
export function useResumableRun(): SessionRun | null | undefined {
  return useLiveQuery(async () => (await findResumableRun()) ?? null, [])
}
