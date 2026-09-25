import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'

export default function Library() {
  const { t } = useTranslation()
  return <PageHeader rubric={t('library.rubric')} title={t('library.title')} />
}
