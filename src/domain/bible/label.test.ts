import { describe, expect, it } from 'vitest'
import { rangeLabel } from './label'

describe('rangeLabel', () => {
  it('writes a verse range the usual way', () => {
    expect(rangeLabel([1, 1], [1, 19])).toBe('1:1–19')
    expect(rangeLabel([1, 28], [2, 3])).toBe('1:28–2:3')
    expect(rangeLabel([117, 1], [117, 2])).toBe('117:1–2')
    expect(rangeLabel([5, 4], [5, 4])).toBe('5:4')
  })

  it('names whole chapters without verses', () => {
    expect(rangeLabel([1, 1], [1, 31], 31)).toBe('1')
    expect(rangeLabel([3, 1], [4, 22])).toBe('3:1–4:22')
  })
})
