import { cn } from '@/lib/cn'

/** Small botanical sprig used as a divider/ornament (inherits currentColor). */
export function Sprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" fill="none" aria-hidden className={cn('shrink-0', className)}>
      <path d="M4 30 C20 30 40 26 60 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M22 28 C20 20 24 14 31 12 C32 20 28 26 22 28Z" fill="currentColor" opacity=".85" />
      <path d="M36 23 C38 15 44 11 51 11 C49 18 43 22 36 23Z" fill="currentColor" opacity=".7" />
      <path d="M13 30 C9 25 9 20 12 16 C16 20 16 26 13 30Z" fill="currentColor" opacity=".55" />
      <circle cx="60" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

/** Teleo mark: a two-leaf sprout over a ground line. */
export function TeleoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={cn('shrink-0', className)}>
      <path d="M24 38 C24 32 23.6 27 24 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M23.8 27 C19 27 14.6 24.4 13.4 19.2 C18.6 18.3 23 20.9 23.8 27Z" fill="currentColor" />
      <path d="M24.2 22.8 C24.6 16.5 28.8 12.3 35 12 C35 18.3 30.8 22.5 24.2 22.8Z" fill="currentColor" />
      <path d="M15.5 38.2 Q24 35.8 32.5 38.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
