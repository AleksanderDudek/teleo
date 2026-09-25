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

/** First-use notice (spec §5.2 / §13): the browser's recognizer may send audio to its vendor. */
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
          <span>{t('speech.privacy.body', { vendor: vendorName })}</span>
        </p>
        {onDevice && <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm font-medium text-ok">{t('speech.privacy.onDevice')}</p>}
        <p className="text-sm">{t('speech.privacy.whisper')}</p>
        <a className="inline-block text-sm font-semibold text-primary underline underline-offset-4" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
          {t('settings.privacyPolicy')}
        </a>
      </div>
    </Dialog>
  )
}
