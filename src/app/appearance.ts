import type { AppSettings, ThemePreference } from '@/db/types'
import { i18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'

const THEME_COLOR = { light: '#f4ecda', dark: '#0d1128' } as const

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') return prefersDark() ? 'dark' : 'light'
  return preference
}

function applyAppearance(app: Pick<AppSettings, 'theme' | 'fontSize'>) {
  const theme = resolveTheme(app.theme)
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.font = app.fontSize
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLOR[theme]
  }
}

/**
 * Keeps <html> in sync with preferences: `.dark` class, segment font size,
 * browser theme colour and the i18next language. Lives outside React so the
 * first render already has the right theme.
 */
export function startAppearanceSync(): () => void {
  let current = useSettingsStore.getState().app
  applyAppearance(current)

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = () => applyAppearance(useSettingsStore.getState().app)
  media.addEventListener('change', onSystemChange)

  const unsubscribe = useSettingsStore.subscribe((state) => {
    const next = state.app
    if (next.theme !== current.theme || next.fontSize !== current.fontSize) applyAppearance(next)
    if (next.uiLang !== current.uiLang) void i18n.changeLanguage(next.uiLang)
    current = next
  })

  return () => {
    media.removeEventListener('change', onSystemChange)
    unsubscribe()
  }
}
