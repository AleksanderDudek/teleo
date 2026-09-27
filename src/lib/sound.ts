import { chimeNotes, type ChimeKind } from '@/domain/feedback/chime'

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null
  context ??= new window.AudioContext()
  return context
}

/**
 * Browsers start audio suspended until a user gesture. Call from a tap (the microphone button) so the
 * first chime of a hands-free session is not lost.
 */
export function unlockAudio(): void {
  const ctx = audio()
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {})
}

/**
 * Plays a synthesized gold chime (no audio files: nothing to download or cache). Silent when the page is
 * hidden or audio is unavailable; never throws.
 */
export function playChime(kind: ChimeKind, step = 0): void {
  try {
    const ctx = audio()
    if (!ctx || document.visibilityState === 'hidden') return
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    const start = ctx.currentTime + 0.01
    for (const n of chimeNotes(kind, step)) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = n.frequency
      const t0 = start + n.delay
      // A bell: near-instant attack, long exponential decay.
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(n.gain, t0 + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + n.duration + 0.05)
    }
  } catch {
    // Audio is a nicety; a failing AudioContext must never interrupt a prayer.
  }
}
