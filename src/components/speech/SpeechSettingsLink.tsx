import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/** Link to the speech section of Settings, shown next to "no engine" errors (e.g. in Firefox). */
export function SpeechSettingsLink() {
  const { t } = useTranslation()
  return (
    <Link to="/settings?section=speech" className="mt-2 flex w-fit items-center gap-1.5 font-semibold underline underline-offset-4">
      <SlidersHorizontal aria-hidden className="size-4" />
      {t('speech.openSettings')}
    </Link>
  )
}
