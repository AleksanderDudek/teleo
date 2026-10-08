import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { dockSide, tourSelector, type TourStep } from '@/domain/tour/tour'
import { cn } from '@/lib/cn'

interface TourOverlayProps {
  steps: readonly TourStep[]
  /** Performs a step's action (a navigation, opening a text). Called once per step, before its anchor is looked for. */
  onStepEnter: (step: TourStep) => void
  /** Called once, whether the tour was finished, skipped or closed with Escape. */
  onFinish: () => void
}

interface Hole {
  top: number
  left: number
  width: number
  height: number
}

/** Breathing room between the lit control and the edge of the light. */
const HOLE_PADDING = 8
/** A step's action is often a navigation to a lazily loaded screen: ~3 s of looking before the step is skipped. */
const ANCHOR_ATTEMPTS = 30
const ANCHOR_POLL_MS = 100

function holeFrom(element: Element): Hole {
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top - HOLE_PADDING,
    left: rect.left - HOLE_PADDING,
    width: rect.width + HOLE_PADDING * 2,
    height: rect.height + HOLE_PADDING * 2,
  }
}

/**
 * The spotlight walk (DECISIONS #127, after the one in Your Events): the screen dimmed, one control lit, a panel
 * saying what it is for, and the app doing the walking. Anchors are found by their `data-tour` attribute, so the
 * screens carry no tour logic. Forward-only — a step can navigate, and Skip / Escape are always one tap away.
 * The panel docks to the screen edge away from the lit control (a sheet on a phone), so it never covers it.
 */
export function TourOverlay({ steps, onStepEnter, onFinish }: TourOverlayProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  // The lit control of a step, keyed by the step: a later step never shows an earlier step's light.
  const [found, setFound] = useState<{ index: number; anchor: HTMLElement; hole: Hole } | null>(null)
  const anchor = found?.index === index ? found.anchor : null
  const hole = found?.index === index ? found.hole : null
  const panelRef = useRef<HTMLDivElement | null>(null)

  // In a ref, so a parent that rebuilds the callback cannot restart the step effect and repeat the step's action.
  const onStepEnterRef = useRef(onStepEnter)
  useEffect(() => {
    onStepEnterRef.current = onStepEnter
  })

  const finishedRef = useRef(false)
  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinish()
  }, [onFinish])

  // StrictMode runs effects twice in development; a step's action must still run once.
  const actedRef = useRef(-1)
  const step = steps[index]

  useEffect(() => {
    if (!step) {
      finish()
      return
    }
    if (actedRef.current !== index) {
      actedRef.current = index
      onStepEnterRef.current(step)
    }

    let cancelled = false
    let attempts = 0
    let timer = 0
    const look = () => {
      if (cancelled) return
      const element = document.querySelector<HTMLElement>(tourSelector(step.anchor))
      if (element) {
        // Instant: a smooth scroll would still be moving when the light is measured.
        element.scrollIntoView({ block: 'center', behavior: 'instant' })
        setFound({ index, anchor: element, hole: holeFrom(element) })
        return
      }
      attempts += 1
      if (attempts >= ANCHOR_ATTEMPTS) setIndex((current) => current + 1)
      else timer = window.setTimeout(look, ANCHOR_POLL_MS)
    }
    timer = window.setTimeout(look, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [step, index, finish])

  // The page still scrolls under the tour; the light follows its control (and moves on when the control goes).
  useEffect(() => {
    if (!anchor) return
    const update = () => {
      if (!anchor.isConnected) setIndex((current) => current + 1)
      else setFound({ index, anchor, hole: holeFrom(anchor) })
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchor, index])

  // Focus follows the step, so keyboard and screen-reader users read the panel they just advanced to.
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node
    node?.focus()
  }, [])
  useEffect(() => {
    panelRef.current?.focus()
  }, [index])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      finish()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [finish])

  // Tab stays in the panel: the page behind the dim must not take the focus.
  const keepFocusInside = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab' || !panelRef.current) return
    const focusable = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!step) return null
  const isLast = index >= steps.length - 1
  const next = () => (isLast ? finish() : setIndex((current) => current + 1))
  const side = hole ? dockSide(hole, window.innerHeight) : 'bottom'

  return (
    <>
      {/* Swallows taps, so the lit control cannot be used from under the tour; it stays between steps so a
          navigation does not flash the undimmed page. The dimming itself is the light's huge shadow. */}
      <div aria-hidden className="fixed inset-0 z-[70]" onClick={(event) => event.stopPropagation()} />
      {hole ? (
        <div
          aria-hidden
          className="tour-hole pointer-events-none fixed z-[71] rounded-2xl"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[71] bg-[rgb(6_8_20/0.72)]" />
      )}
      {anchor && (
        // The panel is a dialog whose own keys keep Tab inside it (the focus trap); Escape is handled on document.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          ref={attachPanel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-step-title"
          aria-describedby="tour-step-body"
          tabIndex={-1}
          onKeyDown={keepFocusInside}
          className={cn(
            'fixed inset-x-0 z-[72] mx-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-line-strong bg-surface p-5 text-ink shadow-[var(--shadow-frame),0_25px_50px_-12px_rgb(0_0_0/0.35)] outline-none animate-rise',
            side === 'bottom' ? 'bottom-[max(env(safe-area-inset-bottom),1rem)]' : 'top-[max(env(safe-area-inset-top),1rem)]',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p aria-live="polite" className="rubric text-xs font-semibold text-gold-ink">
                {t('tour.count', { current: index + 1, total: steps.length })}
              </p>
              <h2 id="tour-step-title" className="mt-1 text-xl leading-tight font-semibold">
                {t(`tour.steps.${step.id}.title`)}
              </h2>
            </div>
            <button
              type="button"
              onClick={finish}
              aria-label={t('tour.close')}
              className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-sunk hover:text-ink"
            >
              <Icon name="x" size={20} />
            </button>
          </div>
          <p id="tour-step-body" className="mt-2 text-ink-soft">
            {t(`tour.steps.${step.id}.body`)}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="ghost" onClick={finish}>
              {t('tour.skip')}
            </Button>
            <span className="flex-1" />
            <Button onClick={next} icon={isLast ? 'check' : undefined}>
              {isLast ? t('tour.done') : t('tour.next')}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
