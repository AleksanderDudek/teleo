import { Lock } from 'lucide-react'
import type { Tier } from '@/domain/types'
import { cn } from '@/lib/cn'

const TIER_COLORS: Record<Tier, { fill: string; ring: string }> = {
  bronze: { fill: '#b7773f', ring: '#8a5327' },
  silver: { fill: '#aab4bd', ring: '#77828c' },
  gold: { fill: '#d6ad45', ring: '#9c7a1c' },
  platinum: { fill: '#a9c6d6', ring: '#6f94a8' },
  diamond: { fill: '#8fdbe8', ring: '#3f9fb2' },
}

/** Medallion with a laurel sprig; tier sets the metal. Locked → muted outline. */
export function AchievementBadge({ tier, locked = false, className }: { tier: Tier; locked?: boolean; className?: string }) {
  const { fill, ring } = TIER_COLORS[tier]
  if (locked) {
    return (
      <span className={cn('inline-flex items-center justify-center rounded-full border-2 border-dashed border-line-strong text-ink-faint', className)}>
        <Lock aria-hidden className="size-1/3" />
      </span>
    )
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn('shrink-0 drop-shadow-sm', className)}>
      <circle cx="24" cy="24" r="22" fill={fill} stroke={ring} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" />
      <path d="M24 33c0-5 0-9 .2-13" stroke="#fff" strokeOpacity=".9" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M24 26.5c-3.4 0-6.3-1.9-7.2-5.4 3.6-.6 6.6 1.3 7.2 5.4z" fill="#fff" fillOpacity=".9" />
      <path d="M24.2 22.5c.3-4.4 3.2-7.3 7.5-7.5 0 4.4-2.9 7.3-7.5 7.5z" fill="#fff" fillOpacity=".9" />
    </svg>
  )
}
