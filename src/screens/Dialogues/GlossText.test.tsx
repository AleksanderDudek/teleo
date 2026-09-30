import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { parseGloss } from '@/domain/dialogue'
import { GlossText } from './GlossText'

const en = parseGloss('{I|s1}{’d like|v1} a {large|a1} {coffee|o1}, please.')
const pl = parseGloss('{Poproszę|v1,s1} {dużą|a1} {kawę|o1}.')

function Pair() {
  const [active, setActive] = useState<readonly string[] | undefined>(undefined)
  return (
    <>
      <GlossText gloss={en} lang="en" active={active} onPoint={(ids) => setActive(ids ?? undefined)} testId="en" />
      <GlossText gloss={pl} lang="pl" active={active} onPoint={(ids) => setActive(ids ?? undefined)} testId="pl" />
    </>
  )
}

afterEach(cleanup)

const word = (text: string) => screen.getByText(text, { selector: '.gloss-word' })

describe('GlossText', () => {
  it('renders exactly the line, in its language, with each linked word marked by its role', () => {
    render(<Pair />)
    expect(screen.getByTestId('en').textContent).toBe('I’d like a large coffee, please.')
    expect(screen.getByTestId('en').getAttribute('lang')).toBe('en')
    expect(word('I').dataset.role).toBe('subject')
    expect(word('’d like').dataset.role).toBe('predicate')
    expect(word('large').dataset.role).toBe('adjective')
    expect(word('coffee').dataset.role).toBe('object')
  })

  it('lights a word and its counterpart when tapped, and turns them off with a second tap', () => {
    render(<Pair />)
    fireEvent.pointerUp(word('dużą'), { pointerType: 'touch' })
    expect(word('large').dataset.active).toBe('true')
    expect(word('dużą').dataset.active).toBe('true')
    expect(word('coffee').dataset.active).toBeUndefined()
    fireEvent.pointerUp(word('dużą'), { pointerType: 'touch' })
    expect(word('large').dataset.active).toBeUndefined()
  })

  it('lights the subject and the predicate hidden in a Polish verb', () => {
    render(<Pair />)
    fireEvent.pointerUp(word('Poproszę'), { pointerType: 'touch' })
    expect(word('I').dataset.active).toBe('true')
    expect(word('’d like').dataset.active).toBe('true')
  })

  it('gilds the words already heard without changing the text', () => {
    const { container } = render(<GlossText gloss={en} lang="en" covered={[true, true, true, false, false]} testId="line" />)
    expect(screen.getByTestId('line').textContent).toBe('I’d like a large coffee, please.')
    const heard = [...container.querySelectorAll('.gloss-heard')].map((node) => node.textContent).join('|')
    expect(heard).toBe('I|’d|like|a')
  })
})
