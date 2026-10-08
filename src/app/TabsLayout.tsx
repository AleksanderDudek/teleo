import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation, useMatches, useNavigation } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { TeleoMark } from '@/components/Ornaments'
import { SupportBanner } from '@/components/support/SupportBanner'
import { SupportStrip } from '@/components/support/SupportStrip'
import { GuidedTour } from '@/components/tour/GuidedTour'
import { dayKeyFor } from '@/domain/time/dayKey'
import { cn } from '@/lib/cn'
import { useAppSettings } from '@/stores/settings'
import { TABS, tabOf, type RouteHandle, type TabKey } from './tabs'

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

function TabBar({ active, hidden }: { active: TabKey | null; hidden: boolean }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <nav
      aria-label={t('nav.main')}
      className={cn(
        'tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 backdrop-blur-md safe-bottom select-none',
        'lg:inset-y-0 lg:right-auto lg:left-0 lg:w-24 lg:border-t-0 lg:border-r lg:pt-6 lg:pb-6',
        hidden && 'max-lg:hidden',
      )}
    >
      <div className="mb-8 hidden flex-col items-center gap-1 text-primary lg:flex">
        <TeleoMark className="size-9" />
        <span className="rubric text-[0.8rem]">{t('app.name')}</span>
      </div>
      <ul className="mx-auto flex max-w-lg justify-around px-2 pt-1.5 lg:flex-col lg:items-center lg:gap-3">
        {TABS.map(({ to, key, icon }) => {
          const isActive = key === active
          return (
            <li key={key}>
              <Link
                to={to}
                data-tour={`tab-${key}`}
                viewTransition
                aria-current={isActive ? (pathname === to ? 'page' : 'true') : undefined}
                onClick={(event) => {
                  // Tapping the tab you are on scrolls its screen back to the top, as native tab bars do.
                  if (!isActive || pathname !== to) return
                  event.preventDefault()
                  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
                }}
                className={cn(
                  'group relative flex min-h-12 min-w-16 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[0.7rem] font-semibold tracking-wide transition-colors',
                  isActive ? 'text-primary' : 'text-ink-faint hover:text-ink',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute -top-1.5 h-0.5 w-7 rounded-full bg-gold transition-opacity lg:top-1/2 lg:-left-3 lg:h-7 lg:w-0.5 lg:-translate-y-1/2',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {/* Active: a gold-soft halo pill and a gilded icon; inactive: a quiet same-colour fill. */}
                <span
                  className={cn(
                    'grid h-8 w-12 place-items-center rounded-full transition-[background-color,box-shadow,transform] duration-200 group-active:scale-90',
                    isActive && 'bg-gold-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent)]',
                  )}
                >
                  <Icon name={icon} size={24} tone={isActive ? 'gilded' : 'plain'} fillOpacity={isActive ? 0.8 : 0.14} />
                </span>
                <span>{t(`nav.${key}`)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** A thin gold line at the top while the next screen's code loads (only when that takes a moment). */
function NavProgress() {
  const navigation = useNavigation()
  return navigation.state === 'loading' ? <div aria-hidden className="nav-progress" /> : null
}

/**
 * After a screen change, screen readers should start on the new screen: focus moves to the content —
 * unless the new screen already put it somewhere (a field), or it is in the tab bar the user just used.
 */
function useFocusOnNavigate() {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const active = document.activeElement
    if (active && active !== document.body && !active.closest('nav')) return
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])
}

/**
 * Layout of every screen outside a session: the support ribbon on top, the content column, the support
 * window at its end, the bottom tab bar (a left rail on desktop). Editing forms hide the tab bar and the
 * window on phones — a focused task, no accidental leave.
 */
export function TabsLayout() {
  const { pathname } = useLocation()
  const form = useMatches().some((match) => (match.handle as RouteHandle | undefined)?.form === true)
  const dayStartHour = useAppSettings().dayStartHour
  // The Guardian's word follows the day the layout opened on (it stays mounted across screens).
  const [openedAt] = useState(() => Date.now())
  useFocusOnNavigate()
  return (
    <div className="lg:pl-24">
      <SupportStrip />
      <NavProgress />
      <main id="main" tabIndex={-1} className={cn('mx-auto w-full max-w-2xl px-5 outline-none sm:px-8 lg:pb-16', form ? 'pb-8' : 'pb-32')}>
        <Outlet />
        {/* On the five main screens only: not under a text, a reading, or right after "Delete everything" (#128). */}
        {!form && TABS.some((tab) => tab.to === pathname) && <SupportBanner dayKey={dayKeyFor(openedAt, dayStartHour)} className="mt-14" />}
      </main>
      <TabBar active={tabOf(pathname)} hidden={form} />
      <GuidedTour />
    </div>
  )
}
