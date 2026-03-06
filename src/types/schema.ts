// ─── ScopeCreep Survival — Full Type Schema v2 ───────────────────────────────
// This is the authoritative data contract for all game content.

// ── Primitives ────────────────────────────────────────────────────────────────

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

// ── Stat Delta ────────────────────────────────────────────────────────────────
// All fields optional; omitted = 0 change.
// riskCompliance: POSITIVE = MORE RISK (bad). Negative = safer.

export interface StatDelta {
  stakeholderTrust?: number  // −5 to +5 per event
  teamHealth?: number
  modelQuality?: number
  deliverySpeed?: number     // −10 to +10 per event (range 0–100)
  riskCompliance?: number    // positive = more risk
}

// ── Stats (live player state) ─────────────────────────────────────────────────

export interface Stats {
  stakeholderTrust: number   // 0–10
  teamHealth: number         // 0–10
  modelQuality: number       // 0–10
  deliverySpeed: number      // 0–100
  riskCompliance: number     // 0–10 (10 = game-over zone)
}

// ── Choice ────────────────────────────────────────────────────────────────────

export interface Choice {
  id: string
  text: string                  // button label shown to player
  consequence: string           // narrative text shown after choosing
  statDelta: StatDelta
  itemGained: string | null     // InventoryItem.id
  itemConsumed: string | null   // InventoryItem.id required to unlock this choice
  questProgress: string | null  // Quest.id to increment
  requiresLevel?: number        // hidden unless player is at this level+
}

// ── Event ─────────────────────────────────────────────────────────────────────

export interface GameEvent {
  id: string
  type: EventType
  rarity: number                // 0–1; 1 = always fires, 0.1 = 10% chance
  title: string
  description: string
  statDelta: StatDelta
  itemDropped: string | null    // InventoryItem.id
  questUnlocked: string | null  // Quest.id this event activates
}

// ── Scenario ──────────────────────────────────────────────────────────────────

export interface Scenario {
  id: string
  type: ScenarioType
  title: string
  flavor: string                // italic context line (time, mood, setting)
  description: string           // the situation paragraph
  choices: [Choice, Choice] | [Choice, Choice, Choice]  // exactly 2 or 3
  randomEvent: GameEvent        // always fires after choice resolves (rarity: 1)
  rareEvent: GameEvent          // fires only if Math.random() < rarity
}

// ── Phase ─────────────────────────────────────────────────────────────────────

export interface Phase {
  id: string                    // e.g. "day-1-morning"
  phase: PhaseId
  scenario: Scenario
}

// ── Quest ─────────────────────────────────────────────────────────────────────

export interface QuestReward {
  statDelta?: StatDelta
  itemId?: string               // InventoryItem.id granted on completion
  xp: number
}

export interface Quest {
  id: string
  title: string
  description: string
  type: QuestType
  steps: number                 // total steps to complete
  reward: QuestReward
  failPenalty: StatDelta | null
  expiresDay: number | null     // null = persists; number = must complete by this day
  hidden: boolean               // if true, only revealed when first progressed
}

// ── Inventory Item ────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  name: string
  emoji: string
  description: string
  flavor: string                // tooltip lore text
  effect: StatDelta
  uses: number                  // −1 = unlimited; 1 = single-use
  category: ItemCategory
  unlocksAtLevel?: number       // item appears in shop/drops only at this level
}

// ── Day ───────────────────────────────────────────────────────────────────────

export interface DayModifier {
  id: string
  title: string
  description: string
  statDelta: StatDelta          // applied at start of day, before any choices
}

export interface Day {
  id: string                    // "day-1"
  dayNumber: number             // 1–5
  brief: string                 // shown at day-start screen
  modifier: DayModifier | null  // optional day-wide stat modifier (e.g. "All-Hands Day")
  phases: [Phase, Phase, Phase, Phase]  // always exactly 4: morning, midday, afternoon, evening
  quests: Quest[]               // quests active/unlockable this day
}

// ── Full Game Content File ────────────────────────────────────────────────────
// Each day-N.json conforms to Day.
// items.json is InventoryItem[].
// This schema is the source of truth for all JSON authoring.
