import { useTranslation } from 'react-i18next'
import { formatShare } from '@/components/share/shareText'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IconHalo } from '@/components/ui/IconHalo'
import { useBibleShare } from './useBible'

/** Today: the Bible challenge — where you are, one tap to the next reading. */
export function BibleCard({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const share = useBibleShare()
  return (
    <Card className={className}>
      <div className="flex items-start gap-4">
        <IconHalo icon="gospel" size={44} iconSize={22} />
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-semibold">{t('bible.open')}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {share === undefined ? t('bible.todayStart') : t('bible.todayBody', { percent: formatShare(share, i18n.language) })}
          </p>
          <ButtonLink to="/bible" size="sm" variant="secondary" icon="play" className="mt-3">
            {t('bible.readNext')}
          </ButtonLink>
        </div>
      </div>
    </Card>
  )
}
