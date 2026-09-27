import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { isListedText, type TextItem, type TextStats } from '@/db/types'

export interface LibraryEntry {
  text: TextItem
  stats?: TextStats
  segmentCount: number
  /** First active segment, used as a preview line. */
  preview: string
}

/** All texts with their stats and active segment counts, kept live. `undefined` while loading. */
export function useLibrary(): LibraryEntry[] | undefined {
  return useLiveQuery(async () => {
    const [texts, stats, segments] = await Promise.all([
      db.texts.toArray(),
      db.textStats.toArray(),
      db.segments.toArray(),
    ])
    const statsById = new Map(stats.map((s) => [s.textId, s]))
    const counts = new Map<string, number>()
    const previews = new Map<string, { order: number; content: string }>()
    for (const segment of segments) {
      if (segment.archived) continue
      counts.set(segment.textId, (counts.get(segment.textId) ?? 0) + 1)
      const current = previews.get(segment.textId)
      if (!current || segment.order < current.order) previews.set(segment.textId, segment)
    }
    return texts
      .filter(isListedText)
      .map((text) => ({
        text,
        stats: statsById.get(text.id),
        segmentCount: counts.get(text.id) ?? 0,
        preview: previews.get(text.id)?.content ?? '',
      }))
      .sort((a, b) => a.text.title.localeCompare(b.text.title))
  }, [])
}
