import { cn } from '@/lib/cn'

/** The chip look, also for links that read as chips (a text's needs). Pressed = lapis with an inner gilt ring. */
export function chipClass(pressed: boolean): string {
  return cn(
    // 40 px, and 44 px to a finger through an invisible extension (DECISIONS #128).
    "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors before:absolute before:-inset-y-0.5 before:inset-x-0 before:content-['']",
    pressed
      ? 'border-primary bg-primary text-on-primary shadow-[inset_0_0_0_2px_var(--primary),inset_0_0_0_3px_color-mix(in_oklab,var(--gold)_55%,transparent)]'
      : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
  )
}
