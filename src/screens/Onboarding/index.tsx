import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { TeleoMark } from '@/components/Ornaments'
import { Button } from '@/components/ui/Button'
import { updateAppSettings } from '@/services/settings'

export default function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <TeleoMark className="mb-6 size-16 text-primary" />
      <p className="rubric">{t('onboarding.rubric')}</p>
      <h1 className="mt-2 text-4xl font-semibold">{t('onboarding.title')}</h1>
      <Button
        size="lg"
        className="mt-10"
        onClick={async () => {
          await updateAppSettings({ onboardingCompleted: true })
          navigate('/', { replace: true })
        }}
      >
        {t('onboarding.start')}
      </Button>
    </main>
  )
}
