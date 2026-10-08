import { TEXT_TYPES, type TextType } from '@/domain/types'
import { parseNeedFilter, type NeedArea, type NeedId } from './needs'

export type SourceFilter = 'all' | 'builtin' | 'user'

/**
 * What the library shows. It lives in the URL (`/library?area=health&need=sleep&type=prayer&q=…`), so the way back
 * from a text returns to the same list and a need on a text page is a plain link (DECISIONS #125).
 */
export interface LibraryFilter {
  /** As typed (not trimmed: the search box is bound to it). */
  query: string
  types: readonly TextType[]
  source: SourceFilter
  showHidden: boolean
  area?: NeedArea
  need?: NeedId
}

export const NO_FILTER: LibraryFilter = { query: '', types: [], source: 'all', showHidden: false }

const isTextType = (value: string): value is TextType => (TEXT_TYPES as readonly string[]).includes(value)

/** Reads the filter from search params; values this version does not know are dropped. */
export function readLibraryFilter(params: URLSearchParams): LibraryFilter {
  const source = params.get('source')
  return {
    query: params.get('q') ?? '',
    types: [...new Set(params.getAll('type').filter(isTextType))],
    source: source === 'builtin' || source === 'user' ? source : 'all',
    showHidden: params.get('hidden') === '1',
    ...parseNeedFilter(params.get('area'), params.get('need')),
  }
}

/** The search params of a filter; defaults are left out, so the plain library stays `/library`. */
export function libraryFilterParams(filter: LibraryFilter): URLSearchParams {
  const params = new URLSearchParams()
  if (filter.query) params.set('q', filter.query)
  if (filter.area) params.set('area', filter.area)
  if (filter.need) params.set('need', filter.need)
  for (const type of filter.types) params.append('type', type)
  if (filter.source !== 'all') params.set('source', filter.source)
  if (filter.showHidden) params.set('hidden', '1')
  return params
}

/** Whether anything narrows the list (the results line then offers to clear it). */
export const isFiltered = (filter: LibraryFilter): boolean => libraryFilterParams(filter).toString() !== ''

/** Where a text page's back arrow goes: the filtered library it was opened from (link state), else the library. */
export function libraryBackTo(state: unknown): string {
  const backTo = typeof state === 'object' && state !== null ? (state as { backTo?: unknown }).backTo : undefined
  return typeof backTo === 'string' && /^\/library(\?|$)/.test(backTo) ? backTo : '/library'
}
