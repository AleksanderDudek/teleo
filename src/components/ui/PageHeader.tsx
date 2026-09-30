import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  rubric?: string
  title: string
  subtitle?: ReactNode
  backTo?: string
  actions?: ReactNode
}

/** True once the large title has slid under the compact bar (checked on scroll, once per frame). */
function useCondensed(bar: RefObject<HTMLElement | null>, marker: RefObject<HTMLElement | null>): boolean {
  const [condensed, setCondensed] = useState(false)
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const barBox = bar.current?.getBoundingClientRect()
      const markerBox = marker.current?.getBoundingClientRect()
      if (barBox && markerBox) setCondensed(markerBox.top < barBox.bottom)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [bar, marker])
  return condensed
}

/**
 * Screen title, the large-title way of native apps: a compact bar sticks under the support ribbon — with
 * the back button on sub-screens, always within reach (an installed app has no browser back button) — and
 * the title moves into it once the large one below has scrolled away. Then the gilded rubric, the serif
 * title, optional actions and a gilt rule.
 */
export function PageHeader({ rubric, title, subtitle, backTo, actions }: PageHeaderProps) {
  const { t } = useTranslation()
  const bar = useRef<HTMLDivElement>(null)
  const marker = useRef<HTMLDivElement>(null)
  const condensed = useCondensed(bar, marker)
  return (
    <>
      <div
        ref={bar}
        className={cn(
          'app-bar sticky top-(--chrome-top) z-20 -mx-5 flex h-(--appbar-h) items-center gap-1 px-2 sm:-mx-8 sm:px-5',
          condensed && 'is-condensed',
          // On a top-level screen the empty bar lies over the header's top margin instead of pushing it down.
          !backTo && '-mb-(--appbar-h)',
          !backTo && !condensed && 'pointer-events-none',
        )}
      >
        {backTo ? (
          <Link
            to={backTo}
            viewTransition
            aria-label={t('common.back')}
            title={t('common.back')}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-sunk active:bg-sunk"
          >
            <Icon name="caret-left" size={22} />
          </Link>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <p aria-hidden className={cn('min-w-0 flex-1 truncate font-serif text-lg font-semibold text-ink transition-opacity duration-200', condensed ? 'opacity-100' : 'opacity-0')}>
          {title}
        </p>
      </div>
      <header className={cn('mb-6', backTo ? 'pt-1' : 'pt-6')}>
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {rubric && (
              <p className="rubric mb-1.5 flex items-center gap-1.5">
                <Icon name="mandorla-star" size={13} />
                {rubric}
              </p>
            )}
            <h1 className="text-[2.1rem] leading-[1.05] font-semibold text-ink">{title}</h1>
            {subtitle && <div className="mt-2 text-ink-soft">{subtitle}</div>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        <div ref={marker} aria-hidden className="gilt-rule mt-3.5" />
      </header>
    </>
  )
}
