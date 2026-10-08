import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero'

const VARIANTS: Record<ButtonVariant, string> = {
  // Lapis with a gilt edge and a long lapis drop shadow.
  primary: 'bg-primary text-on-primary shadow-(--shadow-primary) hover:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sunk',
  ghost: 'text-ink-soft hover:bg-sunk hover:text-ink',
  danger: 'bg-bad text-paper hover:opacity-90',
  gold: 'bg-gold-soft text-gold-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_45%,transparent)] hover:brightness-95',
}

// Small buttons keep their look but reach 44 px for a finger through an invisible extension (DECISIONS #128).
const SIZES: Record<ButtonSize, string> = {
  xs: "relative h-8 gap-1.5 px-2.5 text-[0.8rem] before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']",
  sm: "relative h-9 px-4 text-sm before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-7 text-lg',
  hero: 'h-16 px-7 text-xl',
}

/** Icon size (px) that sits with each button size. */
export const BUTTON_ICON_SIZE: Record<ButtonSize, number> = { xs: 14, sm: 16, md: 18, lg: 20, hero: 24 }

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
    'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] whitespace-nowrap transition-[background-color,color,box-shadow,transform,filter] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  )
}
