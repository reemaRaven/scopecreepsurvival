import type { Stats, StatDelta } from '../types/index.js'
import { RISK_GAME_OVER_THRESHOLD, RISK_CONSECUTIVE_GAME_OVER } from '../types/index.js'
import { mulberry32 } from './RNG.js'

// ── Clamp rules ───────────────────────────────────────────────────────────────

const CAPS: Record<keyof Stats, { min: number; max: number }> = {
  stakeholderTrust: { min: 0, max: 10 },
  teamHealth:       { min: 0, max: 10 },
  modelQuality:     { min: 0, max: 10 },
  deliverySpeed:    { min: 0, max: 100 },
  riskCompliance:   { min: 0, max: 10 },
}

export function applyDelta(stats: Stats, delta: StatDelta): Stats {
  const next = { ...stats }
  for (const key of Object.keys(delta) as (keyof StatDelta)[]) {
    const d = delta[key] ?? 0
    next[key] = Math.min(CAPS[key].max, Math.max(CAPS[key].min, next[key] + d))
  }
  return next
}

export function applyDeltas(stats: Stats, deltas: StatDelta[]): Stats {
  return deltas.reduce<Stats>((s, d) => applyDelta(s, d), stats)
}

// ── Eval variance ─────────────────────────────────────────────────────────────
// Model-evals scenarios add a ±2 random noise to modelQuality changes.

export function withEvalVariance(
  delta: StatDelta,
  seed: number
): { delta: StatDelta; nextSeed: number } {
  if (delta.modelQuality === undefined) return { delta, nextSeed: seed }
  const { value, nextSeed } = mulberry32(seed)
  const noise = Math.floor(value * 5) - 2  // −2 to +2
  return { delta: { ...delta, modelQuality: delta.modelQuality + noise }, nextSeed }
}

// ── Win / Lose checks ────────────────────────────────────────────────────────

export interface GameOverResult {
  over: boolean
  reason: string
}

export function checkGameOver(
  stats: Stats,
  riskConsecutivePhases: number,
  riskThreshold = RISK_GAME_OVER_THRESHOLD
): GameOverResult {
  if (stats.teamHealth <= 0) {
    return {
      over: true,
      reason: 'Team Health hit zero. The engineers have gone quiet. The PR is still open. Nobody is reviewing it.',
    }
  }
  if (stats.stakeholderTrust <= 0) {
    return {
      over: true,
      reason: 'Stakeholder Trust collapsed. You have been moved to an advisory role. The advisory role has no meetings, which is somehow worse.',
    }
  }
  if (stats.modelQuality <= 0) {
    return {
      over: true,
      reason: 'Model Quality reached zero. The AI shipped. Users noticed. The phrase "hallucination" appeared in a TechCrunch headline with your product name.',
    }
  }
  if (stats.deliverySpeed <= 0) {
    return {
      over: true,
      reason: 'Delivery Speed collapsed. The sprint has been running for three weeks. Nothing has shipped. The board has questions.',
    }
  }
  if (
    stats.riskCompliance >= riskThreshold &&
    riskConsecutivePhases >= RISK_CONSECUTIVE_GAME_OVER
  ) {
    return {
      over: true,
      reason: 'Compliance Risk maxed out for two consecutive phases. Legal has issued a hold. The EU is involved. You are in a very long video call.',
    }
  }
  return { over: false, reason: '' }
}

export function isVictory(stats: Stats): boolean {
  return stats.deliverySpeed >= 40
}

export function getVictoryGrade(stats: Stats): 'legendary' | 'gold' | 'standard' {
  const allHigh = (
    stats.stakeholderTrust >= 7 &&
    stats.teamHealth >= 7 &&
    stats.modelQuality >= 7
  )
  if (allHigh && stats.deliverySpeed >= 70) return 'legendary'
  if (stats.stakeholderTrust >= 6 && stats.teamHealth >= 6) return 'gold'
  return 'standard'
}

// ── Scope Overflow event ──────────────────────────────────────────────────────

export const SCOPE_OVERFLOW_DELTA: StatDelta = {
  deliverySpeed: -15,
  teamHealth: -2,
  stakeholderTrust: -1,
}

// ── Tech Debt Bomb explosion ──────────────────────────────────────────────────

export const TECH_DEBT_EXPLOSION_DELTA: StatDelta = {
  deliverySpeed: -12,
  modelQuality: -2,
  teamHealth: -1,
}

export const TECH_DEBT_EXPLOSION_CHANCE = 0.30  // 30% per day

// ── Display helpers ───────────────────────────────────────────────────────────

export function formatDelta(_key: keyof Stats, value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value}`
}

export function isStatCritical(stats: Stats): Partial<Record<keyof Stats, boolean>> {
  return {
    stakeholderTrust: stats.stakeholderTrust <= 2,
    teamHealth:       stats.teamHealth <= 2,
    modelQuality:     stats.modelQuality <= 2,
    deliverySpeed:    stats.deliverySpeed <= 15,
    riskCompliance:   stats.riskCompliance >= 8,
  }
}
