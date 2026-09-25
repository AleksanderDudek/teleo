import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { speechVendor } from './vendor'

interface SpeechPrivacyDialogProps {
  open: boolean
  onDevice: boolean
  onAccept: () => void
  onClose: () => void
}

/**
 * First-use notice (spec §5.2 / §13): the browser's recognizer may send audio to its vendor —
 * unless recognition runs on the device (on-device Web Speech or offline Whisper).
 */
export function SpeechPrivacyDialog({ open, onDevice, onAccept, onClose }: SpeechPrivacyDialogProps) {
  const { t } = useTranslation()
  const vendor = speechVendor()
  const vendorName = t(`speech.privacy.vendor${vendor}`)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('speech.privacy.title')}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onAccept}>{t('speech.privacy.accept')}</Button>
        </>
      }
    >
      <div className="space-y-3 text-ink-soft">
        <p className="flex gap-3">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-leaf" />
          <span>{onDevice ? t('speech.privacy.bodyOnDevice') : t('speech.privacy.body', { vendor: vendorName })}</span>
        </p>
        {!onDevice && <p className="text-sm">{t('speech.privacy.whisper')}</p>}
        <a className="inline-block text-sm font-semibold text-primary underline underline-offset-4" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
          {t('settings.privacyPolicy')}
        </a>
      </div>
    </Dialog>
  )
}
