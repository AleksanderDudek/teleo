import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Toasts } from '@/components/ui/Toasts'
import { useSettingsStore } from '@/stores/settings'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

/** Top-level route element: onboarding gate, toasts, update prompt, scroll restoration. */
export function Root() {
  const onboarded = useSettingsStore((s) => s.app.onboardingCompleted)
  const { pathname } = useLocation()

  if (!onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />

  return (
    <>
      <Outlet />
      <Toasts />
      <PwaUpdatePrompt />
      <ScrollRestoration />
    </>
  )
}
