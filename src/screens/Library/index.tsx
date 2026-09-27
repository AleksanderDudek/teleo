import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { TextCard } from '@/components/TextCard'
import { ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconHalo } from '@/components/ui/IconHalo'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { Segmented } from '@/components/ui/Segmented'
import { ACHIEVEMENT_RULES, buildTextMetrics, nextTextMilestone } from '@/domain/gamification'
import { TEXT_TYPES, type Lang, type TextType } from '@/domain/types'
import { achievementName } from '@/i18n/dynamic'
import { useLibrary } from '@/hooks/useLibrary'
import { searchKey } from '@/lib/search'

type SourceFilter = 'all' | 'builtin' | 'user'

export default function Library() {
  const { t } = useTranslation()
  const entries = useLibrary()
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<ReadonlySet<TextType>>(new Set())
  const [langs, setLangs] = useState<ReadonlySet<Lang>>(new Set())
  const [source, setSource] = useState<SourceFilter>('all')
  const [showHidden, setShowHidden] = useState(false)

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = searchKey(query.trim())
    return entries.filter(({ text, preview }) => {
      if (!showHidden && text.archived) return false
      if (types.size && !types.has(text.type)) return false
      if (langs.size && !langs.has(text.lang)) return false
      if (source !== 'all' && text.source !== source) return false
      if (q && !searchKey(`${text.title} ${text.body} ${preview}`).includes(q)) return false
      return true
    })
  }, [entries, query, types, langs, source, showHidden])

  const toggle = <T,>(set: ReadonlySet<T>, value: T): ReadonlySet<T> => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  const hasAnyVisible = entries?.some((e) => !e.text.archived) ?? false

  /** "12 more to Centurion" once a text has been said at least once (spec §11/3). */
  const milestoneOf = ({ stats, segmentCount }: (typeof filtered)[number]) => {
    if (!stats?.repetitions) return undefined
    const next = nextTextMilestone(buildTextMetrics(stats, segmentCount), ACHIEVEMENT_RULES)
    return next ? t('library.milestone', { remaining: next.remaining, name: achievementName(t, next.rule.id) }) : undefined
  }

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
        <SearchField value={query} onChange={setQuery} label={t('common.search')} placeholder={t('library.searchPlaceholder')} />

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t('library.filterType')}>
          {TEXT_TYPES.map((type) => (
            <Chip key={type} pressed={types.has(type)} onClick={() => setTypes((s) => toggle(s, type))}>
              {t(`textTypesPlural.${type}`)}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 w-px shrink-0 bg-line" />
          {(['pl', 'en'] as const).map((lang) => (
            <Chip key={lang} pressed={langs.has(lang)} onClick={() => setLangs((s) => toggle(s, lang))}>
              {t(`langs.${lang}`)}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 w-px shrink-0 bg-line" />
          <Chip pressed={showHidden} onClick={() => setShowHidden((v) => !v)}>
            {t('library.showHidden')}
          </Chip>
        </div>

        <Segmented<SourceFilter>
          label={t('library.filterSource')}
          hideLabel
          value={source}
          onChange={setSource}
          options={[
            { value: 'all', label: t('library.sourceAll') },
            { value: 'builtin', label: t('library.sourceBuiltin') },
            { value: 'user', label: t('library.sourceUser') },
          ]}
        />
      </div>

      <section aria-live="polite" className="mt-6">
        {entries === undefined ? null : !hasAnyVisible && !showHidden && source !== 'builtin' ? (
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
          <p className="py-10 text-center text-ink-soft">{t('library.noResults')}</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((entry, index) => (
              <li key={entry.text.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
                <TextCard entry={entry} footnote={milestoneOf(entry)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
