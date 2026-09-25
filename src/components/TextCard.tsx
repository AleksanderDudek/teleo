import { EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { LibraryEntry } from '@/hooks/useLibrary'
import { cn } from '@/lib/cn'
import { TextTypeIcon } from './TextTypeIcon'

interface TextCardProps {
  entry: LibraryEntry
  /** Optional line under the preview, e.g. the next milestone. */
  footnote?: string
}

export function TextCard({ entry, footnote }: TextCardProps) {
  const { t } = useTranslation()
  const { text, stats, segmentCount, preview } = entry
  const repetitions = stats?.repetitions ?? 0
  return (
    <Link
      to={`/library/${encodeURIComponent(text.id)}`}
      className={cn(
        'card group flex items-start gap-4 p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-22px_rgb(40_30_10/0.45)]',
        text.archived && 'opacity-60',
      )}
    >
      <span className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sunk text-leaf">
        <TextTypeIcon type={text.type} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-serif text-xl leading-tight font-semibold text-ink">{text.title}</span>
          {text.archived && <EyeOff aria-label={t('library.hidden')} className="size-4 shrink-0 text-ink-faint" />}
        </span>
        <span className="mt-0.5 block text-[0.8rem] font-medium text-ink-soft">
          {t(`textTypes.${text.type}`)} · {t(`langShort.${text.lang}`)} · {t('counts.segments', { count: segmentCount })}
          {text.source === 'user' && <> · {t('library.own')}</>}
        </span>
        {preview && <span className="mt-1.5 line-clamp-1 font-serif text-ink-soft italic">{preview}</span>}
        {footnote && <span className="mt-1.5 block text-xs font-semibold text-gold-ink">{footnote}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="tabular font-serif text-2xl leading-none font-semibold text-gold-ink">{repetitions}</span>
        <span className="mt-1 text-[0.65rem] font-semibold tracking-wider text-ink-faint uppercase">
          {t('library.repetitionsLabel')}
        </span>
      </span>
    </Link>
  )
}
