/** The 66 books of the Protestant/KJV canon in order, with their USFM codes; the first 39 are the Old Testament. */
export const BIBLE_BOOKS = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH',
  'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON',
  'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI',
  'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
] as const

export type BookCode = (typeof BIBLE_BOOKS)[number]

export const OLD_TESTAMENT_BOOKS = 39

export type Testament = 'ot' | 'nt'

export function testamentOf(book: BookCode): Testament {
  return BIBLE_BOOKS.indexOf(book) < OLD_TESTAMENT_BOOKS ? 'ot' : 'nt'
}

export function isBookCode(value: string): value is BookCode {
  return (BIBLE_BOOKS as readonly string[]).includes(value)
}
