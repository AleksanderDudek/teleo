import { describe, expect, it } from 'vitest'
import { chimeNotes, PENTATONIC } from './chime'

describe('chimeNotes', () => {
  it('rings one soft bell note plus its fifth for a sentence', () => {
    const notes = chimeNotes('sentence', 0)
    expect(notes).toHaveLength(2)
    expect(notes[0]).toMatchObject({ frequency: PENTATONIC[0], delay: 0 })
    expect(notes[1]!.frequency).toBeCloseTo(PENTATONIC[0]! * 1.5)
    expect(notes.every((n) => n.gain <= 0.12)).toBe(true)
  })

  it('climbs the pentatonic scale with each sentence in a row, and wraps', () => {
    expect(chimeNotes('sentence', 1)[0]!.frequency).toBe(PENTATONIC[1])
    expect(chimeNotes('sentence', 4)[0]!.frequency).toBe(PENTATONIC[4])
    expect(chimeNotes('sentence', PENTATONIC.length)[0]!.frequency).toBe(PENTATONIC[0])
    expect(chimeNotes('sentence', -3)[0]!.frequency).toBe(PENTATONIC[0])
  })

  it('arpeggiates a finished text and rings a longer chord for a goal or a level', () => {
    const text = chimeNotes('text', 0)
    expect(text.map((n) => n.delay)).toEqual([0, 0.08, 0.16])
    const goal = chimeNotes('goal', 0)
    expect(goal.length).toBeGreaterThan(text.length)
    expect(Math.max(...goal.map((n) => n.duration))).toBeGreaterThan(Math.max(...text.map((n) => n.duration)))
  })
})
