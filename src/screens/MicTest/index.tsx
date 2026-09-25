import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'

export default function MicTest() {
  const { t } = useTranslation()
  return <PageHeader backTo="/settings" rubric={t('micTest.rubric')} title={t('micTest.title')} />
}
