import type { ComponentType } from 'react'
import { createHashRouter, type RouteObject } from 'react-router'
import { NotFound, RouteError } from './RouteError'
import { Root } from './Root'
import { TabsLayout } from './TabsLayout'
import type { RouteHandle } from './tabs'

/** Route modules are code-split; each screen folder default-exports its component. */
const screen = (load: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
})

/** Editing forms: no tab bar or support window on phones (see TabsLayout). */
const FORM: RouteHandle = { form: true }

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
          { path: 'library/new', handle: FORM, ...screen(() => import('@/screens/TextEditor')) },
          { path: 'library/:textId', ...screen(() => import('@/screens/TextDetail')) },
          { path: 'library/:textId/edit', handle: FORM, ...screen(() => import('@/screens/TextEditor')) },
          { path: 'sessions', ...screen(() => import('@/screens/Sessions')) },
          { path: 'sessions/new', handle: FORM, ...screen(() => import('@/screens/SessionBuilder')) },
          { path: 'sessions/:templateId/edit', handle: FORM, ...screen(() => import('@/screens/SessionBuilder')) },
          { path: 'tasks', ...screen(() => import('@/screens/Tasks')) },
          { path: 'tasks/new', handle: FORM, ...screen(() => import('@/screens/Tasks/TaskEditor')) },
          { path: 'tasks/:taskId/edit', handle: FORM, ...screen(() => import('@/screens/Tasks/TaskEditor')) },
          { path: 'progress', ...screen(() => import('@/screens/Progress')) },
          { path: 'bible', ...screen(() => import('@/screens/Bible')) },
          { path: 'bible/:translation/:book', ...screen(() => import('@/screens/Bible/Book')) },
          { path: 'settings', ...screen(() => import('@/screens/Settings')) },
          { path: 'settings/mic-test', ...screen(() => import('@/screens/MicTest')) },
          { path: 'settings/data', ...screen(() => import('@/screens/Data')) },
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
