import type { TFunction } from 'i18next'
import type { MatchResult } from '@/domain/matcher'

/** Short feedback line for a comparison result (spec §6.5: "Extra word: *very*. Try again."). */
export function resultMessage(result: MatchResult, t: TFunction): string {
  if (result.accepted) return result.near > 0 ? t('speech.result.acceptedNear') : t('speech.result.great')
  switch (result.reason) {
    case 'empty':
      return t('speech.result.empty')
    case 'emptySource':
      return t('speech.result.emptySource')
    case 'extra': {
      const words = result.ops.filter((op) => op.op === 'extra').map((op) => op.spoken ?? '')
      return t('speech.result.extra', { count: words.length, words: words.join(', ') })
    }
    case 'wrong': {
      const op = result.ops.find((o) => o.op === 'wrong')
      return t('speech.result.wrong', { spoken: op?.spoken ?? '', expected: op?.source ?? '' })
    }
    default: {
      const words = result.ops.filter((op) => op.op === 'missing' || op.op === 'wrong').map((op) => op.source ?? '')
      return words.length > 0 && words.length <= 3
        ? t('speech.result.missing', { count: words.length, words: words.join(', ') })
        : t('speech.result.coverage', { percent: Math.floor(result.coverage * 100), needed: 95 })
    }
  }
}
