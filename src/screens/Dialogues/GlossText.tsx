import type { Gloss } from '@/domain/dialogue'
import type { Lang } from '@/domain/types'
import { cn } from '@/lib/cn'

interface GlossTextProps {
  gloss: Gloss
  lang: Lang
  /** Link ids lit right now (the word the user points at and its counterpart). */
  active?: readonly string[]
  /** Pointing at a linked word (hover with a mouse, tap on a touch screen); null = nothing. */
  onPoint?: (ids: readonly string[] | null) => void
  /** Live mode: which whitespace-separated words of the line were already heard. */
  covered?: readonly boolean[]
  className?: string
  testId?: string
}

/** Heard/unheard runs of `text`, which starts at `offset` in the whole line. */
function heardRuns(text: string, offset: number, wordAt: readonly number[], covered: readonly boolean[] | undefined) {
  if (!covered) return [{ text, heard: false }]
  const runs: Array<{ text: string; heard: boolean }> = []
  for (let i = 0; i < text.length; i++) {
    const word = wordAt[offset + i] ?? -1
    const heard = word >= 0 && !!covered[word]
    const last = runs.at(-1)
    if (last && last.heard === heard) last.text += text[i]
    else runs.push({ text: text[i]!, heard })
  }
  return runs
}

/** Index of the whitespace-separated word each character of `plain` belongs to (-1 for spaces). */
function wordIndexes(plain: string): number[] {
  let word = -1
  let inWord = false
  return Array.from(plain, (char) => {
    if (/\s/u.test(char)) {
      inWord = false
      return -1
    }
    if (!inWord) word++
    inWord = true
    return word
  })
}

/**
 * A dialogue line with its linked words coloured by grammatical role (DECISIONS #102). The rendered text is
 * exactly the line (spans only wrap it), so assistive tech and the e2e fake recogniser read it unchanged.
 */
export function GlossText({ gloss, lang, active, onPoint, covered, className, testId }: GlossTextProps) {
  const wordAt = covered ? wordIndexes(gloss.plain) : []
  // Where each part starts in the whole line.
  const starts = gloss.parts.map((_, index) => gloss.parts.slice(0, index).reduce((sum, part) => sum + part.text.length, 0))
  return (
    <span lang={lang} data-testid={testId} className={cn('block', className)}>
      {gloss.parts.map((part, index) => {
        const runs = heardRuns(part.text, starts[index]!, wordAt, covered).map((run, i) =>
          run.heard ? (
            <span key={i} className="gloss-heard">
              {run.text}
            </span>
          ) : (
            run.text
          ),
        )
        if (part.ids.length === 0) return <span key={index}>{runs}</span>
        const lit = !!active?.some((id) => part.ids.includes(id))
        return (
          // Pointing is a visual aid; the same pairs are listed as text in the bubble's word list (keyboard,
          // screen readers), so the words themselves stay out of the tab order.
          // A mouse lights a pair while hovering; a finger or pen toggles it with a tap.
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
          <span
            key={index}
            className="gloss-word"
            data-role={part.role}
            data-active={lit || undefined}
            onPointerEnter={(event) => event.pointerType === 'mouse' && onPoint?.(part.ids)}
            onPointerLeave={(event) => event.pointerType === 'mouse' && onPoint?.(null)}
            onPointerUp={(event) => event.pointerType !== 'mouse' && onPoint?.(lit ? null : part.ids)}
          >
            {runs}
          </span>
        )
      })}
    </span>
  )
}
