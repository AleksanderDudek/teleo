import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { useAppSettings } from '@/stores/settings'
import { supportUrl } from './links'

/**
 * The support ribbon: a thin band under the status bar on every screen outside a session. Always there,
 * never in the way — one line, one tap, no animation, nothing to dismiss.
 */
export function SupportStrip() {
  const { t } = useTranslation()
  const { uiLang } = useAppSettings()
  return (
    <div className="support-strip sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <a
        href={supportUrl(uiLang)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('support.buttonLabel')}
        className="mx-auto flex h-(--strip-h) max-w-2xl items-center justify-center gap-2 px-4 text-[0.8rem] font-semibold text-gold-ink select-none"
      >
        <Icon name="coffee" size={16} />
        <span className="truncate">{t('support.strip')}</span>
        <Icon name="caret-right" size={12} className="shrink-0 opacity-70" />
      </a>
    </div>
  )
}
