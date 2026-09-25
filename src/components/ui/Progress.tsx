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

/** Circular progress (daily goal). Colour turns gold when the goal is met. */
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={done ? 'var(--gold)' : 'var(--leaf)'}
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
  tone?: 'leaf' | 'gold'
}

export function ProgressBar({ value, max, label, className, tone = 'leaf' }: BarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-sunk', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', tone === 'gold' ? 'bg-gold' : 'bg-leaf')}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
