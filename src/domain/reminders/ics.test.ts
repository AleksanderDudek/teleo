import { describe, expect, it } from 'vitest'
import { buildDailyReminderIcs, escapeIcsText, foldIcsLine } from './ics'

const baseOptions = {
  time: '07:00',
  title: 'Teleo reminder',
  description: 'Say your daily prayer',
  url: 'https://teleo.app/s/abc',
  uid: 'teleo-daily-reminder',
  now: new Date(Date.UTC(2026, 8, 25, 5, 3, 9)),
  startDate: new Date(2026, 0, 15), // local 2026-01-15, Europe/Warsaw
}

describe('buildDailyReminderIcs', () => {
  it('produces the full VCALENDAR/VEVENT/VALARM structure in order', () => {
    const ics = buildDailyReminderIcs(baseOptions)
    const lines = ics.split('\r\n')
    expect(lines[lines.length - 1]).toBe('') // trailing CRLF leaves an empty tail
    const content = lines.slice(0, -1)

    expect(content).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Teleo//Daily reminder//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:teleo-daily-reminder',
      'DTSTAMP:20260925T050309Z',
      'DTSTART:20260115T070000',
      'DURATION:PT10M',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Teleo reminder',
      'DESCRIPTION:Say your daily prayer\\nhttps://teleo.app/s/abc',
      'URL:https://teleo.app/s/abc',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Teleo reminder',
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ])
  })

  it('uses CRLF line endings throughout, never a bare LF or CR', () => {
    const ics = buildDailyReminderIcs(baseOptions)
    expect(ics.endsWith('\r\n')).toBe(true)
    const withoutCrlf = ics.replace(/\r\n/g, '')
    expect(withoutCrlf).not.toContain('\n')
    expect(withoutCrlf).not.toContain('\r')
  })

  it('formats DTSTAMP in UTC from `now`, regardless of local timezone', () => {
    const ics = buildDailyReminderIcs({ ...baseOptions, now: new Date(Date.UTC(2026, 0, 5, 1, 2, 3)) })
    expect(ics).toContain('DTSTAMP:20260105T010203Z\r\n')
  })

  it('emits a floating local DTSTART (no Z, no TZID) from startDate + time', () => {
    const ics = buildDailyReminderIcs({ ...baseOptions, time: '21:45' })
    expect(ics).toContain('DTSTART:20260115T214500\r\n')
    expect(ics).not.toMatch(/DTSTART[^\r\n]*Z/)
    expect(ics).not.toContain('TZID')
  })

  it('defaults DTSTART to the local date of `now` when startDate is omitted', () => {
    // Local 2026-03-10 00:30 in Europe/Warsaw is 2026-03-09 23:30 UTC: local and UTC dates differ.
    const now = new Date(2026, 2, 10, 0, 30, 0)
    const ics = buildDailyReminderIcs({ ...baseOptions, now, startDate: undefined, time: '07:00' })
    expect(ics).toContain('DTSTAMP:20260309T233000Z\r\n')
    expect(ics).toContain('DTSTART:20260310T070000\r\n')
  })

  it('escapes the summary and appends the raw url to an escaped description', () => {
    const ics = buildDailyReminderIcs({
      ...baseOptions,
      title: 'Czas na Teleo; módl się, proszę',
      description: 'Krótka modlitwa',
    })
    expect(ics).toContain('SUMMARY:Czas na Teleo\\; módl się\\, proszę\r\n')
    expect(ics).toContain('DESCRIPTION:Krótka modlitwa\\nhttps://teleo.app/s/abc\r\n')
    expect(ics).toContain('URL:https://teleo.app/s/abc\r\n')
    // The VALARM's DESCRIPTION carries the escaped title, not the body description.
    const afterAlarm = ics.split('BEGIN:VALARM')[1]
    expect(afterAlarm).toContain('DESCRIPTION:Czas na Teleo\\; módl się\\, proszę\r\n')
  })

  it('folds a long Polish description so every physical line stays within 75 bytes', () => {
    const encoder = new TextEncoder()
    const description =
      'Ćwicz codziennie wytrwałość, cierpliwość i wdzięczność, żeby modlitwa stała się nawykiem serca, nie tylko ust, a poranna modlitwa różańcowa przynosiła prawdziwy spokój.'
    const ics = buildDailyReminderIcs({ ...baseOptions, description })

    const physicalLines = ics.split('\r\n').slice(0, -1)
    for (const line of physicalLines) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }

    // Capture the VEVENT's DESCRIPTION property and its continuations only —
    // capture must stop for good at the next non-continuation line, since the
    // VALARM below has its own, unrelated DESCRIPTION property.
    const descriptionLines: string[] = []
    let started = false
    for (const line of physicalLines) {
      if (!started) {
        if (/^DESCRIPTION:/.test(line)) {
          started = true
          descriptionLines.push(line)
        }
        continue
      }
      if (!line.startsWith(' ')) break
      descriptionLines.push(line)
    }
    expect(descriptionLines.length).toBeGreaterThan(1)

    const unfolded = descriptionLines[0] + descriptionLines.slice(1).map((l) => l.slice(1)).join('')
    expect(unfolded).toBe(`DESCRIPTION:${escapeIcsText(`${description}\n${baseOptions.url}`)}`)
  })

  it.each(['7:00', '07:60', '24:00', '7:5', 'abc', '', '07:00:00', ' 07:00'])(
    'rejects invalid time %j with a RangeError',
    (time) => {
      expect(() => buildDailyReminderIcs({ ...baseOptions, time })).toThrow(RangeError)
    },
  )
})

describe('escapeIcsText', () => {
  it('escapes semicolons and commas', () => {
    expect(escapeIcsText('Czas na Teleo; módl się, proszę')).toBe(
      'Czas na Teleo\\; módl się\\, proszę',
    )
  })

  it('escapes backslashes first, so inserted escapes are never doubled', () => {
    expect(escapeIcsText('back\\slash')).toBe('back\\\\slash')
  })

  it('escapes LF, CR and CRLF as a literal \\n', () => {
    expect(escapeIcsText('line1\nline2')).toBe('line1\\nline2')
    expect(escapeIcsText('line1\r\nline2')).toBe('line1\\nline2')
    expect(escapeIcsText('line1\rline2')).toBe('line1\\nline2')
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeIcsText('Teleo reminder')).toBe('Teleo reminder')
  })
})

describe('foldIcsLine', () => {
  it('does not fold a line at or under 75 bytes', () => {
    const line = 'DESCRIPTION:short'
    expect(foldIcsLine(line)).toBe(line)
  })

  it('folds so continuation lines start with a single space and round-trip losslessly', () => {
    const encoder = new TextEncoder()
    const content =
      'DESCRIPTION:' +
      'Ćwicz codziennie wytrwałość, cierpliwość i wdzięczność, żeby modlitwa stała się nawykiem serca. '.repeat(
        2,
      )
    const folded = foldIcsLine(content)
    const physicalLines = folded.split('\r\n')

    expect(physicalLines.length).toBeGreaterThan(1)
    for (const line of physicalLines) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
    for (const line of physicalLines.slice(1)) {
      expect(line.startsWith(' ')).toBe(true)
    }

    const unfolded = physicalLines[0] + physicalLines.slice(1).map((l) => l.slice(1)).join('')
    expect(unfolded).toBe(content)

    // Every physical line is itself valid, uncorrupted UTF-8 (no character was split).
    const decoder = new TextDecoder('utf-8', { fatal: true })
    for (const line of physicalLines) {
      expect(decoder.decode(encoder.encode(line))).toBe(line)
    }
  })

  it('never splits a multi-byte character even at the exact byte boundary', () => {
    const content = 'a'.repeat(75) + 'ą'
    const folded = foldIcsLine(content)
    const physicalLines = folded.split('\r\n')
    expect(physicalLines).toEqual(['a'.repeat(75), ' ą'])
  })
})
