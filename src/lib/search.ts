/** Case- and diacritic-insensitive form for search ("zdrowas" finds "Zdrowaś"). */
export function searchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
}
