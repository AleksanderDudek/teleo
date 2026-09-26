import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'

interface MicButtonProps {
  listening: boolean
  busy?: boolean
  disabled?: boolean
  onClick: () => void
  size?: 'md' | 'lg'
}

/** Ring of short gold rays radiating from the medallion while the voice is live. */
const RAYS_MASK = 'radial-gradient(circle, transparent 38%, #000 42%, #000 58%, transparent 70%)'

/**
 * The medallion: a lapis disc in a gold nimbus (3px ring, inner hairline, pale outer halo). While
 * listening it turns cinnabar — the voice is live — with radiating gold halos.
 */
export function MicButton({ listening, busy, disabled, onClick, size = 'lg' }: MicButtonProps) {
  const { t } = useTranslation()
  const dimension = size === 'lg' ? 'size-24' : 'size-18'
  return (
    <div className="relative inline-grid place-items-center">
      {listening && (
        <>
          <span
            aria-hidden
            className={cn('absolute rounded-full bg-(image:--halo-rays)', size === 'lg' ? 'size-[10.2rem]' : 'size-[7.65rem]')}
            style={{ maskImage: RAYS_MASK, WebkitMaskImage: RAYS_MASK }}
          />
          <span aria-hidden className={cn('absolute rounded-full bg-gold/35 animate-breathe', dimension)} />
          <span aria-hidden className={cn('absolute rounded-full bg-gold/25 animate-breathe [animation-delay:1.3s]', dimension)} />
        </>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        aria-pressed={listening}
        aria-label={listening ? t('speech.stop') : t('speech.speak')}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full border-[3px] border-gold',
          'shadow-[0_0_0_6px_var(--gold-soft),0_18px_40px_-18px_rgb(20_30_80/0.8)] transition-[transform,background-color] duration-200 active:scale-95 disabled:opacity-50',
          dimension,
          listening ? 'bg-cinnabar text-paper' : 'bg-primary text-on-primary hover:bg-primary-hover',
        )}
      >
        {/* Inner gold hairline of the nimbus (a span, so the focus outline stays free). */}
        <span aria-hidden className="absolute inset-[4px] rounded-full border border-gold/55" />
        {listening ? (
          <Icon name="stop" size={size === 'lg' ? 34 : 28} tone="plain" fillOpacity={1} />
        ) : (
          <Icon name="mic-halo" size={size === 'lg' ? 46 : 36} fillOpacity={0.9} />
        )}
      </button>
    </div>
  )
}
