import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { TextCard } from '@/components/TextCard'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconHalo } from '@/components/ui/IconHalo'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { Segmented } from '@/components/ui/Segmented'
import { db } from '@/db/schema'
import { ACHIEVEMENT_RULES, buildTextMetrics, nextTextMilestone } from '@/domain/gamification'
import {
  isFiltered,
  libraryFilterParams,
  NO_FILTER,
  readLibraryFilter,
  type LibraryFilter,
  type SourceFilter,
} from '@/domain/text/libraryFilter'
import { countNeeds, matchesNeed, NEED_AREAS, NEEDS_BY_AREA, needRank } from '@/domain/text/needs'
import { TEXT_TYPES } from '@/domain/types'
import { achievementName } from '@/i18n/dynamic'
import { useLibrary, type LibraryEntry } from '@/hooks/useLibrary'
import { searchKey } from '@/lib/search'
import { useAppSettings } from '@/stores/settings'

export default function Library() {
  const { t } = useTranslation()
  const app = useAppSettings()
  const location = useLocation()
  const entries = useLibrary(app.uiLang)
  // Texts used by a visible session belong to "Start here" (the rosary prayers, the morning affirmations…).
  const inSessions = useLiveQuery(async () => {
    const templates = await db.sessionTemplates.toArray()
    return new Set(templates.filter((template) => !template.archived).flatMap((template) => template.items.map((item) => item.textId)))
  }, [])
  const [params, setParams] = useSearchParams()
  const filter = useMemo(() => readLibraryFilter(params), [params])
  const [filtersOpen, setFiltersOpen] = useState(false)
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
  // Texts mainly for the chosen need first (DECISIONS #128); the hook already sorts by title, and the sort is stable.
  const filtered = useMemo(
    () => candidates.filter(({ text }) => matchesNeed(text, filter)).sort((a, b) => needRank(a.text, filter) - needRank(b.text, filter)),
    [candidates, filter],
  )

  const filtering = isFiltered(filter)
  /** Unfiltered, the library opens with what a person uses — own texts, texts said before, texts of their sessions. */
  const starters = useMemo(() => {
    if (filtering || !inSessions) return []
    return filtered.filter(({ text, stats }) => text.source === 'user' || (stats?.repetitions ?? 0) > 0 || inSessions.has(text.id))
  }, [filtering, filtered, inSessions])
  const rest = useMemo(() => {
    const ids = new Set(starters.map((entry) => entry.text.id))
    return filtered.filter((entry) => !ids.has(entry.text.id))
  }, [filtered, starters])

  // Only areas and needs that would show something; the chosen ones stay so they can be unchosen.
  const areas = NEED_AREAS.filter((area) => counts.areas.has(area) || area === filter.area)
  const needs = filter.area ? NEEDS_BY_AREA[filter.area].filter((need) => counts.needs.has(need) || need === filter.need) : []

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

  const toggleType = (type: (typeof TEXT_TYPES)[number]) =>
    update({ types: filter.types.includes(type) ? filter.types.filter((other) => other !== type) : [...filter.types, type] })
  /** Type, source and hidden live in the Filters sheet; its button says how many are set. */
  const sheetFilters = filter.types.length + (filter.source === 'all' ? 0 : 1) + (filter.showHidden ? 1 : 0)

  const hasAnyVisible = entries?.some((e) => !e.text.archived) ?? false
  const backTo = `${location.pathname}${location.search}`

  /** "12 more to Centurion" once a text has been said at least once (spec §11/3). */
  const milestoneOf = ({ stats, segmentCount }: LibraryEntry) => {
    if (!stats?.repetitions) return undefined
    const next = nextTextMilestone(buildTextMetrics(stats, segmentCount), ACHIEVEMENT_RULES)
    return next ? t('library.milestone', { remaining: next.remaining, name: achievementName(t, next.rule.id) }) : undefined
  }

  const clear = (
    <button
      type="button"
      onClick={() => setParams(libraryFilterParams(NO_FILTER), { replace: true })}
      className="-my-3 py-3 font-semibold text-primary underline-offset-4 hover:underline"
    >
      {t('library.clearFilters')}
    </button>
  )

  const list = (group: readonly LibraryEntry[], offset = 0) => (
    <ul className="space-y-3">
      {group.map((entry, index) => (
        <li key={entry.text.id} className="animate-rise" style={{ animationDelay: `${Math.min(index + offset, 8) * 40}ms` }}>
          <TextCard entry={entry} footnote={milestoneOf(entry)} backTo={backTo} />
        </li>
      ))}
    </ul>
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
            <div className="chip-row" role="group" aria-label={t('library.filterArea')}>
              {areas.map((area) => (
                <Chip
                  key={area}
                  pressed={filter.area === area}
                  onClick={() => update({ area: filter.area === area ? undefined : area, need: undefined })}
                >
                  {t(`needs.areas.${area}`)}
                  <span className="tabular text-xs">{counts.areas.get(area) ?? 0}</span>
                </Chip>
              ))}
            </div>
            {needs.length > 0 && (
              <div className="chip-row" role="group" aria-label={t('library.filterNeed')}>
                {needs.map((need) => (
                  <Chip key={need} pressed={filter.need === need} onClick={() => update({ need: filter.need === need ? undefined : need })}>
                    {t(`needs.items.${need}`)}
                    <span className="tabular text-xs">{counts.needs.get(need) ?? 0}</span>
                  </Chip>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="flex items-center gap-2">
          <Chip pressed={sheetFilters > 0} onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
            <Icon name="sliders-horizontal" size={16} />
            {t('library.filters')}
            {sheetFilters > 0 && <span className="tabular text-xs">{sheetFilters}</span>}
          </Chip>
          <span className="flex-1" />
          <Link to="/bible" className="inline-flex min-h-11 items-center gap-2 rounded-full pr-1 text-sm font-semibold text-gold-ink">
            <IconHalo icon="gospel" size={32} iconSize={16} />
            {t('bible.libraryTitle')}
          </Link>
        </div>
      </div>

      <section className="mt-6">
        <p role="status" className="sr-only">
          {loaded && t('library.results', { count: filtered.length })}
        </p>
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
        ) : filtering ? (
          <>
            <p className="mb-3 flex items-baseline justify-between gap-4 text-sm text-ink-soft">
              <span className="tabular" aria-hidden>
                {t('library.results', { count: filtered.length })}
              </span>
              {clear}
            </p>
            {list(filtered)}
          </>
        ) : starters.length > 0 ? (
          <>
            <h2 className="rubric mb-3 text-sm">{t('library.startHere')}</h2>
            {list(starters)}
            <h2 className="rubric mt-8 mb-3 text-sm">{t('library.allTexts')}</h2>
            {list(rest, starters.length)}
          </>
        ) : (
          list(filtered)
        )}
      </section>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('library.filters')}
        actions={
          <Button block onClick={() => setFiltersOpen(false)}>
            {t('library.showResults', { count: filtered.length })}
          </Button>
        }
      >
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">{t('library.filterType')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('library.filterType')}>
              {TEXT_TYPES.map((type) => (
                <Chip key={type} pressed={filter.types.includes(type)} onClick={() => toggleType(type)}>
                  {t(`textTypesPlural.${type}`)}
                </Chip>
              ))}
            </div>
          </div>
          <Segmented<SourceFilter>
            label={t('library.filterSource')}
            value={filter.source}
            onChange={(source) => update({ source })}
            options={[
              { value: 'all', label: t('library.sourceAll') },
              { value: 'builtin', label: t('library.sourceBuiltin') },
              { value: 'user', label: t('library.sourceUser') },
            ]}
          />
          <Chip pressed={filter.showHidden} onClick={() => update({ showHidden: !filter.showHidden })}>
            <Icon name="eye-slash" size={16} />
            {t('library.showHidden')}
          </Chip>
        </div>
      </Dialog>
    </>
  )
}
