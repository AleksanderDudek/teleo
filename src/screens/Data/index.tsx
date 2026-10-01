import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StatTile } from '@/components/progress/StatTile'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { deviceSummary, readRestorePoint, requestPersistentStorage, storageStatus, switchToRestorePoint, wipeAllData, type StorageStatus } from '@/services/backup'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/stores/ui'
import { BackupCard } from './BackupCard'
import { formatBytes } from './format'
import { RestoreCard } from './RestoreCard'
import { restartApp } from './restart'
import { SummaryTable } from './SummaryTable'

function Section({ id, title, icon, children, framed }: { id: string; title: string; icon: Parameters<typeof Icon>[0]['name']; children: ReactNode; framed?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="mb-3 flex items-center gap-2 text-2xl font-semibold">
        <Icon name={icon} size={24} className="text-gold-ink" />
        {title}
      </h2>
      <Card className={cn('space-y-4', framed && 'card-framed')}>{children}</Card>
    </section>
  )
}

/** Whether the browser promised to keep the data, and how much room Teleo takes (spec §10, DECISIONS #115). */
function StorageLine() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<StorageStatus | null>(null)
  useEffect(() => {
    void storageStatus().then(setStatus)
  }, [])
  if (!status) return null
  const ask = async () => {
    const granted = await requestPersistentStorage()
    setStatus(await storageStatus())
    toast({ kind: granted ? 'success' : 'info', title: t(granted ? 'data.storageGranted' : 'data.storageRefused') })
  }
  return (
    <div className="space-y-2 border-t border-line pt-4 text-sm">
      <p className="flex gap-2">
        <Icon
          name={status.persisted ? 'shield-check' : 'warning'}
          size={18}
          tone="plain"
          className={cn('mt-0.5 shrink-0', status.persisted ? 'text-ok' : 'text-near')}
        />
        <span className="text-ink-soft">{t(status.persisted === undefined ? 'data.storageUnknown' : status.persisted ? 'data.storageOn' : 'data.storageOff')}</span>
      </p>
      {status.usage !== undefined && <p className="text-ink-faint">{t('data.storageUsage', { size: formatBytes(status.usage, i18n.language) })}</p>}
      {status.persisted === false && (
        <Button size="sm" variant="secondary" icon="shield-check" onClick={() => void ask()}>
          {t('data.storageAsk')}
        </Button>
      )}
    </div>
  )
}

/** Your data (owner request 2026-10-01): what is on this device, backups that leave it, restore, undo, delete. */
export default function Data() {
  const { t, i18n } = useTranslation()
  const meta = useSettingsStore((s) => s.meta)
  const device = useLiveQuery(deviceSummary)
  const restorePoint = useLiveQuery(readRestorePoint)
  const [undoing, setUndoing] = useState<'ask' | 'busy' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')
  // After switching back, the kept data is the restored backup (with what was done since): offered as "redo".
  const redo = restorePoint?.kind === 'beforeUndo'
  const number = new Intl.NumberFormat(i18n.language)
  const date = (ms: number) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)

  const undo = async () => {
    setUndoing('busy')
    const kind = restorePoint?.kind
    const result = await switchToRestorePoint()
    if (!result.ok) {
      setUndoing(null)
      return toast({ kind: 'error', title: t(`data.errors.${result.code}`) })
    }
    toast({ kind: 'success', title: t(kind === 'beforeUndo' ? 'data.redone' : 'data.undone') })
    restartApp()
  }

  return (
    <>
      <PageHeader backTo="/settings" rubric={t('data.rubric')} title={t('data.title')} subtitle={t('data.lead')} />
      <div className="space-y-10">
        <Section id="device" title={t('data.deviceTitle')} icon="hard-drives">
          {device && (
            <dl className="grid grid-cols-2 gap-3">
              <StatTile label={t('data.stats.sentences')} value={number.format(device.sentences)} />
              <StatTile label={t('data.stats.activeDays')} value={number.format(device.activeDays)} />
              <StatTile label={t('data.stats.xp')} value={number.format(device.xp)} />
              <StatTile label={t('data.stats.ownTexts')} value={number.format(device.ownTexts)} />
            </dl>
          )}
          <StorageLine />
        </Section>

        <Section id="backup" title={t('data.backupTitle')} icon="cloud-arrow-up" framed>
          <BackupCard lastBackupAt={meta.lastBackupAt} />
        </Section>

        <Section id="restore" title={t('data.restoreTitle')} icon="upload-simple">
          <RestoreCard device={device} />
        </Section>

        {restorePoint && (
          <Section id="undo" title={t(redo ? 'data.redoTitle' : 'data.undoTitle')} icon="clock-counter-clockwise">
            <p className="text-sm text-ink-soft">{t(redo ? 'data.redoBody' : 'data.undoBody', { date: date(restorePoint.createdAt) })}</p>
            <SummaryTable file={restorePoint.summary} device={device} fileLabel={t('data.kept')} />
            <Button variant="secondary" icon="arrow-counter-clockwise" onClick={() => setUndoing('ask')}>
              {t(redo ? 'data.redo' : 'data.undo')}
            </Button>
          </Section>
        )}

        <Section id="delete" title={t('data.deleteTitle')} icon="trash">
          <p className="text-sm text-ink-soft">{t('data.deleteHint')}</p>
          <Button variant="danger" onClick={() => setDeleting(true)} icon="trash">
            {t('data.deleteAll')}
          </Button>
        </Section>
      </div>

      <Dialog
        open={undoing !== null}
        onClose={() => setUndoing(null)}
        locked={undoing === 'busy'}
        title={t(redo ? 'data.redoConfirmTitle' : 'data.undoConfirmTitle')}
        description={t('data.undoConfirmBody')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setUndoing(null)} disabled={undoing === 'busy'}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void undo()} disabled={undoing === 'busy'}>
              {t(redo ? 'data.redo' : 'data.undo')}
            </Button>
          </>
        }
      />
      <Dialog
        open={deleting}
        onClose={() => {
          setDeleting(false)
          setDeleteWord('')
        }}
        title={t('data.deleteConfirmTitle')}
        description={t('data.deleteBody', { word: t('data.deleteWord') })}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={deleteWord.trim().toLocaleUpperCase(i18n.language) !== t('data.deleteWord')}
              onClick={async () => {
                await wipeAllData()
                restartApp(0)
              }}
            >
              {t('data.deleteConfirm')}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="sr-only">{t('data.deleteWord')}</span>
          <input
            value={deleteWord}
            onChange={(e) => setDeleteWord(e.target.value)}
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-line-strong bg-paper px-4 font-semibold tracking-widest uppercase focus:outline-2 focus:outline-gold"
          />
        </label>
      </Dialog>
    </>
  )
}
