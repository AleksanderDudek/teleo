import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { Icon, type IconName } from '@/components/icons/Icon'
import { TeleoMark } from '@/components/Ornaments'
import { cn } from '@/lib/cn'

/** Teleo Glyphs: sunrise, a jewelled gospel cover, a rosary, a lily, sliders with haloed knobs. */
const TABS: ReadonlyArray<{ to: string; key: 'today' | 'library' | 'sessions' | 'progress' | 'settings'; icon: IconName }> = [
  { to: '/', key: 'today', icon: 'sunrise' },
  { to: '/library', key: 'library', icon: 'gospel' },
  { to: '/sessions', key: 'sessions', icon: 'rosary' },
  { to: '/progress', key: 'progress', icon: 'lily' },
  { to: '/settings', key: 'settings', icon: 'sliders-halo' },
]

function TabBar() {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('nav.main')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 backdrop-blur-md safe-bottom',
        'lg:inset-y-0 lg:right-auto lg:left-0 lg:w-24 lg:border-t-0 lg:border-r lg:pt-6 lg:pb-6',
      )}
    >
      <div className="mb-8 hidden flex-col items-center gap-1 text-primary lg:flex">
        <TeleoMark className="size-9" />
        <span className="rubric text-[0.8rem]">{t('app.name')}</span>
      </div>
      <ul className="mx-auto flex max-w-lg justify-around px-2 pt-1.5 lg:flex-col lg:items-center lg:gap-3">
        {TABS.map(({ to, key, icon }) => (
          <li key={key}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative flex min-w-16 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[0.7rem] font-semibold tracking-wide transition-colors',
                  isActive ? 'text-primary' : 'text-ink-faint hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
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
                      'grid h-8 w-10 place-items-center rounded-full transition-[background-color,box-shadow] duration-200',
                      isActive && 'bg-gold-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent)]',
                    )}
                  >
                    <Icon name={icon} size={24} tone={isActive ? 'gilded' : 'plain'} fillOpacity={isActive ? 0.8 : 0.14} />
                  </span>
                  <span>{t(`nav.${key}`)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Layout for the five main tabs: content column + bottom tab bar (left rail on desktop). */
export function TabsLayout() {
  return (
    <div className="lg:pl-24">
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl px-5 pb-36 outline-none sm:px-8 lg:pb-16">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
