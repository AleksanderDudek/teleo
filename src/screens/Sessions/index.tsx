import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'

export default function Sessions() {
  const { t } = useTranslation()
  return <PageHeader rubric={t('sessions.rubric')} title={t('sessions.title')} />
}
