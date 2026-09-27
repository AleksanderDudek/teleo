import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { MemoryStartDialog } from '@/components/MemoryStartDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/Progress'
import type { SessionTemplate } from '@/db/types'
import type { MemoryLevel } from '@/domain/memory/mask'
import { useResumableRun, useTemplates, type TemplateEntry } from '@/hooks/useSessions'
import { cn } from '@/lib/cn'
import {
  deleteTemplate,
  duplicateTemplate,
  resumeRun,
  SessionError,
  setTemplateArchived,
  setTemplatePinned,
  startRun,
} from '@/services/sessions'
import { toast } from '@/stores/ui'

function itemsSummary(entry: TemplateEntry, t: TFunction): string {
  return entry.template.items
    .map((item) => `${entry.texts.get(item.textId)?.title ?? t('sessions.missingText')} ×${item.repeat}`)
    .join(' · ')
}

function TemplateCard({ entry, onDelete }: { entry: TemplateEntry; onDelete: (template: SessionTemplate) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { template } = entry
  const [busy, setBusy] = useState(false)
  const [choosingMemory, setChoosingMemory] = useState(false)

  const start = async (memoryLevel?: MemoryLevel) => {
    setBusy(true)
    try {
      const run = await startRun({ kind: 'template', templateId: template.id, memoryLevel })
      navigate(`/play/${run.id}`)
    } catch (error) {
      if (error instanceof SessionError) toast({ kind: 'error', title: t('sessions.cantStart') })
      else throw error
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cn('p-0', template.archived && 'opacity-60')}>
      <div className="flex items-start gap-4 p-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="font-serif text-xl font-semibold text-ink">{template.name}</h2>
            {template.pinned && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-ink">
                <Icon name="push-pin" size={12} /> {t('sessions.pinned')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-ink-soft">
            {t('counts.segments', { count: entry.segmentCount })} · {template.source === 'builtin' ? t('sessions.builtin') : t('sessions.own')}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{itemsSummary(entry, t)}</p>
        </div>
        <Button onClick={() => void start()} disabled={busy || entry.segmentCount === 0} icon="play">
          {t('sessions.start')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 border-t border-line px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void setTemplatePinned(template.id, !template.pinned)}
          icon={template.pinned ? 'push-pin-slash' : 'push-pin'}
        >
          {template.pinned ? t('sessions.unpin') : t('sessions.pin')}
        </Button>
        {template.source === 'user' && (
          <ButtonLink size="sm" variant="ghost" to={`/sessions/${encodeURIComponent(template.id)}/edit`} icon="pencil-simple">
            {t('sessions.edit')}
          </ButtonLink>
        )}
        <Button size="sm" variant="ghost" disabled={entry.segmentCount === 0} onClick={() => setChoosingMemory(true)} icon="brain">
          {t('memory.button')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="copy"
          onClick={async () => {
            const copy = await duplicateTemplate(template.id, t('sessions.duplicateName', { name: template.name }))
            navigate(`/sessions/${encodeURIComponent(copy.id)}/edit`)
          }}
        >
          {t('sessions.duplicate')}
        </Button>
        {template.source === 'builtin' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void setTemplateArchived(template.id, !template.archived)}
            icon={template.archived ? 'eye' : 'eye-slash'}
          >
            {template.archived ? t('sessions.unhide') : t('sessions.hide')}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onDelete(template)} icon="trash">
            {t('sessions.delete')}
          </Button>
        )}
      </div>
      <MemoryStartDialog
        open={choosingMemory}
        onClose={() => setChoosingMemory(false)}
        onStart={(level) => {
          setChoosingMemory(false)
          void start(level)
        }}
      />
    </Card>
  )
}

export default function Sessions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const entries = useTemplates()
  const resumable = useResumableRun()
  const [showHidden, setShowHidden] = useState(false)
  const [toDelete, setToDelete] = useState<SessionTemplate | null>(null)
  const visible = entries?.filter((e) => showHidden || !e.template.archived) ?? []
  const done = resumable ? resumable.entries.filter((e) => e.status !== 'pending').length : 0

  return (
    <>
      <PageHeader
        rubric={t('sessions.rubric')}
        title={t('sessions.title')}
        actions={
          <ButtonLink to="/sessions/new" size="sm" icon="plus">
            {t('sessions.add')}
          </ButtonLink>
        }
      />

      {resumable && (
        <Card className="mb-6 border-gold/50 bg-gold-soft/40">
          <p className="rubric">{t('sessions.resumeTitle')}</p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-serif text-xl font-semibold">{resumable.title}</p>
              <p className="text-sm text-ink-soft">{t('sessions.progressOf', { done, total: resumable.plan.length })}</p>
            </div>
            <Button
              icon="arrow-counter-clockwise"
              onClick={async () => {
                await resumeRun(resumable.id)
                navigate(`/play/${resumable.id}`)
              }}
            >
              {t('sessions.resume')}
            </Button>
          </div>
          <ProgressBar className="mt-3" value={done} max={resumable.plan.length} label={t('sessions.progressOf', { done, total: resumable.plan.length })} />
        </Card>
      )}

      <div className="mb-4 flex justify-end">
        <Chip pressed={showHidden} onClick={() => setShowHidden((v) => !v)}>
          {t('sessions.showHidden')}
        </Chip>
      </div>

      {entries === undefined ? null : visible.length === 0 ? (
        <EmptyState
          title={t('sessions.emptyTitle')}
          body={t('sessions.emptyBody')}
          action={
            <ButtonLink to="/sessions/new" icon="plus">
              {t('sessions.add')}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="space-y-4">
          {visible.map((entry, index) => (
            <li key={entry.template.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}>
              <TemplateCard entry={entry} onDelete={setToDelete} />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t('sessions.deleteTitle', { name: toDelete?.name ?? '' })}
        description={t('sessions.deleteBody')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (toDelete) await deleteTemplate(toDelete.id)
                setToDelete(null)
                toast({ kind: 'success', title: t('sessions.deleted') })
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
