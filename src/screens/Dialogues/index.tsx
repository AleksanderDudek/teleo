import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Icon, type IconName } from '@/components/icons/Icon'
import { Card } from '@/components/ui/Card'
import { IconHalo } from '@/components/ui/IconHalo'
import { PageHeader } from '@/components/ui/PageHeader'
import { DIALOGUES, dialogueTextId } from '@/content/dialogues'
import { db } from '@/db/schema'
import { learningLang, userLines } from '@/domain/dialogue'
import { startDialogue } from '@/services/dialogues'
import { useAppSettings } from '@/stores/settings'
import { toast } from '@/stores/ui'
import { RoleLegend } from './RoleLegend'

/** Language dialogues (owner request 2026-09-30): short scripted conversations in the language being learnt. */
export default function Dialogues() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { uiLang } = useAppSettings()
  const target = learningLang(uiLang)
  const [starting, setStarting] = useState<string | null>(null)
  const repetitions = useLiveQuery(async () => {
    const stats = await db.textStats.bulkGet(DIALOGUES.map((d) => dialogueTextId(d.key, target)))
    return new Map(DIALOGUES.map((d, i) => [d.key, stats[i]?.repetitions ?? 0]))
  }, [target])

  const begin = async (key: string) => {
    setStarting(key)
    try {
      const run = await startDialogue(key)
      navigate(`/play/${run.id}`)
    } catch {
      toast({ kind: 'error', title: t('dialogues.startError') })
      setStarting(null)
    }
  }

  return (
    <>
      <PageHeader backTo="/library" rubric={t('dialogues.rubric')} title={t(`dialogues.titleIn.${target}`)} subtitle={t('dialogues.lead')} />

      <Card className="mt-2 space-y-3 p-4">
        <RoleLegend />
        <div className="gilt-rule" />
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Icon name="ear" size={18} className="mt-0.5 shrink-0 text-gold-ink" />
          <span>
            <span className="font-semibold text-ink">{t('dialogues.howToReadTitle')}</span> {t('dialogues.howToRead')}
          </span>
        </p>
      </Card>

      <ul className="mt-6 space-y-3">
        {DIALOGUES.map((dialogue, index) => {
          const done = repetitions?.get(dialogue.key) ?? 0
          return (
            <li key={dialogue.key} className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
              <button
                type="button"
                disabled={starting !== null}
                onClick={() => void begin(dialogue.key)}
                className="card card-lift flex w-full items-center gap-4 p-4 text-left disabled:opacity-70"
              >
                <IconHalo icon={dialogue.icon as IconName} size={48} iconSize={24} tone={done > 0 ? 'gold' : 'sunk'} />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-xl font-semibold">{dialogue.title[uiLang]}</span>
                  <span lang={target} className="block font-serif text-ink-soft italic">
                    {dialogue.title[target]}
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">{dialogue.scene[uiLang]}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs font-semibold text-ink-faint">
                    <span>{t('dialogues.level', { level: dialogue.level })}</span>
                    <span>{t('dialogues.lines', { count: userLines(dialogue).length })}</span>
                    {done > 0 && (
                      <span className="inline-flex items-center gap-1 text-gold-ink">
                        <Icon name="check-circle" size={14} />
                        {t('dialogues.done', { count: done })}
                      </span>
                    )}
                  </span>
                </span>
                <Icon name="caret-right" size={20} className="shrink-0 text-ink-faint" />
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
