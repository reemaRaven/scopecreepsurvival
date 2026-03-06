import type { GameEvent, StatDelta } from '../types/index.js'
import { SCOPE_CREEP_OVERFLOW } from '../types/index.js'
import { SCOPE_OVERFLOW_DELTA } from './StatsEngine.js'
import { mulberry32 } from './RNG.js'

// ── Event queue builders ──────────────────────────────────────────────────────

/**
 * Build the event queue for a scenario outcome.
 * randomEvent always fires (rarity 1).
 * rareEvent fires based on its rarity value.
 */
export function buildEventQueue(
  randomEvent: GameEvent,
  rareEvent: GameEvent,
  seed: number
): { queue: GameEvent[]; nextSeed: number } {
  const { value, nextSeed } = mulberry32(seed)
  const queue: GameEvent[] = [randomEvent]
  if (value < rareEvent.rarity) queue.push(rareEvent)
  return { queue, nextSeed }
}

/** Check and fire scope creep overflow if counter hits threshold */
export function checkScopeCreep(
  count: number,
  choice_triggered_scope_creep: boolean
): { newCount: number; overflowEvent: GameEvent | null } {
  const newCount = choice_triggered_scope_creep ? count + 1 : count
  if (newCount >= SCOPE_CREEP_OVERFLOW) {
    return {
      newCount: 0,  // reset after overflow
      overflowEvent: SCOPE_OVERFLOW_EVENT,
    }
  }
  return { newCount, overflowEvent: null }
}

/** Roll for Tech Debt Bomb explosion */
export function rollTechDebtBomb(
  explosionChance: number,
  seed: number
): { explodes: boolean; nextSeed: number } {
  const { value, nextSeed } = mulberry32(seed)
  return { explodes: value < explosionChance, nextSeed }
}

// ── Predefined System Events ──────────────────────────────────────────────────

export const SCOPE_OVERFLOW_EVENT: GameEvent = {
  id: 'e-system-scope-overflow',
  type: 'cascade',
  rarity: 1,
  title: '🚨 Scope Overflow',
  description: 'The hidden accumulation of small yeses has reached a breaking point. The sprint is buckling under the weight of what was "just one small thing".',
  statDelta: SCOPE_OVERFLOW_DELTA,
  itemDropped: null,
  questUnlocked: null,
}

export const TECH_DEBT_EXPLOSION_EVENT: GameEvent = {
  id: 'e-system-tech-debt-bomb',
  type: 'cascade',
  rarity: 1,
  title: '💣 Tech Debt Bomb Explodes',
  description: 'The deferred refactor you\'ve been carrying finally detonated. At the worst possible time. As predicted by every engineer who mentioned it.',
  statDelta: {
    deliverySpeed: -12,
    modelQuality: -2,
    teamHealth: -1,
  },
  itemDropped: null,
  questUnlocked: null,
}

export const DAY_MODIFIER_EVENT = (title: string, description: string, statDelta: StatDelta): GameEvent => ({
  id: 'e-system-day-modifier',
  type: 'day-modifier',
  rarity: 1,
  title,
  description,
  statDelta,
  itemDropped: null,
  questUnlocked: null,
})
