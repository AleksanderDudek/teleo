import { cn } from '@/lib/cn'

/**
 * Stat tile (dataviz contract): sentence-case label, sans semibold value, optional hint, gilt top edge.
 * `sunk` = the summary variant (uppercase label on a sunk well, no border).
 */
export function StatTile({ label, value, hint, sunk }: { label: string; value: string; hint?: string; sunk?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl px-4 py-3 text-left',
        sunk ? 'bg-sunk' : 'border border-t-2 border-line border-t-gold/55 bg-surface',
      )}
    >
      <dt className={sunk ? 'text-xs font-semibold tracking-wide text-ink-soft uppercase' : 'text-sm font-medium text-ink-soft'}>{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-ink">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-ink-faint">{hint}</dd>}
    </div>
  )
}
