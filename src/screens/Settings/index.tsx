import { useEffect, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { CharacterPicker } from '@/components/brand/CharacterPicker'
import { Icon } from '@/components/icons/Icon'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Stepper } from '@/components/ui/Stepper'
import { Switch } from '@/components/ui/Switch'
import type { AppSettings, FontSize, ThemePreference } from '@/db/types'
import type { ContentFocus, GrammaticalForm, Lang } from '@/domain/types'
import { promptInstall, useInstallState } from '@/lib/install'
import { applyContentPreferences, applyGrammaticalForm, applyLanguage } from '@/services/seed'
import { DAILY_GOAL, DAY_START_HOURS, updateAppSettings } from '@/services/settings'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/stores/ui'
import { RemindersSettings } from './RemindersSettings'
import { WhisperSettings } from './WhisperSettings'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="mb-3 text-2xl font-semibold">
        {title}
      </h2>
      <Card className="space-y-5">{children}</Card>
    </section>
  )
}

/** "Install Teleo": the browser's own dialog where it has one, the Share-menu steps on iPhone and iPad. */
function InstallSection() {
  const { t } = useTranslation()
  const state = useInstallState()
  if (state !== 'prompt' && state !== 'ios') return null
  return (
    <Section id="install" title={t('settings.sectionInstall')}>
      <p className="text-sm text-ink-soft">{t('settings.installBody')}</p>
      {state === 'prompt' ? (
        <Button
          icon="download-simple"
          onClick={async () => {
            if (await promptInstall()) toast({ kind: 'success', title: t('settings.installDone') })
          }}
        >
          {t('settings.installButton')}
        </Button>
      ) : (
        <ol className="space-y-2 text-sm text-ink">
          <li className="flex items-center gap-2.5">
            <span className="halo size-7 text-xs font-bold">1</span>
            <span>
              {t('settings.installIos1')} <Icon name="export" size={18} label={t('settings.installIosShare')} className="inline align-text-bottom text-primary" />
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="halo size-7 text-xs font-bold">2</span>
            <span>{t('settings.installIos2')}</span>
          </li>
        </ol>
      )}
    </Section>
  )
}

/** Name on shared cards; saved when the field is left (not on every keystroke). */
function DisplayName({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (name: string) => void }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  const id = useId()
  const save = () => {
    const name = draft.trim().slice(0, 40)
    if (name !== value) onSave(name)
  }
  return (
    <div>
      <label htmlFor={id} className="font-medium text-ink">
        {t('settings.displayName')}
      </label>
      <input
        id={id}
        value={draft}
        maxLength={40}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className="mt-2 h-11 w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
      />
      <p className="mt-1.5 text-sm text-ink-soft">{t('settings.displayNameHint')}</p>
    </div>
  )
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const app = useSettingsStore((s) => s.app)
  const meta = useSettingsStore((s) => s.meta)
  const [params] = useSearchParams()
  const set = (patch: Partial<AppSettings>) => void updateAppSettings(patch)
  const date = (ms: number) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)

  useEffect(() => {
    const section = params.get('section')
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [params])

  return (
    <>
      <PageHeader rubric={t('settings.rubric')} title={t('settings.title')} />
      <div className="space-y-10">
        <Section id="character" title={t('settings.sectionCharacter')}>
          <p className="text-sm text-ink-soft">{t('settings.characterHint')}</p>
          <CharacterPicker label={t('settings.character')} hideLabel value={app.character} onChange={(character) => set({ character })} size={60} />
          <DisplayName value={app.displayName} placeholder={t(`characters.${app.character}`)} onSave={(displayName) => set({ displayName })} />
        </Section>

        <InstallSection />

        <Section id="appearance" title={t('settings.sectionAppearance')}>
          <Segmented<Lang>
            label={t('settings.language')}
            value={app.uiLang}
            options={[
              { value: 'pl', label: 'Polski' },
              { value: 'en', label: 'English' },
            ]}
            onChange={async (uiLang) => {
              await updateAppSettings({ uiLang })
              await applyLanguage(uiLang, app.contentFocus)
            }}
          />
          <Segmented<ThemePreference>
            label={t('settings.theme')}
            value={app.theme}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
            onChange={(theme) => set({ theme })}
          />
          <div>
            <Segmented<FontSize>
              label={t('settings.fontSize')}
              value={app.fontSize}
              options={[
                { value: 'sm', label: t('settings.fontSm') },
                { value: 'md', label: t('settings.fontMd') },
                { value: 'lg', label: t('settings.fontLg') },
              ]}
              onChange={(fontSize) => set({ fontSize })}
            />
            <p className="scripture mt-3">{t('settings.fontPreview')}</p>
          </div>
        </Section>

        <Section id="speech" title={t('settings.sectionSpeech')}>
          <div>
            <Segmented<AppSettings['engine']>
              label={t('settings.engine')}
              value={app.engine}
              options={[
                { value: 'auto', label: t('settings.engineAuto') },
                { value: 'webspeech', label: t('settings.engineWeb') },
                { value: 'whisper', label: t('settings.engineWhisper') },
              ]}
              onChange={(engine) => set({ engine })}
            />
            <p className="mt-1.5 text-sm text-ink-soft">{t('settings.engineHint')}</p>
          </div>
          <WhisperSettings />
          <div>
            <p className="font-medium text-ink">{t('settings.checking')}</p>
            <p className="mt-1.5 text-sm text-ink-soft">{t('settings.checkingHint')}</p>
          </div>
          <div className="divide-y divide-line">
            <Switch checked={app.handsFree} onChange={(handsFree) => set({ handsFree })} label={t('settings.handsFree')} description={t('settings.handsFreeHint')} />
            <Switch
              checked={app.saveTranscripts}
              onChange={(saveTranscripts) => set({ saveTranscripts })}
              label={t('settings.saveTranscripts')}
              description={t('settings.saveTranscriptsHint')}
            />
          </div>
          <ButtonLink to="/settings/mic-test" variant="secondary" icon="mic-halo">
            {t('settings.micTest')}
          </ButtonLink>
        </Section>

        <Section id="practice" title={t('settings.sectionPractice')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium">{t('settings.dailyGoal')}</span>
            <Stepper label={t('settings.dailyGoal')} value={app.dailyGoal} min={DAILY_GOAL.min} max={DAILY_GOAL.max} onChange={(dailyGoal) => set({ dailyGoal })} />
          </div>
          <div>
            <label className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">{t('settings.dayStart')}</span>
              <select
                value={app.dayStartHour}
                onChange={(e) => set({ dayStartHour: Number(e.target.value) })}
                className="h-10 rounded-full border border-line-strong bg-surface px-4 font-semibold"
              >
                {Array.from({ length: DAY_START_HOURS.max - DAY_START_HOURS.min + 1 }, (_, i) => DAY_START_HOURS.min + i).map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-1.5 text-sm text-ink-soft">{t('settings.dayStartHint')}</p>
          </div>
          <Switch checked={app.listenFirst} onChange={(listenFirst) => set({ listenFirst })} label={t('settings.listenFirst')} description={t('settings.listenFirstHint')} />
          <Switch checked={app.sounds} onChange={(sounds) => set({ sounds })} label={t('settings.sounds')} description={t('settings.soundsHint')} />
        </Section>

        <Section id="content" title={t('settings.sectionContent')}>
          <div>
            <Segmented<ContentFocus>
              label={t('settings.focus')}
              value={app.contentFocus}
              options={[
                { value: 'prayers', label: t('settings.focusPrayers') },
                { value: 'affirmations', label: t('settings.focusAffirmations') },
                { value: 'both', label: t('settings.focusBoth') },
                { value: 'own', label: t('settings.focusOwn') },
              ]}
              onChange={async (contentFocus) => {
                await updateAppSettings({ contentFocus })
                await applyContentPreferences(app.uiLang, contentFocus)
              }}
            />
            <p className="mt-1.5 text-sm text-ink-soft">{t('settings.focusHint')}</p>
          </div>
          {/* Only Polish affirmations are gendered. */}
          {app.uiLang === 'pl' && (
            <div>
              <Segmented<GrammaticalForm>
                label={t('settings.form')}
                value={app.grammaticalForm}
                options={[
                  { value: 'm', label: t('settings.formM') },
                  { value: 'f', label: t('settings.formF') },
                  { value: 'n', label: t('settings.formN') },
                ]}
                onChange={async (grammaticalForm) => {
                  await updateAppSettings({ grammaticalForm })
                  await applyGrammaticalForm(grammaticalForm)
                }}
              />
              <p className="mt-1.5 text-sm text-ink-soft">{t('settings.formHint')}</p>
            </div>
          )}
        </Section>

        <Section id="reminders" title={t('settings.sectionReminders')}>
          <RemindersSettings />
        </Section>

        <Section id="backup" title={t('settings.sectionBackup')}>
          <p className="text-sm text-ink-soft">{t('settings.backupHint')}</p>
          <p className="text-sm font-medium">{meta.lastBackupAt ? t('settings.lastBackup', { date: date(meta.lastBackupAt) }) : t('settings.neverBackedUp')}</p>
          <ButtonLink to="/settings/data" icon="database">
            {t('settings.openData')}
          </ButtonLink>
        </Section>

        <Section id="privacy" title={t('settings.sectionPrivacy')}>
          <p className="flex gap-3 text-sm text-ink-soft">
            <Icon name="shield-cross" size={20} className="mt-0.5 shrink-0 text-primary" />
            {t('settings.privacyHint')}
          </p>
          <a className="inline-block font-semibold text-primary underline underline-offset-4" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
            {t('settings.privacyPolicy')}
          </a>
          <ButtonLink to="/settings/data" variant="secondary" icon="hard-drives">
            {t('settings.dataLink')}
          </ButtonLink>
        </Section>

        <Section id="about" title={t('settings.sectionAbout')}>
          <p className="text-sm text-ink-soft">{t('settings.about', { version: __APP_VERSION__ })}</p>
        </Section>
      </div>

    </>
  )
}
