import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { db } from '@/db/schema'
import {
  analyzeSegments,
  isBlocking,
  MAX_SEGMENTS_PER_TEXT,
  mergeWithNext,
  replaceSegment,
  splitIntoSegments,
  splitSegmentAt,
  type SegmentIssue,
} from '@/domain/segmenter'
import { NEED_AREAS, NEEDS_BY_AREA, needsOf, type NeedId } from '@/domain/text/needs'
import type { Lang, SplitMode, TextType } from '@/domain/types'
import { TEXT_TYPES } from '@/domain/types'
import { createText, getActiveSegments, TextValidationError, updateText } from '@/services/texts'
import { useAppSettings } from '@/stores/settings'
import { toast } from '@/stores/ui'
import { SegmentRow } from './SegmentRow'

const joinBody = (segments: readonly string[], mode: SplitMode) => segments.join(mode === 'line' ? '\n' : ' ')

export default function TextEditor() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { textId } = useParams()
  const app = useAppSettings()
  const existing = useLiveQuery(() => (textId ? db.texts.get(textId) : undefined), [textId])

  const [title, setTitle] = useState('')
  // A new text is what the person came to practise (a prayer for a prayers focus).
  const [type, setType] = useState<TextType>(app.contentFocus === 'prayers' ? 'prayer' : 'affirmation')
  // A text speaks the interface language (one language at a time); an existing text keeps its own.
  const [lang, setLang] = useState<Lang>(app.uiLang)
  const [splitMode, setSplitMode] = useState<SplitMode>('sentence')
  const [body, setBody] = useState('')
  /** In the order chosen: the first is the main need, shown on the card. */
  const [needs, setNeeds] = useState<NeedId[]>([])
  const [needsOpen, setNeedsOpen] = useState(false)
  const [segments, setSegments] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const loadedFor = useRef<string | null>(null)
  /** True after split/merge/edit: the list, not the textarea, holds the user's intent. */
  const manual = useRef(false)

  // Load an existing text once (keeps its current segmentation, which may be hand-made).
  useEffect(() => {
    if (!textId || !existing || loadedFor.current === textId) return
    loadedFor.current = textId
    void getActiveSegments(textId).then((rows) => {
      setTitle(existing.title)
      setType(existing.type)
      setLang(existing.lang)
      setSplitMode(existing.splitMode)
      setBody(existing.body)
      setNeeds(needsOf(existing))
      setNeedsOpen(needsOf(existing).length > 0)
      setSegments(rows.map((r) => r.content))
      manual.current = true
    })
  }, [textId, existing])

  const resplit = (nextBody: string, nextLang: Lang, nextMode: SplitMode) => {
    if (manual.current && segments.length > 0) toast({ kind: 'info', title: t('editor.resplitNotice'), timeoutMs: 3000 })
    manual.current = false
    setSegments(splitIntoSegments(nextBody, nextLang, nextMode))
  }

  const editSegments = (next: string[]) => {
    manual.current = true
    setSegments(next)
    setBody(joinBody(next, splitMode))
  }

  const issues = useMemo(() => analyzeSegments(segments), [segments])
  const issuesByIndex = useMemo(() => {
    const map = new Map<number, SegmentIssue[]>()
    for (const issue of issues) {
      if (issue.kind === 'tooMany') continue
      map.set(issue.index, [...(map.get(issue.index) ?? []), issue])
    }
    return map
  }, [issues])
  const tooMany = issues.find((i) => i.kind === 'tooMany')
  const blocked = issues.some(isBlocking)

  if (textId && existing === undefined) return null
  if (textId && existing === null) return <PageHeader backTo="/library" title={t('textDetail.notFound')} />
  if (existing && existing.source === 'builtin') {
    return (
      <>
        <PageHeader backTo={`/library/${encodeURIComponent(existing.id)}`} rubric={t('editor.titleEdit')} title={existing.title} />
        <Card>
          <p className="text-ink-soft">{t('textDetail.builtinNote')}</p>
          <ButtonLink to={`/library/${encodeURIComponent(existing.id)}`} className="mt-4" variant="secondary">
            {t('common.back')}
          </ButtonLink>
        </Card>
      </>
    )
  }

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      const input = { title, type, lang, splitMode, segments, needs }
      const saved = textId ? await updateText(textId, input) : await createText(input)
      toast({ kind: 'success', title: t('editor.saved') })
      navigate(`/library/${encodeURIComponent(saved.id)}`, { replace: true })
    } catch (e) {
      if (e instanceof TextValidationError) setError(t(`editor.errors.${e.code}`))
      else throw e
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        backTo={textId ? `/library/${encodeURIComponent(textId)}` : '/library'}
        rubric={textId ? t('editor.titleEdit') : t('editor.titleNew')}
        title={title.trim() || (textId ? t('editor.titleEdit') : t('editor.titleNew'))}
      />

      <form
        // Room under the last field for the sticky Save button.
        className="space-y-6 pb-20"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Card className="space-y-6">
          <label className="block">
            <span className="mb-2 block font-medium text-ink">{t('editor.fieldTitle')}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={t('editor.titlePlaceholder')}
              className="h-12 w-full rounded-xl border border-line-strong bg-paper px-4 text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-gold"
            />
          </label>
          <Segmented<TextType>
            label={t('editor.fieldType')}
            value={type}
            onChange={setType}
            options={TEXT_TYPES.map((value) => ({ value, label: t(`textTypes.${value}`) }))}
          />
          <div>
            <Segmented<SplitMode>
              label={t('editor.fieldSplit')}
              value={splitMode}
              onChange={(next) => {
                setSplitMode(next)
                resplit(body, lang, next)
              }}
              options={[
                { value: 'sentence', label: t('editor.splitSentence') },
                { value: 'line', label: t('editor.splitLine') },
              ]}
            />
            {splitMode === 'line' && <p className="mt-1.5 text-sm text-ink-soft">{t('editor.splitLineHint')}</p>}
          </div>
          <details open={needsOpen} onToggle={(e) => setNeedsOpen(e.currentTarget.open)}>
            <summary className="cursor-pointer font-medium text-ink marker:text-ink-faint">
              {t('editor.fieldNeeds')}
              {needs.length > 0 && (
                <span className="ml-2 text-sm font-normal text-ink-soft">
                  {needs.map((need) => t(`needs.items.${need}`)).join(' · ')}
                </span>
              )}
            </summary>
            <p className="mt-1.5 mb-3 text-sm text-ink-soft">{t('editor.needsHint')}</p>
            <div className="space-y-3">
              {NEED_AREAS.map((area) => (
                <div key={area} role="group" aria-label={t(`needs.areas.${area}`)}>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">{t(`needs.areas.${area}`)}</p>
                  <div className="flex flex-wrap gap-2">
                    {NEEDS_BY_AREA[area].map((need) => (
                      <Chip
                        key={need}
                        pressed={needs.includes(need)}
                        onClick={() => setNeeds((list) => (list.includes(need) ? list.filter((n) => n !== need) : [...list, need]))}
                      >
                        {t(`needs.items.${need}`)}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
          <label className="block">
            <span className="mb-2 block font-medium text-ink">{t('editor.fieldBody')}</span>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                resplit(e.target.value, lang, splitMode)
              }}
              rows={8}
              placeholder={t('editor.bodyPlaceholder')}
              className="w-full rounded-xl border border-line-strong bg-paper p-4 font-serif text-lg leading-relaxed text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-gold"
            />
          </label>
        </Card>

        <section aria-labelledby="segments-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="segments-heading" className="text-2xl font-semibold">
              {t('editor.preview')}
            </h2>
            <span className={`tabular text-sm font-semibold ${tooMany ? 'text-bad' : 'text-ink-soft'}`}>
              {t('editor.segmentCount', { count: segments.length, max: MAX_SEGMENTS_PER_TEXT })}
            </span>
          </div>
          <p className="mb-4 text-sm text-ink-soft">{t('editor.previewHint')}</p>
          {tooMany && (
            <p role="alert" className="mb-3 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
              {t('editor.issueTooMany', { count: tooMany.count, max: MAX_SEGMENTS_PER_TEXT })}
            </p>
          )}
          {segments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-ink-soft">{t('editor.previewEmpty')}</p>
          ) : (
            <ol className="space-y-3">
              {segments.map((content, index) => (
                <SegmentRow
                  // Content in the key resets per-row UI state after structural edits.
                  key={`${index}:${content}`}
                  index={index}
                  content={content}
                  issues={issuesByIndex.get(index) ?? []}
                  isLast={index === segments.length - 1}
                  onSplit={(wordIndex) => editSegments(splitSegmentAt(segments, index, wordIndex))}
                  onMergeNext={() => editSegments(mergeWithNext(segments, index))}
                  onMergePrevious={() => editSegments(mergeWithNext(segments, index - 1))}
                  onReplace={(next) => editSegments(replaceSegment(segments, index, next))}
                />
              ))}
            </ol>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 font-medium text-bad">
            {error}
          </p>
        )}

        <div className="sticky bottom-[max(env(safe-area-inset-bottom),1rem)] z-10 flex justify-end lg:bottom-6">
          <Button type="submit" size="lg" disabled={saving || blocked || segments.length === 0} className="shadow-xl">
            {t('editor.save')}
          </Button>
        </div>
      </form>
    </>
  )
}
