const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const

/** File and storage sizes the way file managers show them (decimal units: 1 kB = 1000 bytes). */
export function formatBytes(bytes: number, locale: string): string {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit++
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: UNITS[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit > 0 && value < 10 ? 1 : 0,
  }).format(value)
}
