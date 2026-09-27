import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { formatShare } from '@/components/share/shareText'
import { ArchFrame } from '@/components/ui/ArchFrame'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar, ProgressRing } from '@/components/ui/Progress'
import { Segmented } from '@/components/ui/Segmented'
import { BIBLE_BOOKS, OLD_TESTAMENT_BOOKS } from '@/domain/bible/books'
import type { BibleTranslation } from '@/domain/bible/types'
import { cn } from '@/lib/cn'
import { updateAppSettings } from '@/services/settings'
import { toast } from '@/stores/ui'
import { bibleSummary, bookName, readingMinutes, readingTitle, startReading, useBibleBook, useBibleIndex, useBibleReadings, useBibleTranslation } from './useBible'

/** The Bible challenge: the whole Bible read aloud, a minute at a time. */
export default function Bible() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const translation = useBibleTranslation()
  const index = useBibleIndex(translation)
  const rows = useBibleReadings(translation)
  const summary = index.data && rows ? bibleSummary(index.data, rows) : undefined
  const nextBook = useBibleBook(translation, summary?.next?.book)
  const [starting, setStarting] = useState(false)

  const begin = async (book: string, reading: number) => {
    setStarting(true)
    try {
      const run = await startReading(t, translation, book, reading)
      navigate(`/play/${run.id}`)
    } catch {
      toast({ kind: 'error', title: t('bible.loadError') })
    } finally {
      setStarting(false)
    }
  }

  const number = new Intl.NumberFormat(i18n.language)
  const perBook = new Map<string, number>()
  for (const row of rows ?? []) perBook.set(row.book, (perBook.get(row.book) ?? 0) + 1)

  return (
    <>
      <PageHeader rubric={t('bible.rubric')} title={t('bible.title')} subtitle={t('bible.lead')} />

      <Segmented<BibleTranslation>
        label={t('bible.translation')}
        hideLabel
        value={translation}
        onChange={(bibleTranslation) => void updateAppSettings({ bibleTranslation })}
        options={[
          { value: 'kjv', label: t('bible.kjv') },
          { value: 'pbg', label: t('bible.pbg') },
        ]}
      />

      {index.error && <p className="mt-6 rounded-2xl bg-bad-soft px-4 py-3 text-bad">{t('bible.loadError')}</p>}

      {summary && index.data && (
        <ArchFrame glow className="mt-6 px-5 pt-8 pb-6 text-center">
          <div className="flex justify-center">
            <ProgressRing value={summary.done} max={summary.total} size={148} label={t('bible.progress', { done: summary.done, total: summary.total })}>
              <span className="block text-3xl leading-none font-semibold tabular">{formatShare(summary.share, i18n.language)}</span>
              <span className="mt-1 block text-xs font-semibold text-ink-soft">
                {t('bible.progress', { done: number.format(summary.done), total: number.format(summary.total) })}
              </span>
            </ProgressRing>
          </div>
          <p className="mt-4 text-sm font-medium text-ink-soft">
            {summary.done === 0 ? t('bible.yearHint', { days: summary.daysLeft }) : t('bible.left', { count: summary.daysLeft })}
          </p>
          {summary.next ? (
            <div className="mt-5">
              <Button size="hero" block icon="play" iconFill disabled={starting || !nextBook.data} onClick={() => summary.next && void begin(summary.next.book, summary.next.index)}>
                {t('bible.readNext')}
              </Button>
              {nextBook.data && (
                <p className="mt-2 text-sm text-ink-soft">
                  {t('bible.nextHint', {
                    title: readingTitle(t, nextBook.data, summary.next.index),
                    minutes: readingMinutes(nextBook.data, summary.next.index, index.data.wordsPerMinute),
                  })}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-5 font-serif text-xl font-semibold text-gold-ink">{t('bible.allDone')}</p>
          )}
        </ArchFrame>
      )}

      {index.data &&
        ([
          ['ot', BIBLE_BOOKS.slice(0, OLD_TESTAMENT_BOOKS)],
          ['nt', BIBLE_BOOKS.slice(OLD_TESTAMENT_BOOKS)],
        ] as const).map(([testament, codes]) => (
          <section key={testament} className="mt-8" aria-labelledby={`bible-${testament}`}>
            <h2 id={`bible-${testament}`} className="mb-3 text-2xl font-semibold">
              {t(testament === 'ot' ? 'bible.ot' : 'bible.nt')}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {codes.map((code) => {
                const total = index.data?.books.find((b) => b.b === code)?.readings ?? 0
                const done = perBook.get(code) ?? 0
                const complete = total > 0 && done >= total
                return (
                  <li key={code}>
                    <Link
                      to={`/bible/${translation}/${code}`}
                      className={cn('card card-lift flex items-center gap-3 px-4 py-3', complete && 'card-framed')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-lg font-semibold">{bookName(t, code)}</span>
                        <ProgressBar className="mt-1.5 h-1.5" tone="gold" value={done} max={total} label={t('bible.progress', { done, total })} />
                      </span>
                      {complete ? (
                        <Icon name="crown-jewel" size={20} label={t('bible.bookDone')} className="text-gold-ink" />
                      ) : (
                        <span className="text-xs font-semibold text-ink-soft tabular">{t('bible.bookProgress', { done, total })}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

      {index.data && <p className="mt-8 text-center text-xs text-ink-faint">{t('bible.sourceNote', { name: index.data.name })}</p>}
    </>
  )
}
