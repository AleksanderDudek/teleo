import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'

export default function TextEditor() {
  const { t } = useTranslation()
  const { textId } = useParams()
  return <PageHeader backTo="/library" rubric={textId ? t('editor.rubricEdit') : t('editor.rubricNew')} title="—" />
}
