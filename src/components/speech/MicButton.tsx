import { Mic, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

interface MicButtonProps {
  listening: boolean
  busy?: boolean
  disabled?: boolean
  onClick: () => void
  size?: 'md' | 'lg'
}

/** The medallion: forest disc with a gilded ring; breathing rings while listening. */
export function MicButton({ listening, busy, disabled, onClick, size = 'lg' }: MicButtonProps) {
  const { t } = useTranslation()
  const dimension = size === 'lg' ? 'size-24' : 'size-18'
  return (
    <div className="relative inline-grid place-items-center">
      {listening && (
        <>
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
          'relative inline-flex items-center justify-center rounded-full border-4 shadow-[0_18px_40px_-18px_rgb(20_45_35/0.8)] transition-[transform,background-color] duration-200 active:scale-95 disabled:opacity-50',
          dimension,
          listening ? 'border-gold bg-bad text-paper' : 'border-gold/70 bg-primary text-on-primary hover:bg-primary-hover',
        )}
      >
        {listening ? <Square aria-hidden className="size-8" fill="currentColor" /> : <Mic aria-hidden className="size-10" />}
      </button>
    </div>
  )
}
