import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'

export default function SessionBuilder() {
  const { t } = useTranslation()
  const { templateId } = useParams()
  return <PageHeader backTo="/sessions" rubric={templateId ? t('builder.rubricEdit') : t('builder.rubricNew')} title="—" />
}
