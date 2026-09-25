import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'

export default function TextDetail() {
  const { t } = useTranslation()
  return <PageHeader backTo="/library" rubric={t('textDetail.rubric')} title="—" />
}
