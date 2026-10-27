import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { db } from '@/db/schema'
import type { TextItem } from '@/db/types'
import { mainNeed, relatedTexts } from '@/domain/text/needs'
import { isListedText } from '@/domain/text/visibility'

/**
 * "More for this need" (DECISIONS #130): a few listed texts for the same need, so one prayer found leads to the next.
 * Each link keeps the way back to the library list the first text was opened from.
 */
export function RelatedTexts({ text, backTo }: { text: TextItem; backTo: string }) {
  const { t } = useTranslation()
  const related = useLiveQuery(async () => {
    const listed = (await db.texts.toArray()).filter((other) => !other.archived && isListedText(other, text.lang))
    return relatedTexts(text, listed)
  }, [text])
  if (!related?.length) return null

  return (
    <section aria-labelledby="related-heading" className="mt-8">
      <h2 id="related-heading" className="mb-3 text-2xl font-semibold">
        {t('textDetail.relatedHeading')}
      </h2>
      <ul className="space-y-2">
        {related.map((other) => {
          const need = mainNeed(other)
          return (
            <li key={other.id}>
              <Link
                to={`/library/${encodeURIComponent(other.id)}`}
                state={{ backTo }}
                className="card card-lift flex min-h-14 items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg leading-snug font-semibold">{other.title}</span>
                  {need && <span className="block text-xs text-ink-soft">{t(`needs.items.${need}`)}</span>}
                </span>
                <Icon name="caret-right" size={16} className="shrink-0 text-ink-faint" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
