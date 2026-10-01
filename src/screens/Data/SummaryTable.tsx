import { useTranslation } from 'react-i18next'
import type { BackupSummary } from '@/domain/backup'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'

const ROWS = ['sentences', 'activeDays', 'xp', 'lastActiveDay', 'ownTexts', 'achievements', 'bibleReadings'] as const

/** A backup's contents (or the data kept for undo), next to this device's when there is anything to compare with. */
export function SummaryTable({ file, device, fileLabel }: { file: BackupSummary; device?: BackupSummary; fileLabel?: string }) {
  const { t, i18n } = useTranslation()
  const number = new Intl.NumberFormat(i18n.language)
  const value = (summary: BackupSummary, row: (typeof ROWS)[number]) => {
    if (row !== 'lastActiveDay') return number.format(summary[row])
    return summary.lastActiveDay
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(dayKeyToLocalDate(summary.lastActiveDay))
      : '—'
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs tracking-wide text-ink-soft uppercase">
          <th scope="col" className="py-1.5 font-semibold">
            <span className="sr-only">{t('data.what')}</span>
          </th>
          <th scope="col" className="py-1.5 text-right font-semibold">
            {fileLabel ?? t('data.inBackup')}
          </th>
          {device && (
            <th scope="col" className="py-1.5 pl-3 text-right font-semibold">
              {t('data.onDevice')}
            </th>
          )}
        </tr>
      </thead>
      <tbody className="tabular">
        {ROWS.map((row) => (
          <tr key={row} className="border-t border-line">
            <th scope="row" className="py-1.5 text-left font-medium text-ink-soft">
              {t(`data.stats.${row}`)}
            </th>
            <td className="py-1.5 text-right font-semibold text-ink">{value(file, row)}</td>
            {device && <td className="py-1.5 pl-3 text-right text-ink-soft">{value(device, row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
