import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Character } from '@/components/brand/Character'
import type { IconName } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { buttonClasses, type ButtonSize, type ButtonVariant } from '@/components/ui/buttonClasses'
import type { CharacterId } from '@/domain/types'
import { download } from '@/lib/download'
import { drawShareCard, standaloneSvg, type CardContent } from './shareCard'
import { systemShare, type ShareResult } from './shareSheet'
import { shareLinks } from './shareText'

export interface SharePayload {
  /** The post, exactly as it goes out (previewed before sending). */
  text: string
  /** The picture: everything but the figure and the motto, which are added here. */
  card: Omit<CardContent, 'figureSvg' | 'motto'>
  fileName: string
}

/**
 * Share a picture card (the user's figure + numbers) through the system share sheet. Without one: the
 * text is copied and direct links plus a download are offered. Nothing leaves the device before the user
 * sees exactly what goes out.
 */
export function ShareButton({
  label,
  payload,
  character,
  variant = 'secondary',
  size = 'sm',
  block,
  icon = 'share-network',
  className,
}: {
  label: string
  payload: SharePayload
  character: CharacterId
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  icon?: IconName
  className?: string
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const figureBox = useRef<HTMLDivElement>(null)

  const card = async (): Promise<Blob | null> => {
    try {
      const svg = figureBox.current?.querySelector('svg')
      return await drawShareCard({ ...payload.card, motto: t('share.cta'), figureSvg: svg ? standaloneSvg(svg, 300) : undefined })
    } catch {
      return null
    }
  }

  const go = async () => {
    setBusy(true)
    setNote(null)
    let result: ShareResult
    try {
      const png = await card()
      const file = png ? new File([png], payload.fileName, { type: 'image/png' }) : null
      result = await systemShare({ text: payload.text, title: payload.card.title, file })
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
      <Button variant={variant} size={size} block={block} icon={icon} disabled={busy} onClick={() => void go()}>
        {busy ? t('share.preparing') : label}
      </Button>
      <details className="mt-2 text-sm text-ink-soft">
        <summary className="cursor-pointer font-semibold">{t('share.preview')}</summary>
        <p className="mt-1 whitespace-pre-line">{payload.text}</p>
      </details>
      {note && (
        <p role="status" className="mt-2 text-sm font-medium text-ink">
          {note}
        </p>
      )}
      {fallback && (
        <div className="mt-2 flex flex-wrap gap-2">
          {shareLinks(payload.text, t).map((link) => (
            <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              {link.name}
            </a>
          ))}
          <Button
            variant="ghost"
            size="sm"
            icon="download-simple"
            onClick={() => void card().then((png) => png && download(png, payload.fileName))}
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
