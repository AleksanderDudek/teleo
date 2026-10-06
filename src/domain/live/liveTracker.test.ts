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
  const tracker = createLiveTracker({ lang })
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
    const tracker = createLiveTracker({ lang: 'pl' })
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
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    const first = tracker.update('Jestem spokojny i pewny siebie Idę dalej z odwagą')
    expect(accepted(first)).toEqual([0])
    expect(accepted(tracker.setTarget({ entryIndex: 1, source: S2 }))).toEqual([1])
  })

  it('survives interim revisions that shorten the transcript', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    expect(accepted(tracker.update('Jestem spokojny i pewny siebie'))).toEqual([0])
    tracker.setTarget({ entryIndex: 1, source: S2 })
    // The recogniser revises the tail: one word disappears, then comes back with the next sentence.
    expect(accepted(tracker.update('Jestem spokojny i pewny'))).toEqual([])
    expect(accepted(tracker.update('Jestem spokojny i pewny siebie Idę dalej z odwagą'))).toEqual([1])
  })

  it('ignores filler sounds', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    expect(accepted(tracker.update('yyy jestem spokojny i pewny siebie'))).toEqual([0])
  })

  it('rejects on a pause when the sentence had an extra word, then starts a fresh window', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    expect(accepted(tracker.update('jestem bardzo spokojny i pewny siebie'))).toEqual([])
    const [rejection] = tracker.pause()
    expect(rejection).toMatchObject({ type: 'rejected', entryIndex: 0, cause: 'pause', result: { reason: 'extra' } })
    expect(tracker.pause()).toEqual([])
    expect(accepted(tracker.update('jestem bardzo spokojny i pewny siebie jestem spokojny i pewny siebie'))).toEqual([0])
  })

  it('treats an immediate restart of the sentence as a failed attempt followed by a fresh one', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    const events = tracker.update('jestem bardzo spokojny i pewny siebie jestem spokojny i pewny siebie')
    expect(events.map((e) => e.type)).toEqual(['rejected', 'accepted'])
    expect(events[0]).toMatchObject({ cause: 'restart', transcript: 'jestem bardzo spokojny i pewny siebie' })
  })

  it('handles a stuttered start as a restart', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    const events = tracker.update('jestem jestem spokojny i pewny siebie')
    expect(events.map((e) => e.type)).toEqual(['rejected', 'accepted'])
  })

  it('does not mistake a repeated opening word inside a clean sentence for a restart', () => {
    const tracker = createLiveTracker({ lang: 'en' })
    tracker.setTarget({ entryIndex: 0, source: 'I am calm and I am strong.' })
    const partial = tracker.update('I am calm and I am')
    expect(partial.map((e) => e.type)).toEqual(['progress'])
    expect(accepted(tracker.update('I am calm and I am strong'))).toEqual([0])
  })

  it('accepts on a pause when only the last word of a long sentence was dropped', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: TWENTY })
    const withoutLast = TWENTY.replace(/[.,]/g, '').split(' ').slice(0, -1).join(' ')
    expect(accepted(tracker.update(withoutLast))).toEqual([])
    expect(accepted(tracker.pause())).toEqual([0])
  })

  it('does not reject a pause when nothing (or only fillers) was said', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    expect(tracker.pause()).toEqual([])
    tracker.update('yyy')
    expect(tracker.pause()).toEqual([])
  })

  it('rejects when far more words than the sentence arrive without a match', () => {
    const tracker = createLiveTracker({ lang: 'pl', overflowWords: 8 })
    tracker.setTarget({ entryIndex: 0, source: S2 })
    const events = tracker.update('to jest zupełnie inny tekst który w ogóle nie pasuje do tego zdania')
    expect(events.at(-1)).toMatchObject({ type: 'rejected', cause: 'overflow' })
    expect(accepted(tracker.update('to jest zupełnie inny tekst który w ogóle nie pasuje do tego zdania Idę dalej z odwagą'))).toEqual([0])
  })

  it('keeps words heard before a mid-sentence restart', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    tracker.update('Jestem spokojny i')
    tracker.reset()
    const events = tracker.update('pewny siebie')
    expect(accepted(events)).toEqual([0])
    expect(events.find((e) => e.type === 'rejected')).toBeUndefined()
  })

  it('re-locates the end of the last sentence when the recogniser revises its words', () => {
    const tracker = createLiveTracker({ lang: 'en' })
    tracker.setTarget({ entryIndex: 0, source: 'I am calm and focused.' })
    expect(accepted(tracker.update('I am calm and focused Every'))).toEqual([0])
    tracker.setTarget({ entryIndex: 1, source: 'Every day I am becoming a better version of myself.' })
    // The final result merges "I am" into "I'm": one word fewer before the boundary.
    expect(accepted(tracker.update("I'm calm and focused. Every day I am becoming a better version of myself"))).toEqual([1])
  })

  it('checks the other recognition hypotheses when a pause settles the sentence', () => {
    const tracker = createLiveTracker({ lang: 'en' })
    tracker.setTarget({ entryIndex: 0, source: 'I am calm and focused.' })
    tracker.update('I am come and focused', ['I am calm and focused'])
    expect(accepted(tracker.pause())).toEqual([0])
  })

  it('starts over after the recogniser restarts', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    tracker.update('Jestem spokojny i')
    tracker.reset()
    expect(accepted(tracker.update('Jestem spokojny i pewny siebie'))).toEqual([0])
  })

  it('discards what was heard so far (skip) so the next sentence starts clean', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    tracker.update('jestem jakoś tak')
    tracker.discard()
    tracker.setTarget({ entryIndex: 1, source: S2 })
    expect(accepted(tracker.update('jestem jakoś tak Idę dalej z odwagą'))).toEqual([1])
  })

  it('needs the coverage of its target: the rung of the ladder the sentence is on', () => {
    const TEN = 'Każdego dnia rano wstaję wcześnie i dziękuję za nowy dzień.'
    const eightOfTen = 'każdego dnia rano wcześnie i za nowy dzień'
    const first = createLiveTracker({ lang: 'pl' })
    first.setTarget({ entryIndex: 0, source: TEN })
    expect(accepted(first.update(eightOfTen))).toEqual([])
    expect(first.pause()).toMatchObject([{ type: 'rejected', result: { reason: 'coverage', threshold: 0.9 } }])
    const second = createLiveTracker({ lang: 'pl' })
    second.setTarget({ entryIndex: 0, source: TEN, threshold: 0.8 })
    expect(second.update(eightOfTen)).toMatchObject([{ type: 'accepted', result: { missing: 2, threshold: 0.8 } }])
  })

  it('checks the words already heard again when the same sentence comes back with a lower threshold', () => {
    const TEN = 'Każdego dnia rano wstaję wcześnie i dziękuję za nowy dzień.'
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: TEN })
    // A slip ("bardzo"), then a fresh start that leaves out two words: rejected once, waiting on 90 %.
    const events = tracker.update('każdego dnia rano bardzo każdego dnia rano wcześnie i za nowy dzień')
    expect(events.map((e) => e.type)).toEqual(['rejected', 'progress'])
    expect(accepted(tracker.setTarget({ entryIndex: 0, source: TEN, threshold: 0.8 }))).toEqual([0])
  })

  describe('long sentences (Bible readings)', () => {
    /** KJV Genesis 1:7 — 30 words, "and" three times. */
    const FIRMAMENT = 'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament: and it was so.'
    /** PBG Genesis 1:2 — 17 words, "a" twice. */
    const ZIEMIA = 'A ziemia była niekształtowna i próżna, i ciemność była nad przepaścią, a Duch Boży unaszał się nad wodami.'
    const words = (text: string) => text.replace(/[.,:;]/g, '').split(' ')
    /** Streams words one by one, as interim results, and collects every event. */
    const say = (tracker: ReturnType<typeof createLiveTracker>, spoken: string[], from = 0) =>
      spoken.flatMap((_, i) => (i < from ? [] : tracker.update(spoken.slice(0, i + 1).join(' '))))

    it('a recurring first word after a misheard one is not a restart: the sentence is finished, then judged', () => {
      const tracker = createLiveTracker({ lang: 'en' })
      tracker.setTarget({ entryIndex: 0, source: FIRMAMENT })
      const spoken = words(FIRMAMENT)
      spoken[2] = 'bread' // "made", misheard
      const events = say(tracker, spoken)
      expect(events.filter((e) => e.type === 'rejected')).toEqual([])
      expect(accepted(events)).toEqual([0])
      expect(events.at(-1)).toMatchObject({ type: 'accepted', result: { wrong: 1 } })
    })

    it('the same in Polish, where "a" and "i" open many verses', () => {
      const tracker = createLiveTracker({ lang: 'pl' })
      tracker.setTarget({ entryIndex: 0, source: ZIEMIA })
      const spoken = words(ZIEMIA)
      spoken[1] = 'zima' // "ziemia", misheard
      const events = say(tracker, spoken)
      expect(events.filter((e) => e.type === 'rejected')).toEqual([])
      expect(accepted(events)).toEqual([0])
    })

    it('a sentence whose opening phrase recurs in the text is followed through it, not restarted', () => {
      // KJV Genesis 1:30, 39 words: "and to every" three times.
      const EVERY = 'And to every beast of the earth, and to every fowl of the air, and to every thing that creepeth upon the earth, wherein there is life, I have given every green herb for meat: and it was so.'
      const tracker = createLiveTracker({ lang: 'en' })
      tracker.setTarget({ entryIndex: 0, source: EVERY })
      const spoken = words(EVERY)
      spoken[4] = 'feast' // "beast", misheard
      const events = say(tracker, spoken)
      expect(events.filter((e) => e.type === 'rejected')).toEqual([])
      expect(accepted(events)).toEqual([0])
    })

    it('still catches a slip in a sentence whose opening phrase recurs', () => {
      const TREE = 'the tree of life also in the midst of the garden, and the tree of knowledge of good and evil.'
      const tracker = createLiveTracker({ lang: 'en' })
      tracker.setTarget({ entryIndex: 0, source: TREE })
      const events = say(tracker, ['the', 'tree', 'of', 'lice', 'the', 'tree', 'of', 'life'])
      expect(events.find((e) => e.type === 'rejected')).toMatchObject({ cause: 'restart', transcript: 'the tree of lice' })
    })

    it('still catches a real restart, said word by word', () => {
      const tracker = createLiveTracker({ lang: 'pl' })
      tracker.setTarget({ entryIndex: 0, source: S1 })
      const events = say(tracker, 'jestem jestem spokojny i pewny siebie'.split(' '))
      expect(events.filter((e) => e.type !== 'progress').map((e) => e.type)).toEqual(['rejected', 'accepted'])
      expect(events.find((e) => e.type === 'rejected')).toMatchObject({ cause: 'restart', transcript: 'jestem' })
    })

    it('waits through a pause in the middle of a sentence, and judges what was said once the quiet lasts', () => {
      const tracker = createLiveTracker({ lang: 'en' })
      tracker.setTarget({ entryIndex: 0, source: FIRMAMENT })
      const spoken = words(FIRMAMENT)
      say(tracker, spoken.slice(0, 12))
      expect(tracker.pause()).toEqual([{ type: 'holding', entryIndex: 0 }])
      expect(tracker.pause('long')).toMatchObject([{ type: 'rejected', entryIndex: 0, cause: 'pause' }])
    })

    it('a breath in the middle of a sentence costs nothing: the rest is said and the sentence passes', () => {
      const tracker = createLiveTracker({ lang: 'en' })
      tracker.setTarget({ entryIndex: 0, source: FIRMAMENT })
      const spoken = words(FIRMAMENT)
      say(tracker, spoken.slice(0, 12))
      expect(tracker.pause()).toEqual([{ type: 'holding', entryIndex: 0 }])
      expect(accepted(say(tracker, spoken, 12))).toEqual([0])
    })
  })

  it('a stray word before a clean start of the sentence is not a try', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    tracker.setTarget({ entryIndex: 0, source: S1 })
    const events = 'okej Jestem spokojny i pewny siebie'.split(' ').flatMap((_, i, all) => tracker.update(all.slice(0, i + 1).join(' ')))
    expect(events.filter((e) => e.type !== 'progress').map((e) => e.type)).toEqual(['accepted'])
  })

  describe('pauses', () => {
    it('hold in the middle of a short sentence too (recalling the next words)', () => {
      const tracker = createLiveTracker({ lang: 'pl' })
      tracker.setTarget({ entryIndex: 0, source: S1 })
      tracker.update('Jestem spokojny')
      expect(tracker.pause()).toEqual([{ type: 'holding', entryIndex: 0 }])
      expect(tracker.pause('long')).toMatchObject([{ type: 'rejected', cause: 'pause', transcript: 'Jestem spokojny' }])
    })

    it('settle at once when the speaker reached the end of the sentence', () => {
      const tracker = createLiveTracker({ lang: 'pl' })
      tracker.setTarget({ entryIndex: 0, source: S1 })
      tracker.update('Jestem spokojny i pewny bardzo')
      expect(tracker.pause()).toMatchObject([{ type: 'rejected', cause: 'pause' }])
    })

    it('settle at once when what was said already passes', () => {
      const tracker = createLiveTracker({ lang: 'pl' })
      tracker.setTarget({ entryIndex: 0, source: TWENTY, threshold: 0.7 })
      // 15 of the 20 words, then a pause: enough on the third rung.
      const fifteen = TWENTY.replace(/[.,]/g, '').split(' ').slice(0, 15).join(' ')
      tracker.update(fifteen)
      expect(accepted(tracker.pause())).toEqual([0])
    })
  })

  it('ignores speech when there is no target', () => {
    const tracker = createLiveTracker({ lang: 'pl' })
    expect(tracker.update('Jestem spokojny i pewny siebie')).toEqual([])
    expect(tracker.setTarget(null)).toEqual([])
    expect(tracker.pause()).toEqual([])
  })
})
