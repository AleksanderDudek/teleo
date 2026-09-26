import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { MEMORY_LEVELS, type MemoryLevel } from '@/domain/memory/mask'
import { cn } from '@/lib/cn'

interface MemoryStartDialogProps {
  open: boolean
  onClose: () => void
  onStart: (level: MemoryLevel) => void
}

/** Choose a memory-mode level before starting (spec §7.3). */
export function MemoryStartDialog({ open, onClose, onStart }: MemoryStartDialogProps) {
  const { t } = useTranslation()
  const [level, setLevel] = useState<MemoryLevel>('initials')
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('memory.title')}
      description={t('memory.body')}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onStart(level)}>{t('memory.start')}</Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('memory.title')}</legend>
        {MEMORY_LEVELS.map((value) => (
          <label
            key={value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold',
              level === value ? 'card-framed border-primary bg-surface' : 'border-line hover:border-line-strong',
            )}
          >
            <input type="radio" name="memory-level" value={value} checked={level === value} onChange={() => setLevel(value)} className="sr-only" />
            <span className={cn('mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2', level === value ? 'border-primary bg-primary text-on-primary' : 'border-line-strong')}>
              {level === value && <Icon name="check" size={12} tone="plain" />}
            </span>
            <span>
              <span className="block font-semibold text-ink">{t(`memory.levels.${value}.name`)}</span>
              <span className="block text-sm text-ink-soft">{t(`memory.levels.${value}.desc`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  )
}
