import { describe, expect, it } from 'vitest'
import { dialogueSegments, historyEnd, nextDialogueKey, turnAt, userLines } from './turns'
import type { Dialogue } from './types'

const line = (who: 'bot' | 'you', en: string, pl: string) => ({
  who,
  text: { en, pl },
  ...(who === 'you' ? { say: { en: 'x', pl: 'x' } } : {}),
})

const cafe: Dialogue = {
  key: 'cafe',
  level: 'A1',
  icon: 'coffee',
  partner: 'maria',
  title: { en: 'At the café', pl: 'W kawiarni' },
  scene: { en: 'Order a coffee.', pl: 'Zamów kawę.' },
  lines: [
    line('bot', 'Hi!', 'Cześć!'), // 0
    line('bot', '{What|o1} {can|v1} {I|s1} {get|v1} you?', 'Co {mogę|v1,s1} podać?'), // 1
    line('you', '{I|s1}{’d like|v1} a {coffee|o1}.', '{Poproszę|v1,s1} {kawę|o1}.'), // 2
    line('bot', '{Large|a1}?', '{Dużą|a1}?'), // 3
    line('you', 'Yes, please.', 'Tak, poproszę.'), // 4
    line('you', 'Thank you!', 'Dziękuję!'), // 5
    line('bot', 'Enjoy!', 'Smacznego!'), // 6
  ],
}

describe('userLines', () => {
  it('lists the lines the user says, in order', () => {
    expect(userLines(cafe)).toEqual([2, 4, 5])
  })
})

describe('dialogueSegments', () => {
  it('is the plain text of the user lines in the language being learnt', () => {
    expect(dialogueSegments(cafe, 'en')).toEqual(['I’d like a coffee.', 'Yes, please.', 'Thank you!'])
    expect(dialogueSegments(cafe, 'pl')).toEqual(['Poproszę kawę.', 'Tak, poproszę.', 'Dziękuję!'])
  })
})

describe('turnAt', () => {
  it('opens the first turn with every bot line before it', () => {
    expect(turnAt(cafe, 0)).toEqual({ line: 2, opening: [0, 1] })
  })

  it('opens a later turn with the bot lines since the previous user line', () => {
    expect(turnAt(cafe, 1)).toEqual({ line: 4, opening: [3] })
  })

  it('has no opening when the user speaks twice in a row', () => {
    expect(turnAt(cafe, 2)).toEqual({ line: 5, opening: [] })
  })

  it('ends with the bot lines after the last user line', () => {
    expect(turnAt(cafe, 3)).toEqual({ line: undefined, opening: [6] })
    expect(turnAt(cafe, 9)).toEqual({ line: undefined, opening: [6] })
  })

  it('lets a dialogue start with the user', () => {
    const hello = { ...cafe, lines: cafe.lines.slice(2) }
    expect(turnAt(hello, 0)).toEqual({ line: 0, opening: [] })
  })
})

describe('historyEnd', () => {
  it('is where the current turn begins: lines before it are already on screen', () => {
    expect(historyEnd(cafe, 0)).toBe(0)
    expect(historyEnd(cafe, 1)).toBe(3)
    expect(historyEnd(cafe, 2)).toBe(5)
    expect(historyEnd(cafe, 3)).toBe(6)
  })
})

describe('nextDialogueKey', () => {
  const keys = ['a', 'b', 'c', 'd']

  it('goes to the next dialogue not finished yet, wrapping round', () => {
    expect(nextDialogueKey(keys, 'a', new Set(['a']))).toBe('b')
    expect(nextDialogueKey(keys, 'b', new Set(['a', 'b', 'c']))).toBe('d')
    expect(nextDialogueKey(keys, 'd', new Set(['b', 'c', 'd']))).toBe('a')
  })

  it('simply goes to the next one once every dialogue was finished', () => {
    expect(nextDialogueKey(keys, 'b', new Set(keys))).toBe('c')
    expect(nextDialogueKey(keys, 'd', new Set(keys))).toBe('a')
  })

  it('starts at the beginning for an unknown key and has nothing to offer for an empty list', () => {
    expect(nextDialogueKey(keys, 'x', new Set())).toBe('a')
    expect(nextDialogueKey([], 'x', new Set())).toBeUndefined()
  })
})
