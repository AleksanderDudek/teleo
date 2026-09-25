import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'

export default function SessionPlayer() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-2xl px-5">
      <PageHeader backTo="/" rubric={t('player.rubric')} title="—" />
    </main>
  )
}
