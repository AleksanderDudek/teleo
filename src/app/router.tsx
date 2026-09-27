import type { ComponentType } from 'react'
import { createHashRouter, type RouteObject } from 'react-router'
import { NotFound, RouteError } from './RouteError'
import { Root } from './Root'
import { TabsLayout } from './TabsLayout'

/** Route modules are code-split; each screen folder default-exports its component. */
const screen = (load: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
})

export const routes: RouteObject[] = [
  {
    element: <Root />,
    errorElement: <RouteError />,
    // Shown while the first lazy screen loads: the same splash as index.html.
    hydrateFallbackElement: (
      <div className="boot" aria-hidden>
        <span>TELEO</span>
      </div>
    ),
    children: [
      {
        element: <TabsLayout />,
        children: [
          { index: true, ...screen(() => import('@/screens/Today')) },
          { path: 'library', ...screen(() => import('@/screens/Library')) },
          { path: 'library/new', ...screen(() => import('@/screens/TextEditor')) },
          { path: 'library/:textId', ...screen(() => import('@/screens/TextDetail')) },
          { path: 'library/:textId/edit', ...screen(() => import('@/screens/TextEditor')) },
          { path: 'sessions', ...screen(() => import('@/screens/Sessions')) },
          { path: 'sessions/new', ...screen(() => import('@/screens/SessionBuilder')) },
          { path: 'sessions/:templateId/edit', ...screen(() => import('@/screens/SessionBuilder')) },
          { path: 'progress', ...screen(() => import('@/screens/Progress')) },
          { path: 'settings', ...screen(() => import('@/screens/Settings')) },
          { path: 'settings/mic-test', ...screen(() => import('@/screens/MicTest')) },
        ],
      },
      { path: 'play/:runId', ...screen(() => import('@/screens/SessionPlayer')) },
      { path: 'play/:runId/summary', ...screen(() => import('@/screens/SessionSummary')) },
      { path: 'onboarding', ...screen(() => import('@/screens/Onboarding')) },
      { path: 'friend', ...screen(() => import('@/screens/Friend')) },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const createAppRouter = () => createHashRouter(routes)
