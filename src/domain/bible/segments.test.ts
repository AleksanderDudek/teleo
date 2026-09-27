import { describe, expect, it } from 'vitest'
import { LONG_SEGMENT_WORDS } from '@/domain/segmenter'
import { countWords } from './readings'
import { readingSegments, readingText } from './segments'

describe('readingText', () => {
  it('joins the verses of a reading into one text', () => {
    expect(readingText([{ c: 1, v: 1, t: 'In the beginning.' }, { c: 1, v: 2, t: ' And the earth. ' }])).toBe('In the beginning. And the earth.')
  })
})

describe('readingSegments', () => {
  it('says a reading sentence by sentence, across verse boundaries', () => {
    const text =
      'In the beginning God created the heaven and the earth. And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters. And God said, Let there be light: and there was light.'
    expect(readingSegments(text, 'en')).toEqual([
      'In the beginning God created the heaven and the earth.',
      'And the earth was without form, and void; and darkness was upon the face of the deep.',
      'And the Spirit of God moved upon the face of the waters.',
      'And God said, Let there be light: and there was light.',
    ])
  })

  it('splits long sentences at a clause near the middle until every part is short enough to say', () => {
    const long =
      'And he said unto them, Go ye into all the world, and preach the gospel to every creature; he that believeth and is baptized shall be saved, but he that believeth not shall be damned, and these signs shall follow them that believe, in my name shall they cast out devils, they shall speak with new tongues, they shall take up serpents.'
    const parts = readingSegments(long, 'en')
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((part) => countWords(part) <= LONG_SEGMENT_WORDS)).toBe(true)
    expect(parts.join(' ')).toBe(long)
  })
})
