import { BookOpen, Layers, Settings2, Sprout, Sun, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { TeleoMark } from '@/components/Ornaments'
import { cn } from '@/lib/cn'

const TABS: ReadonlyArray<{ to: string; key: 'today' | 'library' | 'sessions' | 'progress' | 'settings'; Icon: LucideIcon }> = [
  { to: '/', key: 'today', Icon: Sun },
  { to: '/library', key: 'library', Icon: BookOpen },
  { to: '/sessions', key: 'sessions', Icon: Layers },
  { to: '/progress', key: 'progress', Icon: Sprout },
  { to: '/settings', key: 'settings', Icon: Settings2 },
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
        <span className="rubric text-[0.6rem]">{t('app.name')}</span>
      </div>
      <ul className="mx-auto flex max-w-lg justify-around px-2 pt-1.5 lg:flex-col lg:items-center lg:gap-3">
        {TABS.map(({ to, key, Icon }) => (
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
                      'absolute -top-1.5 h-0.5 w-6 rounded-full bg-gold transition-opacity lg:top-1/2 lg:-left-3 lg:h-6 lg:w-0.5 lg:-translate-y-1/2',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <Icon aria-hidden className="size-[1.35rem]" strokeWidth={isActive ? 2.1 : 1.7} />
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
