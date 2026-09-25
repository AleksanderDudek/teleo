import { describe, expect, it } from 'vitest'
import { clampRepeat, countTemplateSegments, expandTemplate } from './expand'
import type { SegmentsByText, TemplateItem } from './types'

function segs(...ids: string[]): { id: string }[] {
  return ids.map((id) => ({ id }))
}

describe('clampRepeat', () => {
  it.each([
    [0, 1],
    [2.6, 3],
    [999, 150],
    [Number.NaN, 1],
    [1, 1],
    [150, 150],
    [150.4, 150],
    [-3, 1],
  ])('clamps %j to %j', (input, expected) => {
    expect(clampRepeat(input)).toBe(expected)
  })
})

describe('expandTemplate', () => {
  it('expands a rosary decade into 26 fullText entries across 12 blocks', () => {
    const segments: SegmentsByText = new Map([
      ['A', segs('a1', 'a2', 'a3', 'a4')],
      ['B', segs('b1', 'b2')],
      ['C', segs('c1', 'c2')],
    ])
    const items: TemplateItem[] = [
      { textId: 'A', repeat: 1 },
      { textId: 'B', repeat: 10 },
      { textId: 'C', repeat: 1 },
    ]

    const { plan, overLimit, missingTextIds } = expandTemplate(items, segments)

    expect(plan).toHaveLength(26)
    expect(overLimit).toBe(false)
    expect(missingTextIds).toEqual([])
    expect(plan.every((e) => e.fullText)).toBe(true)

    // Block 0: text A, 4 entries
    expect(plan.slice(0, 4).map((e) => e.segmentId)).toEqual(['a1', 'a2', 'a3', 'a4'])
    expect(plan.slice(0, 4).every((e) => e.block === 0 && e.textId === 'A')).toBe(true)

    // Blocks 1..10: text B, 2 entries each
    for (let rep = 0; rep < 10; rep++) {
      const block = plan.slice(4 + rep * 2, 4 + rep * 2 + 2)
      expect(block.map((e) => e.segmentId)).toEqual(['b1', 'b2'])
      expect(block.every((e) => e.block === rep + 1 && e.textId === 'B')).toBe(true)
    }

    // Block 11: text C, 2 entries
    expect(plan.slice(24, 26).map((e) => e.segmentId)).toEqual(['c1', 'c2'])
    expect(plan.slice(24, 26).every((e) => e.block === 11 && e.textId === 'C')).toBe(true)

    const blockNumbers = new Set(plan.map((e) => e.block))
    expect(blockNumbers.size).toBe(12)
    expect(Math.max(...blockNumbers)).toBe(11)
  })

  it('marks a strict subset selection as not fullText, in the requested order', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1', 'a2', 'a3', 'a4')]])
    const items: TemplateItem[] = [{ textId: 'A', repeat: 1, segmentIds: ['a2', 'a4'] }]

    const { plan } = expandTemplate(items, segments)

    expect(plan.map((e) => e.segmentId)).toEqual(['a2', 'a4'])
    expect(plan.every((e) => e.fullText === false)).toBe(true)
  })

  it('marks a reordered full selection as not fullText (order matters)', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1', 'a2', 'a3', 'a4')]])
    const items: TemplateItem[] = [
      { textId: 'A', repeat: 1, segmentIds: ['a4', 'a3', 'a2', 'a1'] },
    ]

    const { plan } = expandTemplate(items, segments)

    expect(plan.map((e) => e.segmentId)).toEqual(['a4', 'a3', 'a2', 'a1'])
    expect(plan.every((e) => e.fullText === false)).toBe(true)
  })

  it('ignores segmentIds not present in the active list', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1', 'a2', 'a3')]])
    const items: TemplateItem[] = [{ textId: 'A', repeat: 1, segmentIds: ['a1', 'zzz', 'a3'] }]

    const { plan, missingTextIds } = expandTemplate(items, segments)

    expect(plan.map((e) => e.segmentId)).toEqual(['a1', 'a3'])
    expect(missingTextIds).toEqual([])
  })

  it('treats an unknown text as missing', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1')]])
    const items: TemplateItem[] = [{ textId: 'Z', repeat: 1 }]

    const { plan, missingTextIds } = expandTemplate(items, segments)

    expect(plan).toEqual([])
    expect(missingTextIds).toEqual(['Z'])
  })

  it('treats a text with no active segments as missing', () => {
    const segments: SegmentsByText = new Map([['E', []]])
    const items: TemplateItem[] = [{ textId: 'E', repeat: 1 }]

    const { plan, missingTextIds } = expandTemplate(items, segments)

    expect(plan).toEqual([])
    expect(missingTextIds).toEqual(['E'])
  })

  it('treats segmentIds that all miss the active list as missing', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1', 'a2')]])
    const items: TemplateItem[] = [{ textId: 'A', repeat: 1, segmentIds: ['zzz', 'yyy'] }]

    const { plan, missingTextIds } = expandTemplate(items, segments)

    expect(plan).toEqual([])
    expect(missingTextIds).toEqual(['A'])
  })

  it('collects missing text ids once, in first-seen order, and skips only those items', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1')]])
    const items: TemplateItem[] = [
      { textId: 'X', repeat: 1 },
      { textId: 'A', repeat: 1 },
      { textId: 'X', repeat: 2 },
      { textId: 'Y', repeat: 1 },
    ]

    const { plan, missingTextIds } = expandTemplate(items, segments)

    expect(missingTextIds).toEqual(['X', 'Y'])
    expect(plan.map((e) => e.textId)).toEqual(['A'])
  })

  it('clamps repeat (0 becomes 1 repetition) when expanding', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1', 'a2')]])
    const items: TemplateItem[] = [{ textId: 'A', repeat: 0 }]

    const { plan } = expandTemplate(items, segments)

    expect(plan).toHaveLength(2)
    expect(plan.every((e) => e.block === 0)).toBe(true)
  })

  it('truncates to 150 entries and marks the cut block as not fullText', () => {
    const dIds = Array.from({ length: 7 }, (_, i) => `d${i + 1}`)
    const segments: SegmentsByText = new Map([['D', segs(...dIds)]])
    const items: TemplateItem[] = [{ textId: 'D', repeat: 25 }] // 175 raw entries, 7 per block

    const { plan, overLimit, missingTextIds } = expandTemplate(items, segments)

    expect(overLimit).toBe(true)
    expect(missingTextIds).toEqual([])
    expect(plan).toHaveLength(150)

    // Block 20 (indices 140..146) is fully included and stays fullText.
    expect(plan[140]?.block).toBe(20)
    expect(plan.slice(140, 147).every((e) => e.fullText === true)).toBe(true)

    // Block 21 (indices 147..153) is cut at 149; the surviving entries lose fullText.
    expect(plan.slice(147, 150).every((e) => e.block === 21)).toBe(true)
    expect(plan.slice(147, 150).every((e) => e.fullText === false)).toBe(true)
    expect(plan[149]?.segmentId).toBe('d3')

    const blockNumbers = new Set(plan.map((e) => e.block))
    expect(blockNumbers.size).toBe(22)
  })

  it('does not set overLimit when the plan lands exactly at 150', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1', 'a2')]])
    const items: TemplateItem[] = [{ textId: 'A', repeat: 75 }] // 150 entries exactly

    const { plan, overLimit } = expandTemplate(items, segments)

    expect(plan).toHaveLength(150)
    expect(overLimit).toBe(false)
    expect(plan.every((e) => e.fullText === true)).toBe(true)
  })
})

describe('countTemplateSegments', () => {
  it('counts the rosary decade total', () => {
    const segments: SegmentsByText = new Map([
      ['A', segs('a1', 'a2', 'a3', 'a4')],
      ['B', segs('b1', 'b2')],
      ['C', segs('c1', 'c2')],
    ])
    const items: TemplateItem[] = [
      { textId: 'A', repeat: 1 },
      { textId: 'B', repeat: 10 },
      { textId: 'C', repeat: 1 },
    ]

    expect(countTemplateSegments(items, segments)).toBe(26)
  })

  it('applies no cap, unlike expandTemplate', () => {
    const dIds = Array.from({ length: 7 }, (_, i) => `d${i + 1}`)
    const segments: SegmentsByText = new Map([['D', segs(...dIds)]])
    const items: TemplateItem[] = [{ textId: 'D', repeat: 25 }]

    expect(countTemplateSegments(items, segments)).toBe(175)
  })

  it('skips missing items without counting them', () => {
    const segments: SegmentsByText = new Map([['A', segs('a1', 'a2')]])
    const items: TemplateItem[] = [
      { textId: 'Z', repeat: 5 },
      { textId: 'A', repeat: 1 },
    ]

    expect(countTemplateSegments(items, segments)).toBe(2)
  })
})
