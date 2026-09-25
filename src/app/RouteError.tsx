import { isRouteErrorResponse, useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/components/ui/Button'
import { Sprig } from '@/components/Ornaments'

export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  if (!notFound) console.error('[teleo] route error', error)
  return <ErrorScreen title={notFound ? t('errors.notFound') : t('errors.title')} body={notFound ? undefined : t('errors.body')} />
}

export function NotFound() {
  const { t } = useTranslation()
  return <ErrorScreen title={t('errors.notFound')} />
}

function ErrorScreen({ title, body }: { title: string; body?: string }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Sprig className="mb-6 h-12 w-20 text-gold" />
      <h1 className="text-3xl font-semibold">{title}</h1>
      {body && <p className="mt-3 text-ink-soft">{body}</p>}
      <ButtonLink to="/" className="mt-8">
        {t('errors.home')}
      </ButtonLink>
    </main>
  )
}
