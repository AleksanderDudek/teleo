import { describe, expect, it } from 'vitest'
import { firstTryCombo } from './combo'
import type { EntryState } from './types'

const entry = (status: EntryState['status'], firstTry = status === 'accepted'): EntryState => ({ status, attempts: 1, firstTry, xp: 0 })

describe('firstTryCombo', () => {
  it('counts sentences in a row accepted on the first try, ending at the given one', () => {
    const entries = [entry('accepted'), entry('accepted', false), entry('accepted'), entry('accepted'), entry('accepted'), entry('pending')]
    expect(firstTryCombo(entries, 4)).toBe(3)
    expect(firstTryCombo(entries, 0)).toBe(1)
  })

  it('is 0 when the sentence itself needed another try, and a skip breaks the chain', () => {
    expect(firstTryCombo([entry('accepted'), entry('accepted', false)], 1)).toBe(0)
    expect(firstTryCombo([entry('accepted'), entry('skipped'), entry('accepted')], 2)).toBe(1)
  })
})
