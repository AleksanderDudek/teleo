/*
 * What a text is prayed for: a language-independent taxonomy of areas of life and the needs inside them
 * (DECISIONS #125). A text carries `needs` (the first is its main need); labels live in i18n
 * (`needs.areas.*`, `needs.items.*`), so one classification serves every language. Pure module.
 */

export const NEEDS_BY_AREA = {
  emotions: ['anxiety', 'sadness', 'peace', 'grief', 'shame'],
  health: ['healing', 'sleep', 'fertility', 'longLife', 'strength'],
  family: ['marriage', 'spouse', 'children', 'home', 'forgiveness'],
  work: ['money', 'job', 'business', 'favor', 'studies'],
  direction: ['breakthrough', 'wisdom', 'purpose', 'restoration'],
  deliverance: ['protection', 'bloodline', 'warfare', 'words', 'addiction', 'enemies'],
  spiritual: ['closeness', 'holiness', 'faith', 'gifts', 'church'],
  stages: ['youth', 'newStart', 'oldAge'],
  daily: ['morning', 'evening', 'thanksgiving', 'traditional', 'scripture'],
} as const

export type NeedArea = keyof typeof NEEDS_BY_AREA
export type NeedId = (typeof NEEDS_BY_AREA)[NeedArea][number]

/** Areas in the order the library shows them. */
export const NEED_AREAS = Object.keys(NEEDS_BY_AREA) as NeedArea[]

const AREA_OF = new Map<string, NeedArea>(
  NEED_AREAS.flatMap((area) => NEEDS_BY_AREA[area].map((need) => [need, area] as const)),
)

export const NEED_IDS = [...AREA_OF.keys()] as NeedId[]

export const isNeedId = (value: unknown): value is NeedId => typeof value === 'string' && AREA_OF.has(value)
export const isNeedArea = (value: unknown): value is NeedArea =>
  typeof value === 'string' && Object.hasOwn(NEEDS_BY_AREA, value)

export const areaOf = (need: NeedId): NeedArea => AREA_OF.get(need) as NeedArea

interface WithNeeds {
  needs?: readonly string[]
}

/** The known needs of a text, in order and once each; ids this version does not know (a newer backup) are ignored. */
export function needsOf(text: WithNeeds): NeedId[] {
  return [...new Set(text.needs ?? [])].filter(isNeedId)
}

/** The need a text is mainly for (its first known one). */
export const mainNeed = (text: WithNeeds): NeedId | undefined => needsOf(text)[0]

export interface NeedFilter {
  area?: NeedArea
  need?: NeedId
}

/** A text matches a need when it carries it anywhere in its list, and an area through any of that area's needs. */
export function matchesNeed(text: WithNeeds, filter: NeedFilter): boolean {
  if (filter.need) return needsOf(text).includes(filter.need)
  if (filter.area) return needsOf(text).some((need) => areaOf(need) === filter.area)
  return true
}

/** 0 for a text mainly for the chosen need (or of the chosen area), 1 for one that only touches it — the library lists
 * the first kind first, so "peace of heart" opens with prayers for peace, not with one that mentions it. */
export function needRank(text: WithNeeds, filter: NeedFilter): number {
  const main = mainNeed(text)
  if (filter.need) return main === filter.need ? 0 : 1
  if (filter.area) return main && areaOf(main) === filter.area ? 0 : 1
  return 0
}

/** How many texts each area and each need would show (a text counts once per area, however many of its needs). */
export function countNeeds(texts: Iterable<WithNeeds>): { areas: Map<NeedArea, number>; needs: Map<NeedId, number> } {
  const areas = new Map<NeedArea, number>()
  const needs = new Map<NeedId, number>()
  for (const text of texts) {
    const own = needsOf(text)
    for (const need of own) needs.set(need, (needs.get(need) ?? 0) + 1)
    for (const area of new Set(own.map(areaOf))) areas.set(area, (areas.get(area) ?? 0) + 1)
  }
  return { areas, needs }
}

/** Reads `?area=…&need=…`: a known need brings its own area; unknown values are dropped. */
export function parseNeedFilter(area: string | null, need: string | null): NeedFilter {
  if (isNeedId(need)) return { area: areaOf(need), need }
  return isNeedArea(area) ? { area } : {}
}
