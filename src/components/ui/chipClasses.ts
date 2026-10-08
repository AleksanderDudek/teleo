import { cn } from '@/lib/cn'

/** The chip look, also for links that read as chips (a text's needs). Pressed = lapis with an inner gilt ring. */
export function chipClass(pressed: boolean): string {
  return cn(
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors',
    pressed
      ? 'border-primary bg-primary text-on-primary shadow-[inset_0_0_0_2px_var(--primary),inset_0_0_0_3px_color-mix(in_oklab,var(--gold)_55%,transparent)]'
      : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
  )
}
