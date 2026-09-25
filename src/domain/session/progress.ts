import type { EntryState, PlanEntry } from './types'

/** Indices into `plan` of the entries belonging to `block`, in plan order. */
export function blockEntries(plan: readonly PlanEntry[], block: number): number[] {
  const indices: number[] = []
  plan.forEach((entry, index) => {
    if (entry.block === block) indices.push(index)
  })
  return indices
}

/** Whether `block` has at least one entry and every one of them was accepted. */
export function isBlockComplete(
  plan: readonly PlanEntry[],
  entries: readonly EntryState[],
  block: number,
): boolean {
  const indices = blockEntries(plan, block)
  return indices.length > 0 && indices.every((i) => entries[i]?.status === 'accepted')
}

/**
 * Repetition counters for the entry at `index`, used by live mode to show
 * "Hail Mary 3 of 10"-style progress: `rep` is the 0-based rank of this
 * entry's block among all blocks of the same template item present in the
 * plan, `reps` is how many such blocks the plan holds (only those actually
 * present — a truncated plan counts fewer), and `blockStart`/`blockEnd` are
 * the inclusive plan indices of the entry's own block.
 */
export function repetitionInfo(
  plan: readonly PlanEntry[],
  index: number,
): { item: number; rep: number; reps: number; blockStart: number; blockEnd: number } {
  const entry = plan[index]
  if (!entry) throw new RangeError(`No plan entry at index ${index}`)

  const blocksForItem: number[] = []
  const seenBlocks = new Set<number>()
  for (const e of plan) {
    if (e.item === entry.item && !seenBlocks.has(e.block)) {
      seenBlocks.add(e.block)
      blocksForItem.push(e.block)
    }
  }
  blocksForItem.sort((a, b) => a - b)

  const indices = blockEntries(plan, entry.block)
  const blockStart = indices[0] ?? index
  const blockEnd = indices[indices.length - 1] ?? index

  return {
    item: entry.item,
    rep: blocksForItem.indexOf(entry.block),
    reps: blocksForItem.length,
    blockStart,
    blockEnd,
  }
}

/** Aggregate stats for a session run, used for the end-of-session summary screen. */
export function summarizeRun(
  plan: readonly PlanEntry[],
  entries: readonly EntryState[],
): {
  total: number
  accepted: number
  skipped: number
  firstTry: number
  firstTryRate: number
  textsCompleted: number
} {
  let accepted = 0
  let skipped = 0
  let firstTry = 0
  const blocks = new Map<number, { fullText: boolean; allAccepted: boolean }>()

  plan.forEach((entry, index) => {
    const status = entries[index]?.status
    if (status === 'accepted') {
      accepted += 1
      if (entries[index]?.firstTry) firstTry += 1
    } else if (status === 'skipped') {
      skipped += 1
    }

    const info = blocks.get(entry.block) ?? { fullText: entry.fullText, allAccepted: true }
    info.allAccepted = info.allAccepted && status === 'accepted'
    blocks.set(entry.block, info)
  })

  let textsCompleted = 0
  for (const info of blocks.values()) {
    if (info.fullText && info.allAccepted) textsCompleted += 1
  }

  const processed = accepted + skipped
  const firstTryRate = processed === 0 ? 0 : firstTry / processed

  return { total: plan.length, accepted, skipped, firstTry, firstTryRate, textsCompleted }
}
