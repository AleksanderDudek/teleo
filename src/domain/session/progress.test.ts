import { describe, expect, it } from 'vitest'
import { blockEntries, isBlockComplete, summarizeRun } from './progress'
import type { EntryState, PlanEntry } from './types'

function plan(entries: Array<Partial<PlanEntry> & Pick<PlanEntry, 'block'>>): PlanEntry[] {
  return entries.map((e) => ({
    segmentId: e.segmentId ?? `seg-${e.block}`,
    textId: e.textId ?? 'T',
    block: e.block,
    fullText: e.fullText ?? true,
  }))
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
      { segmentId: 's1', textId: 'T1', block: 0, fullText: true },
      { segmentId: 's2', textId: 'T1', block: 0, fullText: true },
      // Block 1: fullText, text T2, one skipped -> block not complete
      { segmentId: 's3', textId: 'T2', block: 1, fullText: true },
      { segmentId: 's4', textId: 'T2', block: 1, fullText: true },
      // Block 2: not fullText (partial selection), fully accepted but must not count as a text completion
      { segmentId: 's5', textId: 'T3', block: 2, fullText: false },
      // Block 3: fullText, single entry, pending (not yet attempted)
      { segmentId: 's6', textId: 'T4', block: 3, fullText: true },
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
