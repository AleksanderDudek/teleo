/** Options for a daily-repeating calendar reminder (spec §12). */
export interface DailyReminderOptions {
  /** 24h `HH:MM`. */
  time: string
  title: string
  description: string
  url: string
  uid: string
  now: Date
  /** First occurrence's date; defaults to `now`'s local date. */
  startDate?: Date
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_LINE_OCTETS = 75

const pad2 = (n: number): string => String(n).padStart(2, '0')
const pad4 = (n: number): string => String(n).padStart(4, '0')

function formatUtcStamp(date: Date): string {
  return (
    `${pad4(date.getUTCFullYear())}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  )
}

function formatLocalDatePart(date: Date): string {
  return `${pad4(date.getFullYear())}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

/** Escapes TEXT-type ICS content per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const utf8Encoder = new TextEncoder()

/**
 * Folds one logical content line to RFC 5545's 75-octet limit: the first
 * physical line holds up to 75 UTF-8 bytes, each continuation is a CRLF plus
 * a single leading space followed by up to 74 more bytes. Splits only occur
 * between whole Unicode characters, never inside a multi-byte one.
 */
export function foldIcsLine(line: string): string {
  let result = ''
  let lineBytes = 0
  let budget = MAX_LINE_OCTETS

  for (const char of line) {
    const charBytes = utf8Encoder.encode(char).length
    if (lineBytes + charBytes > budget) {
      result += '\r\n '
      lineBytes = 0
      budget = MAX_LINE_OCTETS - 1
    }
    result += char
    lineBytes += charBytes
  }

  return result
}

/** Builds a floating-local-time, daily-repeating reminder as an RFC 5545 .ics file. */
export function buildDailyReminderIcs(options: DailyReminderOptions): string {
  if (!TIME_RE.test(options.time)) {
    throw new RangeError(`Invalid time: ${options.time}`)
  }

  const hhmm = options.time.replace(':', '')
  const dtstamp = formatUtcStamp(options.now)
  const dtstart = `${formatLocalDatePart(options.startDate ?? options.now)}T${hhmm}00`
  const description = escapeIcsText(`${options.description}\n${options.url}`)
  const summary = escapeIcsText(options.title)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Teleo//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${options.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `URL:${options.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}
