import { useId } from 'react'
import { cn } from '@/lib/cn'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
  hideLabel?: boolean
}

/** Single-choice control rendered as a pill group (radio semantics). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
}: SegmentedProps<T>) {
  const id = useId()
  return (
    <fieldset className="min-w-0">
      <legend id={id} className={cn('mb-2 font-medium text-ink', hideLabel && 'sr-only')}>
        {label}
      </legend>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-line bg-sunk p-1">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <label
              key={option.value}
              className={cn(
                'relative cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold',
                selected
                  ? 'bg-surface text-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent),0_1px_3px_rgb(0_0_0/0.1)]'
                  : 'text-ink-soft hover:text-ink',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={id}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
