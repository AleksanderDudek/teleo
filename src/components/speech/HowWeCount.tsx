import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { Dialog } from '@/components/ui/Dialog'

/** "How do we check?" — the 95 % rule explained (spec §6.1). */
export function HowWeCount() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
      >
        <Icon name="question" size={16} />
        {t('speech.howWeCount')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} guide="teach" title={t('speech.howWeCount')} description={t('speech.howWeCountBody')} />
    </>
  )
}
