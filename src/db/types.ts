import type { BibleTranslation } from '@/domain/bible/types'
import type { FriendCard } from '@/domain/leaderboard/friends'
import type { MemoryLevel } from '@/domain/memory/mask'
import type { EntryState, PlanEntry, TemplateItem } from '@/domain/session/types'
import type {
  CharacterId,
  ContentFocus,
  DayKey,
  EngineId,
  GrammaticalForm,
  Lang,
  SplitMode,
  Strictness,
  TextType,
  Tier,
} from '@/domain/types'

/** Row types stored in IndexedDB (spec §10, additions documented in docs/DECISIONS.md). */

export interface TextItem {
  id: string
  title: string
  type: TextType
  lang: Lang
  body: string
  /** `bible`: a Bible-challenge reading, materialised when started; hidden from the library and pickers. */
  source: 'builtin' | 'user' | 'bible'
  tags: string[]
  /** Hidden from the library and pickers (builtin texts can only be hidden, never deleted). */
  archived: boolean
  splitMode: SplitMode
  createdAt: number
  updatedAt: number
  /** Stable identifier of builtin content, used for idempotent seeding. */
  builtinKey?: string
  /** Where a Bible reading comes from. */
  bible?: { translation: BibleTranslation; book: string; index: number; ofBook: number }
}

/** Texts the library, pickers and the session of the day offer (Bible readings have their own screen). */
export function isListedText(text: Pick<TextItem, 'source'>): boolean {
  return text.source !== 'bible'
}

export interface Segment {
  id: string
  textId: string
  order: number
  content: string
  wordCount: number
  /** Replaced by an edit after it had been spoken — kept for history, never practiced again. */
  archived: boolean
}

export interface SessionTemplate {
  id: string
  name: string
  pinned: boolean
  items: TemplateItem[]
  createdAt: number
  updatedAt: number
  source: 'builtin' | 'user'
  archived: boolean
  /** Language of builtin sessions (used for default visibility). */
  lang?: Lang
  builtinKey?: string
  lastUsedAt?: number
}

export type SessionRunStatus = 'in_progress' | 'completed' | 'partial'

export interface SessionRun {
  id: string
  templateId?: string
  /** Set for ad-hoc "say it now" runs started from a single text. */
  textId?: string
  title: string
  dayKey: DayKey
  startedAt: number
  endedAt?: number
  status: SessionRunStatus
  plan: PlanEntry[]
  entries: EntryState[]
  /** Index of the next plan entry to speak. */
  cursor: number
  xpEarned: number
  lastActivityAt: number
  mode: 'read' | 'memory'
  /** Memory mode difficulty (spec §7.3); only the "hidden" level earns `text.memory`. */
  memoryLevel?: MemoryLevel
  /** Achievement keys unlocked by this run (listed on its summary). */
  unlocked?: string[]
}

export interface Attempt {
  id: string
  segmentId: string
  textId: string
  sessionRunId: string
  dayKey: DayKey
  timestamp: number
  /** Omitted when the user disabled transcript storage. */
  transcript?: string
  coverage: number
  extra: number
  wrong: number
  accepted: boolean
  firstTry: boolean
  strictness: Strictness
  engine: EngineId
  durationMs: number
}

export interface DailyStats {
  dayKey: DayKey
  segmentsAccepted: number
  attempts: number
  textsCompleted: number
  sessionsCompleted: number
  xp: number
  langs: Lang[]
  goalReached: boolean
  /** Inactive day bridged by a streak freeze. */
  frozen: boolean
  firstActivityAt?: number
  lastActivityAt?: number
  /** Had an accepted segment before 08:00 (after the day start). */
  morning: boolean
  /** Had an accepted segment at/after 21:00 (or after midnight, before the day start). */
  evening: boolean
  firstTryAccepted: number
  /** Estimated time spent reading aloud (accepted sentences); missing on rows from before v1.3. */
  readingMs?: number
}

export interface TextStats {
  textId: string
  repetitions: number
  segmentsAccepted: number
  currentDayStreak: number
  bestDayStreak: number
  lastDayKey?: DayKey
  /** Full-text blocks where every segment was accepted on the first try. */
  perfectRuns: number
  /** Consecutive first-try accepts (drives `text.perfect` for one-sentence texts). */
  consecutiveFirstTry: number
  bestConsecutiveFirstTry: number
  /** Full-text repetitions completed in memory mode at the "hidden" level (v1.1). */
  memoryRuns: number
  lastPracticedAt?: number
}

export interface AchievementRow {
  /** `ruleId` for global rules, `ruleId:textId` for per-text rules. */
  key: string
  ruleId: string
  textId?: string
  tier: Tier
  xp: number
  unlockedAt: number
}

/** A Bible reading said to the end (every sentence accepted, or skipped after three tries). */
export interface BibleReadingRow {
  /** `<translation>.<BOOK>.<index>` */
  readingId: string
  translation: BibleTranslation
  /** Book code, e.g. `GEN`. */
  book: string
  /** 0-based reading within the book. */
  index: number
  /** Readings in the whole book (lets book completion be counted without the book file). */
  ofBook: number
  completedAt: number
  dayKey: DayKey
  /** Sentences skipped after three failed tries. */
  skipped: number
}

/** The latest card received from a friend (friends' leaderboard, no server). */
export interface FriendRow extends FriendCard {
  receivedAt: number
}

export type XpReason = 'segment' | 'textComplete' | 'sessionComplete' | 'dailyGoal' | 'achievement'

export interface XpLedgerRow {
  id?: number
  timestamp: number
  dayKey: DayKey
  reason: XpReason
  amount: number
  /** Attempt id, run id, achievement key or day key the award refers to. */
  refId?: string
}

export type ThemePreference = 'system' | 'light' | 'dark'
export type FontSize = 'sm' | 'md' | 'lg'

export interface AppSettings {
  uiLang: Lang
  theme: ThemePreference
  engine: 'auto' | EngineId
  whisperModel: 'tiny' | 'base'
  strictness: Strictness
  /** Hour (0–6) at which a new day starts. */
  dayStartHour: number
  /** Accepted segments per day (1–150). */
  dailyGoal: number
  handsFree: boolean
  saveTranscripts: boolean
  fontSize: FontSize
  listenFirst: boolean
  grammaticalForm: GrammaticalForm
  contentFocus: ContentFocus
  /** `HH:MM`, used for the calendar reminder. */
  reminderTime: string
  onboardingCompleted: boolean
  speechPrivacyAcknowledged: boolean
  /** The figure shown as the user's avatar. */
  character: CharacterId
  /** Chime for every accepted sentence. */
  sounds: boolean
  /** Name on shared cards and friends' leaderboards; empty = the character's name. */
  displayName: string
  /** Bible challenge translation; unset = the one in the interface language. */
  bibleTranslation?: BibleTranslation
}

export interface GameState {
  freezesAvailable: number
  /** Streak value that last earned a freeze (prevents double awards). */
  lastFreezeAwardStreak: number
  perfectSessions: number
  fullSessions: number
  comebacks: number
  /** Cached sum of the XP ledger. */
  totalXp: number
  /** Days bridged by freezes that the user has not been told about yet. */
  pendingFreezeNotice: DayKey[]
}

export interface MetaState {
  schemaVersion: number
  seedVersion: number
  installedAt: number
  lastBackupAt?: number
  backupReminderSnoozedAt?: number
  /** Random id of this install on friend cards, so a friend's board updates instead of duplicating. */
  shareId?: string
}

export type SettingsRow =
  | { key: 'app'; value: AppSettings }
  | { key: 'game'; value: GameState }
  | { key: 'meta'; value: MetaState }
