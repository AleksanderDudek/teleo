import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'

interface StepperProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  label: string
  step?: number
  /** Visible value formatter, e.g. "×10". */
  format?: (value: number) => string
}

export function Stepper({ value, min, max, onChange, label, step = 1, format }: StepperProps) {
  const { t } = useTranslation()
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)))
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-full border border-line bg-surface">
      <button
        type="button"
        onClick={() => set(value - step)}
        disabled={value <= min}
        aria-label={`${label}: −${step}`}
        className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft hover:text-ink disabled:opacity-35"
      >
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite" className="tabular min-w-12 text-center font-semibold text-ink">
        {format ? format(value) : value}
      </output>
      <button
        type="button"
        onClick={() => set(value + step)}
        disabled={value >= max}
        aria-label={`${label}: +${step}`}
        title={t('common.add')}
        className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft hover:text-ink disabled:opacity-35"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
