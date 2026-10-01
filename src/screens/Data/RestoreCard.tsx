import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import {
  BackupCryptoError,
  compareSummaries,
  decryptBackup,
  hasProgress,
  parseBackup,
  readBackupText,
  summarizeBackup,
  type BackupErrorCode,
  type BackupFile,
  type BackupSummary,
  type EncryptedBackup,
} from '@/domain/backup'
import { importBackupJson } from '@/services/backup'
import { toast } from '@/stores/ui'
import { restartApp } from './restart'
import { SummaryTable } from './SummaryTable'

interface Preview {
  json: string
  backup: BackupFile
  summary: BackupSummary
}

/**
 * Restoring from a file (DECISIONS #112): a protected file asks for its password first, then the file's contents
 * are shown next to this device's — with a warning when restoring would take progress away — before anything is
 * replaced. The replaced data stays on the device as the restore point.
 */
export function RestoreCard({ device }: { device?: BackupSummary }) {
  const { t, i18n } = useTranslation()
  const fileInput = useRef<HTMLInputElement>(null)
  const passwordId = useId()
  const [locked, setLocked] = useState<EncryptedBackup | null>(null)
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [restoring, setRestoring] = useState(false)
  const date = (ms: number) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)
  const fail = (code: BackupErrorCode | 'noRestorePoint') => toast({ kind: 'error', title: t(`data.errors.${code}`) })

  const open = (json: string) => {
    const parsed = parseBackup(json)
    if (!parsed.ok) return fail(parsed.code)
    setPreview({ json, backup: parsed.backup, summary: summarizeBackup(parsed.backup.data) })
  }

  const choose = async (file: File | undefined) => {
    if (!file) return
    const read = readBackupText(await file.text())
    if (read.kind === 'error') return fail(read.code)
    if (read.kind === 'plain') return open(read.json)
    setPassword('')
    setUnlockError(null)
    setLocked(read.envelope)
  }

  const unlock = async () => {
    if (!locked || !password) return
    setUnlocking(true)
    try {
      const json = await decryptBackup(locked, password)
      setLocked(null)
      setPassword('')
      open(json)
    } catch (error) {
      setUnlockError(t(error instanceof BackupCryptoError && error.code === 'invalidEnvelope' ? 'data.errors.invalidShape' : 'data.errors.wrongPassword'))
    } finally {
      setUnlocking(false)
    }
  }

  const restore = async () => {
    if (!preview) return
    setRestoring(true)
    const result = await importBackupJson(preview.json)
    if (!result.ok) {
      setRestoring(false)
      setPreview(null)
      return fail(result.code)
    }
    toast({ kind: 'success', title: t('data.restored') })
    restartApp()
  }

  const warning = preview && device ? compareSummaries(preview.summary, device) : null
  const keepsCurrent = !!device && hasProgress(device)

  return (
    <>
      <p className="text-sm text-ink-soft">{t('data.restoreHint')}</p>
      <Button variant="secondary" icon="upload-simple" onClick={() => fileInput.current?.click()}>
        {t('data.choose')}
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void choose(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <Dialog
        open={locked !== null}
        onClose={() => setLocked(null)}
        locked={unlocking}
        title={t('data.unlockTitle')}
        description={locked ? t('data.unlockBody', { date: date(locked.exportedAt) }) : undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => setLocked(null)} disabled={unlocking}>
              {t('common.cancel')}
            </Button>
            <Button icon="lock-simple" onClick={() => void unlock()} disabled={!password || unlocking}>
              {unlocking ? t('data.unlocking') : t('data.unlock')}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void unlock()
          }}
        >
          <label htmlFor={passwordId} className="font-medium text-ink">
            {t('data.password')}
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setUnlockError(null)
            }}
            aria-invalid={unlockError ? true : undefined}
            className="mt-1.5 h-11 w-full rounded-xl border border-line-strong bg-paper px-4 focus:outline-2 focus:outline-gold"
          />
          {unlockError && (
            <p role="alert" className="mt-2 text-sm font-semibold text-bad">
              {unlockError}
            </p>
          )}
        </form>
      </Dialog>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        locked={restoring}
        title={t('data.previewTitle')}
        description={
          preview
            ? `${t('data.previewFrom', { date: date(preview.backup.exportedAt) })}${preview.backup.appVersion ? ` · ${t('data.previewVersion', { version: preview.backup.appVersion })}` : ''}`
            : undefined
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={restoring}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void restore()} disabled={restoring}>
              {t('data.restore')}
            </Button>
          </>
        }
      >
        {preview && (
          <div className="space-y-3">
            <SummaryTable file={preview.summary} device={keepsCurrent ? device : undefined} />
            {warning && (warning.older || warning.lessProgress) && (
              <p role="alert" className="flex gap-2 rounded-xl bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">
                <Icon name="warning" size={18} tone="plain" className="mt-0.5 shrink-0" />
                {warning.older ? t('data.previewOlder') : t('data.previewLess')}
              </p>
            )}
            <p className="text-sm text-ink-soft">{keepsCurrent ? t('data.previewUndo') : t('data.previewReplace')}</p>
          </div>
        )}
      </Dialog>
    </>
  )
}
