import { Icon } from '@/components/icons/Icon'
import type { Tier } from '@/domain/types'
import { cn } from '@/lib/cn'

const RAYS = Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2)

/**
 * Haloed medallion: umber leading line, tier-metal disc, radiating nimbus rays and the sprout.
 * Tier sets the metal. Locked → dashed outline with a lock.
 */
export function AchievementBadge({ tier, locked = false, className }: { tier: Tier; locked?: boolean; className?: string }) {
  if (locked) {
    return (
      <span className={cn('inline-flex items-center justify-center rounded-full border-2 border-dashed border-line-strong text-ink-faint', className)}>
        <Icon name="lock-simple" className="size-1/3" />
      </span>
    )
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn('shrink-0 drop-shadow-sm', className)}>
      <circle cx="24" cy="24" r="23" fill="none" stroke="var(--ink)" strokeOpacity=".55" strokeWidth="1" />
      <circle cx="24" cy="24" r="21.5" fill={`var(--tier-${tier})`} stroke={`var(--tier-${tier}-ring)`} strokeWidth="2.5" />
      {RAYS.map((a) => (
        <line key={a} x1={24 + Math.cos(a) * 12} y1={24 + Math.sin(a) * 12} x2={24 + Math.cos(a) * 16} y2={24 + Math.sin(a) * 16} stroke="#fff" strokeOpacity=".35" strokeWidth="1" strokeLinecap="round" />
      ))}
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" />
      <path d="M24 33c0-5 0-9 .2-13" stroke="#fff" strokeOpacity=".9" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M24 26.5c-3.4 0-6.3-1.9-7.2-5.4 3.6-.6 6.6 1.3 7.2 5.4z" fill="#fff" fillOpacity=".9" />
      <path d="M24.2 22.5c.3-4.4 3.2-7.3 7.5-7.5 0 4.4-2.9 7.3-7.5 7.5z" fill="#fff" fillOpacity=".9" />
    </svg>
  )
}
