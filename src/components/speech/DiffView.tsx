import { useTranslation } from 'react-i18next'
import type { DiffPart } from '@/domain/matcher'
import { cn } from '@/lib/cn'

const SOURCE_STYLE = {
  match: 'text-ok',
  near: 'text-near underline decoration-dotted decoration-2 underline-offset-4',
  missing: 'text-ink-faint line-through decoration-2',
  wrong: 'text-bad line-through decoration-2',
  none: 'text-ink',
} as const

/**
 * The words of a comparison, coloured (spec §6.5): green said, amber close, grey missing, red extra/different.
 * Words heard but not in the text are small chips relative to the surrounding size, so the same parts read well in
 * a card and on the player's stage.
 */
export function DiffWords({ parts }: { parts: readonly DiffPart[] }) {
  return parts.map((part, i) =>
    part.kind === 'source' ? (
      <span key={i} className={SOURCE_STYLE[part.status]}>
        {part.text}{' '}
      </span>
    ) : (
      <span key={i} className="mr-[0.25em] rounded bg-bad-soft px-[0.25em] align-[0.08em] text-[0.8em] font-semibold text-bad italic">
        {part.status === 'extra' ? '+' : '→'}
        {part.text}
      </span>
    ),
  )
}

/** Word-level result of a comparison as a paragraph (spec §6.5). */
export function DiffView({ parts, className }: { parts: readonly DiffPart[]; className?: string }) {
  return (
    <p className={cn('font-serif text-xl leading-relaxed', className)}>
      <DiffWords parts={parts} />
    </p>
  )
}

export function DiffLegend() {
  const { t } = useTranslation()
  const item = (className: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('size-2.5 rounded-full', className)} />
      {label}
    </span>
  )
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-ink-soft">
      {item('bg-ok', t('speech.legendMatch'))}
      {item('bg-near', t('speech.legendNear'))}
      {item('bg-ink-faint', t('speech.legendMissing'))}
      {item('bg-bad', t('speech.legendExtra'))}
    </p>
  )
}
