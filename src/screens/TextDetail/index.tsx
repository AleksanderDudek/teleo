import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { MemoryStartDialog } from '@/components/MemoryStartDialog'
import { TextTypeIcon } from '@/components/TextTypeIcon'
import type { MemoryLevel } from '@/domain/memory/mask'
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
  const { textId } = useParams()
  const view = useText(textId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [starting, setStarting] = useState(false)
  const [choosingMemory, setChoosingMemory] = useState(false)

  if (view === undefined) return null
  if (view === null) {
    return (
      <>
        <PageHeader backTo="/library" title={t('textDetail.notFound')} />
        <ButtonLink to="/library" variant="secondary">
          {t('common.back')}
        </ButtonLink>
      </>
    )
  }

  const { text, segments, stats } = view
  const encodedId = encodeURIComponent(text.id)
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
        backTo="/library"
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
        <Button size="lg" onClick={() => void sayNow()} disabled={starting || segments.length === 0} icon="mic-halo">
          {t('textDetail.sayNow')}
        </Button>
        <Button variant="secondary" onClick={() => setChoosingMemory(true)} disabled={starting || segments.length === 0} icon="brain">
          {t('memory.button')}
        </Button>
        {text.source === 'user' ? (
          <ButtonLink to={`/library/${encodedId}/edit`} variant="secondary" icon="pencil-simple">
            {t('common.edit')}
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            icon="copy"
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
          variant="ghost"
          icon={text.archived ? 'eye' : 'eye-slash'}
          onClick={() => void setTextArchived(text.id, !text.archived)}
        >
          {text.archived ? t('textDetail.unhide') : t('textDetail.hide')}
        </Button>
        {text.source === 'user' && (
          <Button variant="ghost" icon="trash" onClick={() => setConfirmDelete(true)}>
            {t('textDetail.delete')}
          </Button>
        )}
      </div>

      {text.archived && <p className="mt-4 rounded-xl bg-sunk px-4 py-3 text-sm text-ink-soft">{t('textDetail.hiddenNote')}</p>}
      {text.source === 'builtin' && <p className="mt-4 text-sm text-ink-soft">{t('textDetail.builtinNote')}</p>}

      <section aria-labelledby="stats-heading" className="mt-8">
        <h2 id="stats-heading" className="mb-3 text-2xl font-semibold">
          {t('textDetail.statsHeading')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t('textDetail.statRepetitions')} value={stats?.repetitions ?? 0} />
          <Stat label={t('textDetail.statSegments')} value={stats?.segmentsAccepted ?? 0} />
          <Stat label={t('textDetail.statStreak')} value={stats?.currentDayStreak ?? 0} />
          <Stat label={t('textDetail.statBestStreak')} value={stats?.bestDayStreak ?? 0} />
          <Stat label={t('textDetail.statPerfect')} value={stats?.perfectRuns ?? 0} />
          <Stat label={t('textDetail.statLast')} value={lastPracticed} />
        </dl>
      </section>

      <TextAchievements text={text} stats={stats} segmentCount={segments.length} />

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
                navigate('/library', { replace: true })
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
