import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from './Icon'

describe('Icon', () => {
  it('draws a Teleo Glyph as a gilded fill under a stroked outline', () => {
    const { container } = render(<Icon name="candle" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    const [fill, line] = svg.querySelectorAll('g')
    expect(fill!.getAttribute('fill')).toBe('var(--icon-gild)')
    expect(fill!.getAttribute('fill-opacity')).toBe('0.6')
    expect(line!.getAttribute('stroke')).toBe('currentColor')
  })

  it('draws a Phosphor icon on its 256 grid with a filled outline', () => {
    const { container } = render(<Icon name="microphone" tone="plain" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 256 256')
    const [fill, line] = svg.querySelectorAll('g')
    expect(fill!.getAttribute('fill')).toBe('currentColor')
    expect(fill!.getAttribute('fill-opacity')).toBe('0.18')
    expect(line!.getAttribute('fill')).toBe('currentColor')
  })

  it('is decorative by default and named when labelled', () => {
    const { container, getByRole } = render(
      <>
        <Icon name="x" />
        <Icon name="eye-slash" label="Hidden" />
      </>,
    )
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    expect(getByRole('img', { name: 'Hidden' })).toBeInTheDocument()
  })

  it('takes a pixel size or defaults to 1em', () => {
    const { container } = render(
      <>
        <Icon name="plus" size={16} />
        <Icon name="plus" />
      </>,
    )
    const [sized, fluid] = container.querySelectorAll('svg')
    expect(sized!.getAttribute('width')).toBe('16')
    expect(fluid!.getAttribute('width')).toBe('1em')
  })

  it('makes the fill layer solid on request', () => {
    const { container } = render(<Icon name="play" fillOpacity={1} />)
    expect(container.querySelector('g')!.getAttribute('fill-opacity')).toBe('1')
  })
})
