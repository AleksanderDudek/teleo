import { useTranslation } from 'react-i18next'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'
import type { CharacterId } from '@/domain/types'
import { ShareButton } from './ShareButton'
import { formatShare, shareText, type DayShare } from './shareText'

/** "Share today": the day's minutes, sentences, streak and points. */
export function ShareDayButton({ day, character, className }: { day: DayShare; character: CharacterId; className?: string }) {
  const { t, i18n } = useTranslation()
  const seed = Number(day.dayKey.replaceAll('-', '')) || 0
  const date = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(day.dayKey))
  return (
    <ShareButton
      className={className}
      label={t('share.button')}
      character={character}
      payload={{
        text: shareText(day, t, i18n.language, seed),
        fileName: t('share.fileName'),
        card: {
          rubric: date,
          title: t('share.cardTitle'),
          stats: [
            { value: String(day.minutes), label: t('share.cardMinutes') },
            { value: String(day.sentences), label: t('share.cardSentences') },
            { value: String(day.streak), label: t('share.cardStreak') },
            { value: new Intl.NumberFormat(i18n.language).format(day.points), label: t('share.cardPoints') },
          ],
          note: day.bibleShare ? `${formatShare(day.bibleShare, i18n.language)} ${t('share.cardBible')}` : undefined,
        },
      }}
    />
  )
}
