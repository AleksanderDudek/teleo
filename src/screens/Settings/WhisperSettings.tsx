import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ProgressBar } from '@/components/ui/Progress'
import { Segmented } from '@/components/ui/Segmented'
import { formatMegabytes, modelBytes, type WhisperModelId } from '@/domain/speech/whisper/models'
import { progressPercent } from '@/domain/speech/whisper/progress'
import { ORT_RUNTIME_BYTES } from '@/domain/speech/whisper/runtime'
import { updateAppSettings } from '@/services/settings'
import { useAppSettings } from '@/stores/settings'
import { toast } from '@/stores/ui'
import { useWhisperStore, whisperModels } from '@/stores/whisper'

const MODEL_NAMES: Record<WhisperModelId, string> = { tiny: 'Tiny', base: 'Base' }

/**
 * Offline Whisper (spec §5.3): model choice and the only way a model reaches
 * the device — an explicit download, with its size and a mobile-data warning
 * first, then progress; plus deletion.
 */
export function WhisperSettings() {
  const { t, i18n } = useTranslation()
  const app = useAppSettings()
  const models = useWhisperStore((s) => s.models)
  const [confirm, setConfirm] = useState<{ model: WhisperModelId; bytes: number } | null>(null)
  const size = (bytes: number) => formatMegabytes(bytes, i18n.language)
  const selected = app.whisperModel
  const other: WhisperModelId = selected === 'base' ? 'tiny' : 'base'
  const state = models[selected]
  const otherState = models[other]
  const busy = state.status === 'downloading' || otherState.status === 'downloading'

  useEffect(() => {
    void whisperModels().refresh()
  }, [])

  const download = async (model: WhisperModelId) => {
    setConfirm(null)
    if (await whisperModels().download(model)) toast({ kind: 'success', title: t('settings.whisperDone') })
  }

  const remove = async (model: WhisperModelId) => {
    await whisperModels().remove(model)
    toast({ kind: 'info', title: t('settings.whisperDeleted') })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line p-4">
      <div>
        <h3 className="font-semibold">{t('settings.whisperTitle')}</h3>
        <p className="mt-1 text-sm text-ink-soft">{t('settings.whisperIntro')}</p>
      </div>

      {state.status === 'unavailable' ? (
        <p className="text-sm font-medium text-bad">{t('settings.whisperUnavailable')}</p>
      ) : (
        <>
          <div>
            <Segmented<WhisperModelId>
              label={t('settings.whisperModel')}
              value={selected}
              options={[
                { value: 'tiny', label: t('settings.whisperTiny', { size: size(modelBytes('tiny') + ORT_RUNTIME_BYTES) }) },
                { value: 'base', label: t('settings.whisperBase', { size: size(modelBytes('base') + ORT_RUNTIME_BYTES) }) },
              ]}
              onChange={(whisperModel) => void updateAppSettings({ whisperModel })}
            />
            <p className="mt-1.5 text-sm text-ink-soft">{t('settings.whisperModelHint')}</p>
          </div>

          <div aria-live="polite" className="space-y-2">
            {state.status === 'checking' && <p className="text-sm text-ink-soft">{t('settings.whisperChecking')}</p>}

            {state.status === 'ready' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ok">
                  <Icon name="check-circle" size={16} />
                  {t('settings.whisperReady')}
                </p>
                <Button size="sm" variant="ghost" icon="trash" onClick={() => void remove(selected)}>
                  {t('settings.whisperDelete')}
                </Button>
              </div>
            )}

            {state.status === 'downloading' && (
              <>
                <ProgressBar value={state.progress.loaded} max={state.progress.total} label={t('settings.whisperProgress')} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="tabular text-sm text-ink-soft">{t('settings.whisperDownloading', { percent: progressPercent(state.progress) })}</p>
                  <Button size="sm" variant="ghost" onClick={() => whisperModels().cancel()}>
                    {t('settings.whisperCancel')}
                  </Button>
                </div>
              </>
            )}

            {(state.status === 'missing' || state.status === 'failed') && (
              <>
                {state.status === 'failed' ? (
                  <p role="alert" className="text-sm font-medium text-bad">
                    {state.code === 'storage-full' ? t('settings.whisperNoSpace') : t('settings.whisperFailed')}
                  </p>
                ) : (
                  <p className="text-sm text-ink-soft">{app.engine === 'whisper' ? t('settings.whisperNeedsDownload') : t('settings.whisperMissing')}</p>
                )}
                <Button
                  variant="secondary"
                  disabled={busy}
                  icon="download-simple"
                  onClick={() => setConfirm({ model: selected, bytes: state.missingBytes })}
                >
                  {t('settings.whisperDownload', { size: size(state.missingBytes) })}
                </Button>
              </>
            )}
          </div>

          {otherState.status === 'ready' && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
              {t('settings.whisperAlsoDownloaded', { model: MODEL_NAMES[other], size: size(modelBytes(other)) })}
              <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => void remove(other)}>
                {t('settings.whisperDeleteOther', { model: MODEL_NAMES[other] })}
              </button>
            </p>
          )}
          {otherState.status === 'downloading' && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
              {MODEL_NAMES[other]}: {t('settings.whisperDownloading', { percent: progressPercent(otherState.progress) })}
              <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => whisperModels().cancel()}>
                {t('settings.whisperCancel')}
              </button>
            </p>
          )}
        </>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t('settings.whisperConfirmTitle')}
        description={confirm ? t('settings.whisperConfirmBody', { size: size(confirm.bytes) }) : undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button icon="download-simple" onClick={() => confirm && void download(confirm.model)}>
              {t('settings.whisperConfirm')}
            </Button>
          </>
        }
      />
    </div>
  )
}
