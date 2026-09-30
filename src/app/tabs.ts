import type { IconName } from '@/components/icons/Icon'

export type TabKey = 'today' | 'library' | 'sessions' | 'progress' | 'settings'

/** Teleo Glyphs: sunrise, a jewelled gospel cover, a rosary, a lily, sliders with haloed knobs. */
export const TABS: ReadonlyArray<{ to: string; key: TabKey; icon: IconName; also?: readonly string[] }> = [
  { to: '/', key: 'today', icon: 'sunrise' },
  // The Bible and the language dialogues are opened from the library: they light the library tab.
  { to: '/library', key: 'library', icon: 'gospel', also: ['/bible', '/dialogues'] },
  { to: '/sessions', key: 'sessions', icon: 'rosary' },
  { to: '/progress', key: 'progress', icon: 'lily' },
  { to: '/settings', key: 'settings', icon: 'sliders-halo' },
]

const within = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`)

/** The tab a screen belongs to — its own section, or the one it is reached from; null when none. */
export function tabOf(pathname: string): TabKey | null {
  if (pathname === '/' || pathname === '') return 'today'
  const tab = TABS.find(({ to, also = [] }) => to !== '/' && [to, ...also].some((root) => within(pathname, root)))
  return tab?.key ?? null
}

/** Route `handle` flags read by the tab layout. */
export interface RouteHandle {
  /** An editing form: the tab bar and the support window step aside for the task. */
  form?: boolean
}
