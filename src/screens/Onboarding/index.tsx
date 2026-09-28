import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Character } from '@/components/brand/Character'
import { CharacterPicker } from '@/components/brand/CharacterPicker'
import { Guardian, type GuardianMood } from '@/components/brand/Guardian'
import { GuideBubble } from '@/components/brand/GuideBubble'
import { Icon, type IconName } from '@/components/icons/Icon'
import { MicButton } from '@/components/speech/MicButton'
import { speechVendor } from '@/components/speech/vendor'
import { ArchFrame } from '@/components/ui/ArchFrame'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { IconHalo, type HaloTone } from '@/components/ui/IconHalo'
import { Segmented } from '@/components/ui/Segmented'
import { Stepper } from '@/components/ui/Stepper'
import { COVERAGE_LADDER, evaluate } from '@/domain/matcher'
import { SPEECH_LANG, type ContentFocus, type GrammaticalForm, type Lang } from '@/domain/types'
import { useSpeechEngine } from '@/hooks/useSpeechEngine'
import { useTapCapture } from '@/hooks/useTapCapture'
import { cn } from '@/lib/cn'
import { requestPersistentStorage } from '@/services/backup'
import { applyContentPreferences, applyGrammaticalForm } from '@/services/seed'
import { DAILY_GOAL, updateAppSettings } from '@/services/settings'
import { useAppSettings } from '@/stores/settings'

const STEPS = 5

const FOCUS: ReadonlyArray<{ value: ContentFocus; key: 'Prayers' | 'Affirmations' | 'Both' | 'Own'; icon: IconName; tone: HaloTone }> = [
  { value: 'prayers', key: 'Prayers', icon: 'praying-hands', tone: 'gold' },
  { value: 'affirmations', key: 'Affirmations', icon: 'radiant-heart', tone: 'sunk' },
  { value: 'both', key: 'Both', icon: 'mandorla-star', tone: 'lapis' },
  { value: 'own', key: 'Own', icon: 'scroll-ribbon', tone: 'sunk' },
]

/** A centred step: the Guardian (or a window), a serif title and a line of body text. */
function Lead({ figure, title, body }: { figure: ReactNode; title: string; body?: ReactNode }) {
  return (
    <>
      {figure}
      <h1 id="step-title" className="mt-4 text-center text-[1.9rem] leading-[1.1] font-semibold">
        {title}
      </h1>
      {body && <p className="mx-auto mt-2 max-w-[22rem] text-center text-ink-soft">{body}</p>}
    </>
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
      // A microphone check, not a test: the most forgiving rung of the coverage ladder.
      const ok = evaluate(phrase, speech.alternatives, { lang, threshold: COVERAGE_LADDER.at(-1) }).accepted
      setVerdict(ok ? 'ok' : 'retry')
      if (ok) onHeard()
    },
  })
  const vendor = t(`speech.privacy.vendor${speechVendor()}`)
  const mood: GuardianMood = verdict === 'ok' ? 'celebrate' : verdict === 'retry' ? 'encourage' : 'listen'
  return (
    <div className="flex flex-col items-center text-center">
      <Lead
        figure={<Guardian mood={mood} size={180} decorative />}
        title={t('onboarding.micTitle')}
        body={verdict === 'ok' ? t('onboarding.micOk') : t('onboarding.micBody')}
      />
      <p className="scripture mandorla mt-3 w-full py-2.5">{phrase}</p>
      <div className="mt-2">
        <MicButton listening={capture.phase === 'listening'} busy={capture.phase === 'starting' || capture.phase === 'stopping'} disabled={!engine} onClick={capture.toggle} />
      </div>
      <p aria-live="polite" className={cn('mt-4 min-h-6 font-semibold', verdict === 'ok' ? 'text-ok' : 'text-near')}>
        {verdict === 'retry' ? t('onboarding.micRetry') : verdict === 'ok' ? '' : capture.transcript}
      </p>
      {(capture.error || engineState.status === 'unsupported') && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {t(`speech.errors.${capture.error ?? 'not-supported'}`)}
        </p>
      )}
      {/* Spec §5.2: say who processes the audio before the microphone is used for the first time. */}
      <p className="mt-4 flex gap-3 rounded-2xl border border-line bg-surface p-4 text-left text-sm text-ink-soft">
        <Icon name="shield-cross" size={20} className="mt-0.5 text-primary" />
        <span>
          {t('speech.privacy.body', { vendor })} {engineState.status === 'ready' && engineState.onDevice && t('speech.privacy.onDevice')}
        </span>
      </p>
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

  const steps: ReactNode[] = [
    // 1 · welcome (the language comes from the browser; Settings can change it)
    <Fragment key="welcome">
      <Lead
        figure={
          <ArchFrame glow className="px-3 pt-6">
            <Guardian mood="welcome" size={210} decorative className="mx-auto" />
          </ArchFrame>
        }
        title={t('onboarding.welcomeTitle')}
        body={t('onboarding.welcomeBody')}
      />
    </Fragment>,
    // 2 · the figure that stands for the user
    <Fragment key="character">
      <h1 id="step-title" className="sr-only">
        {t('onboarding.characterTitle')}
      </h1>
      <GuideBubble mood="point" size={96} compact>
        {t('onboarding.characterGuide')}
      </GuideBubble>
      <div className="mt-4 flex justify-center">
        <ArchFrame glow shape="lancet" className="w-[170px] px-2 pt-[18px]">
          <Character id={app.character} pose="praying" size={154} decorative />
        </ArchFrame>
      </div>
      <div className="mt-4">
        <CharacterPicker label={t('onboarding.characterTitle')} hideLabel value={app.character} onChange={(character) => void updateAppSettings({ character })} />
      </div>
    </Fragment>,
    // 3 · what to practise (+ the Polish grammatical form)
    <Fragment key="focus">
      <h1 id="step-title" className="sr-only">
        {t('onboarding.focusTitle')}
      </h1>
      <GuideBubble mood="teach" size={96} compact>
        {t('onboarding.focusGuide')}
      </GuideBubble>
      <div className="mt-4 grid gap-2.5">
        {FOCUS.map(({ value, key, icon, tone }) => {
          const selected = focus === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setFocus(value)}
              className={cn('card flex items-center gap-3.5 p-3.5 text-left transition-colors', selected ? 'card-framed border-primary' : 'hover:border-line-strong')}
            >
              <IconHalo icon={icon} tone={tone} size={46} />
              <span className="flex-1">
                <span className="block font-serif text-[1.2rem] font-semibold">{t(`onboarding.focus${key}`)}</span>
                <span className="block text-sm text-ink-soft">{t(`onboarding.focus${key}Body`)}</span>
              </span>
            </button>
          )
        })}
        {app.uiLang === 'pl' && (focus === 'affirmations' || focus === 'both') && (
          <div className="card p-4">
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
    </Fragment>,
    // 4 · microphone test
    <MicStep key="mic" lang={app.uiLang} onHeard={() => void updateAppSettings({ speechPrivacyAcknowledged: true })} />,
    // 5 · daily goal
    <div key="goal" className="flex flex-col items-center">
      <Lead figure={<Guardian mood="encourage" size={180} decorative />} title={t('onboarding.goalTitle')} body={t('onboarding.goalBody')} />
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {[5, 10, 20, 30].map((preset) => (
          <Chip key={preset} pressed={goal === preset} onClick={() => setGoal(preset)}>
            {t('onboarding.goalSentences', { count: preset })}
          </Chip>
        ))}
      </div>
      <div className="mt-4">
        <Stepper label={t('settings.dailyGoal')} value={goal} min={DAILY_GOAL.min} max={DAILY_GOAL.max} onChange={setGoal} />
      </div>
      <p className="mt-4 flex items-center gap-2 text-center text-sm font-medium text-gold-ink">
        <Icon name="mandorla-star" size={16} />
        {t('golden.hint')}
      </p>
      <p className="mt-5 flex items-center gap-2 text-center text-[0.8rem] text-ink-soft">
        <Icon name="shield-cross" size={16} className="text-primary" />
        <span>
          {t('onboarding.privacyNote')}{' '}
          <a className="font-semibold text-primary underline underline-offset-4" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
            {t('onboarding.privacyLink')}
          </a>
        </span>
      </p>
    </div>,
  ]
  const last = step === STEPS - 1

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="flex items-center justify-between">
        <p className="rubric">{t('onboarding.step', { current: step + 1, total: STEPS })}</p>
        <Button variant="ghost" size="sm" onClick={() => void finish()} disabled={busy}>
          {t('onboarding.skip')}
        </Button>
      </div>

      <section key={step} className="flex-1 pt-3 animate-rise" aria-labelledby="step-title">
        {steps[step]}
      </section>

      <div className="mt-6 flex flex-col items-center gap-3.5">
        <div className="flex gap-2" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                'size-2.5 rounded-full transition-colors',
                i === step ? 'bg-gold shadow-[0_0_0_3px_var(--gold-soft)]' : i < step ? 'bg-primary' : 'bg-line-strong',
              )}
            />
          ))}
        </div>
        <div className="flex w-full gap-2.5">
          {step > 0 && (
            <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>
              {t('onboarding.back')}
            </Button>
          )}
          <Button
            size="lg"
            block
            disabled={busy}
            iconEnd={last ? undefined : 'caret-right'}
            onClick={() => (last ? void finish() : setStep((s) => s + 1))}
          >
            {step === 0 ? t('onboarding.start') : last ? t('onboarding.begin') : t('onboarding.next')}
          </Button>
        </div>
      </div>
    </main>
  )
}
