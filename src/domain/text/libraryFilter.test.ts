import { describe, expect, it } from 'vitest'
import { isFiltered, libraryBackTo, libraryFilterParams, NO_FILTER, readLibraryFilter } from './libraryFilter'

const read = (search: string) => readLibraryFilter(new URLSearchParams(search))

describe('library filter in the URL', () => {
  it('reads an empty search as no filter, and writes no filter as an empty search', () => {
    expect(read('')).toEqual(NO_FILTER)
    expect(libraryFilterParams(NO_FILTER).toString()).toBe('')
    expect(isFiltered(NO_FILTER)).toBe(false)
  })

  it('round-trips every filter', () => {
    const filter = {
      query: 'pokój ',
      types: ['prayer', 'text'] as const,
      source: 'builtin' as const,
      showHidden: true,
      area: 'health' as const,
      need: 'sleep' as const,
    }
    expect(read(libraryFilterParams(filter).toString())).toEqual(filter)
    expect(isFiltered(filter)).toBe(true)
  })

  it('takes the area from the need and drops what it does not know', () => {
    expect(read('need=sleep')).toMatchObject({ area: 'health', need: 'sleep' })
    expect(read('type=psalm&type=prayer&type=prayer&source=everyone&hidden=yes&area=nowhere')).toEqual({
      ...NO_FILTER,
      types: ['prayer'],
    })
  })

  it('counts a need alone as a filter', () => {
    expect(isFiltered(read('area=family'))).toBe(true)
  })
})

describe('libraryBackTo', () => {
  it('returns to the filtered library a text was opened from, and to the library otherwise', () => {
    expect(libraryBackTo({ backTo: '/library?area=health&need=sleep' })).toBe('/library?area=health&need=sleep')
    expect(libraryBackTo({ backTo: '/library' })).toBe('/library')
    expect(libraryBackTo({ backTo: '/settings' })).toBe('/library')
    expect(libraryBackTo({ backTo: '/library-of-alexandria' })).toBe('/library')
    expect(libraryBackTo(null)).toBe('/library')
    expect(libraryBackTo('x')).toBe('/library')
  })
})
