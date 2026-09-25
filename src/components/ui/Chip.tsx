import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Toggleable filter chip (`aria-pressed`). */
export function Chip({
  pressed,
  className,
  type = 'button',
  ...rest
}: { pressed: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors',
        pressed
          ? 'border-primary bg-primary text-on-primary'
          : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
        className,
      )}
      {...rest}
    />
  )
}
