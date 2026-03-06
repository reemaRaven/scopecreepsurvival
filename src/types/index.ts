// ─── ScopeCreep Survival — Runtime Types v2 ──────────────────────────────────

// ── Data Contract Types (match JSON schema) ───────────────────────────────────

export type PhaseId = 'morning' | 'midday' | 'afternoon' | 'evening'

export type ScenarioType =
  | 'standup'
  | 'backlog'
  | 'escalation'
  | 'model-evals'
  | 'privacy-review'
  | 'demo-day'
  | 'incident'
  | 'leadership-update'

export type EventType = 'random' | 'rare' | 'cascade' | 'day-modifier'
export type ItemCategory = 'tool' | 'document' | 'consumable' | 'artifact'
export type QuestType = 'daily' | 'sprint' | 'hidden'

// ── Stats ─────────────────────────────────────────────────────────────────────
// riskCompliance: higher = MORE risk = WORSE. All others: higher = better.

export interface Stats {
  stakeholderTrust: number  // 0–10
  teamHealth: number        // 0–10
  modelQuality: number      // 0–10
  deliverySpeed: number     // 0–100
  riskCompliance: number    // 0–10 (≥10 for 2 phases = game over)
}

export interface StatDelta {
  stakeholderTrust?: number  // −5 to +5
  teamHealth?: number
  modelQuality?: number
  deliverySpeed?: number     // −15 to +15
  riskCompliance?: number    // positive = worse
}

// ── Items ─────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  name: string
  emoji: string
  description: string
  flavor: string
  effect: StatDelta
  uses: number             // −1 = unlimited; positive = number of uses
  category: ItemCategory
  unlocksAtLevel?: number
}

export interface InventorySlot {
  item: InventoryItem
  usesRemaining: number    // tracks remaining uses for this slot instance
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface GameEvent {
  id: string
  type: EventType
  rarity: number           // 0–1; 1 = always fires
  title: string
  description: string
  statDelta: StatDelta
  itemDropped: string | null
  questUnlocked: string | null
}

// ── Choices & Scenarios ───────────────────────────────────────────────────────

export interface Choice {
  id: string
  text: string
  consequence: string
  statDelta: StatDelta
  itemGained: string | null
  itemConsumed: string | null  // item id required to use this choice
  questProgress: string | null
  requiresLevel?: number
  scopeCreep?: boolean         // increments hidden scope creep counter
}

export interface Scenario {
  id: string
  type: ScenarioType
  title: string
  flavor: string
  description: string
  choices: Choice[]
  randomEvent: GameEvent
  rareEvent: GameEvent
}

export interface Phase {
  id: string
  phase: PhaseId
  scenario: Scenario
}

// ── Quests ────────────────────────────────────────────────────────────────────

export interface QuestReward {
  statDelta?: StatDelta
  itemId?: string | null
  xp: number
}

export interface Quest {
  id: string
  title: string
  description: string
  type: QuestType
  steps: number
  reward: QuestReward
  failPenalty: StatDelta | null
  expiresDay: number | null
  hidden: boolean
}

export interface ActiveQuest {
  quest: Quest
  currentStep: number
  completed: boolean
  failed: boolean
}

// ── Day ───────────────────────────────────────────────────────────────────────

export interface DayModifier {
  id: string
  title: string
  description: string
  statDelta: StatDelta
}

export interface Day {
  id: string
  dayNumber: number
  brief: string
  modifier: DayModifier | null
  phases: [Phase, Phase, Phase, Phase]
  quests: Quest[]
}

// ── Game State ────────────────────────────────────────────────────────────────

export type GameStatus =
  | 'start'
  | 'day-intro'
  | 'phase-intro'
  | 'scenario'
  | 'consequence'
  | 'event'
  | 'day-summary'
  | 'level-up'
  | 'game-over'
  | 'victory'
  | 'boss-intro'
  | 'boss-round'
  | 'boss-consequence'
  | 'boss-victory'
  | 'boss-defeat'

export interface GameState {
  // Position
  dayNumber: number
  phase: PhaseId

  // Core stats
  stats: Stats

  // Inventory (hotbar)
  inventory: InventorySlot[]

  // Quests
  activeQuests: ActiveQuest[]
  completedQuestIds: string[]

  // XP & progression
  xp: number
  level: number
  pendingLevelUp: boolean
  levelUnlock: string | null   // name of newly unlocked ability/item

  // Loaded day data
  currentDay: Day

  // Event queue: random event always queued; rare event conditionally queued
  eventQueue: GameEvent[]

  // UI state machine
  status: GameStatus

  // Screen data for consequence/event screens
  lastConsequence: string
  lastStatDelta: StatDelta
  lastItemGained: InventoryItem | null
  currentEvent: GameEvent | null

  // Hidden mechanics
  scopeCreepCount: number
  riskConsecutivePhases: number  // tracks consecutive high-risk phases

  // Deterministic RNG
  rngSeed: number

  // Boss encounter
  activeBoss: Boss | null
  bossRound: number
  bossMeterValue: number
  lastBossActionResult: string | null

  // Per-run tracking (for achievements)
  bossesDefeated: string[]
  scopeCreepTriggered: boolean
  techDebtExploded: boolean
  hadDoubleCritical: boolean
  noScopeCreepChoices: boolean

  // Run config (set from MetaSave at game start)
  activeRole: string
  activeDifficulty: string
  deltaMultiplier: number
  hotbarSizeLimit: number     // 9 default, overridable
  riskGameOverThreshold: number  // 10 default, overridable
  noItemsMode: boolean

  // Newly earned achievements (populated at run end for UI display)
  newlyEarnedAchievements: Achievement[]

  // History
  completedScenarioIds: string[]

  // End state
  gameOverReason: string
}

// ── Boss ──────────────────────────────────────────────────────────────────────

export interface BossAction {
  id: string
  text: string
  consequence: string
  statDelta: StatDelta
  meterDelta: number        // positive = boss stronger (or weaker if meterInverted)
  itemConsumed: string | null
}

export interface BossRound {
  id: string
  setup: string
  actions: [BossAction, BossAction, BossAction]
}

export interface Boss {
  id: string
  name: string
  title: string
  description: string
  triggerDay: number
  triggerPhase: PhaseId
  meterName: string
  meterStart: number        // 0–100
  meterWinThreshold: number
  meterLoseThreshold: number
  meterInverted: boolean    // true = higher meter is BETTER (Confidence)
  rounds: [BossRound, BossRound, BossRound]
  victoryConsequence: string
  defeatConsequence: string
  victoryDelta: StatDelta
  defeatDelta: StatDelta
  xpReward: number
}

// ── Achievement ───────────────────────────────────────────────────────────────

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
}

// ── Meta save (persists across runs) ─────────────────────────────────────────

export interface MetaSave {
  version: number
  totalRuns: number
  totalWins: number
  bestScore: number
  highestLevel: number
  achievements: string[]    // earned achievement ids
  activeRole: string        // 'ai-pm' | 'ai-tpm' | 'ai-program-lead'
  activeDifficulty: string  // difficulty id
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const INITIAL_STATS: Stats = {
  stakeholderTrust: 7,
  teamHealth:       8,
  modelQuality:     7,
  deliverySpeed:    50,
  riskCompliance:   2,
}

export const PHASE_ORDER: PhaseId[] = ['morning', 'midday', 'afternoon', 'evening']

export const PHASE_LABELS: Record<PhaseId, string> = {
  morning:   '☀  Morning Standup',
  midday:    '⚡  Midday Grind',
  afternoon: '🔥  Afternoon Sprint',
  evening:   '🌙  Evening Wrap',
}

export const MAX_DAYS = 5
export const HOTBAR_SIZE = 9
export const SCOPE_CREEP_OVERFLOW = 5   // counter triggers Scope Overflow event
export const RISK_GAME_OVER_THRESHOLD = 10
export const RISK_CONSECUTIVE_GAME_OVER = 2  // phases at max risk before game over
