import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { Dialog } from '@/components/ui/Dialog'
import { TextTypeIcon } from '@/components/TextTypeIcon'
import type { TextItem } from '@/db/types'
import { countNeeds, isNeedId, mainNeed, matchesNeed, NEED_AREAS, NEEDS_BY_AREA, type NeedArea, type NeedId } from '@/domain/text/needs'
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
  // Kept between picks: several texts for one need are often added in a row.
  const [need, setNeed] = useState<NeedId | undefined>()
  const searched = useMemo(() => {
    const q = searchKey(query.trim())
    return texts
      .filter((text) => !text.archived && (segmentCounts.get(text.id) ?? 0) > 0)
      .filter((text) => !q || searchKey(`${text.title} ${text.tags.join(' ')} ${text.body}`).includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [texts, segmentCounts, query])
  const counts = useMemo(() => countNeeds(searched), [searched])
  const filtered = useMemo(() => searched.filter((text) => matchesNeed(text, { need })), [searched, need])
  const mainNeedLabel = (text: TextItem) => {
    const id = mainNeed(text)
    return id ? t(`needs.items.${id}`) : ''
  }
  // Only needs that have something to pick (and the chosen one, so it can be unchosen) — DECISIONS #125.
  const offered = (area: NeedArea) =>
    NEEDS_BY_AREA[area].filter((id) => counts.needs.has(id) || id === need)

  return (
    <Dialog open={open} onClose={onClose} title={t('builder.pickTitle')}>
      <label className="relative mb-3 block">
        <span className="sr-only">{t('builder.pickSearch')}</span>
        <Icon name="magnifying-glass" size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('builder.pickSearch')}
          className="h-11 w-full rounded-full border border-line bg-paper pr-4 pl-10 focus:outline-2 focus:outline-gold"
        />
      </label>
      {(counts.needs.size > 0 || need) && (
        <label className="mb-3 block">
          <span className="sr-only">{t('builder.pickNeed')}</span>
          <select
            value={need ?? ''}
            onChange={(e) => setNeed(isNeedId(e.target.value) ? e.target.value : undefined)}
            className="h-11 w-full rounded-full border border-line bg-paper px-4 text-ink focus:outline-2 focus:outline-gold"
          >
            <option value="">{t('builder.pickNeedAll')}</option>
            {NEED_AREAS.filter((area) => offered(area).length > 0).map((area) => (
              <optgroup key={area} label={t(`needs.areas.${area}`)}>
                {offered(area).map((id) => (
                  <option key={id} value={id}>
                    {t(`needs.items.${id}`)} ({counts.needs.get(id) ?? 0})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
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
                <TextTypeIcon type={text.type} size={20} className="text-gold-ink" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg font-semibold">{text.title}</span>
                  <span className="block text-xs text-ink-soft">
                    {[mainNeedLabel(text), t('counts.segments', { count: segmentCounts.get(text.id) ?? 0 })]
                      .filter(Boolean)
                      .join(' · ')}
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
