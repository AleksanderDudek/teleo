import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { useTaskViews } from '@/hooks/useTasks'
import { deleteTask, setTaskArchived, type TaskView } from '@/services/tasks'
import { toast } from '@/stores/ui'
import { TaskCard } from './TaskCard'

/** Daily tasks: the ones running now, then the finished and stopped ones. */
export default function Tasks() {
  const { t } = useTranslation()
  const views = useTaskViews()
  const [toDelete, setToDelete] = useState<TaskView | null>(null)
  if (!views) return null
  const current = views.filter((v) => !v.task.archived && !v.progress.over)
  const past = views.filter((v) => v.task.archived || v.progress.over)

  const actions = (view: TaskView) => (
    <>
      <ButtonLink size="sm" variant="ghost" to={`/tasks/${encodeURIComponent(view.task.id)}/edit`} icon="pencil-simple">
        {t('tasks.edit')}
      </ButtonLink>
      {!view.progress.over && (
        <Button size="sm" variant="ghost" icon={view.task.archived ? 'play' : 'pause'} onClick={() => void setTaskArchived(view.task.id, !view.task.archived)}>
          {view.task.archived ? t('tasks.resume') : t('tasks.stop')}
        </Button>
      )}
      <Button size="sm" variant="ghost" icon="trash" onClick={() => setToDelete(view)}>
        {t('tasks.delete')}
      </Button>
    </>
  )

  return (
    <>
      <PageHeader
        backTo="/sessions"
        rubric={t('tasks.rubric')}
        title={t('tasks.title')}
        subtitle={t('tasks.lead')}
        actions={
          <ButtonLink to="/tasks/new" size="sm" icon="plus">
            {t('tasks.add')}
          </ButtonLink>
        }
      />

      {views.length === 0 ? (
        <EmptyState
          mood="point"
          title={t('tasks.emptyTitle')}
          body={t('tasks.emptyBody')}
          action={
            <ButtonLink to="/tasks/new" icon="plus">
              {t('tasks.add')}
            </ButtonLink>
          }
        />
      ) : (
        <>
          {current.length > 0 && (
            <ul className="space-y-4">
              {current.map((view, index) => (
                <li key={view.task.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}>
                  <TaskCard view={view} actions={actions(view)} />
                </li>
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <section className="mt-8" aria-labelledby="past-tasks">
              <h2 id="past-tasks" className="mb-3 text-2xl font-semibold">
                {t('tasks.pastHeading')}
              </h2>
              <ul className="space-y-4">
                {past.map((view) => (
                  <li key={view.task.id}>
                    <TaskCard view={view} actions={actions(view)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t('tasks.deleteTitle')}
        description={t('tasks.deleteBody')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (toDelete) await deleteTask(toDelete.task.id)
                setToDelete(null)
                toast({ kind: 'success', title: t('tasks.deleted') })
              }}
            >
              {t('tasks.delete')}
            </Button>
          </>
        }
      />
    </>
  )
}
