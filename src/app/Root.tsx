import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Toasts } from '@/components/ui/Toasts'
import { useSettingsStore } from '@/stores/settings'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

/** Routes a first-time visitor may open before onboarding (an invitation link must not be lost). */
const OPEN_BEFORE_ONBOARDING = new Set(['/onboarding', '/friend'])

/** Top-level route element: onboarding gate, toasts, update prompt, scroll restoration. */
export function Root() {
  const onboarded = useSettingsStore((s) => s.app.onboardingCompleted)
  const { pathname } = useLocation()

  if (!onboarded && !OPEN_BEFORE_ONBOARDING.has(pathname)) return <Navigate to="/onboarding" replace />

  return (
    <>
      <Outlet />
      <Toasts />
      <PwaUpdatePrompt />
      <ScrollRestoration />
    </>
  )
}
