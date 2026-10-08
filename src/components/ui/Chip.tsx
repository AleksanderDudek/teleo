import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { chipClass } from './chipClasses'

/** Toggleable filter chip (`aria-pressed`). */
export function Chip({
  pressed,
  className,
  type = 'button',
  ...rest
}: { pressed: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} aria-pressed={pressed} className={cn(chipClass(pressed), className)} {...rest} />
}
