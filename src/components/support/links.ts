/** Published app — the address at the end of every shared post. */
export const APP_URL = 'https://aleksanderdudek.github.io/teleo/'

/** The author's coffee jar, the same one as in gym-training-tracker. */
export const SUPPORT_URL = 'https://buycoffee.to/uriel'

const TIPS = [
  'support.tip1',
  'support.tip2',
  'support.tip3',
  'support.tip4',
  'support.tip5',
  'support.tip6',
  'support.tip7',
  'support.tip8',
  'support.tip9',
  'support.tip10',
] as const

/** The Guardian's word for a given day: the same all day long, a different one tomorrow. */
export function tipOfTheDay(dayKey: string): (typeof TIPS)[number] {
  const days = Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86_400_000)
  return TIPS[((Number.isFinite(days) ? days : 0) % TIPS.length + TIPS.length) % TIPS.length]!
}
