import type { Boss, BossAction, GameState, StatDelta } from '../types/index.js'
import bossesData from '../data/bosses.json'

const BOSSES = bossesData as unknown as Boss[]
const BOSS_MAP = new Map(BOSSES.map(b => [b.id, b]))

// ── Lookup ────────────────────────────────────────────────────────────────────

export function getBoss(id: string): Boss | undefined {
  return BOSS_MAP.get(id)
}

export function getAllBosses(): Boss[] {
  return BOSSES
}

/**
 * Returns the boss that should trigger for this day/phase, or null.
 * A boss only triggers once per run — defeated bosses are skipped.
 */
export function checkBossTrigger(
  dayNumber: number,
  phase: string,
  bossesDefeated: string[],
): Boss | null {
  const boss = BOSSES.find(
    b => b.triggerDay === dayNumber && b.triggerPhase === phase
  )
  if (!boss) return null
  if (bossesDefeated.includes(boss.id)) return null
  return boss
}

// ── Meter helpers ─────────────────────────────────────────────────────────────

/**
 * Apply a meterDelta to the current meter value.
 * For inverted meters (Confidence), higher is better so the win/lose
 * thresholds are flipped — but meterDelta direction is the same (positive =
 * more favourable from the boss's perspective for normal, more confidence
 * for inverted).
 */
export function applyMeterDelta(
  current: number,
  delta: number,
  inverted: boolean
): number {
  const next = inverted ? current + delta : current + delta
  return Math.max(0, Math.min(100, next))
}

/** True when the boss meter has crossed its instant-lose boundary. */
export function isMeterInstantLose(
  value: number,
  boss: Boss,
): boolean {
  if (boss.meterInverted) return value <= boss.meterLoseThreshold
  return value >= boss.meterLoseThreshold
}

/** True when the boss meter satisfies the win condition after 3 rounds. */
export function isMeterWin(value: number, boss: Boss): boolean {
  if (boss.meterInverted) return value >= boss.meterWinThreshold
  return value <= boss.meterWinThreshold
}

/** 0–100 fill percentage for the meter bar (100 = full bar). */
export function meterFillPct(value: number, boss: Boss): number {
  if (boss.meterInverted) {
    // Higher value = more confident = more fill
    return Math.round(value)
  }
  return Math.round(value)
}

// ── Action resolution ─────────────────────────────────────────────────────────

export function getBossAction(
  boss: Boss,
  roundIndex: number,
  actionId: string,
): BossAction | null {
  const round = boss.rounds[roundIndex as 0 | 1 | 2]
  if (!round) return null
  return round.actions.find(a => a.id === actionId) ?? null
}

// ── Score calculation (reused from victory screen) ────────────────────────────

export function calcScore(state: GameState): number {
  return Math.round(
    state.stats.stakeholderTrust * 10 +
    state.stats.deliverySpeed +
    state.stats.modelQuality * 8 -
    state.stats.riskCompliance * 5 +
    state.xp / 10
  )
}

// ── Stat delta scaling (chaos mode) ──────────────────────────────────────────

export function scaleDelta(delta: StatDelta, multiplier: number): StatDelta {
  if (multiplier === 1) return delta
  const out: StatDelta = {}
  for (const key of Object.keys(delta) as (keyof StatDelta)[]) {
    const v = delta[key]
    if (v !== undefined) out[key] = Math.round(v * multiplier)
  }
  return out
}
