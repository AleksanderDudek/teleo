import { MAX_REPEAT, MAX_SESSION_SEGMENTS } from './types'
import type { PlanEntry, SegmentsByText, TemplateItem } from './types'

/** Round `repeat` and clamp it to the 1..MAX_REPEAT range a single item may legally repeat. */
export function clampRepeat(repeat: number): number {
  if (Number.isNaN(repeat)) return 1
  return Math.min(MAX_REPEAT, Math.max(1, Math.round(repeat)))
}

interface ResolvedItem {
  segmentIds: string[]
  fullText: boolean
}

/**
 * Resolves one template item against the active segments of its text: the
 * ordered list of segment ids to speak, and whether that is the whole text.
 * Returns `null` when the text is unknown, has no active segments, or the
 * requested `segmentIds` don't overlap the active list at all.
 */
function resolveItem(item: TemplateItem, segments: SegmentsByText): ResolvedItem | null {
  const active = segments.get(item.textId)
  if (!active || active.length === 0) return null

  const activeIds = active.map((segment) => segment.id)
  if (!item.segmentIds) {
    return { segmentIds: activeIds, fullText: true }
  }

  const activeIdSet = new Set(activeIds)
  const seen = new Set<string>()
  const selected: string[] = []
  for (const id of item.segmentIds) {
    if (!activeIdSet.has(id) || seen.has(id)) continue
    seen.add(id)
    selected.push(id)
  }
  if (selected.length === 0) return null

  const fullText =
    selected.length === activeIds.length && selected.every((id, i) => id === activeIds[i])
  return { segmentIds: selected, fullText }
}

/** Total segments a template would expand to, ignoring the 150-segment session cap. */
export function countTemplateSegments(
  items: readonly TemplateItem[],
  segments: SegmentsByText,
): number {
  let total = 0
  for (const item of items) {
    const resolved = resolveItem(item, segments)
    if (!resolved) continue
    total += clampRepeat(item.repeat) * resolved.segmentIds.length
  }
  return total
}

/**
 * Expands a session template into a flat plan of segments to speak in order.
 * Unknown/empty texts are skipped and reported in `missingTextIds`. When the
 * plan would exceed `MAX_SESSION_SEGMENTS`, it is truncated and `overLimit`
 * is set; a block cut mid-way by the truncation is marked `fullText: false`
 * on its surviving entries, since a partial block is not a text repetition.
 */
export function expandTemplate(
  items: readonly TemplateItem[],
  segments: SegmentsByText,
): { plan: PlanEntry[]; overLimit: boolean; missingTextIds: string[] } {
  const plan: PlanEntry[] = []
  const missingTextIds: string[] = []
  const seenMissing = new Set<string>()
  let block = 0
  // Once we've collected one entry past the cap, we know overLimit and can
  // tell whether the cut fell mid-block — no need to build the rest of a
  // potentially huge plan. Missing-text detection still runs for every item.
  let full = false

  items.forEach((item, itemIndex) => {
    const resolved = resolveItem(item, segments)
    if (!resolved) {
      if (!seenMissing.has(item.textId)) {
        seenMissing.add(item.textId)
        missingTextIds.push(item.textId)
      }
      return
    }
    if (full) return

    const repeat = clampRepeat(item.repeat)
    repsLoop: for (let r = 0; r < repeat; r++) {
      const currentBlock = block
      block += 1
      for (const segmentId of resolved.segmentIds) {
        plan.push({
          segmentId,
          textId: item.textId,
          block: currentBlock,
          fullText: resolved.fullText,
          item: itemIndex,
        })
        if (plan.length > MAX_SESSION_SEGMENTS) {
          full = true
          break repsLoop
        }
      }
    }
  })

  if (plan.length <= MAX_SESSION_SEGMENTS) {
    return { plan, overLimit: false, missingTextIds }
  }

  const truncated = plan.slice(0, MAX_SESSION_SEGMENTS)
  const lastEntry = truncated[truncated.length - 1]
  const cutBlock = lastEntry?.block
  const wasCutMidBlock = plan[MAX_SESSION_SEGMENTS]?.block === cutBlock

  if (wasCutMidBlock) {
    for (const entry of truncated) {
      if (entry.block === cutBlock) entry.fullText = false
    }
  }

  return { plan: truncated, overLimit: true, missingTextIds }
}
