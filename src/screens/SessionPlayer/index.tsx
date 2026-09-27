import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker, useNavigate, useParams } from 'react-router'
import { GuideBubble } from '@/components/brand/GuideBubble'
import { Icon } from '@/components/icons/Icon'
import { DiffLegend, DiffView } from '@/components/speech/DiffView'
import { HowWeCount } from '@/components/speech/HowWeCount'
import { MicButton } from '@/components/speech/MicButton'
import { guardianLine, resultMessage } from '@/components/speech/resultMessage'
import { SpeechPrivacyDialog } from '@/components/speech/SpeechPrivacyDialog'
import { pointsToSpeechSettings } from '@/components/speech/speechErrors'
import { SpeechSettingsLink } from '@/components/speech/SpeechSettingsLink'
import { isIosStandalone } from '@/components/speech/vendor'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ProgressBar } from '@/components/ui/Progress'
import { goldenMultiplier } from '@/domain/gamification'
import { buildDiff, evaluate, type DiffPart, type MatchResult } from '@/domain/matcher'
import { firstTryCombo } from '@/domain/session'
import type { SpeechResult } from '@/domain/speech/SpeechEngine'
import { SPEECH_LANG, type EngineId } from '@/domain/types'
import { useOnline } from '@/hooks/useOnline'
import { useSpaceKey } from '@/hooks/useSpaceKey'
import { useSpeechEngine } from '@/hooks/useSpeechEngine'
import { useTapCapture } from '@/hooks/useTapCapture'
import { useWakeLock } from '@/hooks/useWakeLock'
import { cn } from '@/lib/cn'
import { playChime, unlockAudio } from '@/lib/sound'
import { speak, stopSpeaking, ttsSupported } from '@/lib/tts'
import { finishRun, markHinted, pauseRun, PracticeError, recordAttempt, skipEntry } from '@/services/practice'
import { updateAppSettings } from '@/services/settings'
import { useAppSettings } from '@/stores/settings'
import { celebrationLines } from './celebrate'
import { repetitionLabel } from './repetition'
import { SegmentStage } from './SegmentStage'
import { useLiveSession, type LiveSentence } from './useLiveSession'
import { usePlayerData, type PlayerData } from './usePlayerData'

const AUTO_LISTEN_DELAY_MS = 600
const SKIP_AFTER_FAILS = 3

export default function SessionPlayer() {
  const { runId } = useParams()
  const dayStartHour = useAppSettings().dayStartHour
  const data = usePlayerData(runId, dayStartHour)
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
  entryIndex: number
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
  const finished = run.cursor >= total || run.status === 'completed'
  const index = Math.min(run.cursor, total - 1)
  const planEntry = run.plan[index]!
  const segment = segments.get(planEntry.segmentId)
  const text = texts.get(planEntry.textId)
  const lang = text?.lang ?? app.uiLang

  const engineState = useSpeechEngine(SPEECH_LANG[lang])
  const engine = engineState.status === 'ready' ? engineState.engine : null
  const online = useOnline()
  const offlineWarning = !online && engine?.id === 'webspeech' && engineState.status === 'ready' && !engineState.onDevice
  // Live mode needs a streaming recogniser (Web Speech); others fall back to tap + auto-listen.
  const live = app.handsFree && engine?.id === 'webspeech'

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [praiseKey, setPraiseKey] = useState(0)
  const [gain, setGain] = useState<{ xp: number; golden: boolean; combo: number } | undefined>(undefined)
  const [unlockLines, setUnlockLines] = useState<string[]>([])
  const [askPrivacy, setAskPrivacy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [hint, setHint] = useState(false)
  const allowLeave = useRef(false)
  const finishing = useRef(false)
  const timers = useRef<number[]>([])
  useWakeLock(!finished)

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    // The summary lists everything unlocked in this run (and the level-up), so no toasts here.
    await finishRun(run.id)
    allowLeave.current = true
    navigate(`/play/${run.id}/summary`, { replace: true })
  }, [navigate, run.id])

  /** Stores a verdict; returns whether the session just reached its end. */
  const record = async (entryIndex: number, result: MatchResult, durationMs: number, engineId: EngineId): Promise<boolean> => {
    const outcome = await recordAttempt({ runId: run.id, entryIndex, evaluation: result, engine: engineId, durationMs })
    const lines = celebrationLines(outcome, t)
    if (lines.length > 0) {
      setUnlockLines(lines)
      later(() => setUnlockLines((current) => (current === lines ? [] : current)), 4500)
    }
    if (result.accepted) {
      navigator.vibrate?.(35)
      setFeedback(null)
      const combo = firstTryCombo(outcome.run.entries, entryIndex)
      setGain({ xp: outcome.xpGained, golden: outcome.golden > 1, combo })
      if (app.sounds) playChime(outcome.goalReached || outcome.levelUp ? 'goal' : outcome.textCompleted ? 'text' : 'sentence', Math.max(0, combo - 1))
      setPraiseKey((k) => k + 1)
      return outcome.run.cursor >= total
    }
    const source = segments.get(run.plan[entryIndex]!.segmentId)?.content ?? ''
    const entryLang = texts.get(run.plan[entryIndex]!.textId)?.lang ?? lang
    setFeedback({ entryIndex, result, diff: buildDiff(source, entryLang, result), message: resultMessage(result, t) })
    return false
  }

  // --- live mode --------------------------------------------------------------
  const liveTarget: LiveSentence | null = live && !finished && segment ? { entryIndex: index, source: segment.content, lang } : null
  const liveSession = useLiveSession({
    engine: live ? engine : null,
    strictness: app.strictness,
    target: liveTarget,
    onVerdict: async (entryIndex, result, durationMs) => {
      const ended = await record(entryIndex, result, durationMs, 'webspeech')
      if (ended) {
        liveSession.stop()
        await finish()
      }
    },
  })

  // --- tap mode ---------------------------------------------------------------
  const onTapResult = async (speech: SpeechResult) => {
    if (!segment) return
    const result = evaluate(segment.content, speech.alternatives, { lang, strictness: app.strictness })
    if (result.reason === 'empty') {
      // Nothing was heard (accidental tap, microphone muted): tell the user, but it is not an attempt.
      setFeedback({ entryIndex: index, result, diff: buildDiff(segment.content, lang, result), message: resultMessage(result, t) })
      return
    }
    setBusy(true)
    try {
      const ended = await record(index, result, speech.durationMs, speech.engine)
      if (ended) await finish()
      else if (result.accepted && app.handsFree && !app.listenFirst) later(() => void capture.start(), AUTO_LISTEN_DELAY_MS)
    } finally {
      setBusy(false)
    }
  }
  const capture = useTapCapture({ engine: live ? null : engine, lang: SPEECH_LANG[lang], onResult: (speech) => void onTapResult(speech) })

  const listening = live ? liveSession.phase === 'listening' : capture.phase === 'listening'
  const starting = live ? liveSession.phase === 'starting' : capture.phase === 'starting'
  // Tap mode after the utterance: the engine is turning speech into text (Whisper takes seconds).
  const checking = !live && capture.phase === 'stopping'
  const speechError = live ? liveSession.error : capture.error

  const stopAll = () => {
    stopSpeaking()
    liveSession.stop()
    capture.cancel()
  }

  // --- listen first (spec §7.3) -------------------------------------------------
  /** Reads the current sentence aloud with the microphone paused, so it can't hear itself. */
  const readAloud = async (auto: boolean) => {
    if (!segment || speaking) return
    const resumeLive = live && liveSession.phase !== 'idle'
    const resumeTap = !live && (capture.phase === 'listening' || (auto && app.handsFree && praiseKey > 0))
    liveSession.stop()
    capture.cancel()
    setSpeaking(true)
    await speak(segment.content, SPEECH_LANG[lang])
    setSpeaking(false)
    if (resumeLive) void liveSession.start()
    else if (resumeTap) void capture.start()
  }
  const readAloudRef = useRef(readAloud)
  useLayoutEffect(() => {
    readAloudRef.current = readAloud
  })
  const spokenIndex = useRef(-1)
  useEffect(() => {
    if (!app.listenFirst || finished || spokenIndex.current === index) return
    spokenIndex.current = index
    void readAloudRef.current(true)
  }, [app.listenFirst, finished, index])
  useEffect(() => () => stopSpeaking(), [])

  // --- memory mode --------------------------------------------------------------
  const memoryLevel = run.mode === 'memory' ? run.memoryLevel : undefined
  const showHint = (on: boolean) => {
    setHint(on)
    if (on && !run.entries[index]?.hinted) void markHinted(run.id, index)
  }

  const toggleMic = () => {
    if (busy || finished || speaking) return
    unlockAudio()
    const idle = live ? liveSession.phase === 'idle' : capture.phase === 'idle'
    if (idle && !app.speechPrivacyAcknowledged) return setAskPrivacy(true)
    if (live) {
      if (idle) void liveSession.start()
      else liveSession.stop()
      return
    }
    if (idle) setFeedback(null)
    capture.toggle()
  }

  useSpaceKey(toggleMic)

  // Never keep the microphone open in the background.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        liveSession.stop()
        capture.cancel()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [liveSession, capture])

  // Only a run with progress is worth a "pause this session?" question; an untouched one just closes.
  const hasProgress = run.entries.some((entry) => entry.status !== 'pending' || entry.attempts > 0)
  const blocker = useBlocker(
    ({ nextLocation }) => hasProgress && !allowLeave.current && !finished && !nextLocation.pathname.endsWith('/summary'),
  )
  const leaveDialogOpen = leaving || blocker.state === 'blocked'
  const stay = () => {
    setLeaving(false)
    if (blocker.state === 'blocked') blocker.reset()
  }

  const leave = async () => {
    stopAll()
    await pauseRun(run.id)
    allowLeave.current = true
    setLeaving(false)
    if (blocker.state === 'blocked') blocker.proceed()
    else navigate('/', { replace: true })
  }

  const skip = async () => {
    if (live) liveSession.discard()
    else capture.cancel()
    try {
      const next = await skipEntry(run.id, index)
      setFeedback(null)
      if (next.cursor >= total) {
        stopAll()
        await finish()
      }
    } catch (error) {
      // An accepted verdict for this sentence landed first: nothing left to skip.
      if (!(error instanceof PracticeError && error.code === 'outOfOrder')) throw error
    }
  }

  const switchMode = async () => {
    stopAll()
    setFeedback(null)
    await updateAppSettings({ handsFree: !app.handsFree })
  }

  const failed = run.entries[index]?.attempts ?? 0
  const previousEntry = index > 0 ? run.plan[index - 1] : undefined
  const previous = previousEntry ? segments.get(previousEntry.segmentId)?.content : undefined
  const next = index + 1 < total ? segments.get(run.plan[index + 1]!.segmentId)?.content : undefined
  const repetition = repetitionLabel(run.plan, index, (id) => texts.get(id)?.title ?? '')
  const done = run.entries.filter((e) => e.status !== 'pending').length
  const covered = live && listening ? liveSession.progress?.covered : undefined
  const memoryBadge = memoryLevel ? t('memory.badge', { level: t(`memory.levels.${memoryLevel}.name`) }) : null
  const visibleFeedback = feedback && feedback.entryIndex === index && !(listening && !live) ? feedback : null
  const encouragement = visibleFeedback ? guardianLine(visibleFeedback.result, failed, t) : null
  const golden = goldenMultiplier(data.readingMsToday) > 1

  const status = speaking
    ? t('player.listening')
    : checking
    ? t('speech.checking')
    : starting
    ? t('speech.starting')
    : listening
      ? live
        ? t('player.listeningLive')
        : t('speech.listening')
      : visibleFeedback
        ? t('player.retry')
        : live && praiseKey > 0
          ? t('player.pausedLive')
          : t('player.tapToSpeak')

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <IconButton label={t('player.close')} icon="x" onClick={() => (hasProgress ? setLeaving(true) : void leave())} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg font-semibold">{run.title}</p>
            <ProgressBar className="mt-1" value={done} max={total} label={t('player.progress', { current: Math.min(done + 1, total), total })} />
          </div>
          <div className="text-right">
            <p className="tabular text-sm font-semibold text-ink">
              {Math.min(done + 1, total)}/{total}
            </p>
            <p className="tabular flex items-center justify-end gap-1 text-xs font-semibold text-gold-ink">
              {golden && (
                <span title={t('golden.badgeTitle')} className="rounded-full bg-gold-soft px-1.5 font-bold shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent)]">
                  {t('golden.badge')}
                </span>
              )}
              {t('player.xp', { xp: run.xpEarned })}
            </p>
          </div>
        </div>
        {(engine?.id === 'webspeech' || memoryBadge) && (
          <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gold-ink">{memoryBadge}</span>
            {engine?.id === 'webspeech' && (
            <button
              type="button"
              role="switch"
              aria-checked={app.handsFree}
              onClick={() => void switchMode()}
              title={app.handsFree ? t('player.liveOn') : t('player.liveOff')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                app.handsFree ? 'border-ok/40 bg-ok-soft text-ok' : 'border-line bg-surface text-ink-soft',
              )}
            >
              <Icon name="radiance" size={14} />
              {t('player.liveMode')}
            </button>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-6">
        {!segment && !finished && (
          <div className="card flex max-w-xl flex-col items-center gap-3 p-5 text-center">
            <p className="text-ink-soft">{t('player.segmentMissing')}</p>
            <Button variant="secondary" onClick={() => void skip()}>
              {t('player.skip')}
            </Button>
          </div>
        )}
        {segment && (
          <SegmentStage
            previous={previous}
            previousDone={!!previousEntry && run.entries[index - 1]?.status === 'accepted'}
            current={segment.content}
            next={next}
            covered={covered}
            praiseKey={praiseKey}
            unlockLines={unlockLines}
            repetition={repetition}
            memoryLevel={memoryLevel}
            reveal={hint}
            gain={gain}
          />
        )}

        <div aria-live="polite" className="mt-6 w-full max-w-xl">
          <p key={praiseKey} className="sr-only">
            {praiseKey > 0 ? [t('player.great'), ...unlockLines].join('. ') : ''}
          </p>
          {encouragement && (
            <GuideBubble mood="encourage" size={80} compact className="mb-3 animate-rise">
              {encouragement}
            </GuideBubble>
          )}
          {visibleFeedback && (
            <div className="card card-framed space-y-3 p-4 text-left animate-rise">
              <p className="font-semibold text-bad">{visibleFeedback.message}</p>
              <DiffView parts={visibleFeedback.diff} className="text-lg" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DiffLegend />
                <HowWeCount />
              </div>
            </div>
          )}
          {offlineWarning && (
            <p role="status" className="mb-3 rounded-xl bg-near-soft px-4 py-3 text-near">
              {t('speech.offline')}
            </p>
          )}
          {speechError && (
            <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">
              {t(`speech.errors.${speechError}`)} {isIosStandalone() && t('speech.errors.iosStandalone')}
              {pointsToSpeechSettings(speechError) && <SpeechSettingsLink />}
            </p>
          )}
          {engineState.status === 'unsupported' && (
            <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">
              {t(`speech.errors.${engineState.reason}`)}
              <SpeechSettingsLink />
            </p>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-paper via-paper/95 to-transparent px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {!live && listening && capture.transcript && (
          <p className="line-clamp-2 max-w-xl text-center font-serif text-ink-soft italic">{capture.transcript}</p>
        )}
        <div className="flex items-center gap-5">
          {ttsSupported() && segment ? (
            <IconButton outlined label={t('player.listen')} icon="bell" onClick={() => void readAloud(false)} disabled={speaking || finished} />
          ) : (
            <span className="size-12" />
          )}
          <MicButton listening={listening} busy={busy || starting || checking} disabled={!engine || finished || speaking} onClick={toggleMic} />
          {memoryLevel ? (
            <button
              type="button"
              aria-label={t('memory.hint')}
              title={t('memory.hint')}
              onPointerDown={() => showHint(true)}
              onPointerUp={() => setHint(false)}
              onPointerLeave={() => setHint(false)}
              onPointerCancel={() => setHint(false)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                showHint(true)
                later(() => setHint(false), 2500)
              }}
              className={cn('inline-flex size-12 touch-none items-center justify-center rounded-full border border-line bg-surface text-ink-soft select-none', hint && 'border-gold text-gold-ink')}
            >
              <Icon name="eye-almond" size={20} />
            </button>
          ) : (
            <span className="size-12" />
          )}
        </div>
        <p className="h-5 text-sm font-medium text-ink-soft">{status}</p>
        {memoryLevel && <p className="max-w-sm text-center text-xs text-ink-faint">{t('memory.hintNote')}</p>}
        {failed >= SKIP_AFTER_FAILS && (live || !listening) && (
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
          if (live) void liveSession.start()
          else void capture.start()
        }}
      />
      <Dialog
        open={leaveDialogOpen}
        onClose={stay}
        guide="rest"
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
