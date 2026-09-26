import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { evaluate } from '@/domain/matcher'
import { guardianLine } from './resultMessage'

const t = ((key: string) => key) as unknown as TFunction
const check = (source: string, spoken: string) => evaluate(source, [spoken], { lang: 'en', strictness: 'strict' })

describe('guardianLine', () => {
  it('stays silent when the attempt passed or nothing was heard', () => {
    expect(guardianLine(check('I am calm.', 'I am calm'), 0, t)).toBeNull()
    expect(guardianLine(check('I am calm.', ''), 1, t)).toBeNull()
  })

  it('names the kind of slip without repeating the details', () => {
    expect(guardianLine(check('I am calm and focused.', 'I am very calm and focused'), 1, t)).toBe('guardian.extra')
    expect(guardianLine(check('I am calm', 'I am cold'), 1, t)).toBe('guardian.wrong')
    expect(guardianLine(check('I am calm and focused.', 'I am calm focused'), 1, t)).toBe('guardian.missing')
  })

  it('offers the way out once skipping is allowed', () => {
    expect(guardianLine(check('I am calm and focused.', 'I am very calm and focused'), 3, t)).toBe('guardian.stuck')
  })
})
