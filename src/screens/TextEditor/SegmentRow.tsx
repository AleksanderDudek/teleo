import { Combine, Pencil, Scissors, TriangleAlert, Info } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { MAX_WORDS_PER_SEGMENT, type SegmentIssue } from '@/domain/segmenter'
import { cn } from '@/lib/cn'

interface SegmentRowProps {
  index: number
  content: string
  issues: SegmentIssue[]
  isLast: boolean
  onSplit: (wordIndex: number) => void
  onMergeNext: () => void
  onMergePrevious: () => void
  onReplace: (content: string) => void
}

export function SegmentRow({ index, content, issues, isLast, onSplit, onMergeNext, onMergePrevious, onReplace }: SegmentRowProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'view' | 'split' | 'edit'>('view')
  const [draft, setDraft] = useState(content)
  const words = content.split(/\s+/)
  const blocking = issues.some((i) => i.kind === 'tooLong')

  return (
    <li className={cn('card p-4', blocking && 'border-bad/50')}>
      <div className="flex items-start gap-3">
        <span className="tabular mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sunk text-xs font-bold text-ink-soft">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {mode === 'edit' ? (
            <div className="space-y-2">
              <label className="sr-only" htmlFor={`segment-${index}`}>
                {t('editor.segmentLabel', { n: index + 1 })}
              </label>
              <textarea
                id={`segment-${index}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 48)))}
                className="w-full rounded-xl border border-line-strong bg-paper p-3 font-serif text-lg focus:outline-2 focus:outline-gold"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    onReplace(draft)
                    setMode('view')
                  }}
                >
                  {t('common.save')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : mode === 'split' ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-gold-ink">{t('editor.chooseSplit')}</p>
              <p className="font-serif text-lg leading-9">
                {words.map((word, i) => (
                  <span key={`${i}-${word}`}>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onSplit(i)
                          setMode('view')
                        }}
                        aria-label={t('editor.splitBefore', { word })}
                        className="mx-0.5 inline-flex h-7 w-3 items-center justify-center rounded align-middle text-gold hover:bg-gold-soft focus-visible:bg-gold-soft"
                      >
                        <span aria-hidden className="h-5 w-px bg-current" />
                      </button>
                    )}
                    {word}
                  </span>
                ))}
              </p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setMode('view')}>
                {t('common.cancel')}
              </Button>
            </div>
          ) : (
            <p className="font-serif text-lg leading-snug text-ink">{content}</p>
          )}

          {mode === 'view' && issues.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {issues.map((issue) => (
                <li
                  key={issue.kind}
                  className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-sm', issue.kind === 'tooLong' ? 'text-bad' : 'text-near')}
                >
                  {issue.kind === 'tooLong' ? <TriangleAlert aria-hidden className="size-4" /> : <Info aria-hidden className="size-4" />}
                  <span>
                    {issue.kind === 'long' && t('editor.issueLong', { words: issue.words })}
                    {issue.kind === 'tooLong' && t('editor.issueTooLong', { words: issue.words, max: MAX_WORDS_PER_SEGMENT })}
                    {issue.kind === 'short' && t('editor.issueShort')}
                    {issue.kind === 'digits' && t('editor.issueDigits')}
                  </span>
                  {(issue.kind === 'long' || issue.kind === 'tooLong') && issue.suggestedSplitWord !== null && (
                    <button type="button" onClick={() => onSplit(issue.suggestedSplitWord!)} className="font-semibold underline underline-offset-4">
                      {t('editor.applySuggestion')}
                    </button>
                  )}
                  {issue.kind === 'short' && (
                    <button
                      type="button"
                      onClick={issue.mergeWith === 'previous' ? onMergePrevious : onMergeNext}
                      className="font-semibold underline underline-offset-4"
                    >
                      {issue.mergeWith === 'previous' ? t('editor.mergePrevious') : t('editor.mergeNext')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {mode === 'view' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" disabled={words.length < 2} onClick={() => setMode('split')} icon={<Scissors aria-hidden className="size-4" />}>
                {t('editor.splitHere')}
              </Button>
              <Button size="sm" variant="ghost" disabled={isLast} onClick={onMergeNext} icon={<Combine aria-hidden className="size-4" />}>
                {t('editor.mergeNext')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(content)
                  setMode('edit')
                }}
                icon={<Pencil aria-hidden className="size-4" />}
              >
                {t('editor.editSegment')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
