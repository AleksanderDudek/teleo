import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DiffLegend, DiffView } from '@/components/speech/DiffView'
import { HowWeCount } from '@/components/speech/HowWeCount'
import { MicButton } from '@/components/speech/MicButton'
import { resultMessage } from '@/components/speech/resultMessage'
import { SpeechPrivacyDialog } from '@/components/speech/SpeechPrivacyDialog'
import { pointsToSpeechSettings } from '@/components/speech/speechErrors'
import { SpeechSettingsLink } from '@/components/speech/SpeechSettingsLink'
import { isIosStandalone } from '@/components/speech/vendor'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { buildDiff, evaluate, type MatchResult } from '@/domain/matcher'
import type { OnDeviceStatus, SpeechResult } from '@/domain/speech/SpeechEngine'
import { SPEECH_LANG, type Lang } from '@/domain/types'
import { useSpeechEngine } from '@/hooks/useSpeechEngine'
import { useTapCapture } from '@/hooks/useTapCapture'
import { cn } from '@/lib/cn'
import { updateAppSettings } from '@/services/settings'
import { useAppSettings } from '@/stores/settings'
import { toast } from '@/stores/ui'

const PHRASES: Record<Lang, string[]> = {
  pl: ['Teleo', 'Dzień dobry', 'Jestem spokojny i skupiony.', 'Chleba naszego powszedniego daj nam dzisiaj.'],
  en: ['Teleo', 'Good morning', 'I am calm and focused.', 'Give us this day our daily bread.'],
}

export default function MicTest() {
  const { t } = useTranslation()
  const app = useAppSettings()
  const [lang, setLang] = useState<Lang>(app.uiLang)
  const [phrase, setPhrase] = useState(PHRASES[app.uiLang][1] ?? '')
  const [custom, setCustom] = useState('')
  const [outcome, setOutcome] = useState<{ result: MatchResult; speech: SpeechResult } | null>(null)
  const [askPrivacy, setAskPrivacy] = useState(false)
  const [onDeviceStatus, setOnDeviceStatus] = useState<OnDeviceStatus | undefined>()
  const engineState = useSpeechEngine(SPEECH_LANG[lang])
  const engine = engineState.status === 'ready' ? engineState.engine : null
  const target = custom.trim() || phrase

  const capture = useTapCapture({
    engine,
    lang: SPEECH_LANG[lang],
    onResult: (speech) => setOutcome({ speech, result: evaluate(target, speech.alternatives, { lang, strictness: app.strictness }) }),
  })

  useEffect(() => {
    let alive = true
    void engine?.onDeviceStatus?.(SPEECH_LANG[lang]).then((status) => alive && setOnDeviceStatus(status))
    return () => {
      alive = false
    }
  }, [engine, lang])

  const diff = useMemo(() => (outcome ? buildDiff(target, lang, outcome.result) : null), [outcome, target, lang])

  const toggle = () => {
    if (capture.phase === 'idle' && !app.speechPrivacyAcknowledged) return setAskPrivacy(true)
    setOutcome(null)
    capture.toggle()
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || (event.target as HTMLElement | null)?.closest('input, textarea, button, [role="radio"]')) return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const listening = capture.phase === 'listening'

  return (
    <>
      <PageHeader backTo="/settings" rubric={t('micTest.rubric')} title={t('micTest.title')} subtitle={t('micTest.intro')} />

      <Card className="space-y-5">
        <Segmented<Lang>
          label={t('editor.fieldLang')}
          value={lang}
          onChange={(next) => {
            setLang(next)
            setPhrase(PHRASES[next][1] ?? '')
            setOutcome(null)
          }}
          options={[
            { value: 'pl', label: t('langs.pl') },
            { value: 'en', label: t('langs.en') },
          ]}
        />
        <fieldset>
          <legend className="mb-2 font-medium">{t('micTest.phrase')}</legend>
          <div className="flex flex-wrap gap-2">
            {PHRASES[lang].map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={!custom && phrase === p}
                onClick={() => {
                  setPhrase(p)
                  setCustom('')
                  setOutcome(null)
                }}
                className={cn(
                  'rounded-full border px-3 py-1.5 font-serif text-base',
                  !custom && phrase === p ? 'border-primary bg-primary text-on-primary' : 'border-line bg-paper hover:border-line-strong',
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="sr-only">{t('micTest.custom')}</span>
            <input
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value)
                setOutcome(null)
              }}
              placeholder={t('micTest.customPlaceholder')}
              className="h-11 w-full rounded-xl border border-line-strong bg-paper px-4 font-serif placeholder:font-sans placeholder:text-ink-faint focus:outline-2 focus:outline-gold"
            />
          </label>
        </fieldset>
      </Card>

      <section className="mt-6 flex flex-col items-center text-center">
        <p className="scripture max-w-xl">{target}</p>
        <div className="mt-8">
          <MicButton listening={listening} busy={capture.phase === 'starting' || capture.phase === 'stopping'} disabled={!engine} onClick={toggle} />
        </div>
        <p className="mt-3 h-6 text-sm font-medium text-ink-soft" aria-live="polite">
          {capture.phase === 'starting' ? t('speech.starting') : listening ? t('speech.listening') : capture.phase === 'stopping' ? t('speech.checking') : t('speech.spaceHint')}
        </p>
        {listening && capture.transcript && <p className="mt-2 max-w-xl font-serif text-lg text-ink-soft italic">{capture.transcript}</p>}
      </section>

      {engineState.status === 'unsupported' && (
        <p role="alert" className="mt-6 rounded-xl bg-bad-soft px-4 py-3 text-bad">
          {t(`speech.errors.${engineState.reason}`)}
          <SpeechSettingsLink />
        </p>
      )}
      {capture.error && (
        <p role="alert" className="mt-6 rounded-xl bg-bad-soft px-4 py-3 text-bad">
          {t(`speech.errors.${capture.error}`)} {isIosStandalone() && t('speech.errors.iosStandalone')}
          {pointsToSpeechSettings(capture.error) && <SpeechSettingsLink />}
        </p>
      )}

      {outcome && diff && (
        <Card className="mt-6 space-y-4" aria-live="polite">
          <p className={cn('text-lg font-semibold', outcome.result.accepted ? 'text-ok' : 'text-bad')}>{resultMessage(outcome.result, t)}</p>
          <DiffView parts={diff} />
          <DiffLegend />
          <div className="border-t border-line pt-3 text-sm text-ink-soft">
            <p className="font-semibold text-ink">{t('micTest.heard')}</p>
            <p className="font-serif text-base">{outcome.speech.alternatives[0] ?? '—'}</p>
            {outcome.speech.alternatives.length > 1 && (
              <p className="mt-1">
                {t('micTest.alternatives')}: {outcome.speech.alternatives.slice(1).join(' · ')}
              </p>
            )}
          </div>
          <HowWeCount />
        </Card>
      )}

      <Card className="mt-6 space-y-2 text-sm">
        <p>
          <span className="font-semibold">{t('micTest.engine')}:</span>{' '}
          {(engine?.id ?? (app.engine === 'whisper' ? 'whisper' : 'webspeech')) === 'whisper'
            ? t('micTest.engineWhisper', { model: app.whisperModel === 'base' ? 'Base' : 'Tiny' })
            : t('micTest.engineWeb')}
        </p>
        {onDeviceStatus && (
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t('micTest.onDevice')}:</span>
            {onDeviceStatus === 'available' && t('micTest.onDeviceAvailable')}
            {(onDeviceStatus === 'downloadable' || onDeviceStatus === 'downloading') && t('micTest.onDeviceDownloadable')}
            {onDeviceStatus === 'unavailable' && t('micTest.onDeviceUnavailable')}
            {onDeviceStatus === 'downloadable' && engine?.installOnDevice && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (await engine.installOnDevice?.(SPEECH_LANG[lang])) {
                    setOnDeviceStatus('available')
                    toast({ kind: 'success', title: t('micTest.onDeviceInstalled') })
                  }
                }}
              >
                {t('micTest.onDeviceInstall')}
              </Button>
            )}
          </p>
        )}
      </Card>

      <SpeechPrivacyDialog
        open={askPrivacy}
        onDevice={engineState.status === 'ready' && engineState.onDevice}
        onClose={() => setAskPrivacy(false)}
        onAccept={async () => {
          setAskPrivacy(false)
          await updateAppSettings({ speechPrivacyAcknowledged: true })
          setOutcome(null)
          void capture.start()
        }}
      />
    </>
  )
}
