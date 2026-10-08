import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { IconHalo } from '@/components/ui/IconHalo'
import { mainNeed } from '@/domain/text/needs'
import type { LibraryEntry } from '@/hooks/useLibrary'
import { cn } from '@/lib/cn'
import { TextTypeIcon } from './TextTypeIcon'

interface TextCardProps {
  entry: LibraryEntry
  /** Optional line under the preview, e.g. the next milestone. */
  footnote?: string
  /** Where the text's back arrow returns (the filtered library), passed in the link's state. */
  backTo?: string
}

export function TextCard({ entry, footnote, backTo }: TextCardProps) {
  const { t } = useTranslation()
  const { text, stats, segmentCount, preview } = entry
  const repetitions = stats?.repetitions ?? 0
  const need = mainNeed(text)
  const meta = [
    t(`textTypes.${text.type}`),
    need && t(`needs.items.${need}`),
    t('counts.segments', { count: segmentCount }),
    text.source === 'user' && t('library.own'),
  ].filter((item) => typeof item === 'string')
  return (
    <Link
      to={`/library/${encodeURIComponent(text.id)}`}
      state={backTo ? { backTo } : undefined}
      className={cn(
        'card card-lift group flex items-start gap-4 p-4',
        text.archived && 'opacity-60',
      )}
    >
      <IconHalo tone={text.type === 'prayer' ? 'gold' : 'sunk'} size={44} className="mt-0.5">
        <TextTypeIcon type={text.type} size={22} />
      </IconHalo>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="line-clamp-2 font-serif text-xl leading-tight font-semibold text-ink">{text.title}</span>
          {text.archived && <Icon name="eye-slash" size={16} label={t('library.hidden')} className="text-ink-faint" />}
        </span>
        <span className="mt-0.5 block text-[0.8rem] font-medium text-ink-soft">
          {/* Each item keeps its dot, so a long line wraps between items, never before a dot. */}
          {meta.map((item, index) => (
            <Fragment key={index}>
              <span className="whitespace-nowrap">
                {item}
                {index < meta.length - 1 && ' ·'}
              </span>{' '}
            </Fragment>
          ))}
        </span>
        {preview && <span className="mt-1.5 line-clamp-1 font-serif text-ink-soft italic">{preview}</span>}
        {footnote && <span className="mt-1.5 block text-xs font-semibold text-gold-ink">{footnote}</span>}
      </span>
      {/* Only once said: on a fresh library a column of zeros took a third of every title's width. */}
      {repetitions > 0 && (
        <span className="flex shrink-0 flex-col items-end">
          <span className="tabular text-2xl leading-none font-semibold text-gold-ink">{repetitions}</span>
          <span className="mt-1 text-xs font-semibold tracking-wide text-ink-soft">{t('library.repetitionsLabel')}</span>
        </span>
      )}
    </Link>
  )
}
