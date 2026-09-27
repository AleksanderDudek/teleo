import type { EntryState } from './types'

/** Sentences in a row accepted on the first try, ending at `index` (0 if that one needed another try). */
export function firstTryCombo(entries: readonly EntryState[], index: number): number {
  let count = 0
  for (let i = index; i >= 0; i--) {
    const entry = entries[i]
    if (entry?.status !== 'accepted' || !entry.firstTry) break
    count++
  }
  return count
}
