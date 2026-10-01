import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { download } from '@/lib/download'
import { canShareFile, prefersShare, shareFile } from '@/lib/saveFile'
import { markBackupDone, prepareBackup } from '@/services/backup'
import { toast } from '@/stores/ui'
import { formatBytes } from './format'

export const MIN_PASSWORD = 8

interface Prepared {
  file: File
  size: number
  encrypted: boolean
}

const inputClass =
  'mt-1.5 h-11 w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none'

/**
 * Making a backup in two taps (DECISIONS #110): "Create" builds the file (reading everything and, with a
 * password, encrypting takes a moment); then saving or sharing it is a fresh tap, which iOS requires for the
 * share sheet.
 */
export function BackupCard({ lastBackupAt }: { lastBackupAt?: number }) {
  const { t, i18n } = useTranslation()
  const ids = { password: useId(), repeat: useId(), hint: useId() }
  const [protect, setProtect] = useState(false)
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const date = (ms: number) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)

  const tooShort = protect && password.length > 0 && password.length < MIN_PASSWORD
  const mismatch = protect && repeat.length > 0 && password !== repeat
  const ready = !protect || (password.length >= MIN_PASSWORD && password === repeat)

  // A file made with other options is stale: make it again. (The options are locked while a file is being made.)
  const changed = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setPrepared(null)
  }

  const create = async () => {
    setPreparing(true)
    try {
      const backup = await prepareBackup({ password: protect ? password : undefined })
      setPrepared({ file: new File([backup.blob], backup.fileName, { type: 'application/json' }), size: backup.size, encrypted: backup.encrypted })
    } catch (error) {
      console.error('[teleo] creating a backup failed', error)
      toast({ kind: 'error', title: t('data.createFailed') })
    } finally {
      setPreparing(false)
    }
  }

  const done = async () => {
    await markBackupDone()
    toast({ kind: 'success', title: t('data.saved') })
  }

  const save = () => {
    if (!prepared) return
    download(prepared.file, prepared.file.name)
    void done()
  }

  const share = async () => {
    if (!prepared) return
    const result = await shareFile(prepared.file, t('data.shareTitle'))
    if (result === 'shared') void done()
    else if (result === 'failed') toast({ kind: 'error', title: t('data.shareFailed') })
  }

  const shareable = prepared ? canShareFile(prepared.file) : false
  const shareFirst = shareable && prefersShare()
  const shareButton = shareable && (
    <Button key="share" variant={shareFirst ? 'primary' : 'secondary'} icon="cloud-arrow-up" onClick={() => void share()}>
      {t('data.share')}
    </Button>
  )
  const downloadButton = (
    <Button key="download" variant={shareFirst ? 'secondary' : 'primary'} icon="download-simple" onClick={save}>
      {t('data.download')}
    </Button>
  )

  return (
    <>
      <p className="text-sm text-ink-soft">{t('data.backupHint')}</p>
      <p className="text-sm font-medium">{lastBackupAt ? t('data.lastBackup', { date: date(lastBackupAt) }) : t('data.neverBackedUp')}</p>

      <div className="border-t border-line">
        <Switch checked={protect} onChange={changed(setProtect)} label={t('data.protect')} description={t('data.protectHint')} disabled={preparing} />
      </div>
      {protect && (
        <div className="space-y-3">
          <div>
            <label htmlFor={ids.password} className="font-medium text-ink">
              {t('data.password')}
            </label>
            <input
              id={ids.password}
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={preparing}
              onChange={(event) => changed(setPassword)(event.target.value)}
              aria-invalid={tooShort || undefined}
              aria-describedby={ids.hint}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={ids.repeat} className="font-medium text-ink">
              {t('data.passwordRepeat')}
            </label>
            <input
              id={ids.repeat}
              type="password"
              autoComplete="new-password"
              value={repeat}
              disabled={preparing}
              onChange={(event) => changed(setRepeat)(event.target.value)}
              aria-invalid={mismatch || undefined}
              className={inputClass}
            />
          </div>
          <p id={ids.hint} className="text-sm text-ink-soft" aria-live="polite">
            {mismatch ? (
              <span className="font-semibold text-bad">{t('data.passwordMismatch')}</span>
            ) : (
              <span className={tooShort ? 'font-semibold text-bad' : undefined}>{t('data.passwordTooShort', { count: MIN_PASSWORD })}</span>
            )}
          </p>
          <p className="flex gap-2 rounded-xl bg-near-soft px-3 py-2.5 text-sm text-near">
            <Icon name="warning" size={18} tone="plain" className="mt-0.5 shrink-0" />
            {t('data.passwordWarning')}
          </p>
        </div>
      )}

      {prepared ? (
        <div className="space-y-3 rounded-2xl bg-sunk p-4" aria-live="polite">
          <p className="flex items-center gap-3">
            <Icon name={prepared.encrypted ? 'lock-simple' : 'file-text'} size={28} className="shrink-0 text-gold-ink" />
            <span className="min-w-0">
              <span className="block font-semibold">{t('data.ready')}</span>
              <span className="block truncate text-sm text-ink-soft">
                {prepared.file.name} · {formatBytes(prepared.size, i18n.language)}
                {prepared.encrypted ? ` · ${t('data.protectedFile')}` : ''}
              </span>
            </span>
          </p>
          <div className="flex flex-wrap gap-2">{shareFirst ? [shareButton, downloadButton] : [downloadButton, shareButton]}</div>
          <p className="text-xs text-ink-faint">{shareable ? t('data.whereToKeep') : t('data.whereToKeepDownload')}</p>
        </div>
      ) : (
        <Button icon="database" onClick={() => void create()} disabled={!ready || preparing}>
          {preparing ? t('data.preparing') : t('data.create')}
        </Button>
      )}
    </>
  )
}
