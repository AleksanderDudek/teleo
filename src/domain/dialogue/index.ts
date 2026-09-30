/** Language dialogues (owner request 2026-09-30): scripts, word links and turns. Pure module: no DOM, no storage. */

export { GLOSS_ROLES, GlossError, glossIds, parseGloss, roleOf, type Gloss, type GlossPart, type GlossRole } from './gloss'
export { learningLang, nativeLang } from './languages'
export { dialogueSegments, historyEnd, nextDialogueKey, turnAt, userLines, type Turn } from './turns'
export type { Dialogue, DialogueLevel, DialogueLine, Speaker } from './types'
