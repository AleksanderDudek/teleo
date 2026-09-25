import type {
  AvailabilityStatus,
  RecognitionErrorEventLike,
  RecognitionLike,
  RecognitionResultEventLike,
  RecognitionResultLike,
} from '@/domain/speech/webSpeechTypes'

/** Scriptable stand-in for `SpeechRecognition` (unit tests). */
export class FakeRecognition implements RecognitionLike {
  static instances: FakeRecognition[] = []
  static availability: AvailabilityStatus | undefined
  static failOnStart: string | undefined

  static reset() {
    FakeRecognition.instances = []
    FakeRecognition.availability = undefined
    FakeRecognition.failOnStart = undefined
  }

  static async available(): Promise<AvailabilityStatus> {
    return FakeRecognition.availability ?? 'unavailable'
  }

  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  processLocally = false
  onstart: (() => void) | null = null
  onresult: ((event: RecognitionResultEventLike) => void) | null = null
  onerror: ((event: RecognitionErrorEventLike) => void) | null = null
  onend: (() => void) | null = null
  running = false
  startCalls = 0

  constructor() {
    FakeRecognition.instances.push(this)
  }

  start() {
    this.startCalls++
    this.running = true
    queueMicrotask(() => {
      if (FakeRecognition.failOnStart) {
        this.onerror?.({ error: FakeRecognition.failOnStart })
        this.running = false
        this.onend?.()
      } else {
        this.onstart?.()
      }
    })
  }

  stop() {
    this.running = false
    queueMicrotask(() => this.onend?.())
  }

  abort() {
    this.running = false
    queueMicrotask(() => this.onend?.())
  }

  /** Emits the full result list (as browsers do) — each entry: [isFinal, ...alternatives]. */
  emit(...results: Array<[boolean, ...string[]]>) {
    const list = results.map(([isFinal, ...alternatives]) => {
      const result: Record<number, { transcript: string; confidence: number }> & { isFinal: boolean; length: number } = {
        isFinal,
        length: alternatives.length,
      }
      alternatives.forEach((transcript, i) => (result[i] = { transcript, confidence: 0.9 - i * 0.1 }))
      return result as unknown as RecognitionResultLike
    })
    this.onresult?.({ resultIndex: 0, results: Object.assign(list, { length: list.length }) })
  }

  fail(error: string) {
    this.onerror?.({ error })
  }

  /** The browser ends recognition on its own. */
  endUnexpectedly() {
    this.running = false
    this.onend?.()
  }
}
