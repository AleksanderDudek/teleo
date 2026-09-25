import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@/components/ui/Dialog'
import { TextTypeIcon } from '@/components/TextTypeIcon'
import type { TextItem } from '@/db/types'
import { searchKey } from '@/lib/search'

interface TextPickerProps {
  open: boolean
  texts: readonly TextItem[]
  segmentCounts: ReadonlyMap<string, number>
  onPick: (textId: string) => void
  onClose: () => void
}

export function TextPicker({ open, texts, segmentCounts, onPick, onClose }: TextPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = searchKey(query.trim())
    return texts
      .filter((text) => !text.archived && (segmentCounts.get(text.id) ?? 0) > 0)
      .filter((text) => !q || searchKey(`${text.title} ${text.body}`).includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [texts, segmentCounts, query])

  return (
    <Dialog open={open} onClose={onClose} title={t('builder.pickTitle')}>
      <label className="relative mb-3 block">
        <span className="sr-only">{t('builder.pickSearch')}</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('builder.pickSearch')}
          className="h-11 w-full rounded-full border border-line bg-paper pr-4 pl-10 focus:outline-2 focus:outline-gold"
        />
      </label>
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-ink-soft">{t('builder.pickEmpty')}</p>
      ) : (
        <ul className="-mx-2 max-h-[55dvh] overflow-y-auto">
          {filtered.map((text) => (
            <li key={text.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(text.id)
                  setQuery('')
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-sunk"
              >
                <TextTypeIcon type={text.type} className="size-5 shrink-0 text-leaf" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg font-semibold">{text.title}</span>
                  <span className="block text-xs text-ink-soft">
                    {t(`langShort.${text.lang}`)} · {t('counts.segments', { count: segmentCounts.get(text.id) ?? 0 })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
