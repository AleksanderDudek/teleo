import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

interface PageHeaderProps {
  rubric?: string
  title: string
  subtitle?: ReactNode
  backTo?: string
  actions?: ReactNode
}

/** Screen title block: gilded rubric, serif title, optional back link and actions. */
export function PageHeader({ rubric, title, subtitle, backTo, actions }: PageHeaderProps) {
  const { t } = useTranslation()
  return (
    <header className="mb-6 pt-6">
      {backTo && (
        <Link
          to={backTo}
          className="-ml-2 mb-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t('common.back')}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {rubric && <p className="rubric mb-1.5">{rubric}</p>}
          <h1 className="text-[2.1rem] leading-[1.05] font-semibold text-ink">{title}</h1>
          {subtitle && <div className="mt-2 text-ink-soft">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
