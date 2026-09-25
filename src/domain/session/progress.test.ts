import { describe, expect, it } from 'vitest'
import { blockEntries, isBlockComplete, repetitionInfo, summarizeRun } from './progress'
import type { EntryState, PlanEntry } from './types'

function plan(entries: Array<Partial<PlanEntry> & Pick<PlanEntry, 'block'>>): PlanEntry[] {
  return entries.map((e) => ({
    segmentId: e.segmentId ?? `seg-${e.block}`,
    textId: e.textId ?? 'T',
    block: e.block,
    fullText: e.fullText ?? true,
    item: e.item ?? 0,
  }))
}

/** Rosary decade: items[0] A x1 (4 segs, block 0), items[1] B x10 (2 segs, blocks 1..10),
 *  items[2] C x1 (2 segs, block 11) — 26 entries total. */
function rosaryPlan(): PlanEntry[] {
  const entries: PlanEntry[] = []
  for (let s = 0; s < 4; s++) {
    entries.push({ segmentId: `a${s}`, textId: 'A', block: 0, fullText: true, item: 0 })
  }
  for (let r = 0; r < 10; r++) {
    for (let s = 0; s < 2; s++) {
      entries.push({ segmentId: `b${s}`, textId: 'B', block: r + 1, fullText: true, item: 1 })
    }
  }
  for (let s = 0; s < 2; s++) {
    entries.push({ segmentId: `c${s}`, textId: 'C', block: 11, fullText: true, item: 2 })
  }
  return entries
}

function state(overrides: Partial<EntryState> = {}): EntryState {
  return { status: 'pending', attempts: 0, firstTry: false, xp: 0, ...overrides }
}

describe('blockEntries', () => {
  it('returns the plan indices belonging to a block, in order', () => {
    const p = plan([{ block: 0 }, { block: 0 }, { block: 1 }, { block: 2 }, { block: 1 }])
    expect(blockEntries(p, 1)).toEqual([2, 4])
    expect(blockEntries(p, 0)).toEqual([0, 1])
  })

  it('returns an empty array for a block with no entries', () => {
    const p = plan([{ block: 0 }])
    expect(blockEntries(p, 5)).toEqual([])
  })
})

describe('isBlockComplete', () => {
  it('is true when every entry of the block is accepted', () => {
    const p = plan([{ block: 0 }, { block: 0 }, { block: 1 }])
    const entries = [state({ status: 'accepted' }), state({ status: 'accepted' }), state()]
    expect(isBlockComplete(p, entries, 0)).toBe(true)
  })

  it('is false when any entry of the block is not accepted', () => {
    const p = plan([{ block: 0 }, { block: 0 }])
    const entries = [state({ status: 'accepted' }), state({ status: 'skipped' })]
    expect(isBlockComplete(p, entries, 0)).toBe(false)
  })

  it('is false when any entry of the block is still pending', () => {
    const p = plan([{ block: 0 }, { block: 0 }])
    const entries = [state({ status: 'accepted' }), state({ status: 'pending' })]
    expect(isBlockComplete(p, entries, 0)).toBe(false)
  })

  it('is false for a block that has no entries', () => {
    const p = plan([{ block: 0 }])
    const entries = [state({ status: 'accepted' })]
    expect(isBlockComplete(p, entries, 7)).toBe(false)
  })
})

describe('summarizeRun', () => {
  it('summarizes an empty run', () => {
    expect(summarizeRun([], [])).toEqual({
      total: 0,
      accepted: 0,
      skipped: 0,
      firstTry: 0,
      firstTryRate: 0,
      textsCompleted: 0,
    })
  })

  it('summarizes mixed statuses across full-text and partial blocks', () => {
    const p: PlanEntry[] = [
      // Block 0: fullText, text T1, both accepted, one first-try
      { segmentId: 's1', textId: 'T1', block: 0, fullText: true, item: 0 },
      { segmentId: 's2', textId: 'T1', block: 0, fullText: true, item: 0 },
      // Block 1: fullText, text T2, one skipped -> block not complete
      { segmentId: 's3', textId: 'T2', block: 1, fullText: true, item: 1 },
      { segmentId: 's4', textId: 'T2', block: 1, fullText: true, item: 1 },
      // Block 2: not fullText (partial selection), fully accepted but must not count as a text completion
      { segmentId: 's5', textId: 'T3', block: 2, fullText: false, item: 2 },
      // Block 3: fullText, single entry, pending (not yet attempted)
      { segmentId: 's6', textId: 'T4', block: 3, fullText: true, item: 3 },
    ]
    const entries: EntryState[] = [
      state({ status: 'accepted', firstTry: true }),
      state({ status: 'accepted', firstTry: false }),
      state({ status: 'accepted', firstTry: true }),
      state({ status: 'skipped' }),
      state({ status: 'accepted', firstTry: true }),
      state({ status: 'pending' }),
    ]

    const summary = summarizeRun(p, entries)

    expect(summary.total).toBe(6)
    expect(summary.accepted).toBe(4)
    expect(summary.skipped).toBe(1)
    expect(summary.firstTry).toBe(3)
    expect(summary.firstTryRate).toBeCloseTo(3 / 5)
    // Only block 0 is a fully-accepted fullText block.
    expect(summary.textsCompleted).toBe(1)
  })

  it('computes a firstTryRate of 0 when nothing has been processed yet', () => {
    const p = plan([{ block: 0 }, { block: 0 }])
    const entries = [state(), state()]
    const summary = summarizeRun(p, entries)
    expect(summary.firstTryRate).toBe(0)
  })
})

describe('repetitionInfo', () => {
  it('reports item/rep/reps/block span for an entry mid-way through a repeating item', () => {
    const p = rosaryPlan()
    expect(repetitionInfo(p, 5)).toEqual({ item: 1, rep: 0, reps: 10, blockStart: 4, blockEnd: 5 })
  })

  it('advances rep for the next block of the same item', () => {
    const p = rosaryPlan()
    expect(repetitionInfo(p, 7).rep).toBe(1)
  })

  it('reports the block span for a multi-segment single-repetition item', () => {
    const p = rosaryPlan()
    expect(repetitionInfo(p, 0)).toEqual({ item: 0, rep: 0, reps: 1, blockStart: 0, blockEnd: 3 })
    expect(repetitionInfo(p, 3)).toEqual({ item: 0, rep: 0, reps: 1, blockStart: 0, blockEnd: 3 })
  })

  it('reports reps = 20 for a one-sentence item repeated 20 times', () => {
    const p: PlanEntry[] = Array.from({ length: 20 }, (_, block) => ({
      segmentId: `s${block}`,
      textId: 'S',
      block,
      fullText: true,
      item: 0,
    }))
    expect(repetitionInfo(p, 5)).toEqual({ item: 0, rep: 5, reps: 20, blockStart: 5, blockEnd: 5 })
  })

  it('counts only the blocks actually present in a truncated plan', () => {
    // As if the full item had more repetitions, but the plan was truncated to blocks 0..2.
    const p: PlanEntry[] = [
      { segmentId: 's0', textId: 'S', block: 0, fullText: true, item: 0 },
      { segmentId: 's1', textId: 'S', block: 1, fullText: true, item: 0 },
      { segmentId: 's2', textId: 'S', block: 2, fullText: false, item: 0 },
    ]
    const info = repetitionInfo(p, 2)
    expect(info.reps).toBe(3)
    expect(info.rep).toBe(2)
  })

  it('throws for an out-of-range index', () => {
    const p = rosaryPlan()
    expect(() => repetitionInfo(p, 999)).toThrow(RangeError)
  })
})
