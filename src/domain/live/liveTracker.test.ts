import { describe, expect, it } from 'vitest'
import { createLiveTracker, type LiveEvent, type LiveTarget } from './liveTracker'

const S1 = 'Jestem spokojny i pewny siebie.'
const S2 = 'Idę dalej z odwagą.'
const S3 = 'Dziękuję za ten dzień.'
const TWENTY =
  'Każdego dnia rano wstaję wcześnie, dziękuję za nowy dzień i spokojnie planuję wszystkie ważne sprawy, które czekają na mnie dzisiaj.'

const accepted = (events: LiveEvent[]) => events.filter((e) => e.type === 'accepted').map((e) => e.entryIndex)

/** Streams `text` word by word (as interim results), moving to the next target after each accept. */
function stream(targets: LiveTarget[], text: string, lang: 'pl' | 'en' = 'pl') {
  const tracker = createLiveTracker({ lang, strictness: 'strict' })
  const events: LiveEvent[] = []
  let next = 0
  events.push(...tracker.setTarget(targets[next++] ?? null))
  const words = text.split(' ')
  for (let i = 1; i <= words.length; i++) {
    for (const event of tracker.update(words.slice(0, i).join(' '))) {
      events.push(event)
      if (event.type === 'accepted') events.push(...tracker.setTarget(targets[next++] ?? null))
    }
  }
  // setTarget may itself accept spill-over; keep advancing.
  let last = events.at(-1)
  while (last?.type === 'accepted' && next <= targets.length) {
    const more = tracker.setTarget(targets[next++] ?? null)
    events.push(...more)
    last = more.at(-1)
  }
  return { tracker, events }
}

describe('LiveTracker', () => {
  it('accepts three fluent sentences from one growing transcript', () => {
    const targets = [S1, S2, S3].map((source, entryIndex) => ({ entryIndex, source }))
    const { events } = stream(targets, 'Jestem spokojny i pewny siebie Idę dalej z odwagą Dziękuję za ten dzień')
    expect(accepted(events)).toEqual([0, 1, 2])
    const firstAccept = events.find((e) => e.type === 'accepted')
    expect(firstAccept?.type === 'accepted' && firstAccept.transcript).toBe('Jestem spokojny i pewny siebie')
  })

  it('reports progress while a sentence is being said', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    const [event] = tracker.update('Jestem spokojny')
    expect(event).toMatchObject({ type: 'progress', entryIndex: 0, progress: { covered: [true, true, false, false, false], errors: 0 } })
  })

  it('counts a repeated sentence once per repetition', () => {
    const targets = [0, 1, 2].map((entryIndex) => ({ entryIndex, source: 'I am calm.' }))
    const { events } = stream(targets, 'I am calm I am calm I am calm', 'en')
    expect(accepted(events)).toEqual([0, 1, 2])
  })

  it('evaluates spill-over as soon as the next sentence becomes the target', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    const first = tracker.update('Jestem spokojny i pewny siebie Idę dalej z odwagą')
    expect(accepted(first)).toEqual([0])
    expect(accepted(tracker.setTarget({ entryIndex: 1, source: S2 }))).toEqual([1])
  })

  it('survives interim revisions that shorten the transcript', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    expect(accepted(tracker.update('Jestem spokojny i pewny siebie'))).toEqual([0])
    tracker.setTarget({ entryIndex: 1, source: S2 })
    // The recogniser revises the tail: one word disappears, then comes back with the next sentence.
    expect(accepted(tracker.update('Jestem spokojny i pewny'))).toEqual([])
    expect(accepted(tracker.update('Jestem spokojny i pewny siebie Idę dalej z odwagą'))).toEqual([1])
  })

  it('ignores filler sounds', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    expect(accepted(tracker.update('yyy jestem spokojny i pewny siebie'))).toEqual([0])
  })

  it('rejects on a pause when the sentence had an extra word, then starts a fresh window', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    expect(accepted(tracker.update('jestem bardzo spokojny i pewny siebie'))).toEqual([])
    const [rejection] = tracker.pause()
    expect(rejection).toMatchObject({ type: 'rejected', entryIndex: 0, cause: 'pause', result: { reason: 'extra' } })
    expect(tracker.pause()).toEqual([])
    expect(accepted(tracker.update('jestem bardzo spokojny i pewny siebie jestem spokojny i pewny siebie'))).toEqual([0])
  })

  it('accepts on a pause when only the last word of a long sentence was dropped', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: TWENTY })
    const withoutLast = TWENTY.replace(/[.,]/g, '').split(' ').slice(0, -1).join(' ')
    expect(accepted(tracker.update(withoutLast))).toEqual([])
    expect(accepted(tracker.pause())).toEqual([0])
  })

  it('does not reject a pause when nothing (or only fillers) was said', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    expect(tracker.pause()).toEqual([])
    tracker.update('yyy')
    expect(tracker.pause()).toEqual([])
  })

  it('rejects when far more words than the sentence arrive without a match', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict', overflowWords: 8 })
    tracker.setTarget({ entryIndex: 0, source: S2 })
    const events = tracker.update('to jest zupełnie inny tekst który w ogóle nie pasuje do tego zdania')
    expect(events.at(-1)).toMatchObject({ type: 'rejected', cause: 'overflow' })
    expect(accepted(tracker.update('to jest zupełnie inny tekst który w ogóle nie pasuje do tego zdania Idę dalej z odwagą'))).toEqual([0])
  })

  it('starts over after the recogniser restarts', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    tracker.update('Jestem spokojny i')
    tracker.reset()
    expect(accepted(tracker.update('Jestem spokojny i pewny siebie'))).toEqual([0])
  })

  it('discards what was heard so far (skip) so the next sentence starts clean', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    tracker.update('jestem jakoś tak')
    tracker.discard()
    tracker.setTarget({ entryIndex: 1, source: S2 })
    expect(accepted(tracker.update('jestem jakoś tak Idę dalej z odwagą'))).toEqual([1])
  })

  it('ignores speech when there is no target', () => {
    const tracker = createLiveTracker({ lang: 'pl', strictness: 'strict' })
    expect(tracker.update('Jestem spokojny i pewny siebie')).toEqual([])
    expect(tracker.setTarget(null)).toEqual([])
    expect(tracker.pause()).toEqual([])
  })
})
