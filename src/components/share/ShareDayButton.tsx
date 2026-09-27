import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Character } from '@/components/brand/Character'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Button } from '@/components/ui/Button'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'
import type { CharacterId } from '@/domain/types'
import { download } from '@/lib/download'
import { drawShareCard, standaloneSvg } from './shareCard'
import { formatShare, shareLinks, shareText, type DayShare } from './shareText'

type Result = 'shared' | 'cancelled' | 'copied' | 'unsupported'

/** The share sheet can be closed by a gesture the browser never reports; don't wait for it forever. */
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([promise, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms))])

async function share(text: string, title: string, png: Blob | null, fileName: string): Promise<Result> {
  if (navigator.share) {
    try {
      const file = png ? new File([png], fileName, { type: 'image/png' }) : null
      const payload = file && navigator.canShare?.({ files: [file] }) ? { files: [file], text } : { title, text }
      if (await withTimeout(navigator.share(payload).then(() => true), 20_000, false)) return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await withTimeout(navigator.clipboard.writeText(text), 3_000, undefined)
    return 'copied'
  } catch {
    return 'unsupported'
  }
}

/**
 * "Share today": a square picture of the day (the user's figure, minutes, sentences, streak, points)
 * through the system share sheet. Without one: the text is copied and direct links plus a download are
 * offered. Nothing leaves the device before the user sees exactly what goes out.
 */
export function ShareDayButton({ day, character, className }: { day: DayShare; character: CharacterId; className?: string }) {
  const { t, i18n } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const figureBox = useRef<HTMLDivElement>(null)
  const seed = Number(day.dayKey.replaceAll('-', '')) || 0
  const text = shareText(day, t, i18n.language, seed)
  const date = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(day.dayKey))

  const card = async (): Promise<Blob | null> => {
    try {
      const svg = figureBox.current?.querySelector('svg')
      return await drawShareCard({
        rubric: date,
        title: t('share.cardTitle'),
        stats: [
          { value: String(day.minutes), label: t('share.cardMinutes') },
          { value: String(day.sentences), label: t('share.cardSentences') },
          { value: String(day.streak), label: t('share.cardStreak') },
          { value: new Intl.NumberFormat(i18n.language).format(day.points), label: t('share.cardPoints') },
        ],
        note: day.bibleShare ? `${formatShare(day.bibleShare, i18n.language)} ${t('share.cardBible')}` : undefined,
        motto: t('share.cta'),
        figureSvg: svg ? standaloneSvg(svg, 300) : undefined,
      })
    } catch {
      return null
    }
  }

  const go = async () => {
    setBusy(true)
    setNote(null)
    let result: Result
    try {
      result = await share(text, t('share.cardTitle'), await card(), t('share.fileName'))
    } catch {
      result = 'unsupported'
    } finally {
      setBusy(false)
    }
    if (result === 'shared' || result === 'cancelled') return
    setNote(result === 'copied' ? t('share.copied') : t('share.unsupported'))
    setFallback(true)
  }

  return (
    <div className={className}>
      <Button variant="secondary" size="sm" icon="share-network" disabled={busy} onClick={() => void go()}>
        {busy ? t('share.preparing') : t('share.button')}
      </Button>
      <details className="mt-2 text-sm text-ink-soft">
        <summary className="cursor-pointer font-semibold">{t('share.preview')}</summary>
        <p className="mt-1 whitespace-pre-line">{text}</p>
      </details>
      {note && (
        <p role="status" className="mt-2 text-sm font-medium text-ink">
          {note}
        </p>
      )}
      {fallback && (
        <div className="mt-2 flex flex-wrap gap-2">
          {shareLinks(text, t).map((link) => (
            <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              {link.name}
            </a>
          ))}
          <Button
            variant="ghost"
            size="sm"
            icon="download-simple"
            onClick={() => void card().then((png) => png && download(png, t('share.fileName')))}
          >
            {t('share.download')}
          </Button>
        </div>
      )}
      {/* The figure drawn into the card; its SVG uses fixed pigments, so it renders on its own. */}
      <div ref={figureBox} hidden aria-hidden>
        <Character id={character} pose="praying" size={300} decorative />
      </div>
    </div>
  )
}
