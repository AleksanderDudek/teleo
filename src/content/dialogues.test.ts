import { describe, expect, it } from 'vitest'
import { GLYPHS } from '@/components/icons/glyphs'
import { PHOSPHOR } from '@/components/icons/phosphor'
import { dialogueSegments, glossIds, parseGloss, userLines } from '@/domain/dialogue'
import { evaluate, normalize } from '@/domain/matcher'
import { CHARACTER_IDS, LANGS } from '@/domain/types'
import { DIALOGUES, dialogueOfText, dialogueTextId } from './dialogues'

const MARKUP = /[{}|]/

describe('builtin dialogues', () => {
  it('have unique, url-safe keys', () => {
    const keys = DIALOGUES.map((d) => d.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9-]*$/)
    expect(DIALOGUES.length).toBeGreaterThanOrEqual(8)
  })

  it.each(DIALOGUES.map((d) => [d.key, d] as const))('%s: has a title, scene, level, icon and partner', (_, dialogue) => {
    for (const lang of LANGS) {
      expect(dialogue.title[lang]?.trim()).toBeTruthy()
      expect(dialogue.scene[lang]?.trim()).toBeTruthy()
    }
    expect(['A1', 'A2']).toContain(dialogue.level)
    expect(Object.hasOwn(PHOSPHOR, dialogue.icon) || Object.hasOwn(GLYPHS, dialogue.icon)).toBe(true)
    expect(CHARACTER_IDS).toContain(dialogue.partner)
  })

  it.each(DIALOGUES.map((d) => [d.key, d] as const))('%s: opens with the partner and gives the user at least three lines', (_, dialogue) => {
    expect(dialogue.lines[0]?.who).toBe('bot')
    expect(userLines(dialogue).length).toBeGreaterThanOrEqual(3)
    for (const line of dialogue.lines) expect(['bot', 'you']).toContain(line.who)
  })

  it.each(DIALOGUES.map((d) => [d.key, d] as const))('%s: every line links the same words in every language', (_, dialogue) => {
    dialogue.lines.forEach((line, index) => {
      const ids = LANGS.map((lang) => {
        const gloss = parseGloss(line.text[lang])
        expect(gloss.plain, `${dialogue.key}#${index} ${lang}`).not.toMatch(MARKUP)
        expect(gloss.plain.trim(), `${dialogue.key}#${index} ${lang}`).toBe(gloss.plain)
        expect(normalize(gloss.plain, lang).length, `${dialogue.key}#${index} ${lang}`).toBeGreaterThan(0)
        return [...glossIds(gloss)].sort()
      })
      expect(ids[1], `${dialogue.key}#${index}`).toEqual(ids[0])
    })
  })

  it.each(DIALOGUES.map((d) => [d.key, d] as const))('%s: every user line has its pronunciation for readers of the other language', (_, dialogue) => {
    for (const index of userLines(dialogue)) {
      for (const lang of LANGS) {
        const say = dialogue.lines[index]!.say?.[lang]
        expect(say?.trim(), `${dialogue.key}#${index} ${lang}`).toBeTruthy()
        expect(say, `${dialogue.key}#${index} ${lang}`).not.toMatch(MARKUP)
      }
    }
  })

  it.each(DIALOGUES.map((d) => [d.key, d] as const))('%s: the matcher accepts each user line read exactly, as a recogniser writes it', (_, dialogue) => {
    for (const lang of LANGS) {
      for (const plain of dialogueSegments(dialogue, lang)) {
        expect(evaluate(plain, [plain], { lang }).accepted, `${dialogue.key} ${lang}: ${plain}`).toBe(true)
        // Recognisers drop punctuation and capitals and write straight apostrophes.
        const heard = plain.replace(/[.,!?]/g, '').replace(/’/g, "'").toLocaleLowerCase(lang)
        expect(evaluate(plain, [heard], { lang }).accepted, `${dialogue.key} ${lang}: ${heard}`).toBe(true)
        // Numbers are written as words: recognisers disagree on digits.
        expect(plain, `${dialogue.key} ${lang}`).not.toMatch(/\d/)
      }
    }
  })
})

describe('dialogueOfText', () => {
  it('finds the dialogue behind its hidden text id', () => {
    expect(dialogueOfText(dialogueTextId('cafe'))?.key).toBe('cafe')
    expect(dialogueOfText('dialogue:nope')).toBeUndefined()
    expect(dialogueOfText('builtin:en.lords-prayer')).toBeUndefined()
    expect(dialogueOfText(undefined)).toBeUndefined()
  })
})
