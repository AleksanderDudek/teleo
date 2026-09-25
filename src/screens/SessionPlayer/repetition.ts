import { repetitionInfo, type PlanEntry } from '@/domain/session'

export interface RepetitionLabel {
  label: string
  /** 1-based repetition being spoken now. */
  current: number
  total: number
  /** One-sentence item: show pips. */
  single: boolean
}

/** Counter for repeated template items ("Zdrowaś Maryjo · 3/10"); nothing for single repetitions. */
export function repetitionLabel(plan: readonly PlanEntry[], index: number, titleOf: (textId: string) => string): RepetitionLabel | undefined {
  const entry = plan[index]
  if (!entry) return undefined
  const info = repetitionInfo(plan, index)
  if (info.reps < 2) return undefined
  return { label: titleOf(entry.textId), current: info.rep + 1, total: info.reps, single: info.blockStart === info.blockEnd }
}
