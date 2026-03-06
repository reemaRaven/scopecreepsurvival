// ── XP Thresholds (cumulative XP to reach level N) ───────────────────────────
// Level 1 is start; level 10 is max across a 5-day run.

export const XP_PER_CHOICE = 5
export const XP_PER_DAY_COMPLETE = 30
export const XP_RARE_EVENT_SURVIVED = 25

export const XP_THRESHOLDS: number[] = [
  0,     // Lv 1
  50,    // Lv 2
  120,   // Lv 3
  220,   // Lv 4
  350,   // Lv 5
  500,   // Lv 6
  680,   // Lv 7
  900,   // Lv 8
  1150,  // Lv 9
  1440,  // Lv 10
  1760,  // Lv 11
  2120,  // Lv 12
  2530,  // Lv 13
  2990,  // Lv 14
  3500,  // Lv 15
  4070,  // Lv 16
  4700,  // Lv 17
  5400,  // Lv 18
  6180,  // Lv 19
  7050,  // Lv 20
]

// ── Level Unlocks ─────────────────────────────────────────────────────────────
// Maps level → display string shown on level-up screen.

export const LEVEL_UNLOCKS: Record<number, string> = {
  2:  'Cancel Meeting token unlocked (1 use/day)',
  3:  'Rubber Duck passive: absorb 1 teamHealth loss per phase',
  4:  'OKR Shield item unlocked: block 1 full trust damage',
  5:  'Roadmap Preview: see consequences before choosing',
  6:  'Tech Freeze: pause riskCompliance growth for 1 phase',
  7:  'On-Call Override: auto-survive 1 incident per day',
  8:  'Stakeholder Charm: +1 trust on all choices for 1 phase',
  9:  'PM Mode: all stats +1 for the final day',
  10: 'MAX LEVEL — secret ending unlocked',
  11: 'Boss encounters now trigger across all runs',
  12: 'War Room location unlocked',
  13: 'Understaffed + Skeptical Board difficulties unlocked',
  14: 'High Stakes difficulty unlocked',
  15: 'Strict Compliance difficulty unlocked',
  16: 'AI TPM role eligible (requires 1 win)',
  17: 'Lean Inventory + Speed Chess difficulties unlocked',
  18: 'Client Call location unlocked',
  19: 'AI Program Lead role eligible (requires 5 wins)',
  20: 'LEGENDARY — Chaos Mode, Iron PM & Demo Stage unlocked',
}

// ── Passive Unlocks (apply automatically each phase) ─────────────────────────

export function hasRubberDuckPassive(level: number): boolean {
  return level >= 3
}

export function hasRoadmapPreview(level: number): boolean {
  return level >= 5
}

// ── XP Calculations ───────────────────────────────────────────────────────────

export function getLevelFromXP(xp: number): number {
  let level = 1
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1
  }
  return Math.min(level, 20)
}

export function getXPToNextLevel(xp: number, level: number): number {
  if (level >= 10) return 0
  return XP_THRESHOLDS[level] - xp  // XP_THRESHOLDS[level] = threshold for level+1
}

export function getXPProgress(xp: number, level: number): number {
  if (level >= 10) return 100
  const levelStart = XP_THRESHOLDS[level - 1]
  const levelEnd = XP_THRESHOLDS[level]
  return Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100)
}

export interface AddXPResult {
  xp: number
  level: number
  leveledUp: boolean
  newUnlock: string | null
}

export function addXP(currentXP: number, currentLevel: number, amount: number): AddXPResult {
  const newXP = currentXP + amount
  const newLevel = getLevelFromXP(newXP)
  const leveledUp = newLevel > currentLevel
  return {
    xp: newXP,
    level: newLevel,
    leveledUp,
    newUnlock: leveledUp ? (LEVEL_UNLOCKS[newLevel] ?? null) : null,
  }
}
