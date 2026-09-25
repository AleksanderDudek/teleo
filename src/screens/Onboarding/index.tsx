import { Check, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { TeleoMark } from '@/components/Ornaments'
import { MicButton } from '@/components/speech/MicButton'
import { speechVendor } from '@/components/speech/vendor'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Stepper } from '@/components/ui/Stepper'
import { evaluate } from '@/domain/matcher'
import { SPEECH_LANG, type ContentFocus, type GrammaticalForm, type Lang } from '@/domain/types'
import { useSpeechEngine } from '@/hooks/useSpeechEngine'
import { useTapCapture } from '@/hooks/useTapCapture'
import { cn } from '@/lib/cn'
import { requestPersistentStorage } from '@/services/backup'
import { applyContentPreferences, applyGrammaticalForm } from '@/services/seed'
import { DAILY_GOAL, updateAppSettings } from '@/services/settings'
import { useAppSettings } from '@/stores/settings'

const STEPS = 4

function Choice({ selected, onClick, title, body }: { selected: boolean; onClick: () => void; title: string; body?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
        selected ? 'border-primary bg-surface shadow-md' : 'border-line bg-surface/60 hover:border-line-strong',
      )}
    >
      <span className={cn('mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-primary bg-primary text-on-primary' : 'border-line-strong')}>
        {selected && <Check aria-hidden className="size-3" strokeWidth={3} />}
      </span>
      <span>
        <span className="block font-serif text-xl font-semibold">{title}</span>
        {body && <span className="mt-0.5 block text-sm text-ink-soft">{body}</span>}
      </span>
    </button>
  )
}

function MicStep({ lang, onHeard }: { lang: Lang; onHeard: () => void }) {
  const { t } = useTranslation()
  const engineState = useSpeechEngine(SPEECH_LANG[lang])
  const engine = engineState.status === 'ready' ? engineState.engine : null
  const phrase = t('onboarding.micPhrase')
  const [verdict, setVerdict] = useState<'ok' | 'retry' | null>(null)
  const capture = useTapCapture({
    engine,
    lang: SPEECH_LANG[lang],
    onResult: (speech) => {
      const ok = evaluate(phrase, speech.alternatives, { lang, strictness: 'lenient' }).accepted
      setVerdict(ok ? 'ok' : 'retry')
      if (ok) onHeard()
    },
  })
  const vendor = t(`speech.privacy.vendor${speechVendor()}`)
  return (
    <div className="flex flex-col items-center text-center">
      <p className="flex gap-3 rounded-2xl bg-surface p-4 text-left text-sm text-ink-soft">
        <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-leaf" />
        <span>
          {t('speech.privacy.body', { vendor })} {engineState.status === 'ready' && engineState.onDevice && t('speech.privacy.onDevice')}
        </span>
      </p>
      <p className="mt-6 text-ink-soft">{t('onboarding.micBody')}</p>
      <p className="scripture mt-2">{phrase}</p>
      <div className="mt-6">
        <MicButton listening={capture.phase === 'listening'} busy={capture.phase === 'starting' || capture.phase === 'stopping'} disabled={!engine} onClick={capture.toggle} />
      </div>
      <p aria-live="polite" className={cn('mt-4 min-h-6 font-semibold', verdict === 'ok' ? 'text-ok' : 'text-near')}>
        {verdict === 'ok' ? t('onboarding.micOk') : verdict === 'retry' ? t('onboarding.micRetry') : capture.transcript}
      </p>
      {(capture.error || engineState.status === 'unsupported') && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {t(`speech.errors.${capture.error ?? 'not-supported'}`)}
        </p>
      )}
    </div>
  )
}

export default function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const app = useAppSettings()
  const [step, setStep] = useState(0)
  const [focus, setFocus] = useState<ContentFocus>(app.contentFocus)
  const [form, setForm] = useState<GrammaticalForm>(app.grammaticalForm)
  const [goal, setGoal] = useState(app.dailyGoal)
  const [busy, setBusy] = useState(false)

  const finish = async () => {
    setBusy(true)
    await updateAppSettings({ contentFocus: focus, grammaticalForm: form, dailyGoal: goal, onboardingCompleted: true })
    await applyContentPreferences(app.uiLang, focus)
    await applyGrammaticalForm(form)
    void requestPersistentStorage()
    navigate('/', { replace: true })
  }

  const screens: Array<{ title: string; body?: string; content: ReactNode }> = [
    {
      title: t('onboarding.langTitle'),
      body: t('onboarding.langBody'),
      content: (
        <div className="space-y-3">
          <Choice selected={app.uiLang === 'pl'} onClick={() => void updateAppSettings({ uiLang: 'pl' })} title="Polski" />
          <Choice selected={app.uiLang === 'en'} onClick={() => void updateAppSettings({ uiLang: 'en' })} title="English" />
        </div>
      ),
    },
    {
      title: t('onboarding.focusTitle'),
      content: (
        <div className="space-y-3">
          {(['prayers', 'affirmations', 'both', 'own'] as const).map((value) => {
            const key = value.charAt(0).toUpperCase() + value.slice(1)
            return (
              <Choice
                key={value}
                selected={focus === value}
                onClick={() => setFocus(value)}
                title={t(`onboarding.focus${key}` as 'onboarding.focusPrayers')}
                body={t(`onboarding.focus${key}Body` as 'onboarding.focusPrayersBody')}
              />
            )
          })}
          {app.uiLang === 'pl' && (focus === 'affirmations' || focus === 'both') && (
            <div className="rounded-2xl border border-line bg-surface/60 p-4">
              <Segmented<GrammaticalForm>
                label={t('onboarding.formTitle')}
                value={form}
                onChange={setForm}
                options={[
                  { value: 'm', label: t('settings.formM') },
                  { value: 'f', label: t('settings.formF') },
                  { value: 'n', label: t('settings.formN') },
                ]}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('onboarding.micTitle'),
      content: <MicStep lang={app.uiLang} onHeard={() => void updateAppSettings({ speechPrivacyAcknowledged: true })} />,
    },
    {
      title: t('onboarding.goalTitle'),
      body: t('onboarding.goalBody'),
      content: (
        <div className="flex flex-col items-center gap-5">
          <div className="flex flex-wrap justify-center gap-2">
            {[5, 10, 20, 30].map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={goal === preset}
                onClick={() => setGoal(preset)}
                className={cn(
                  'rounded-full border px-4 py-2 font-semibold',
                  goal === preset ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                {t('onboarding.goalSentences', { count: preset })}
              </button>
            ))}
          </div>
          <Stepper label={t('settings.dailyGoal')} value={goal} min={DAILY_GOAL.min} max={DAILY_GOAL.max} onChange={setGoal} />
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <ShieldCheck aria-hidden className="size-4 text-leaf" />
            {t('onboarding.privacyNote')}{' '}
            <a className="font-semibold text-primary underline underline-offset-4" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
              {t('onboarding.privacyLink')}
            </a>
          </p>
        </div>
      ),
    },
  ]
  const current = screens[step]!
  const last = step === STEPS - 1

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-primary">
          <TeleoMark className="size-8" />
          <span className="rubric">{t('app.name')}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => void finish()} disabled={busy}>
          {t('onboarding.skip')}
        </Button>
      </div>

      {step === 0 && (
        <div className="mt-8 animate-rise">
          <h1 className="text-4xl leading-tight font-semibold">{t('onboarding.welcomeTitle')}</h1>
          <p className="mt-3 text-ink-soft">{t('onboarding.welcomeBody')}</p>
        </div>
      )}

      <section key={step} className="mt-8 flex-1 animate-rise" aria-labelledby="step-title">
        <p className="rubric">{t('onboarding.step', { current: step + 1, total: STEPS })}</p>
        <h2 id="step-title" className="mt-1 text-2xl font-semibold">
          {current.title}
        </h2>
        {current.body && <p className="mt-2 text-ink-soft">{current.body}</p>}
        <div className="mt-6">{current.content}</div>
      </section>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div className="flex gap-1.5" aria-hidden>
          {screens.map((_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-primary' : 'w-1.5 bg-line-strong')} />
          ))}
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              {t('onboarding.back')}
            </Button>
          )}
          <Button size="lg" disabled={busy} onClick={() => (last ? void finish() : setStep((s) => s + 1))}>
            {last ? t('onboarding.start') : t('onboarding.next')}
          </Button>
        </div>
      </div>
    </main>
  )
}
