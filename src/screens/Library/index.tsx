import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { TextCard } from '@/components/TextCard'
import { ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconHalo } from '@/components/ui/IconHalo'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { Segmented } from '@/components/ui/Segmented'
import { ACHIEVEMENT_RULES, buildTextMetrics, nextTextMilestone } from '@/domain/gamification'
import {
  isFiltered,
  libraryFilterParams,
  NO_FILTER,
  readLibraryFilter,
  type LibraryFilter,
  type SourceFilter,
} from '@/domain/text/libraryFilter'
import { countNeeds, matchesNeed, NEED_AREAS, NEEDS_BY_AREA } from '@/domain/text/needs'
import { TEXT_TYPES } from '@/domain/types'
import { achievementName } from '@/i18n/dynamic'
import { useLibrary } from '@/hooks/useLibrary'
import { searchKey } from '@/lib/search'
import { useAppSettings } from '@/stores/settings'

const CHIP_ROW = '-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0'

export default function Library() {
  const { t } = useTranslation()
  const app = useAppSettings()
  const location = useLocation()
  const entries = useLibrary(app.uiLang)
  const [params, setParams] = useSearchParams()
  const filter = useMemo(() => readLibraryFilter(params), [params])
  const needsSection = useRef<HTMLElement>(null)
  // Replacing the entry: typing in the search box must not fill the history.
  const update = (patch: Partial<LibraryFilter>) => setParams(libraryFilterParams({ ...filter, ...patch }), { replace: true })

  // Titles, words and tags (the attribution of the prayer library), folded once per data change, not per keystroke.
  const searchKeys = useMemo(
    () => new Map(entries?.map(({ text }) => [text.id, searchKey(`${text.title} ${text.tags.join(' ')} ${text.body}`)])),
    [entries],
  )

  /** Every filter but the need: what the need chips count. */
  const candidates = useMemo(() => {
    if (!entries) return []
    const q = searchKey(filter.query.trim())
    return entries.filter(({ text }) => {
      if (!filter.showHidden && text.archived) return false
      if (filter.types.length && !filter.types.includes(text.type)) return false
      if (filter.source !== 'all' && text.source !== filter.source) return false
      if (q && !searchKeys.get(text.id)?.includes(q)) return false
      return true
    })
  }, [entries, filter, searchKeys])

  const counts = useMemo(() => countNeeds(candidates.map((entry) => entry.text)), [candidates])
  const filtered = useMemo(() => candidates.filter(({ text }) => matchesNeed(text, filter)), [candidates, filter])

  // Only areas and needs that would show something; the chosen ones stay so they can be unchosen.
  const areas = NEED_AREAS.filter((area) => counts.areas.has(area) || area === filter.area)
  const needs = filter.area ? NEEDS_BY_AREA[filter.area].filter((need) => counts.needs.has(need) || need === filter.need) : []

  const toggleType = (type: (typeof TEXT_TYPES)[number]) =>
    update({ types: filter.types.includes(type) ? filter.types.filter((other) => other !== type) : [...filter.types, type] })

  const loaded = entries !== undefined
  // On phones the chip rows scroll sideways: bring the chosen chips into their row (not the page into view).
  useEffect(() => {
    for (const chip of needsSection.current?.querySelectorAll<HTMLElement>('[aria-pressed="true"]') ?? []) {
      const row = chip.parentElement
      if (!row) continue
      const left = chip.getBoundingClientRect().left - row.getBoundingClientRect().left
      if (left < 0 || left + chip.offsetWidth > row.clientWidth) row.scrollLeft += left - 20
    }
  }, [filter.area, filter.need, loaded])

  const hasAnyVisible = entries?.some((e) => !e.text.archived) ?? false
  const filtering = isFiltered(filter)
  const backTo = `${location.pathname}${location.search}`

  /** "12 more to Centurion" once a text has been said at least once (spec §11/3). */
  const milestoneOf = ({ stats, segmentCount }: (typeof filtered)[number]) => {
    if (!stats?.repetitions) return undefined
    const next = nextTextMilestone(buildTextMetrics(stats, segmentCount), ACHIEVEMENT_RULES)
    return next ? t('library.milestone', { remaining: next.remaining, name: achievementName(t, next.rule.id) }) : undefined
  }

  const clear = (
    <button
      type="button"
      onClick={() => setParams(libraryFilterParams(NO_FILTER), { replace: true })}
      className="font-semibold text-primary underline-offset-4 hover:underline"
    >
      {t('library.clearFilters')}
    </button>
  )

  return (
    <>
      <PageHeader
        rubric={t('library.rubric')}
        title={t('library.title')}
        actions={
          <ButtonLink to="/library/new" size="sm" icon="plus">
            {t('library.add')}
          </ButtonLink>
        }
      />

      <Link to="/bible" className="card card-lift card-framed mb-5 flex items-center gap-4 p-4">
        <IconHalo icon="gospel" size={44} iconSize={22} />
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-xl font-semibold">{t('bible.libraryTitle')}</span>
          <span className="block text-sm text-ink-soft">{t('bible.libraryBody')}</span>
        </span>
      </Link>

      <div className="space-y-4">
        <SearchField
          value={filter.query}
          onChange={(query) => update({ query })}
          label={t('common.search')}
          placeholder={t('library.searchPlaceholder')}
        />

        {areas.length > 0 && (
          <section ref={needsSection} data-tour="needs" aria-labelledby="needs-heading" className="space-y-2">
            <h2 id="needs-heading" className="font-serif text-xl font-semibold">
              {t('library.needsHeading')}
            </h2>
            <div className={CHIP_ROW} role="group" aria-label={t('library.filterArea')}>
              {areas.map((area) => (
                <Chip
                  key={area}
                  pressed={filter.area === area}
                  onClick={() => update({ area: filter.area === area ? undefined : area, need: undefined })}
                >
                  {t(`needs.areas.${area}`)}
                  <span className="tabular text-xs opacity-70">{counts.areas.get(area) ?? 0}</span>
                </Chip>
              ))}
            </div>
            {needs.length > 0 && (
              <div className={CHIP_ROW} role="group" aria-label={t('library.filterNeed')}>
                {needs.map((need) => (
                  <Chip key={need} pressed={filter.need === need} onClick={() => update({ need: filter.need === need ? undefined : need })}>
                    {t(`needs.items.${need}`)}
                    <span className="tabular text-xs opacity-70">{counts.needs.get(need) ?? 0}</span>
                  </Chip>
                ))}
              </div>
            )}
          </section>
        )}

        <div className={CHIP_ROW} role="group" aria-label={t('library.filterType')}>
          {TEXT_TYPES.map((type) => (
            <Chip key={type} pressed={filter.types.includes(type)} onClick={() => toggleType(type)}>
              {t(`textTypesPlural.${type}`)}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 w-px shrink-0 bg-line" />
          <Chip pressed={filter.showHidden} onClick={() => update({ showHidden: !filter.showHidden })}>
            {t('library.showHidden')}
          </Chip>
        </div>

        <Segmented<SourceFilter>
          label={t('library.filterSource')}
          hideLabel
          value={filter.source}
          onChange={(source) => update({ source })}
          options={[
            { value: 'all', label: t('library.sourceAll') },
            { value: 'builtin', label: t('library.sourceBuiltin') },
            { value: 'user', label: t('library.sourceUser') },
          ]}
        />
      </div>

      <section aria-live="polite" className="mt-6">
        {entries === undefined ? null : !hasAnyVisible && !filter.showHidden && filter.source !== 'builtin' ? (
          <EmptyState
            title={t('library.emptyTitle')}
            body={t('library.emptyBody')}
            action={
              <ButtonLink to="/library/new" icon="plus">
                {t('library.add')}
              </ButtonLink>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-ink-soft">
            {t('library.noResults')} {filtering && clear}
          </p>
        ) : (
          <>
            {filtering && (
              <p className="mb-3 flex items-baseline justify-between gap-4 text-sm text-ink-soft">
                <span className="tabular">{t('library.results', { count: filtered.length })}</span>
                {clear}
              </p>
            )}
            <ul className="space-y-3">
              {filtered.map((entry, index) => (
                <li
                  key={entry.text.id}
                  data-tour={index === 0 ? 'result' : undefined}
                  className="animate-rise"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <TextCard entry={entry} footnote={milestoneOf(entry)} backTo={backTo} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  )
}
