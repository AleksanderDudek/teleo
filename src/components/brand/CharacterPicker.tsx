import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { CHARACTER_IDS, type CharacterId } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Avatar } from './Avatar'

interface CharacterPickerProps {
  value: CharacterId
  onChange: (id: CharacterId) => void
  label: string
  hideLabel?: boolean
  /** Avatar diameter in px. */
  size?: number
}

/** The eight characters as a radio group: portrait in a nimbus with the name as an inscription. */
export function CharacterPicker({ value, onChange, label, hideLabel, size = 58 }: CharacterPickerProps) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className={cn('mb-3 font-medium text-ink', hideLabel && 'sr-only')}>{label}</legend>
      <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-3">
        {CHARACTER_IDS.map((id) => {
          const selected = id === value
          return (
            <label key={id} className="group flex cursor-pointer flex-col items-center rounded-2xl p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold">
              <input type="radio" name={name} value={id} checked={selected} onChange={() => onChange(id)} className="sr-only" />
              <Avatar id={id} size={size} selected={selected} decorative className="transition-transform group-hover:-translate-y-0.5" />
              <span className={cn('inscription mt-1 text-[0.85rem]', selected ? 'text-primary' : 'text-ink-soft')}>{t(`characters.${id}`)}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
