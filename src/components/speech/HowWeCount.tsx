import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { Dialog } from '@/components/ui/Dialog'
import { useAppSettings } from '@/stores/settings'

/** "How do we check?" — the way of checking in use explained (gentle or strict, DECISIONS #133). */
export function HowWeCount({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { checking } = useAppSettings()
  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('speech.howWeCount')}
          title={t('speech.howWeCount')}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunk hover:text-ink"
        >
          <Icon name="question" size={20} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          <Icon name="question" size={16} />
          {t('speech.howWeCount')}
        </button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} guide="teach" title={t('speech.howWeCount')} description={t(checking === 'strict' ? 'speech.howWeCountStrict' : 'speech.howWeCountGentle')} />
    </>
  )
}
