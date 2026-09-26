import { Icon } from '@/components/icons/Icon'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
}

/** 48px pill search input with a leading magnifier. */
export function SearchField({ value, onChange, label, placeholder }: SearchFieldProps) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon name="magnifying-glass" size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-gold"
      />
    </label>
  )
}
