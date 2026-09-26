import type { ReactNode } from 'react'
import { Icon, type IconName, type IconTone } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'

export type HaloTone = 'gold' | 'lapis' | 'sunk' | 'cinnabar' | 'frost'

const TONE_CLASS: Record<HaloTone, string> = {
  gold: 'halo',
  lapis: 'halo halo-lapis',
  sunk: 'halo halo-sunk',
  cinnabar: 'halo halo-cinnabar',
  frost: 'halo halo-frost',
}

interface IconHaloProps {
  icon?: IconName
  /** Disc diameter in px. */
  size?: number
  iconSize?: number
  tone?: HaloTone
  iconTone?: IconTone
  /** Solid fill layer (the gold play triangle). */
  iconFill?: boolean
  className?: string
  children?: ReactNode
}

/**
 * An icon set inside a nimbus (gold ring + inner hairline). Gold for streak, sparkle and prayer;
 * lapis for play; sunk for affirmation and text; cinnabar for listening; frost for a freeze.
 */
export function IconHalo({ icon, size = 44, iconSize, tone = 'gold', iconTone, iconFill, className, children }: IconHaloProps) {
  const fallbackTone: IconTone = tone === 'cinnabar' || tone === 'frost' ? 'plain' : 'gilded'
  return (
    <span className={cn(TONE_CLASS[tone], className)} style={{ width: size, height: size }}>
      {icon ? <Icon name={icon} size={iconSize ?? Math.round(size * 0.5)} tone={iconTone ?? fallbackTone} fillOpacity={iconFill ? 1 : undefined} /> : children}
    </span>
  )
}
