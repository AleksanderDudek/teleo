import type { PlanEntry } from '@/domain/session'

/**
 * Repetition counter for the current entry: consecutive blocks of the same text
 * with the same segments form a group ("Zdrowaś Maryjo · 3/10"). Groups of one
 * block show nothing.
 */
export function repetitionLabel(
  plan: readonly PlanEntry[],
  index: number,
  titleOf: (textId: string) => string,
): { label: string; current: number; total: number; single: boolean } | undefined {
  const entry = plan[index]
  if (!entry) return undefined
  const blockSignature = (block: number) =>
    plan
      .filter((e) => e.block === block)
      .map((e) => e.segmentId)
      .join('|')
  const signature = blockSignature(entry.block)
  const blocks = [...new Set(plan.map((e) => e.block))]
  const position = blocks.indexOf(entry.block)
  let first = position
  while (first > 0 && blockSignature(blocks[first - 1]!) === signature) first--
  let last = position
  while (last < blocks.length - 1 && blockSignature(blocks[last + 1]!) === signature) last++
  const total = last - first + 1
  if (total < 2) return undefined
  return {
    label: titleOf(entry.textId),
    current: position - first + 1,
    total,
    single: signature.split('|').length === 1,
  }
}
