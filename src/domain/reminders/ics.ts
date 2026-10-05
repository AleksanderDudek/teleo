/** One daily-repeating event of the reminder calendar (spec §12). */
export interface IcsEvent {
  uid: string
  title: string
  description: string
  /** 24h `HH:MM`. */
  time: string
  /** First occurrence's date (local). */
  startDate: Date
  /** Last occurrence's date (local, inclusive); the event repeats forever without it. */
  untilDate?: Date
}

export interface CalendarOptions {
  events: readonly IcsEvent[]
  /** Appended to every description and set as each event's URL. */
  url: string
  now: Date
}

/** Options for a single daily-repeating calendar reminder. */
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

const LINE_BREAK_RE = /[\r\n]/

function assertValidDate(date: Date, label: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid ${label}: not a valid Date`)
  }
}

function assertNoLineBreak(value: string, label: string): void {
  if (LINE_BREAK_RE.test(value)) {
    throw new RangeError(`Invalid ${label}: must not contain a line break`)
  }
}

function eventLines(event: IcsEvent, url: string, dtstamp: string): string[] {
  if (!TIME_RE.test(event.time)) {
    throw new RangeError(`Invalid time: ${event.time}`)
  }
  assertValidDate(event.startDate, 'startDate')
  if (event.untilDate) assertValidDate(event.untilDate, 'untilDate')
  assertNoLineBreak(event.uid, 'uid')

  const hhmm = event.time.replace(':', '')
  const dtstart = `${formatLocalDatePart(event.startDate)}T${hhmm}00`
  // A floating DTSTART takes a floating UNTIL (RFC 5545 §3.3.10): the end of the last day, local time.
  const rrule = event.untilDate ? `RRULE:FREQ=DAILY;UNTIL=${formatLocalDatePart(event.untilDate)}T235959` : 'RRULE:FREQ=DAILY'
  const description = escapeIcsText(`${event.description}\n${url}`)
  const summary = escapeIcsText(event.title)

  return [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    'DURATION:PT10M',
    rrule,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ]
}

/** Builds a calendar of floating-local-time, daily-repeating events as an RFC 5545 .ics file. */
export function buildCalendarIcs(options: CalendarOptions): string {
  assertValidDate(options.now, 'now')
  assertNoLineBreak(options.url, 'url')
  const dtstamp = formatUtcStamp(options.now)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Teleo//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...options.events.flatMap((event) => eventLines(event, options.url, dtstamp)),
    'END:VCALENDAR',
  ]

  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

/** Builds a single floating-local-time, daily-repeating reminder as an RFC 5545 .ics file. */
export function buildDailyReminderIcs(options: DailyReminderOptions): string {
  assertValidDate(options.now, 'now')
  return buildCalendarIcs({
    now: options.now,
    url: options.url,
    events: [
      {
        uid: options.uid,
        title: options.title,
        description: options.description,
        time: options.time,
        startDate: options.startDate ?? options.now,
      },
    ],
  })
}
