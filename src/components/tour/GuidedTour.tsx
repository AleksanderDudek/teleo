import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { Icon, type IconName } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { shouldOfferTour, TOUR_NEED, TOUR_VERSION, tourLibraryPath, tourSteps, type TourStep } from '@/domain/tour/tour'
import { updateMeta } from '@/services/settings'
import { firstTextForNeed } from '@/services/tour'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { TourOverlay } from './TourOverlay'

const BULLETS: ReadonlyArray<{ icon: IconName; key: 'bulletStart' | 'bulletFind' | 'bulletKeep' }> = [
  { icon: 'play', key: 'bulletStart' },
  { icon: 'magnifying-glass', key: 'bulletFind' },
  { icon: 'list-checks', key: 'bulletKeep' },
]

/**
 * The guided tour's host (DECISIONS #127), mounted in the tab layout so it survives the tour's navigations.
 * After the setup it invites once (per tour version) on Today; Settings can ask for it again. Taking it, declining
 * it and closing it all count as seen.
 */
export function GuidedTour() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const onboardingCompleted = useSettingsStore((s) => s.app.onboardingCompleted)
  const uiLang = useSettingsStore((s) => s.app.uiLang)
  const tourVersion = useSettingsStore((s) => s.meta.tourVersion)
  const requested = useUiStore((s) => s.tourRequested)
  const clearRequest = useUiStore((s) => s.clearTourRequest)
  const [run, setRun] = useState<{ steps: TourStep[]; textId?: string } | null>(null)
  // Taken or declined in this visit: no invitation even before the saved version reaches the store.
  const [dismissed, setDismissed] = useState(false)
  const [starting, setStarting] = useState(false)

  const markSeen = useCallback(() => void updateMeta({ tourVersion: TOUR_VERSION }), [])

  /** The story's text decides which steps run (none for it: the text steps are left out). */
  const load = useCallback(
    () =>
      firstTextForNeed(TOUR_NEED, uiLang).then((textId) => {
        setRun({ steps: tourSteps({ hasText: textId !== undefined }), textId })
        setStarting(false)
      }),
    [uiLang],
  )
  const start = () => {
    setStarting(true)
    void load()
  }

  // Settings → "Show me around": straight into the tour, no invitation.
  useEffect(() => {
    if (!requested || pathname !== '/') return
    clearRequest()
    void load()
  }, [requested, pathname, clearRequest, load])

  const inviting = !run && !starting && !requested && !dismissed && shouldOfferTour({ onboardingCompleted, tourVersion, pathname })

  const onStepEnter = useCallback(
    (step: TourStep) => {
      const { action } = step
      // Replacing: the tour walks through screens without filling the history the back button walks.
      if (action.kind === 'navigate') navigate(action.to, { replace: true })
      else if (action.kind === 'openText' && run?.textId) {
        // The text's back arrow returns to the filtered library the tour came from.
        navigate(`/library/${encodeURIComponent(run.textId)}`, { replace: true, state: { backTo: tourLibraryPath() } })
      }
    },
    [navigate, run],
  )

  const finish = useCallback(() => {
    setRun(null)
    setDismissed(true)
    markSeen()
  }, [markSeen])

  return (
    <>
      <Dialog
        open={inviting}
        onClose={() => {
          // Closing is "not now": the invitation does not come back on every visit.
          setDismissed(true)
          markSeen()
        }}
        guide="welcome"
        title={t('tour.invite.title')}
        description={t('tour.invite.body')}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDismissed(true)
                markSeen()
              }}
            >
              {t('tour.invite.later')}
            </Button>
            <Button icon="play" iconFill onClick={start}>
              {t('tour.invite.start')}
            </Button>
          </>
        }
      >
        <ul className="mt-4 space-y-3">
          {BULLETS.map(({ icon, key }) => (
            <li key={key} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-ink">
                <Icon name={icon} size={18} />
              </span>
              <span className="pt-1.5 text-ink">{t(`tour.invite.${key}`)}</span>
            </li>
          ))}
        </ul>
      </Dialog>
      {run && <TourOverlay steps={run.steps} onStepEnter={onStepEnter} onFinish={finish} />}
    </>
  )
}
