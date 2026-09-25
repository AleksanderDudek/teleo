import { describe, expect, it } from 'vitest'
import { align } from './align'

const words = (text: string) => (text === '' ? [] : text.split(' '))
const opsOf = (source: string, spoken: string) =>
  align(words(source), words(spoken)).ops.map((entry) => entry.op)

describe('align', () => {
  it('matches identical sequences at zero cost', () => {
    expect(align(['hail', 'mary'], ['hail', 'mary'])).toEqual({
      ops: [
        { op: 'match', source: 'hail', spoken: 'hail', sourceIndex: 0 },
        { op: 'match', source: 'mary', spoken: 'mary', sourceIndex: 1 },
      ],
      cost: 0,
    })
  })

  it('charges 0.2 for a near match', () => {
    expect(align(['chleba', 'naszego'], ['chleba', 'waszego'])).toEqual({
      ops: [
        { op: 'match', source: 'chleba', spoken: 'chleba', sourceIndex: 0 },
        { op: 'near', source: 'naszego', spoken: 'waszego', sourceIndex: 1 },
      ],
      cost: 0.2,
    })
  })

  it('charges 1 for a missing source word', () => {
    expect(align(['jestem', 'i', 'pewny'], ['jestem', 'pewny'])).toEqual({
      ops: [
        { op: 'match', source: 'jestem', spoken: 'jestem', sourceIndex: 0 },
        { op: 'missing', source: 'i', sourceIndex: 1 },
        { op: 'match', source: 'pewny', spoken: 'pewny', sourceIndex: 2 },
      ],
      cost: 1,
    })
  })

  it('charges 1 for an extra spoken word and keeps it at its spoken position', () => {
    expect(align(['jestem', 'spokojny'], ['jestem', 'bardzo', 'spokojny'])).toEqual({
      ops: [
        { op: 'match', source: 'jestem', spoken: 'jestem', sourceIndex: 0 },
        { op: 'extra', spoken: 'bardzo' },
        { op: 'match', source: 'spokojny', spoken: 'spokojny', sourceIndex: 1 },
      ],
      cost: 1,
    })
  })

  it('prefers one substitution (1.5) over missing + extra (2)', () => {
    expect(align(['i', 'am', 'calm'], ['i', 'am', 'cold'])).toEqual({
      ops: [
        { op: 'match', source: 'i', spoken: 'i', sourceIndex: 0 },
        { op: 'match', source: 'am', spoken: 'am', sourceIndex: 1 },
        { op: 'wrong', source: 'calm', spoken: 'cold', sourceIndex: 2 },
      ],
      cost: 1.5,
    })
  })

  it('adds up mixed costs', () => {
    expect(align(words('zdrowaś maryjo łaski'), words('zdrowas łaski')).cost).toBe(1.2)
  })

  it('handles empty sequences', () => {
    expect(align([], [])).toEqual({ ops: [], cost: 0 })
    expect(opsOf('ojcze nasz', '')).toEqual(['missing', 'missing'])
    expect(opsOf('', 'ojcze nasz')).toEqual(['extra', 'extra'])
    expect(align([], ['amen']).cost).toBe(1)
  })

  it('reports a duplicated word once as extra', () => {
    const { ops, cost } = align(words('grateful for today'), words('grateful for for today'))
    expect(cost).toBe(1)
    expect(ops.filter((entry) => entry.op === 'extra')).toEqual([{ op: 'extra', spoken: 'for' }])
    expect(ops.filter((entry) => entry.op === 'match')).toHaveLength(3)
  })

  it('lists ops in source order with extras where they were spoken', () => {
    expect(opsOf('ojcze nasz', 'amen ojcze nasz ojcze nasz')).toEqual([
      'extra',
      'extra',
      'extra',
      'match',
      'match',
    ])
    expect(opsOf('one two three', 'one two x three y')).toEqual([
      'match',
      'match',
      'extra',
      'match',
      'extra',
    ])
  })

  it('breaks ties in favour of the diagonal over an extra word', () => {
    // Both readings cost 1; backtracking from the end takes the diagonal first,
    // so the later repetition is the matched one.
    expect(align(['amen'], ['amen', 'amen']).ops).toEqual([
      { op: 'extra', spoken: 'amen' },
      { op: 'match', source: 'amen', spoken: 'amen', sourceIndex: 0 },
    ])
  })

  it('breaks ties in favour of the diagonal over a missing word', () => {
    // "missing alpha + bravo→xray" and "alpha→xray + missing bravo" both cost 2.5.
    expect(align(['alpha', 'bravo'], ['xray']).ops).toEqual([
      { op: 'missing', source: 'alpha', sourceIndex: 0 },
      { op: 'wrong', source: 'bravo', spoken: 'xray', sourceIndex: 1 },
    ])
  })
})
