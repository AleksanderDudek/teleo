/** What just happened, from the smallest to the biggest reward. */
export type ChimeKind = 'sentence' | 'text' | 'goal'

export interface ChimeNote {
  /** Hz */
  frequency: number
  /** Seconds after the chime starts. */
  delay: number
  /** Seconds until the note has faded. */
  duration: number
  /** Peak gain, 0…1 (kept soft: the microphone may still be listening). */
  gain: number
}

/** C major pentatonic from C6: any two notes sound well together, so a rising combo never clashes. */
export const PENTATONIC = [1046.5, 1174.66, 1318.51, 1567.98, 1760] as const

const note = (frequency: number, delay: number, duration: number, gain: number): ChimeNote => ({ frequency, delay, duration, gain })

/**
 * Notes of the gold chime. A sentence rings a bell note and its fifth; `step` (sentences in a row) climbs
 * the pentatonic scale, so a fluent run of sentences plays a little melody. A finished text arpeggiates
 * a major triad; a met goal or a new level rings a fuller, longer chord.
 */
export function chimeNotes(kind: ChimeKind, step: number): ChimeNote[] {
  if (kind === 'sentence') {
    const root = PENTATONIC[Math.max(0, Math.trunc(step)) % PENTATONIC.length]!
    return [note(root, 0, 0.7, 0.09), note(root * 1.5, 0, 0.5, 0.035)]
  }
  if (kind === 'text') return [note(1046.5, 0, 0.8, 0.08), note(1318.51, 0.08, 0.8, 0.07), note(1567.98, 0.16, 1, 0.07)]
  return [note(523.25, 0, 1.4, 0.06), note(659.25, 0.07, 1.4, 0.06), note(783.99, 0.14, 1.4, 0.06), note(1046.5, 0.21, 1.6, 0.08), note(1567.98, 0.28, 1.2, 0.04)]
}
