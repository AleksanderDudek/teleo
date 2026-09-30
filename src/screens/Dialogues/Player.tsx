import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker, useNavigate } from 'react-router'
import { Avatar } from '@/components/brand/Avatar'
import { Icon } from '@/components/icons/Icon'
import { DiffLegend, DiffView } from '@/components/speech/DiffView'
import { HowWeCount } from '@/components/speech/HowWeCount'
import { MicButton } from '@/components/speech/MicButton'
import { resultMessage } from '@/components/speech/resultMessage'
import { SpeechPrivacyDialog } from '@/components/speech/SpeechPrivacyDialog'
import { pointsToSpeechSettings } from '@/components/speech/speechErrors'
import { SpeechSettingsLink } from '@/components/speech/SpeechSettingsLink'
import { isIosStandalone } from '@/components/speech/vendor'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ProgressBar } from '@/components/ui/Progress'
import { dialogueOfText } from '@/content/dialogues'
import { historyEnd, linkPairs, nativeLang, parseGloss, turnAt, userLines, type Dialogue, type Gloss } from '@/domain/dialogue'
import { buildDiff, coverageNeeded, evaluate, type DiffPart, type MatchResult } from '@/domain/matcher'
import type { SpeechResult } from '@/domain/speech/SpeechEngine'
import { SPEECH_LANG, type EngineId, type Lang } from '@/domain/types'
import { useOnline } from '@/hooks/useOnline'
import { useSpaceKey } from '@/hooks/useSpaceKey'
import { useSpeechEngine } from '@/hooks/useSpeechEngine'
import { useTapCapture } from '@/hooks/useTapCapture'
import { useWakeLock } from '@/hooks/useWakeLock'
import { cn } from '@/lib/cn'
import { playChime, unlockAudio } from '@/lib/sound'
import { speak, stopSpeaking, ttsSupported } from '@/lib/tts'
import { celebrationLines } from '@/screens/SessionPlayer/celebrate'
import { useLiveSession, type LiveSentence } from '@/screens/SessionPlayer/useLiveSession'
import type { PlayerData } from '@/screens/SessionPlayer/usePlayerData'
import { finishRun, pauseRun, PracticeError, recordAttempt, skipEntry } from '@/services/practice'
import { updateAppSettings } from '@/services/settings'
import { useAppSettings } from '@/stores/settings'
import { GlossText } from './GlossText'
import { RoleLegend, WordList } from './RoleLegend'

const SKIP_AFTER_FAILS = 3
/** The partner "types" for a moment before each line, as in a messenger. */
const TYPING_MS = 750

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
/** Without a voice: time to read the partner's line (about three words a second, at least 1.5 s). */
const readingPause = (text: string) => Math.max(1500, text.split(/\s+/).length * 330)
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** The chat player for a run whose text is a language dialogue (dispatched from `/play/:runId`). */
export default function DialoguePlayer({ data }: { data: PlayerData }) {
  const { t } = useTranslation()
  const found = dialogueOfText(data.run.textId)
  if (!found) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-xl">{t('player.notFound')}</p>
        <ButtonLink to="/">{t('errors.home')}</ButtonLink>
      </main>
    )
  }
  return <Chat data={data} dialogue={found.dialogue} target={found.lang} />
}

interface Feedback {
  entryIndex: number
  result: MatchResult
  diff: DiffPart[]
  message: string
}

/** Where the conversation is: the partner's lines of this turn appear one by one, then it is the user's turn. */
interface Stage {
  turn: number
  /** Opening lines of this turn already on screen. */
  revealed: number
  typing: boolean
  step: 'bot' | 'you' | 'end'
}

interface LineGlosses {
  target: Gloss
  native: Gloss
}

function Chat({ data, dialogue, target }: { data: PlayerData; dialogue: Dialogue; target: Lang }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const app = useAppSettings()
  const native = nativeLang(target, app.uiLang)
  const { run, segments } = data
  const total = run.plan.length
  const completed = run.status === 'completed'
  const turn = Math.min(run.cursor, total)
  const mine = useMemo(() => userLines(dialogue), [dialogue])
  const glosses: LineGlosses[] = useMemo(
    () => dialogue.lines.map((line) => ({ target: parseGloss(line.text[target]), native: parseGloss(line.text[native]) })),
    [dialogue, target, native],
  )
  const currentLine = turn < total ? mine[turn] : undefined
  const planEntry = turn < total ? run.plan[turn] : undefined
  // Checked against the stored sentence: the script's line, unless an app update changed the script since.
  const source = (planEntry && segments.get(planEntry.segmentId)?.content) || (currentLine !== undefined ? glosses[currentLine]!.target.plain : '')
  // The coverage ladder: each failed try of this line lowers what the next one needs (90 → 80 → 70 %).
  const failed = turn < total ? (run.entries[turn]?.attempts ?? 0) : 0
  const needed = coverageNeeded(failed)
  const partner = t(`characters.${dialogue.partner}`)

  // "The language model follows the language being learnt": recogniser, matcher and voice all use `target`.
  const engineState = useSpeechEngine(SPEECH_LANG[target])
  const engine = engineState.status === 'ready' ? engineState.engine : null
  const online = useOnline()
  const offlineWarning = !online && engine?.id === 'webspeech' && engineState.status === 'ready' && !engineState.onDevice
  const live = app.handsFree && engine?.id === 'webspeech'

  const [stage, setStage] = useState<Stage>({ turn: -1, revealed: 0, typing: false, step: 'bot' })
  const view: Stage = stage.turn === turn ? stage : { turn, revealed: 0, typing: false, step: 'bot' }
  const yourTurn = view.step === 'you' && !completed && currentLine !== undefined
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [gains, setGains] = useState<Record<number, number>>({})
  const [unlockLines, setUnlockLines] = useState<string[]>([])
  const [active, setActive] = useState<{ line: number; ids: readonly string[] } | null>(null)
  const [wordsOpen, setWordsOpen] = useState<ReadonlySet<number>>(() => new Set())
  const [speakingLine, setSpeakingLine] = useState<number | null>(null)
  const [askPrivacy, setAskPrivacy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const allowLeave = useRef(false)
  const finishing = useRef(false)
  const timers = useRef<number[]>([])
  useWakeLock(!completed)

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    await finishRun(run.id)
    allowLeave.current = true
    navigate(`/play/${run.id}/summary`, { replace: true })
  }, [navigate, run.id])

  /** Stores a verdict on the user's line `entryIndex`. */
  const record = async (entryIndex: number, result: MatchResult, durationMs: number, engineId: EngineId) => {
    const outcome = await recordAttempt({ runId: run.id, entryIndex, evaluation: result, engine: engineId, durationMs })
    const lines = celebrationLines(outcome, t)
    if (lines.length > 0) {
      setUnlockLines(lines)
      later(() => setUnlockLines((current) => (current === lines ? [] : current)), 4500)
    }
    if (result.accepted) {
      navigator.vibrate?.(35)
      setFeedback(null)
      setGains((current) => ({ ...current, [entryIndex]: outcome.xpGained }))
      if (app.sounds) playChime(outcome.goalReached || outcome.levelUp ? 'goal' : outcome.textCompleted ? 'text' : 'sentence', 0)
      return
    }
    setFeedback({ entryIndex, result, diff: buildDiff(source, target, result), message: resultMessage(result, t) })
  }

  // --- live mode: one recognition per turn, the line accepted the moment every word needed was heard ------
  const liveTarget: LiveSentence | null = live && yourTurn && source ? { entryIndex: turn, source, lang: target, threshold: needed } : null
  const liveSession = useLiveSession({
    engine: live ? engine : null,
    target: liveTarget,
    onVerdict: async (entryIndex, result, durationMs) => {
      // The partner answers next: the microphone must never hear the synthetic voice.
      if (result.accepted) liveSession.stop()
      await record(entryIndex, result, durationMs, 'webspeech')
    },
  })

  // --- tap mode (Whisper, or hands-free off): one utterance per tap -------------------------------------------
  const onTapResult = async (speech: SpeechResult) => {
    if (!yourTurn || !source) return
    const result = evaluate(source, speech.alternatives, { lang: target, threshold: needed })
    if (result.reason === 'empty') {
      // Nothing was heard: say so, but it is not an attempt (DECISIONS #53).
      setFeedback({ entryIndex: turn, result, diff: buildDiff(source, target, result), message: resultMessage(result, t) })
      return
    }
    setBusy(true)
    try {
      await record(turn, result, speech.durationMs, speech.engine)
    } finally {
      setBusy(false)
    }
  }
  const capture = useTapCapture({ engine: live ? null : engine, lang: SPEECH_LANG[target], onResult: (speech) => void onTapResult(speech) })

  const listening = live ? liveSession.phase === 'listening' : capture.phase === 'listening'
  const starting = live ? liveSession.phase === 'starting' : capture.phase === 'starting'
  const checking = !live && capture.phase === 'stopping'
  const speechError = live ? liveSession.error : capture.error
  const covered = live && listening && yourTurn ? liveSession.progress?.covered : undefined

  /** Reads a line aloud with the microphone paused (it would hear the voice), then listens again if asked. */
  /** Bumped by every stop (leaving, a hidden page, the partner's turn, unmount): a read-aloud then never reopens the mic. */
  const hearing = useRef(0)
  const hear = async (index: number, thenListen = false) => {
    if (speakingLine !== null) return
    const generation = ++hearing.current
    const wasListening = live ? liveSession.phase !== 'idle' : capture.phase === 'listening'
    liveSession.stop()
    capture.cancel()
    setSpeakingLine(index)
    await speak(glosses[index]!.target.plain, SPEECH_LANG[target])
    setSpeakingLine((current) => (current === index ? null : current))
    if (generation !== hearing.current) return
    if ((thenListen || wasListening) && latest.current.yourTurn) latest.current.listen()
  }
  useEffect(() => {
    const generations = hearing
    return () => {
      generations.current++
    }
  }, [])

  // Fresh closures for effects and async continuations.
  const latest = useRef({ yourTurn, speaking: speakingLine !== null, hear, listen: () => {}, stop: () => {} })
  useLayoutEffect(() => {
    latest.current = {
      yourTurn,
      speaking: speakingLine !== null,
      hear,
      listen: () => {
        // Never open the microphone for a page in the background (a line read aloud may end there).
        if (document.visibilityState === 'hidden') return
        if (live) void liveSession.start()
        else void capture.start()
      },
      stop: () => {
        hearing.current++
        liveSession.stop()
        capture.cancel()
      },
    }
  })

  // --- the partner's lines: typing dots, the line, read aloud in the language being learnt --------------------
  useEffect(() => {
    if (completed) return
    let cancelled = false
    const alive = () => !cancelled
    const { opening } = turnAt(dialogue, turn)
    latest.current.stop()
    void (async () => {
      for (let i = 0; i < opening.length; i++) {
        const index = opening[i]!
        setStage({ turn, revealed: i, typing: true, step: 'bot' })
        await wait(TYPING_MS)
        if (!alive()) return
        setStage({ turn, revealed: i + 1, typing: false, step: 'bot' })
        const text = parseGloss(dialogue.lines[index]!.text[target]).plain
        setSpeakingLine(index)
        if (ttsSupported()) await speak(text, SPEECH_LANG[target])
        else await wait(readingPause(text))
        if (!alive()) return
        setSpeakingLine(null)
      }
      setStage({ turn, revealed: opening.length, typing: false, step: turn >= total ? 'end' : 'you' })
    })()
    return () => {
      cancelled = true
      stopSpeaking()
      setSpeakingLine(null)
    }
  }, [turn, completed, dialogue, target, total])

  // The last line of the partner has been said: on to the summary.
  useEffect(() => {
    if (view.step === 'end' && !completed) {
      const id = window.setTimeout(() => void finish(), 700)
      return () => window.clearTimeout(id)
    }
  }, [view.step, completed, finish])

  // --- the user's turn: "listen first" (a setting) and hands-free listening --------------------------------
  const prepared = useRef(-1)
  const autoListened = useRef(-1)
  useEffect(() => {
    if (!yourTurn || currentLine === undefined) return
    const canListen = app.handsFree && !!engine && app.speechPrivacyAcknowledged && autoListened.current !== turn
    if (app.listenFirst && ttsSupported() && prepared.current !== turn) {
      prepared.current = turn
      if (canListen) autoListened.current = turn
      void latest.current.hear(currentLine, canListen)
      return
    }
    if (canListen && !latest.current.speaking) {
      autoListened.current = turn
      latest.current.listen()
    }
  }, [yourTurn, turn, currentLine, engine, app.handsFree, app.speechPrivacyAcknowledged, app.listenFirst])

  // Keep the newest message in view: to the very end, where the sticky footer has its own room (a message
  // scrolled only to the viewport's edge would sit under the microphone).
  const shownKey = `${turn}:${view.revealed}:${view.typing}:${yourTurn}:${feedback ? feedback.result.coverage : ''}`
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [shownKey])

  const toggleMic = () => {
    if (busy || !yourTurn || speakingLine !== null) return
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
      if (document.visibilityState === 'hidden') latest.current.stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const hasProgress = run.entries.some((entry) => entry.status !== 'pending' || entry.attempts > 0)
  const blocker = useBlocker(
    ({ nextLocation }) => hasProgress && !allowLeave.current && !completed && !nextLocation.pathname.endsWith('/summary'),
  )
  const leaveDialogOpen = leaving || blocker.state === 'blocked'
  const stay = () => {
    setLeaving(false)
    if (blocker.state === 'blocked') blocker.reset()
  }
  const leave = async () => {
    latest.current.stop()
    stopSpeaking()
    await pauseRun(run.id)
    allowLeave.current = true
    setLeaving(false)
    if (blocker.state === 'blocked') blocker.proceed()
    else navigate('/dialogues', { replace: true })
  }

  const skip = async () => {
    if (live) liveSession.discard()
    else capture.cancel()
    try {
      await skipEntry(run.id, turn)
      setFeedback(null)
    } catch (error) {
      // An accepted verdict for this line landed first: nothing left to skip.
      if (!(error instanceof PracticeError && error.code === 'outOfOrder')) throw error
    }
  }

  const switchMode = async () => {
    latest.current.stop()
    setFeedback(null)
    await updateAppSettings({ handsFree: !app.handsFree })
  }

  // --- what is on screen -------------------------------------------------------------------------------
  const shown: number[] = []
  const end = completed ? dialogue.lines.length : historyEnd(dialogue, turn)
  for (let i = 0; i < end; i++) shown.push(i)
  if (!completed) {
    shown.push(...turnAt(dialogue, turn).opening.slice(0, view.revealed))
    if (yourTurn && currentLine !== undefined) shown.push(currentLine)
  }
  const done = run.entries.filter((entry) => entry.status !== 'pending').length
  const visibleFeedback = feedback && feedback.entryIndex === turn && yourTurn && !(listening && !live) ? feedback : null
  const nextTry = visibleFeedback && !visibleFeedback.result.accepted && needed < visibleFeedback.result.threshold ? Math.round(needed * 100) : null

  const status = completed
    ? t('dialogues.finished')
    : !yourTurn
      ? view.step === 'end'
        ? t('dialogues.finished')
        : t('dialogues.partnerSpeaking', { name: partner })
      : speakingLine !== null
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
                : t('player.tapToSpeak')

  const toggleWords = (index: number) =>
    setWordsOpen((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  const tools = (index: number, extra?: ReactNode) => {
    const pairs = linkPairs(glosses[index]!.target, glosses[index]!.native)
    const open = wordsOpen.has(index)
    return (
      <>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {ttsSupported() && (
            <button
              type="button"
              onClick={() => void hear(index)}
              disabled={speakingLine !== null || (view.step === 'bot' && !completed)}
              aria-label={t('dialogues.listenLine')}
              title={t('dialogues.listenLine')}
              className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunk hover:text-ink disabled:opacity-40"
            >
              <Icon name="speaker-high" size={18} className={cn(speakingLine === index && 'text-gold-ink animate-pulse')} />
            </button>
          )}
          {pairs.length > 0 && (
            <button
              type="button"
              onClick={() => toggleWords(index)}
              aria-expanded={open}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-sunk hover:text-ink"
            >
              <Icon name="translate" size={16} />
              {t('dialogues.words')}
            </button>
          )}
          {extra}
        </div>
        {open && <WordList pairs={pairs} from={target} to={native} className="mt-2 border-t border-line pt-2" />}
      </>
    )
  }

  const bubble = (index: number) => {
    const line = dialogue.lines[index]!
    const gloss = glosses[index]!
    const lit = active?.line === index ? active.ids : undefined
    const point = (ids: readonly string[] | null) => setActive(ids ? { line: index, ids } : null)

    if (line.who === 'bot') {
      return (
        <li key={index} className="flex items-end gap-2 animate-rise">
          <Avatar id={dialogue.partner} size={36} decorative className="mb-1" />
          <div className="bubble bubble-bot max-w-[85%] px-4 pt-3 pb-1.5">
            <span className="sr-only">{partner}: </span>
            <GlossText gloss={gloss.target} lang={target} active={lit} onPoint={point} className="font-serif text-xl leading-snug text-ink" />
            <GlossText gloss={gloss.native} lang={native} active={lit} onPoint={point} className="mt-1 text-sm text-ink-soft" />
            {tools(index)}
          </div>
        </li>
      )
    }

    const k = mine.indexOf(index)
    const entry = run.entries[k]
    const current = !completed && k === turn && yourTurn
    const say = line.say?.[target]
    const statusChip = current ? null : entry?.status === 'skipped' ? (
      <span className="ml-auto text-xs font-semibold text-ink-faint">{t('dialogues.skipped')}</span>
    ) : (
      <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-ok">
        <Icon name="check" size={14} tone="plain" fillOpacity={0.3} />
        {t('dialogues.said')}
        {gains[k] ? <span className="text-gold-ink tabular">+{gains[k]} XP</span> : null}
      </span>
    )
    return (
      <li key={index} className="flex flex-col items-end gap-1.5 animate-rise">
        {current && <p className="rubric pr-2">{t('dialogues.yourTurn')}</p>}
        <div className={cn('bubble bubble-you max-w-[92%] px-4 pt-3 pb-1.5', current && 'bubble-current')}>
          <span className="sr-only">{t('dialogues.you')}: </span>
          <GlossText
            gloss={gloss.target}
            lang={target}
            active={lit}
            onPoint={point}
            covered={current ? covered : undefined}
            testId={current ? 'segment-text' : undefined}
            className={cn('font-serif leading-snug text-ink', current ? 'text-2xl' : 'text-xl')}
          />
          {current && say && (
            <p className="mt-2 flex items-start gap-1.5 text-ink-soft">
              <Icon name="ear" size={16} className="mt-1 shrink-0 text-gold-ink" />
              <span>
                <span className="sr-only">{t('dialogues.pronunciation')}: </span>
                <span lang={native} className="italic">
                  {say}
                </span>
              </span>
            </p>
          )}
          <GlossText gloss={gloss.native} lang={native} active={lit} onPoint={point} className="mt-1.5 text-sm text-ink-soft" />
          {tools(index, statusChip)}
        </div>
        {current && visibleFeedback && (
          <div className="card card-framed mt-1 w-full max-w-[92%] space-y-3 p-4 text-left animate-rise">
            <p className="font-semibold text-bad">{visibleFeedback.message}</p>
            <DiffView parts={visibleFeedback.diff} className="text-lg" />
            {nextTry !== null && (
              <p className="flex items-center gap-2 text-sm font-medium text-gold-ink">
                <Icon name="sparkle" size={16} />
                {t('player.nextTry', { percent: nextTry })}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DiffLegend />
              <HowWeCount />
            </div>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <IconButton label={t('player.close')} icon="x" onClick={() => (hasProgress && !completed ? setLeaving(true) : void leave())} />
          <Avatar id={dialogue.partner} size={40} decorative />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg font-semibold">{run.title}</p>
            <p className="truncate text-xs text-ink-soft">
              <span lang={target} className="italic">
                {dialogue.title[target]}
              </span>{' '}
              · {partner}
            </p>
          </div>
          <div className="text-right">
            <p className="tabular text-sm font-semibold text-ink">
              {Math.min(done + (completed ? 0 : 1), total)}/{total}
            </p>
            <p className="tabular text-xs font-semibold text-gold-ink">{t('player.xp', { xp: run.xpEarned })}</p>
          </div>
        </div>
        <div className="mx-auto mt-2 flex max-w-2xl items-center gap-3">
          <ProgressBar className="flex-1" value={done} max={total} label={t('dialogues.progress', { current: Math.min(done + 1, total), total })} />
          {engine?.id === 'webspeech' && (
            <button
              type="button"
              role="switch"
              aria-checked={app.handsFree}
              onClick={() => void switchMode()}
              title={app.handsFree ? t('player.liveOn') : t('player.liveOff')}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                app.handsFree ? 'border-ok/40 bg-ok-soft text-ok' : 'border-line bg-surface text-ink-soft',
              )}
            >
              <Icon name="radiance" size={14} />
              {t('player.liveMode')}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Avatar id={dialogue.partner} size={64} decorative />
          <p className="rubric">{t('dialogues.level', { level: dialogue.level })}</p>
          <p className="max-w-sm text-sm text-ink-soft">{dialogue.scene[native]}</p>
          <RoleLegend className="mt-2" />
        </div>

        <ol role="log" aria-live="polite" aria-relevant="additions" aria-label={t('dialogues.chat', { name: partner })} className="space-y-4">
          {shown.map(bubble)}
          {view.typing && !completed && (
            <li className="flex items-end gap-2">
              <Avatar id={dialogue.partner} size={36} decorative className="mb-1" />
              <div role="status" aria-label={t('dialogues.typing', { name: partner })} className="bubble bubble-bot flex gap-1.5 px-4 py-4">
                <span className="typing-dot" />
                <span className="typing-dot [animation-delay:0.15s]" />
                <span className="typing-dot [animation-delay:0.3s]" />
              </div>
            </li>
          )}
        </ol>

        <div aria-live="polite" className="mt-4 space-y-3">
          {unlockLines.map((line) => (
            <p key={line} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-gold-ink animate-fade">
              <Icon name="crown-jewel" size={16} />
              {line}
            </p>
          ))}
          {offlineWarning && (
            <p role="status" className="rounded-xl bg-near-soft px-4 py-3 text-near">
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
        {completed ? (
          <ButtonLink to={`/play/${run.id}/summary`} replace size="lg" icon="seal-check">
            {t('dialogues.toSummary')}
          </ButtonLink>
        ) : (
          <>
            {!live && listening && capture.transcript && (
              <p lang={target} className="line-clamp-2 max-w-xl text-center font-serif text-ink-soft italic">
                {capture.transcript}
              </p>
            )}
            <div className="flex items-center gap-5">
              {ttsSupported() && yourTurn && currentLine !== undefined ? (
                <IconButton outlined label={t('dialogues.listenLine')} icon="speaker-high" onClick={() => void hear(currentLine)} disabled={speakingLine !== null} />
              ) : (
                <span className="size-12" />
              )}
              <MicButton listening={listening} busy={busy || starting || checking} disabled={!engine || !yourTurn || speakingLine !== null} onClick={toggleMic} />
              <span className="size-12" />
            </div>
            <p className="min-h-5 text-center text-sm font-medium text-ink-soft">{status}</p>
            {failed >= SKIP_AFTER_FAILS && yourTurn && (live || !listening) && (
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => void skip()}>
                  {t('dialogues.skip')}
                </Button>
                <p className="text-xs text-ink-faint">{t('player.skipHint')}</p>
              </div>
            )}
          </>
        )}
      </footer>

      <SpeechPrivacyDialog
        open={askPrivacy}
        onDevice={engineState.status === 'ready' && engineState.onDevice}
        onClose={() => setAskPrivacy(false)}
        onAccept={async () => {
          setAskPrivacy(false)
          await updateAppSettings({ speechPrivacyAcknowledged: true })
          latest.current.listen()
        }}
      />
      <Dialog
        open={leaveDialogOpen}
        onClose={stay}
        guide="rest"
        title={t('dialogues.leaveTitle')}
        description={t('dialogues.leaveBody')}
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
