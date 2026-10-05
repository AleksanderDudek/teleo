import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Guardian } from '@/components/brand/Guardian'
import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'
import { useAppSettings } from '@/stores/settings'
import { supportUrl, tipOfTheDay } from './links'

/**
 * The support window at the end of a screen: the Guardian in a night-lapis stained-glass arch, his word
 * for today (worth reading on its own, different tomorrow), then the coffee. Fixed pigments, so it reads
 * as the same painted panel in both themes.
 */
export function SupportBanner({ dayKey, className }: { dayKey: string; className?: string }) {
  const { t } = useTranslation()
  const { uiLang } = useAppSettings()
  const titleId = useId()
  return (
    <aside aria-labelledby={titleId} className={cn('support-window relative overflow-hidden rounded-arch px-6 pt-7 pb-6 sm:px-8', className)}>
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-7 sm:text-left">
        <Guardian mood="encourage" size={148} decorative className="shrink-0 drop-shadow-[0_10px_18px_rgb(0_0_0/0.35)]" />
        <div className="min-w-0 flex-1">
          <p className="rubric">{`${t('support.rubric')} · ${t('guardian.name')}`}</p>
          <p className="mt-1.5 font-serif text-[1.1rem] leading-snug text-(--window-ivory) italic">{t(tipOfTheDay(dayKey))}</p>
          <div aria-hidden className="my-4 h-px bg-[linear-gradient(90deg,transparent,var(--window-gold)_20%,var(--window-gold)_80%,transparent)] opacity-60" />
          <h2 id={titleId} className="text-2xl font-semibold text-(--window-ivory)">
            {t('support.bannerTitle')}
          </h2>
          <p className="mt-1 text-sm text-(--window-ivory-soft)">{t('support.line')}</p>
        </div>
      </div>
      <a
        href={supportUrl(uiLang)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('support.buttonLabel')}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-(--window-gold) text-lg font-semibold text-(--window-gold-ink) shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35),0_12px_24px_-14px_rgb(0_0_0/0.8)] transition-[filter,transform] select-none hover:brightness-105 active:scale-[0.98]"
      >
        <Icon name="coffee" size={22} tone="plain" />
        {t('support.button')}
      </a>
      <p className="mt-2 text-center text-xs text-(--window-ivory-soft)">{t('support.note')}</p>
    </aside>
  )
}
