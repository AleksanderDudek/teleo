import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useUiStore } from '@/stores/ui'

/**
 * Service-worker lifecycle → toasts. Updates are never applied automatically:
 * reloading in the middle of a session would interrupt a prayer (DECISIONS #8).
 */
export function PwaUpdatePrompt() {
  const { t } = useTranslation()
  const pushToast = useUiStore((s) => s.pushToast)
  const shown = useRef({ refresh: false, offline: false })
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error: unknown) => console.warn('[teleo] service worker registration failed', error),
  })

  useEffect(() => {
    if (!needRefresh || shown.current.refresh) return
    shown.current.refresh = true
    pushToast({
      kind: 'info',
      title: t('pwa.updateAvailable'),
      timeoutMs: null,
      action: { label: t('pwa.reload'), run: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, pushToast, t, updateServiceWorker])

  useEffect(() => {
    if (!offlineReady || shown.current.offline) return
    shown.current.offline = true
    pushToast({ kind: 'success', title: t('pwa.offlineReady') })
  }, [offlineReady, pushToast, t])

  return null
}
