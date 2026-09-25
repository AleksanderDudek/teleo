import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'

export default function Progress() {
  const { t } = useTranslation()
  return <PageHeader rubric={t('progress.rubric')} title={t('progress.title')} />
}
