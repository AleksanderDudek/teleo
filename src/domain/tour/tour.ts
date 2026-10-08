/*
 * The guided tour (DECISIONS #127): after the first setup, an invitation on Today, then a spotlight walk through the
 * app that the app performs itself — it opens the library on a need, opens a prayer for it and points at what a
 * person does next. The script is data: steps name a `data-tour` anchor and declare what should happen; the overlay
 * (`src/components/tour/`) performs it. Pure module.
 */
import { areaOf, type NeedId } from '@/domain/text/needs'

/** Bump to offer the tour again after a redesign; `meta.tourVersion` holds the version a person has seen. */
export const TOUR_VERSION = 1

/** The need the story looks for: one every language and content focus has texts for. */
export const TOUR_NEED: NeedId = 'peace'

export type TourStepId = 'start' | 'goal' | 'needs' | 'result' | 'say' | 'memory' | 'task' | 'sessions' | 'progress' | 'done'

/** What the app does when a step begins — usually what puts the step's anchor on screen. */
export type TourAction =
  | { kind: 'none' }
  | { kind: 'navigate'; to: string }
  /** Open the first text the library lists for {@link TOUR_NEED} (skipped with its steps when there is none). */
  | { kind: 'openText' }

export interface TourStep {
  id: TourStepId
  /** The `data-tour` value of the element the step lights up. */
  anchor: string
  action: TourAction
}

export const tourLibraryPath = () => `/library?area=${areaOf(TOUR_NEED)}&need=${TOUR_NEED}`

const none = { kind: 'none' } as const
const go = (to: string) => ({ kind: 'navigate', to }) as const

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'start', anchor: 'start', action: go('/') },
  { id: 'goal', anchor: 'goal', action: none },
  { id: 'needs', anchor: 'needs', action: go(tourLibraryPath()) },
  { id: 'result', anchor: 'result', action: none },
  { id: 'say', anchor: 'say', action: { kind: 'openText' } },
  { id: 'memory', anchor: 'memory', action: none },
  { id: 'task', anchor: 'task', action: none },
  { id: 'sessions', anchor: 'tab-sessions', action: go('/sessions') },
  { id: 'progress', anchor: 'tab-progress', action: go('/progress') },
  { id: 'done', anchor: 'start', action: go('/') },
]

/** Steps that show a text: without a text for the story's need (own texts only, say) they are left out up front. */
const TEXT_STEPS: ReadonlySet<TourStepId> = new Set(['result', 'say', 'memory', 'task'])

/** The steps of one run of the tour. */
export function tourSteps({ hasText }: { hasText: boolean }): TourStep[] {
  return TOUR_STEPS.filter((step) => hasText || !TEXT_STEPS.has(step.id))
}

export const tourSelector = (anchor: string) => `[data-tour="${anchor}"]`

/**
 * Where the step's panel docks: at the screen edge away from the lit element, so it never covers it — on a phone
 * the panel is a sheet at the bottom for the upper half of the screen and at the top for the lower half.
 */
export function dockSide(hole: { top: number; height: number }, viewportHeight: number): 'top' | 'bottom' {
  return hole.top + hole.height / 2 < viewportHeight / 2 ? 'bottom' : 'top'
}

/** The invitation appears on Today, after the setup, until this version of the tour was taken or declined. */
export function shouldOfferTour(state: { onboardingCompleted: boolean; tourVersion?: number; pathname: string }): boolean {
  return state.onboardingCompleted && (state.tourVersion ?? 0) < TOUR_VERSION && state.pathname === '/'
}
