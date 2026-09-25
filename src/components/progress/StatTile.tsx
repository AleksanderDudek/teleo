/** Stat tile (dataviz contract): sentence-case label, sans semibold value, optional hint. */
export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <dt className="text-sm font-medium text-ink-soft">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-ink">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-ink-faint">{hint}</dd>}
    </div>
  )
}
