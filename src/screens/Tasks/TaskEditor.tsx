import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { TextTypeIcon } from '@/components/TextTypeIcon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stepper } from '@/components/ui/Stepper'
import { db } from '@/db/schema'
import type { TaskRow, TextItem } from '@/db/types'
import { endDayFor, TASK_LIMITS, taskDays } from '@/domain/tasks'
import { isListedText } from '@/domain/text/visibility'
import { dayKeyFor, dayKeyToLocalDate } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'
import { TextPicker } from '@/screens/SessionBuilder/TextPicker'
import { createTask, TaskError, updateTask } from '@/services/tasks'
import { useAppSettings } from '@/stores/settings'
import { toast } from '@/stores/ui'

const DAY_PRESETS = [7, 14, 21, 30] as const
/** A browser date input can hold a five-digit year, which no day key accepts. */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

interface Draft {
  textId: string | null
  timesPerDay: number
  startDay: DayKey
  days: number
}

/** New task (`/tasks/new?text=<id>`) or edit (`/tasks/:taskId/edit`): the text, times a day, first day and length. */
export default function TaskEditor() {
  const { taskId } = useParams()
  const [params] = useSearchParams()
  const { uiLang, dayStartHour } = useAppSettings()
  const [today] = useState(() => dayKeyFor(Date.now(), dayStartHour))

  const data = useLiveQuery(async () => {
    const [texts, segments, task] = await Promise.all([db.texts.toArray(), db.segments.toArray(), taskId ? db.tasks.get(taskId) : undefined])
    const segmentCounts = new Map<string, number>()
    for (const segment of segments) if (!segment.archived) segmentCounts.set(segment.textId, (segmentCounts.get(segment.textId) ?? 0) + 1)
    // The task's own text stays available even when the interface language no longer lists it.
    return { texts: texts.filter((text) => isListedText(text, uiLang) || text.id === task?.textId), segmentCounts, task: task ?? null }
  }, [taskId, uiLang])

  if (data === undefined) return null
  const initial: Draft = data.task
    ? { textId: data.task.textId, timesPerDay: data.task.timesPerDay, startDay: data.task.startDay, days: taskDays(data.task) }
    : { textId: params.get('text'), timesPerDay: 3, startDay: today, days: 14 }
  // The form owns its draft from the first render of a given task; a reload of the live query must not reset it.
  return <TaskForm key={data.task?.id ?? 'new'} task={data.task} initial={initial} texts={data.texts} segmentCounts={data.segmentCounts} />
}

function TaskForm({ task, initial, texts, segmentCounts }: { task: TaskRow | null; initial: Draft; texts: TextItem[]; segmentCounts: Map<string, number> }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(initial)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }))

  const text = draft.textId ? texts.find((x) => x.id === draft.textId) : undefined
  const endDay = endDayFor(draft.startDay, draft.days)
  const date = (day: string) => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(day))

  const save = async () => {
    if (!draft.textId) return
    setSaving(true)
    setError(null)
    try {
      const input = { textId: draft.textId, timesPerDay: draft.timesPerDay, startDay: draft.startDay, days: draft.days }
      if (task) await updateTask(task.id, input)
      else await createTask(input)
      toast({ kind: 'success', title: t('tasks.saved') })
      navigate(task ? '/tasks' : '/', { replace: true })
    } catch (e) {
      if (e instanceof TaskError) setError(t(`tasks.errors.${e.code}`))
      else throw e
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader backTo="/tasks" rubric={task ? t('tasks.titleEdit') : t('tasks.titleNew')} title={text?.title ?? t('tasks.titleNew')} />
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Card>
          <p className="mb-2 font-medium">{t('tasks.fieldText')}</p>
          {text ? (
            <div className="flex items-center gap-3">
              <TextTypeIcon type={text.type} size={22} className="text-gold-ink" />
              <span className="min-w-0 flex-1 truncate font-serif text-lg font-semibold">{text.title}</span>
              <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
                {t('tasks.changeText')}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setPicking(true)} icon="plus">
              {t('tasks.pickText')}
            </Button>
          )}
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium">{t('tasks.fieldTimes')}</span>
            <Stepper
              label={t('tasks.fieldTimes')}
              value={draft.timesPerDay}
              min={TASK_LIMITS.timesPerDay.min}
              max={TASK_LIMITS.timesPerDay.max}
              onChange={(timesPerDay) => patch({ timesPerDay })}
              format={(v) => t('tasks.timesValue', { count: v })}
            />
          </div>
          <label className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium">{t('tasks.fieldStart')}</span>
            <input
              type="date"
              value={draft.startDay}
              onChange={(e) => DAY_KEY.test(e.target.value) && patch({ startDay: e.target.value })}
              className="h-10 rounded-full border border-line-strong bg-surface px-4 font-semibold"
            />
          </label>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">{t('tasks.fieldDays')}</span>
              <Stepper label={t('tasks.fieldDays')} value={draft.days} min={TASK_LIMITS.days.min} max={TASK_LIMITS.days.max} onChange={(days) => patch({ days })} format={(v) => t('counts.days', { count: v })} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAY_PRESETS.map((preset) => (
                <Chip key={preset} pressed={draft.days === preset} onClick={() => patch({ days: preset })}>
                  {t('counts.days', { count: preset })}
                </Chip>
              ))}
            </div>
          </div>
          <p className="text-sm text-ink-soft">{t('tasks.summaryLine', { times: draft.timesPerDay, from: date(draft.startDay), to: date(endDay), total: draft.timesPerDay * draft.days })}</p>
        </Card>

        {error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 font-medium text-bad">
            {error}
          </p>
        )}
        <div className="sticky bottom-[max(env(safe-area-inset-bottom),1rem)] z-10 flex justify-end lg:bottom-6">
          <Button type="submit" size="lg" disabled={!draft.textId || saving} className="shadow-xl">
            {t('tasks.save')}
          </Button>
        </div>
      </form>

      <TextPicker
        open={picking}
        texts={texts}
        segmentCounts={segmentCounts}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          patch({ textId: id })
          setPicking(false)
        }}
      />
    </>
  )
}
