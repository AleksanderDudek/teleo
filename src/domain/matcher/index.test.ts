import { describe, expect, it } from 'vitest'
import * as matcher from '@/domain/matcher'
import type { DiffPart, EvaluateOptions, MatchResult } from '@/domain/matcher'

describe('matcher public API', () => {
  it('exports exactly the documented functions', () => {
    expect(Object.keys(matcher).sort()).toEqual([
      'align',
      'buildDiff',
      'compareWords',
      'evaluate',
      'levenshtein',
      'normalize',
      'removeFillers',
      'stripDiacritics',
    ])
  })

  it('evaluates an utterance and describes it for the UI', () => {
    const source = 'Ojcze nasz, któryś jest w niebie'
    const options: EvaluateOptions = { lang: 'pl', strictness: 'strict' }
    const said = 'ojcze nasz ktorys jest w niebie'
    const result: MatchResult = matcher.evaluate(source, [said], options)
    const parts: DiffPart[] = matcher.buildDiff(source, options.lang, result)
    expect(result).toMatchObject({ accepted: true, near: 1 })
    expect(parts.map((part) => part.status)).toEqual([
      'match',
      'match',
      'near',
      'match',
      'match',
      'match',
    ])
  })
})
