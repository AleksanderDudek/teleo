import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Segment, TextItem, TextStats } from '@/db/types'
import { getActiveSegments } from '@/services/texts'

export interface TextView {
  text: TextItem
  segments: Segment[]
  stats?: TextStats
}

/** One text with its active segments and stats. `null` = not found, `undefined` = loading. */
export function useText(textId: string | undefined): TextView | null | undefined {
  return useLiveQuery(async () => {
    if (!textId) return null
    const text = await db.texts.get(textId)
    if (!text) return null
    const [segments, stats] = await Promise.all([getActiveSegments(textId), db.textStats.get(textId)])
    return { text, segments, stats }
  }, [textId])
}
