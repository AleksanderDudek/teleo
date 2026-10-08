import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { chipClass } from '@/components/ui/chipClasses'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { MemoryStartDialog } from '@/components/MemoryStartDialog'
import { Icon } from '@/components/icons/Icon'
import { TextTypeIcon } from '@/components/TextTypeIcon'
import type { MemoryLevel } from '@/domain/memory/mask'
import { libraryBackTo } from '@/domain/text/libraryFilter'
import { needsOf } from '@/domain/text/needs'
import { useText } from '@/hooks/useText'
import { startRun } from '@/services/sessions'
import { copyTextAsOwn, deleteUserText, setTextArchived } from '@/services/texts'
import { toast } from '@/stores/ui'
import { TextAchievements } from './TextAchievements'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-sunk px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-ink">{value}</dd>
    </div>
  )
}

export default function TextDetail() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = libraryBackTo(location.state)
  const { textId } = useParams()
  const view = useText(textId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [starting, setStarting] = useState(false)
  const [choosingMemory, setChoosingMemory] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  if (view === undefined) return null
  if (view === null) {
    return (
      <>
        <PageHeader backTo={backTo} title={t('textDetail.notFound')} />
        <ButtonLink to={backTo} variant="secondary">
          {t('common.back')}
        </ButtonLink>
      </>
    )
  }

  const { text, segments, stats } = view
  const encodedId = encodeURIComponent(text.id)
  const needs = needsOf(text)
  const lastPracticed = stats?.lastPracticedAt
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(stats.lastPracticedAt)
    : t('textDetail.never')

  const sayNow = async (memoryLevel?: MemoryLevel) => {
    setStarting(true)
    try {
      const run = await startRun({ kind: 'text', textId: text.id, memoryLevel })
      navigate(`/play/${run.id}`)
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <PageHeader
        backTo={backTo}
        rubric={t(`textTypes.${text.type}`)}
        title={text.title}
        subtitle={
          <span className="inline-flex items-center gap-2 text-sm">
            <TextTypeIcon type={text.type} size={16} className="text-gold-ink" />
            {t('counts.segments', { count: segments.length })} · {text.source === 'builtin' ? t('library.builtin') : t('library.own')}
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button data-tour="say" size="lg" onClick={() => void sayNow()} disabled={starting || segments.length === 0} icon="mic-halo">
          {t('textDetail.sayNow')}
        </Button>
        <Button
          data-tour="memory"
          variant="secondary"
          onClick={() => setChoosingMemory(true)}
          disabled={starting || segments.length === 0}
          icon="brain"
        >
          {t('memory.button')}
        </Button>
        <ButtonLink data-tour="task" to={`/tasks/new?text=${encodedId}`} variant="secondary" icon="list-checks">
          {t('textDetail.setTask')}
        </ButtonLink>
        {/* Copy/edit, hide and delete are kept apart from the practice buttons (DECISIONS #128). */}
        <Button variant="ghost" icon="dots-three" onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          {t('common.more')}
        </Button>
      </div>

      {text.archived && <p className="mt-4 rounded-xl bg-sunk px-4 py-3 text-sm text-ink-soft">{t('textDetail.hiddenNote')}</p>}

      {/* The text itself first; statistics and achievements below, folded (DECISIONS #128). */}
      <section aria-labelledby="segments-heading" className="mt-8">
        <h2 id="segments-heading" className="mb-3 text-2xl font-semibold">
          {t('textDetail.segmentsHeading')}
        </h2>
        <Card className="p-0">
          <ol className="divide-y divide-line">
            {segments.map((segment, index) => (
              <li key={segment.id} className="flex gap-4 px-5 py-4">
                <span className="tabular mt-1 w-5 shrink-0 text-right text-sm font-bold text-gold-ink">{index + 1}</span>
                <p className="font-serif text-lg leading-snug text-ink">{segment.content}</p>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {needs.length > 0 && (
        <section aria-labelledby="needs-heading" className="mt-6">
          <h2 id="needs-heading" className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
            {t('textDetail.needsHeading')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {needs.map((need) => (
              <li key={need}>
                <Link to={`/library?need=${need}`} className={chipClass(false)}>
                  {t(`needs.items.${need}`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {text.tags.length > 0 && <p className="mt-3 text-sm text-ink-soft">{t('textDetail.tags', { tags: text.tags.join(' · ') })}</p>}
      {text.source === 'builtin' && <p className="mt-3 text-sm text-ink-soft">{t('textDetail.builtinNote')}</p>}

      <details className="group mt-8 rounded-3xl border border-line bg-surface">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-xl font-semibold">{t('textDetail.progressHeading')}</span>
            <span className="block text-sm text-ink-soft">
              {t('textDetail.progressSummary', { count: stats?.repetitions ?? 0, last: lastPracticed })}
            </span>
          </span>
          <Icon name="caret-down" size={20} className="text-ink-soft transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-5 pb-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t('textDetail.statRepetitions')} value={stats?.repetitions ?? 0} />
            <Stat label={t('textDetail.statSegments')} value={stats?.segmentsAccepted ?? 0} />
            <Stat label={t('textDetail.statStreak')} value={stats?.currentDayStreak ?? 0} />
            <Stat label={t('textDetail.statBestStreak')} value={stats?.bestDayStreak ?? 0} />
            <Stat label={t('textDetail.statPerfect')} value={stats?.perfectRuns ?? 0} />
            <Stat label={t('textDetail.statLast')} value={lastPracticed} />
          </dl>
          <TextAchievements text={text} stats={stats} segmentCount={segments.length} />
        </div>
      </details>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title={text.title}>
        <div className="mt-4 flex flex-col gap-2">
          {text.source === 'user' ? (
            <ButtonLink to={`/library/${encodedId}/edit`} variant="secondary" icon="pencil-simple" block>
              {t('common.edit')}
            </ButtonLink>
          ) : (
            <Button
              variant="secondary"
              icon="copy"
              block
              onClick={async () => {
                const copy = await copyTextAsOwn(text.id, t('textDetail.copyTitle', { title: text.title }))
                toast({ kind: 'success', title: t('textDetail.copied') })
                navigate(`/library/${encodeURIComponent(copy.id)}/edit`)
              }}
            >
              {t('textDetail.copy')}
            </Button>
          )}
          <Button
            variant="secondary"
            block
            icon={text.archived ? 'eye' : 'eye-slash'}
            onClick={() => {
              const hide = !text.archived
              setMoreOpen(false)
              void setTextArchived(text.id, hide).then(() =>
                toast({
                  kind: 'success',
                  title: hide ? t('textDetail.hiddenToast') : t('textDetail.shownToast'),
                  action: { label: t('textDetail.undo'), run: () => void setTextArchived(text.id, !hide) },
                }),
              )
            }}
          >
            {text.archived ? t('textDetail.unhide') : t('textDetail.hide')}
          </Button>
          {text.source === 'user' && (
            <Button
              variant="ghost"
              block
              icon="trash"
              onClick={() => {
                setMoreOpen(false)
                setConfirmDelete(true)
              }}
            >
              {t('textDetail.delete')}
            </Button>
          )}
        </div>
      </Dialog>

      <MemoryStartDialog
        open={choosingMemory}
        onClose={() => setChoosingMemory(false)}
        onStart={(level) => {
          setChoosingMemory(false)
          void sayNow(level)
        }}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('textDetail.deleteTitle', { title: text.title })}
        description={t('textDetail.deleteBody')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteUserText(text.id)
                setConfirmDelete(false)
                toast({ kind: 'success', title: t('textDetail.deleted') })
                navigate(backTo, { replace: true })
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      />
    </>
  )
}
