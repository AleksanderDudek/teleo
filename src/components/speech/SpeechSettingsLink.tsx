import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '@/components/icons/Icon'

/** Link to the speech section of Settings, shown next to "no engine" errors (e.g. in Firefox). */
export function SpeechSettingsLink() {
  const { t } = useTranslation()
  return (
    <Link to="/settings?section=speech" className="mt-2 flex w-fit items-center gap-1.5 font-semibold underline underline-offset-4">
      <Icon name="sliders-halo" size={16} />
      {t('speech.openSettings')}
    </Link>
  )
}
