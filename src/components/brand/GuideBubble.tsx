import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { Guardian, type GuardianMood } from './Guardian'

interface GuideBubbleProps {
  mood?: GuardianMood
  children: ReactNode
  actions?: ReactNode
  /** Portrait width in px. */
  size?: number
  compact?: boolean
  /** Heading of the panel; the Guardian's name by default. */
  title?: string
  className?: string
}

/**
 * The Guardian speaking: portrait beside a framed parchment panel headed with his name.
 * Voice: first person, warm, brief, never scolding. One Guardian per screen.
 */
export function GuideBubble({ mood = 'teach', children, actions, size = 96, compact, title, className }: GuideBubbleProps) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex items-end gap-1', className)}>
      <Guardian mood={mood} size={size} decorative className="-mb-1.5" />
      <div className={cn('card card-framed relative min-w-0 flex-1', compact ? 'px-3.5 py-3' : 'px-4.5 py-4')}>
        <span aria-hidden className="absolute bottom-[18px] -left-[7px] size-3 rotate-45 border-b border-l border-line-strong bg-surface" />
        <p className="rubric">{title ?? t('guardian.name')}</p>
        <div className={cn('mt-1 font-serif leading-snug text-ink text-pretty', compact ? 'text-[1.05rem]' : 'text-[1.2rem]')}>{children}</div>
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
