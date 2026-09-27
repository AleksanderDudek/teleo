import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { evaluate } from '@/domain/matcher'
import { guardianLine, resultMessage } from './resultMessage'

const t = ((key: string) => key) as unknown as TFunction
const check = (source: string, spoken: string, threshold?: number) => evaluate(source, [spoken], { lang: 'en', threshold })
/** Echoes the key and its values, to see what the message was given. */
const tWith = ((key: string, values?: Record<string, unknown>) => `${key} ${JSON.stringify(values ?? {})}`) as unknown as TFunction

describe('resultMessage', () => {
  it('names the coverage the attempt needed', () => {
    const source = 'I choose to breathe slowly and to listen with care.'
    expect(resultMessage(check(source, 'I choose to breathe care'), tWith)).toBe('speech.result.coverage {"percent":50,"needed":90}')
    expect(resultMessage(check(source, 'I choose to breathe care', 0.7), tWith)).toBe('speech.result.coverage {"percent":50,"needed":70}')
  })

  it('shows a single misheard word as heard instead of the expected one', () => {
    expect(resultMessage(check('I am calm', 'I am cold'), tWith)).toBe('speech.result.wrong {"spoken":"cold","expected":"calm"}')
  })

  it('lists up to three words not said, a misheard one among them', () => {
    expect(resultMessage(check('I am calm and focused.', 'I am cold focused'), tWith)).toBe('speech.result.missing {"count":2,"words":"calm, and"}')
  })
})

describe('guardianLine', () => {
  it('stays silent when the attempt passed or nothing was heard', () => {
    expect(guardianLine(check('I am calm.', 'I am calm'), 0, t)).toBeNull()
    expect(guardianLine(check('I am calm.', ''), 1, t)).toBeNull()
  })

  it('names the kind of slip without repeating the details', () => {
    expect(guardianLine(check('I am calm and focused.', 'I am very calm and focused'), 1, t)).toBe('guardian.extra')
    expect(guardianLine(check('I am calm', 'I am cold'), 1, t)).toBe('guardian.wrong')
    expect(guardianLine(check('I am calm and focused.', 'I am cold focused'), 1, t)).toBe('guardian.missing')
    expect(guardianLine(check('I am calm and focused.', 'I am calm focused'), 1, t)).toBe('guardian.missing')
  })

  it('offers the way out once skipping is allowed', () => {
    expect(guardianLine(check('I am calm and focused.', 'I am very calm and focused'), 3, t)).toBe('guardian.stuck')
  })
})
