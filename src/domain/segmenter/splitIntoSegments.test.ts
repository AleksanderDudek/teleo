import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { splitIntoSegments } from './splitIntoSegments'

describe('splitIntoSegments — sentence mode basics', () => {
  it('splits on terminal punctuation followed by a capital letter', () => {
    expect(splitIntoSegments('Ojcze nasz. Chleba naszego.', 'pl', 'sentence')).toEqual([
      'Ojcze nasz.',
      'Chleba naszego.',
    ])
  })

  it('splits on ?, ! and … alike', () => {
    expect(splitIntoSegments('Czy to prawda? Tak! Na pewno…', 'pl', 'sentence')).toEqual([
      'Czy to prawda?',
      'Tak!',
      'Na pewno…',
    ])
  })

  it('treats a blank line as a hard boundary even without punctuation', () => {
    expect(splitIntoSegments('Pierwsza linia\n\nDruga linia', 'pl', 'sentence')).toEqual([
      'Pierwsza linia',
      'Druga linia',
    ])
  })

  it('joins a single newline inside a paragraph into a space', () => {
    expect(splitIntoSegments('Ojcze nasz,\nktóryś jest w niebie.', 'pl', 'sentence')).toEqual([
      'Ojcze nasz, któryś jest w niebie.',
    ])
  })

  it('collapses runs of spaces and trims', () => {
    expect(splitIntoSegments('  Ala   ma    kota.   Idzie  spać.  ', 'pl', 'sentence')).toEqual([
      'Ala ma kota.',
      'Idzie spać.',
    ])
  })

  it('returns an empty array for empty or whitespace-only text', () => {
    expect(splitIntoSegments('', 'pl', 'sentence')).toEqual([])
    expect(splitIntoSegments('   ', 'pl', 'sentence')).toEqual([])
  })

  it('handles more than two paragraphs, each with its own sentences', () => {
    expect(
      splitIntoSegments('Jeden. Dwa.\n\nTrzy.\n\nCztery. Pięć.', 'pl', 'sentence'),
    ).toEqual(['Jeden.', 'Dwa.', 'Trzy.', 'Cztery.', 'Pięć.'])
  })
})

describe('splitIntoSegments — abbreviation protection', () => {
  it('protects a mid-sentence PL abbreviation from being cut', () => {
    expect(splitIntoSegments('Pójdę np. do domu. Potem wrócę.', 'pl', 'sentence')).toEqual([
      'Pójdę np. do domu.',
      'Potem wrócę.',
    ])
  })

  it('protects an abbreviation even right before a capitalized word', () => {
    expect(splitIntoSegments('Modlił się św. Józef. Amen.', 'pl', 'sentence')).toEqual([
      'Modlił się św. Józef.',
      'Amen.',
    ])
  })

  it('protects an EN abbreviation at the start of the text', () => {
    expect(splitIntoSegments('Mr. Smith is here. He is calm.', 'en', 'sentence')).toEqual([
      'Mr. Smith is here.',
      'He is calm.',
    ])
  })

  it('protects a two-dot EN abbreviation (e.g.)', () => {
    expect(splitIntoSegments('Use e.g. this one. Then that.', 'en', 'sentence')).toEqual([
      'Use e.g. this one.',
      'Then that.',
    ])
  })

  it('does not let a protected abbreviation swallow a real sentence break', () => {
    // `w.` is protected, but must not break `nowy.` — the sentence still ends there.
    expect(splitIntoSegments('Jestem nowy. Idę dalej.', 'pl', 'sentence')).toEqual([
      'Jestem nowy.',
      'Idę dalej.',
    ])
  })

  it('only matches an abbreviation as a whole word, not as a suffix of a longer word', () => {
    // `krów.` ends in the letters `w.` but is not the abbreviation `w.` itself.
    expect(splitIntoSegments('Widzę stado krów. Idą powoli.', 'pl', 'sentence')).toEqual([
      'Widzę stado krów.',
      'Idą powoli.',
    ])
  })

  it('only matches an abbreviation as a whole word, not inside a longer word ending the same way', () => {
    // `cedr.` ends in the letters `dr.` but is not the abbreviation `dr.` itself.
    expect(splitIntoSegments('To jest cedr. Rośnie w lesie.', 'pl', 'sentence')).toEqual([
      'To jest cedr.',
      'Rośnie w lesie.',
    ])
  })

  it('only applies the abbreviation list for the given language', () => {
    // `st.` is not a protected PL abbreviation, so it still ends the sentence.
    expect(splitIntoSegments('Mieszka przy tej st. Jest ładna.', 'pl', 'sentence')).toEqual([
      'Mieszka przy tej st.',
      'Jest ładna.',
    ])
  })
})

describe('splitIntoSegments — quotes', () => {
  it('keeps a closing quote with the sentence it ends', () => {
    expect(splitIntoSegments('Powiedział: „Idź.” Poszedł.', 'pl', 'sentence')).toEqual([
      'Powiedział: „Idź.”',
      'Poszedł.',
    ])
  })
})

describe('splitIntoSegments — line mode', () => {
  it('treats each non-empty line as a segment and strips list markers', () => {
    expect(
      splitIntoSegments(
        'Jestem spokojny.\n\n- Jestem silny\n2. Jestem wdzięczny\n• Idę dalej',
        'pl',
        'line',
      ),
    ).toEqual(['Jestem spokojny.', 'Jestem silny', 'Jestem wdzięczny', 'Idę dalej'])
  })

  it('handles CRLF line endings', () => {
    expect(splitIntoSegments('Jeden\r\nDwa\r\nTrzy', 'pl', 'line')).toEqual([
      'Jeden',
      'Dwa',
      'Trzy',
    ])
  })

  it('strips every kind of listed marker, including the other bullet and dash characters', () => {
    expect(
      splitIntoSegments('* Gwiazdka\n· Kropka\n– Półpauza\n— Pauza\n1) Nawias', 'pl', 'line'),
    ).toEqual(['Gwiazdka', 'Kropka', 'Półpauza', 'Pauza', 'Nawias'])
  })

  it('trims lines and drops blank ones without treating them as markers', () => {
    expect(splitIntoSegments('  Ala ma kota.  \n\n\n   \nIdzie spać.', 'pl', 'line')).toEqual([
      'Ala ma kota.',
      'Idzie spać.',
    ])
  })

  it('does not strip a number that is not a short list marker', () => {
    expect(splitIntoSegments('2024. Rok się zaczął.', 'pl', 'line')).toEqual([
      '2024. Rok się zaczął.',
    ])
  })

  it('returns an empty array for empty or whitespace-only text', () => {
    expect(splitIntoSegments('', 'pl', 'line')).toEqual([])
    expect(splitIntoSegments('   \n  \n ', 'pl', 'line')).toEqual([])
  })
})

describe('splitIntoSegments — fallback without Intl.Segmenter', () => {
  beforeEach(() => {
    vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('splits on terminal punctuation followed by a capital letter', () => {
    expect(splitIntoSegments('Ojcze nasz. Chleba naszego.', 'pl', 'sentence')).toEqual([
      'Ojcze nasz.',
      'Chleba naszego.',
    ])
  })

  it('protects a mid-sentence PL abbreviation from being cut', () => {
    expect(splitIntoSegments('Pójdę np. do domu. Potem wrócę.', 'pl', 'sentence')).toEqual([
      'Pójdę np. do domu.',
      'Potem wrócę.',
    ])
  })

  it('protects an abbreviation even right before a capitalized word', () => {
    expect(splitIntoSegments('Modlił się św. Józef. Amen.', 'pl', 'sentence')).toEqual([
      'Modlił się św. Józef.',
      'Amen.',
    ])
  })

  it('protects an EN abbreviation at the start of the text', () => {
    expect(splitIntoSegments('Mr. Smith is here. He is calm.', 'en', 'sentence')).toEqual([
      'Mr. Smith is here.',
      'He is calm.',
    ])
  })

  it('protects a two-dot EN abbreviation (e.g.)', () => {
    expect(splitIntoSegments('Use e.g. this one. Then that.', 'en', 'sentence')).toEqual([
      'Use e.g. this one.',
      'Then that.',
    ])
  })

  it('splits on ?, ! and … alike', () => {
    expect(splitIntoSegments('Czy to prawda? Tak! Na pewno…', 'pl', 'sentence')).toEqual([
      'Czy to prawda?',
      'Tak!',
      'Na pewno…',
    ])
  })

  it('keeps a closing quote with the sentence it ends', () => {
    expect(splitIntoSegments('Powiedział: „Idź.” Poszedł.', 'pl', 'sentence')).toEqual([
      'Powiedział: „Idź.”',
      'Poszedł.',
    ])
  })
})
