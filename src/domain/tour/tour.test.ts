import { describe, expect, it } from 'vitest'
import { areaOf } from '@/domain/text/needs'
import { dockSide, shouldOfferTour, TOUR_NEED, TOUR_STEPS, TOUR_VERSION, tourLibraryPath, tourSelector, tourSteps } from './tour'

describe('the guided tour script', () => {
  it('has unique steps, each anchored to a data-tour attribute', () => {
    const ids = TOUR_STEPS.map((step) => step.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const step of TOUR_STEPS) expect(step.anchor).toMatch(/^[a-z-]+$/)
    expect(tourSelector('start')).toBe('[data-tour="start"]')
  })

  it('starts and ends on the Start button of Today', () => {
    expect(TOUR_STEPS[0]).toMatchObject({ anchor: 'start', action: { kind: 'navigate', to: '/' } })
    expect(TOUR_STEPS.at(-1)).toMatchObject({ anchor: 'start', action: { kind: 'navigate', to: '/' } })
  })

  it('shows the library filtered by the story need through the URL', () => {
    expect(tourLibraryPath()).toBe(`/library?area=${areaOf(TOUR_NEED)}&need=${TOUR_NEED}`)
    expect(TOUR_STEPS.find((step) => step.id === 'needs')?.action).toEqual({ kind: 'navigate', to: tourLibraryPath() })
  })

  it('opens a text before pointing at its buttons', () => {
    const ids = TOUR_STEPS.map((step) => step.id)
    expect(TOUR_STEPS[ids.indexOf('say')]?.action).toEqual({ kind: 'openText' })
    expect(ids.indexOf('memory')).toBe(ids.indexOf('say') + 1)
    expect(ids.indexOf('task')).toBe(ids.indexOf('say') + 2)
  })
})

describe('tourSteps', () => {
  it('leaves out the text steps when there is no text for the need', () => {
    expect(tourSteps({ hasText: true })).toEqual(TOUR_STEPS)
    expect(tourSteps({ hasText: false }).map((step) => step.id)).toEqual(['start', 'goal', 'needs', 'sessions', 'progress', 'done'])
  })
})

describe('dockSide', () => {
  it('docks the panel away from the lit element', () => {
    expect(dockSide({ top: 100, height: 60 }, 800)).toBe('bottom')
    expect(dockSide({ top: 700, height: 60 }, 800)).toBe('top')
  })
})

describe('shouldOfferTour', () => {
  const base = { onboardingCompleted: true, tourVersion: 0, pathname: '/' }

  it('offers the tour once per version, on Today, after the setup', () => {
    expect(shouldOfferTour(base)).toBe(true)
    expect(shouldOfferTour({ ...base, tourVersion: undefined })).toBe(true)
    expect(shouldOfferTour({ ...base, tourVersion: TOUR_VERSION })).toBe(false)
    expect(shouldOfferTour({ ...base, onboardingCompleted: false })).toBe(false)
    expect(shouldOfferTour({ ...base, pathname: '/library' })).toBe(false)
  })
})
