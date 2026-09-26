import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface RingProps {
  value: number
  max: number
  size?: number
  stroke?: number
  label: string
  className?: string
  children?: ReactNode
}

/** Circular progress as a halo: a lapis arc between two gold hairlines; turns gold leaf when the goal is met. */
export function ProgressRing({ value, max, size = 132, stroke = 10, label, className, children }: RingProps) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const done = ratio >= 1
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius + stroke / 2 + 3} fill="none" stroke="var(--gold)" strokeOpacity=".45" strokeWidth="1" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius - stroke / 2 - 3} fill="none" stroke="var(--gold)" strokeOpacity=".35" strokeWidth="1" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={done ? 'var(--gold)' : 'var(--primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

interface BarProps {
  value: number
  max: number
  label: string
  className?: string
  /** Lapis for session progress, gold for XP and levels, leaf for growth. */
  tone?: 'lapis' | 'gold' | 'leaf'
}

const BAR_TONE = { lapis: 'bg-primary', gold: 'bg-gold', leaf: 'bg-leaf' } as const

/** 8px pill bar on a sunk track with a gilt hairline. */
export function ProgressBar({ value, max, label, className, tone = 'lapis' }: BarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-sunk shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_30%,transparent)]', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', BAR_TONE[tone])}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
