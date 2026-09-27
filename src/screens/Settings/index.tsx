import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { CharacterPicker } from '@/components/brand/CharacterPicker'
import { Icon } from '@/components/icons/Icon'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Stepper } from '@/components/ui/Stepper'
import { Switch } from '@/components/ui/Switch'
import type { AppSettings, FontSize, ThemePreference } from '@/db/types'
import { parseBackup } from '@/domain/backup'
import { buildDailyReminderIcs } from '@/domain/reminders/ics'
import type { ContentFocus, GrammaticalForm, Lang, Strictness } from '@/domain/types'
import { downloadText } from '@/lib/download'
import { newId } from '@/lib/id'
import { backupFileName, exportBackup, importBackupJson, markBackupDone, requestPersistentStorage, wipeAllData } from '@/services/backup'
import { applyContentPreferences, applyGrammaticalForm } from '@/services/seed'
import { DAILY_GOAL, DAY_START_HOURS, updateAppSettings } from '@/services/settings'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/stores/ui'
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

const Hint = ({ children }: { children: ReactNode }) => <p className="-mt-3 text-sm text-ink-soft">{children}</p>

export default function Settings() {
  const { t, i18n } = useTranslation()
  const app = useSettingsStore((s) => s.app)
  const meta = useSettingsStore((s) => s.meta)
  const [params] = useSearchParams()
  const set = (patch: Partial<AppSettings>) => void updateAppSettings(patch)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{ json: string; exportedAt: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const date = (ms: number) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  useEffect(() => {
    const section = params.get('section')
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [params])

  const exportNow = async () => {
    const file = await exportBackup()
    downloadText(backupFileName(), JSON.stringify(file, null, 1), 'application/json')
    await markBackupDone()
    toast({ kind: 'success', title: t('settings.exported') })
  }

  const chooseImport = async (file: File | undefined) => {
    if (!file) return
    const json = await file.text()
    const parsed = parseBackup(json)
    if (!parsed.ok) return toast({ kind: 'error', title: t('settings.importFailed', { reason: parsed.path ?? parsed.code }) })
    setPendingImport({ json, exportedAt: parsed.backup.exportedAt })
  }

  const reminder = () => {
    const ics = buildDailyReminderIcs({
      time: app.reminderTime,
      title: t('settings.reminderTitle'),
      description: t('settings.reminderBody'),
      url: new URL(import.meta.env.BASE_URL, window.location.origin).href,
      uid: `teleo-daily-${newId()}@teleo`,
      now: new Date(),
    })
    downloadText('teleo-reminder.ics', ics, 'text/calendar')
  }

  return (
    <>
      <PageHeader rubric={t('settings.rubric')} title={t('settings.title')} />
      <div className="space-y-10">
        <Section id="character" title={t('settings.sectionCharacter')}>
          <p className="text-sm text-ink-soft">{t('settings.characterHint')}</p>
          <CharacterPicker label={t('settings.character')} hideLabel value={app.character} onChange={(character) => set({ character })} size={60} />
        </Section>

        <Section id="appearance" title={t('settings.sectionAppearance')}>
          <Segmented<Lang>
            label={t('settings.language')}
            value={app.uiLang}
            options={[
              { value: 'pl', label: 'Polski' },
              { value: 'en', label: 'English' },
            ]}
            onChange={(uiLang) => set({ uiLang })}
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
            <Segmented<Strictness>
              label={t('settings.strictness')}
              value={app.strictness}
              options={[
                { value: 'strict', label: t('settings.strict') },
                { value: 'lenient', label: t('settings.lenient') },
              ]}
              onChange={(strictness) => set({ strictness })}
            />
            <p className="mt-1.5 text-sm text-ink-soft">{t('settings.strictHint')}</p>
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
        </Section>

        <Section id="reminders" title={t('settings.sectionReminders')}>
          <label className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium">{t('settings.reminderTime')}</span>
            <input
              type="time"
              value={app.reminderTime}
              onChange={(e) => e.target.value && set({ reminderTime: e.target.value })}
              className="h-10 rounded-full border border-line-strong bg-surface px-4 font-semibold"
            />
          </label>
          <Hint>{t('settings.reminderHint')}</Hint>
          <Button variant="secondary" onClick={reminder} icon="calendar-plus">
            {t('settings.reminderDownload')}
          </Button>
        </Section>

        <Section id="backup" title={t('settings.sectionBackup')}>
          <p className="text-sm text-ink-soft">{t('settings.backupHint')}</p>
          <p className="text-sm font-medium">{meta.lastBackupAt ? t('settings.lastBackup', { date: date(meta.lastBackupAt) }) : t('settings.neverBackedUp')}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void exportNow()} icon="download-simple">
              {t('settings.export')}
            </Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()} icon="upload-simple">
              {t('settings.import')}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                void chooseImport(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        </Section>

        <Section id="privacy" title={t('settings.sectionPrivacy')}>
          <p className="flex gap-3 text-sm text-ink-soft">
            <Icon name="shield-cross" size={20} className="mt-0.5 shrink-0 text-primary" />
            {t('settings.privacyHint')}
          </p>
          <a className="inline-block font-semibold text-primary underline underline-offset-4" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
            {t('settings.privacyPolicy')}
          </a>
          {persisted !== null && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-semibold">{t('settings.persisted')}:</span> {persisted ? t('settings.persistedOn') : t('settings.persistedOff')}
              </span>
              {!persisted && (
                <Button size="sm" variant="secondary" onClick={async () => setPersisted(await requestPersistentStorage())}>
                  {t('settings.persistAsk')}
                </Button>
              )}
            </div>
          )}
          <Button variant="danger" onClick={() => setDeleting(true)} icon="trash">
            {t('settings.deleteAll')}
          </Button>
        </Section>

        <Section id="about" title={t('settings.sectionAbout')}>
          <p className="text-sm text-ink-soft">{t('settings.about', { version: __APP_VERSION__ })}</p>
        </Section>
      </div>

      <Dialog
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title={t('settings.importTitle')}
        description={pendingImport ? t('settings.importBody', { date: date(pendingImport.exportedAt) }) : undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!pendingImport) return
                const result = await importBackupJson(pendingImport.json)
                setPendingImport(null)
                if (!result.ok) return toast({ kind: 'error', title: t('settings.importFailed', { reason: result.path ?? result.code }) })
                toast({ kind: 'success', title: t('settings.imported') })
                // Restart so every in-memory state (language, theme, stores) follows the restored data.
                window.setTimeout(() => window.location.replace(import.meta.env.BASE_URL), 600)
              }}
            >
              {t('settings.importConfirm')}
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
        title={t('settings.deleteTitle')}
        description={t('settings.deleteBody', { word: t('settings.deleteWord') })}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={deleteWord.trim().toLocaleUpperCase(i18n.language) !== t('settings.deleteWord')}
              onClick={async () => {
                await wipeAllData()
                window.location.replace(import.meta.env.BASE_URL)
              }}
            >
              {t('settings.deleteConfirm')}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="sr-only">{t('settings.deleteWord')}</span>
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
