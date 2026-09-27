import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { isBookCode } from '@/domain/bible/books'
import { rangeLabel } from '@/domain/bible/label'
import { BIBLE_TRANSLATIONS, type BibleTranslation } from '@/domain/bible/types'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/ui'
import { bibleSummary, bookName, readingMinutes, startReading, useBibleBook, useBibleIndex, useBibleReadings } from './useBible'

/** One book: its readings with verse ranges; any reading can be read (or read again). */
export default function BibleBook() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams()
  const translation: BibleTranslation = (BIBLE_TRANSLATIONS as readonly string[]).includes(params.translation ?? '') ? (params.translation as BibleTranslation) : 'kjv'
  const code = params.book && isBookCode(params.book) ? params.book : 'GEN'
  const book = useBibleBook(translation, code)
  const index = useBibleIndex(translation)
  const rows = useBibleReadings(translation)
  const [starting, setStarting] = useState<number | null>(null)
  const next = index.data && rows ? bibleSummary(index.data, rows).next : null
  const read = new Set((rows ?? []).filter((row) => row.book === code).map((row) => row.index))

  const begin = async (reading: number) => {
    setStarting(reading)
    try {
      const run = await startReading(t, translation, code, reading)
      navigate(`/play/${run.id}`)
    } catch {
      toast({ kind: 'error', title: t('bible.loadError') })
    } finally {
      setStarting(null)
    }
  }

  return (
    <>
      <PageHeader backTo="/bible" rubric={t('bible.readings')} title={bookName(t, code)} />
      {book.error && <p className="rounded-2xl bg-bad-soft px-4 py-3 text-bad">{t('bible.loadError')}</p>}
      {book.data && (
        <ol className="grid gap-2">
          {book.data.r.map(([fc, fv, tc, tv], i) => {
            const done = read.has(i)
            const isNext = next?.book === code && next.index === i
            const lastVerse = Math.max(...book.data!.v.filter(([c]) => c === fc).map(([, v]) => v))
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={starting !== null}
                  onClick={() => void begin(i)}
                  className={cn('card card-lift flex w-full items-center gap-3 px-4 py-3 text-left', isNext && 'card-framed border-primary')}
                >
                  <span className={cn('halo size-9 text-sm font-bold', done ? '' : 'halo-sunk')} aria-hidden>
                    {done ? <Icon name="check" size={16} tone="plain" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-lg font-semibold tabular">{rangeLabel([fc, fv], [tc, tv], lastVerse)}</span>
                    <span className="block text-xs text-ink-soft">
                      {t('bible.minutes', { minutes: readingMinutes(book.data!, i, index.data?.wordsPerMinute ?? 140) })}
                    </span>
                  </span>
                  {done && <span className="text-xs font-semibold text-ok">{t('bible.readingDone')}</span>}
                  {isNext && <span className="text-xs font-semibold text-primary">{t('bible.readingNext')}</span>}
                  <Icon name="caret-right" size={16} className="text-ink-faint" />
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
