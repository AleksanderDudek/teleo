import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'

export default function Today() {
  const { t } = useTranslation()
  return <PageHeader rubric={t('today.rubric')} title={t('today.title')} />
}
