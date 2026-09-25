import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker, useNavigate, useParams } from 'react-router'
import { DiffLegend, DiffView } from '@/components/speech/DiffView'
import { HowWeCount } from '@/components/speech/HowWeCount'
import { MicButton } from '@/components/speech/MicButton'
import { resultMessage } from '@/components/speech/resultMessage'
import { SpeechPrivacyDialog } from '@/components/speech/SpeechPrivacyDialog'
import { isIosStandalone } from '@/components/speech/vendor'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ProgressBar } from '@/components/ui/Progress'
import { buildDiff, evaluate, type DiffPart, type MatchResult } from '@/domain/matcher'
import type { SpeechResult } from '@/domain/speech/SpeechEngine'
import { SPEECH_LANG } from '@/domain/types'
import { useSpeechEngine } from '@/hooks/useSpeechEngine'
import { useTapCapture } from '@/hooks/useTapCapture'
import { useWakeLock } from '@/hooks/useWakeLock'
import { cn } from '@/lib/cn'
import { finishRun, pauseRun, recordAttempt, skipEntry } from '@/services/practice'
import { updateAppSettings } from '@/services/settings'
import { useAppSettings } from '@/stores/settings'
import { celebrate } from './celebrate'
import { SegmentStage } from './SegmentStage'
import { usePlayerData, type PlayerData } from './usePlayerData'
import { repetitionLabel } from './repetition'

const CELEBRATION_MS = 900
const AUTO_LISTEN_DELAY_MS = 600
const SKIP_AFTER_FAILS = 3

export default function SessionPlayer() {
  const { runId } = useParams()
  const data = usePlayerData(runId)
  const { t } = useTranslation()
  if (data === undefined) return null
  if (data === null || data.run.plan.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-xl">{t('player.notFound')}</p>
        <ButtonLink to="/">{t('errors.home')}</ButtonLink>
      </main>
    )
  }
  return <Player data={data} />
}

interface Feedback {
  result: MatchResult
  diff: DiffPart[]
  message: string
}

function Player({ data }: { data: PlayerData }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const app = useAppSettings()
  const { run, segments, texts } = data
  const total = run.plan.length
  const index = Math.min(run.cursor, total - 1)
  const planEntry = run.plan[index]!
  const segment = segments.get(planEntry.segmentId)
  const text = texts.get(planEntry.textId)
  const lang = text?.lang ?? app.uiLang
  const finished = run.cursor >= total || run.status === 'completed'

  const engineState = useSpeechEngine(SPEECH_LANG[lang])
  const engine = engineState.status === 'ready' ? engineState.engine : null
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [askPrivacy, setAskPrivacy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const allowLeave = useRef(false)
  const timers = useRef<number[]>([])
  useWakeLock(!finished)

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const finish = useCallback(async () => {
    // The summary lists everything unlocked in this run (and the level-up), so no toasts here.
    await finishRun(run.id)
    allowLeave.current = true
    navigate(`/play/${run.id}/summary`, { replace: true })
  }, [navigate, run.id])

  const handleResult = async (speech: SpeechResult) => {
    if (!segment) return
    const result = evaluate(segment.content, speech.alternatives, { lang, strictness: app.strictness })
    setBusy(true)
    try {
      const outcome = await recordAttempt({ runId: run.id, entryIndex: index, evaluation: result, engine: speech.engine, durationMs: speech.durationMs })
      celebrate(outcome, t, (id) => texts.get(id)?.title)
      if (result.accepted) {
        navigator.vibrate?.(35)
        setFeedback(null)
        setCelebrating(true)
        later(() => {
          setCelebrating(false)
          if (outcome.run.cursor >= total) void finish()
          else if (app.handsFree) later(() => void capture.start(), AUTO_LISTEN_DELAY_MS)
        }, CELEBRATION_MS)
      } else {
        setFeedback({ result, diff: buildDiff(segment.content, lang, result), message: resultMessage(result, t) })
      }
    } finally {
      setBusy(false)
    }
  }

  const capture = useTapCapture({ engine, lang: SPEECH_LANG[lang], onResult: (speech) => void handleResult(speech) })
  const listening = capture.phase === 'listening'

  const toggleMic = () => {
    if (busy || celebrating || finished) return
    if (capture.phase === 'idle' && !app.speechPrivacyAcknowledged) return setAskPrivacy(true)
    if (capture.phase === 'idle') setFeedback(null)
    capture.toggle()
  }

  // Space toggles the microphone (spec §11 accessibility).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, button, dialog')) return
      event.preventDefault()
      toggleMic()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Never keep the microphone open in the background.
  useEffect(() => {
    const onVisibility = () => document.visibilityState === 'hidden' && capture.cancel()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [capture])

  const blocker = useBlocker(({ nextLocation }) => !allowLeave.current && !finished && !nextLocation.pathname.endsWith('/summary'))
  const leaveDialogOpen = leaving || blocker.state === 'blocked'
  const stay = () => {
    setLeaving(false)
    if (blocker.state === 'blocked') blocker.reset()
  }

  const leave = async () => {
    capture.cancel()
    await pauseRun(run.id)
    allowLeave.current = true
    setLeaving(false)
    if (blocker.state === 'blocked') blocker.proceed()
    else navigate('/', { replace: true })
  }

  const skip = async () => {
    capture.cancel()
    const next = await skipEntry(run.id, index)
    setFeedback(null)
    if (next.cursor >= total) void finish()
  }

  const failed = run.entries[index]?.attempts ?? 0
  const previous = index > 0 ? segments.get(run.plan[index - 1]!.segmentId)?.content : undefined
  const next = index + 1 < total ? segments.get(run.plan[index + 1]!.segmentId)?.content : undefined
  const repetition = repetitionLabel(run.plan, index, (id) => texts.get(id)?.title ?? '')
  const done = run.entries.filter((e) => e.status !== 'pending').length

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <IconButton label={t('player.close')} onClick={() => setLeaving(true)}>
            <X aria-hidden className="size-5" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg font-semibold">{run.title}</p>
            <ProgressBar className="mt-1" value={done} max={total} label={t('player.progress', { current: Math.min(done + 1, total), total })} />
          </div>
          <div className="text-right">
            <p className="tabular text-sm font-semibold text-ink">
              {Math.min(done + 1, total)}/{total}
            </p>
            <p className="tabular text-xs font-semibold text-gold-ink">{t('player.xp', { xp: run.xpEarned })}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-8">
        {segment && (
          <SegmentStage previous={previous} current={segment.content} next={next} celebrating={celebrating} repetition={repetition} />
        )}

        <div aria-live="polite" className="mt-6 w-full max-w-xl">
          {celebrating && <p className="sr-only">{t('player.great')}</p>}
          {feedback && !listening && (
            <div className="card space-y-3 p-4 text-left animate-rise">
              <p className="font-semibold text-bad">{feedback.message}</p>
              <DiffView parts={feedback.diff} className="text-lg" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DiffLegend />
                <HowWeCount />
              </div>
            </div>
          )}
          {capture.error && (
            <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">
              {t(`speech.errors.${capture.error}`)} {isIosStandalone() && t('speech.errors.iosStandalone')}
            </p>
          )}
          {engineState.status === 'unsupported' && (
            <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">
              {t('speech.errors.not-supported')}
            </p>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-paper via-paper/95 to-transparent px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {listening && capture.transcript && (
          <p className="line-clamp-2 max-w-xl text-center font-serif text-ink-soft italic">{capture.transcript}</p>
        )}
        <MicButton listening={listening} busy={busy || capture.phase === 'starting' || capture.phase === 'stopping'} disabled={!engine || celebrating || finished} onClick={toggleMic} />
        <p className={cn('h-5 text-sm font-medium text-ink-soft')}>
          {capture.phase === 'starting' ? t('speech.starting') : listening ? t('speech.listening') : feedback ? t('player.retry') : t('player.tapToSpeak')}
        </p>
        {failed >= SKIP_AFTER_FAILS && !listening && (
          <div className="flex flex-col items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => void skip()}>
              {t('player.skip')}
            </Button>
            <p className="text-xs text-ink-faint">{t('player.skipHint')}</p>
          </div>
        )}
      </footer>

      <SpeechPrivacyDialog
        open={askPrivacy}
        onDevice={engineState.status === 'ready' && engineState.onDevice}
        onClose={() => setAskPrivacy(false)}
        onAccept={async () => {
          setAskPrivacy(false)
          await updateAppSettings({ speechPrivacyAcknowledged: true })
          void capture.start()
        }}
      />
      <Dialog
        open={leaveDialogOpen}
        onClose={stay}
        title={t('player.leaveTitle')}
        description={t('player.leaveBody')}
        actions={
          <>
            <Button variant="ghost" onClick={stay}>
              {t('player.stay')}
            </Button>
            <Button onClick={() => void leave()}>{t('player.leaveConfirm')}</Button>
          </>
        }
      />
    </div>
  )
}
