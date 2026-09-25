import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import type { ThemePreference } from '@/db/types'
import type { Lang } from '@/domain/types'
import { updateAppSettings } from '@/services/settings'
import { useAppSettings } from '@/stores/settings'

export default function Settings() {
  const { t } = useTranslation()
  const app = useAppSettings()
  return (
    <>
      <PageHeader rubric={t('settings.rubric')} title={t('settings.title')} />
      <Card className="space-y-6">
        <Segmented<Lang>
          label={t('settings.language')}
          value={app.uiLang}
          options={[
            { value: 'pl', label: 'Polski' },
            { value: 'en', label: 'English' },
          ]}
          onChange={(uiLang) => void updateAppSettings({ uiLang })}
        />
        <Segmented<ThemePreference>
          label={t('settings.theme')}
          value={app.theme}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
          onChange={(theme) => void updateAppSettings({ theme })}
        />
      </Card>
    </>
  )
}
