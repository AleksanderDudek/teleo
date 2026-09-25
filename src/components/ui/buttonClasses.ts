import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary shadow-[0_10px_24px_-14px_rgb(20_45_35/0.7)] hover:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sunk',
  ghost: 'text-ink-soft hover:bg-sunk hover:text-ink',
  danger: 'bg-bad text-paper hover:opacity-90',
  gold: 'bg-gold-soft text-gold-ink hover:brightness-95',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-7 text-lg',
}

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
}): string {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] transition-[background-color,color,box-shadow,transform,filter] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  )
}
