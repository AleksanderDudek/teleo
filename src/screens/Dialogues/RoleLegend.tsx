import { useTranslation } from 'react-i18next'
import { GLOSS_ROLES, type LinkPair } from '@/domain/dialogue'
import type { Lang } from '@/domain/types'
import { cn } from '@/lib/cn'

/** The four colours (and school underlines) of the word links. */
export function RoleLegend({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={className}>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm" aria-label={t('dialogues.legendTitle')}>
        {GLOSS_ROLES.map((role) => (
          <li key={role} className="flex items-center gap-1.5">
            <span aria-hidden className="gloss-word px-1 font-serif font-semibold" data-role={role}>
              Aa
            </span>
            <span className="text-ink-soft">{t(`dialogues.roles.${role}`)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-center text-xs text-ink-faint">{t('dialogues.legendHint')}</p>
    </div>
  )
}

/** The pairs of a line as text: what each coloured word means (also the keyboard and screen-reader route). */
export function WordList({ pairs, from, to, className }: { pairs: readonly LinkPair[]; from: Lang; to: Lang; className?: string }) {
  const { t } = useTranslation()
  if (pairs.length === 0) return <p className={cn('text-sm text-ink-faint', className)}>{t('dialogues.noWords')}</p>
  return (
    <ul className={cn('space-y-1 text-sm', className)}>
      {pairs.map((pair) => (
        <li key={pair.id} className="flex flex-wrap items-baseline gap-x-1.5">
          <span lang={from} className="gloss-word font-serif text-base font-semibold" data-role={pair.role}>
            {pair.from}
          </span>
          <span aria-hidden className="text-ink-faint">
            →
          </span>
          <span lang={to} className="font-serif text-base">
            {pair.to || '—'}
          </span>
          <span className="text-xs text-ink-faint">({t(`dialogues.roles.${pair.role}`)})</span>
        </li>
      ))}
    </ul>
  )
}
