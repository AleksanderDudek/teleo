import { useId } from 'react'
import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label id={`${id}-label`} htmlFor={id} className="font-medium text-ink">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-sm text-ink-soft">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-45',
          checked ? 'border-primary bg-primary' : 'border-line-strong bg-sunk',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-5 rounded-full shadow transition-transform duration-200',
            checked ? 'translate-x-6 bg-on-primary' : 'translate-x-1 bg-surface',
          )}
        />
      </button>
    </div>
  )
}
