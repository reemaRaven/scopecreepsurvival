import type { MetaSave, GameState, Achievement, StatDelta } from '../types/index.js'
import achievementsData from '../data/achievements.json'
import metaData from '../data/meta-progression.json'

const META_KEY = 'scopecreep_meta'
const META_VERSION = 1

interface MetaEnvelope {
  version: number
  meta: MetaSave
}

const ALL_ACHIEVEMENTS = achievementsData as Achievement[]

// ── Role data (typed slice of meta-progression.json) ─────────────────────────

interface RoleEntry {
  id: string
  startingBonusStats: Partial<StatDelta>
  unlockCondition: string
}

interface DifficultyEntry {
  id: string
  unlockCondition: string
  modifiers: {
    teamHealthStart?: number
    stakeholderTrustStart?: number
    deliverySpeedStart?: number
    startingItem?: string
    riskGameOverThreshold?: number
    hotbarSize?: number
    deltaMultiplier?: number
    noItems?: boolean
  }
}

const ROLES = metaData.roles as RoleEntry[]
const DIFFICULTIES = metaData.difficulties as DifficultyEntry[]

// ── Persistence ───────────────────────────────────────────────────────────────

export function defaultMeta(): MetaSave {
  return {
    version: META_VERSION,
    totalRuns: 0,
    totalWins: 0,
    bestScore: 0,
    highestLevel: 1,
    achievements: [],
    activeRole: 'ai-pm',
    activeDifficulty: 'normal',
  }
}

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return defaultMeta()
    const envelope = JSON.parse(raw) as MetaEnvelope
    if (envelope.version !== META_VERSION) return defaultMeta()
    return envelope.meta
  } catch {
    return defaultMeta()
  }
}

export function saveMeta(meta: MetaSave): void {
  try {
    const envelope: MetaEnvelope = { version: META_VERSION, meta }
    localStorage.setItem(META_KEY, JSON.stringify(envelope))
  } catch {
    // ignore quota / private browsing
  }
}

// ── Role helpers ──────────────────────────────────────────────────────────────

export function getRoleBonus(roleId: string): StatDelta {
  const role = ROLES.find(r => r.id === roleId)
  return (role?.startingBonusStats ?? {}) as StatDelta
}

export function isRoleUnlocked(roleId: string, meta: MetaSave): boolean {
  const role = ROLES.find(r => r.id === roleId)
  if (!role) return false
  if (role.unlockCondition === 'default') return true
  if (role.unlockCondition.startsWith('total_wins_')) {
    const required = parseInt(role.unlockCondition.replace('total_wins_', ''), 10)
    return meta.totalWins >= required
  }
  return false
}

// ── Difficulty helpers ────────────────────────────────────────────────────────

export interface DifficultyConfig {
  teamHealthStart?: number
  stakeholderTrustStart?: number
  deliverySpeedStart?: number
  startingItem?: string
  riskGameOverThreshold: number
  hotbarSizeLimit: number
  deltaMultiplier: number
  noItemsMode: boolean
}

export function getDifficultyConfig(difficultyId: string): DifficultyConfig {
  const diff = DIFFICULTIES.find(d => d.id === difficultyId)
  const m = diff?.modifiers ?? {}
  return {
    teamHealthStart: m.teamHealthStart,
    stakeholderTrustStart: m.stakeholderTrustStart,
    deliverySpeedStart: m.deliverySpeedStart,
    startingItem: m.startingItem,
    riskGameOverThreshold: m.riskGameOverThreshold ?? 10,
    hotbarSizeLimit: m.hotbarSize ?? 9,
    deltaMultiplier: m.deltaMultiplier ?? 1,
    noItemsMode: m.noItems ?? false,
  }
}

export function isDifficultyUnlocked(diffId: string, meta: MetaSave): boolean {
  const diff = DIFFICULTIES.find(d => d.id === diffId)
  if (!diff) return false
  if (diff.unlockCondition === 'default') return true
  if (diff.unlockCondition.startsWith('total_wins_')) {
    const required = parseInt(diff.unlockCondition.replace('total_wins_', ''), 10)
    return meta.totalWins >= required
  }
  if (diff.unlockCondition.startsWith('achievement_')) {
    const achId = diff.unlockCondition.replace('achievement_', '')
    return meta.achievements.includes(achId)
  }
  return false
}

// ── Achievement checking ──────────────────────────────────────────────────────

/**
 * Given completed run state and current meta, return IDs of achievements
 * newly earned this run (not already in meta.achievements).
 */
export function checkAchievements(state: GameState, meta: MetaSave): string[] {
  const earned: string[] = []
  const already = new Set(meta.achievements)

  function check(id: string, condition: boolean) {
    if (condition && !already.has(id)) earned.push(id)
  }

  const { stats, bossesDefeated, scopeCreepTriggered, techDebtExploded,
          hadDoubleCritical, noScopeCreepChoices, level, xp } = state
  const won = state.status === 'victory'

  // Completion
  check('first-blood', true)  // always earns on run end
  check('first-win', won)

  // Stat-based wins
  check('safety-first',    won && stats.riskCompliance <= 1)
  check('speed-demon',     won && stats.deliverySpeed >= 90)
  check('team-player',     won && stats.teamHealth >= 9)
  check('trust-builder',   won && stats.stakeholderTrust >= 9)
  check('quality-obsessed',won && stats.modelQuality >= 9)
  check('balanced-pm',     won &&
    stats.stakeholderTrust >= 6 && stats.teamHealth >= 6 &&
    stats.modelQuality >= 6 && stats.deliverySpeed >= 60)

  // Survival achievements
  check('comeback-kid',        won && hadDoubleCritical)
  check('scope-creep-survivor', won && scopeCreepTriggered)
  check('tech-debt-defused',   won && techDebtExploded)

  // Boss achievements
  const bossCount = bossesDefeated.length
  check('boss-slayer',         bossCount >= 1)
  check('demo-day-champion',   bossesDefeated.includes('boss-demo-day'))
  check('incident-commander',  bossesDefeated.includes('boss-model-incident'))
  check('security-cleared',    bossesDefeated.includes('boss-procurement'))
  check('triple-boss',         bossCount >= 3)

  // Level / veteran
  check('level-10',  level >= 10)
  check('veteran',   (meta.totalRuns + 1) >= 10)

  // Score (inline calc — mirrors BossEngine.calcScore)
  const score =
    Math.round(stats.stakeholderTrust * 10 + stats.deliverySpeed +
      stats.modelQuality * 8 - stats.riskCompliance * 5 + xp / 10)
  check('legendary-pm', won && score >= 800)

  // Scope defender
  check('no-scope-creep', won && noScopeCreepChoices)

  return earned
}

/**
 * Returns the Achievement objects for the given IDs.
 */
export function getAchievementsByIds(ids: string[]): Achievement[] {
  return ids
    .map(id => ALL_ACHIEVEMENTS.find(a => a.id === id))
    .filter((a): a is Achievement => a !== undefined)
}

// ── Post-run meta update ──────────────────────────────────────────────────────

export interface RunResult {
  won: boolean
  score: number
  level: number
  newAchievementIds: string[]
}

export function updateMetaAfterRun(meta: MetaSave, result: RunResult): MetaSave {
  const allAchievements = [
    ...new Set([...meta.achievements, ...result.newAchievementIds]),
  ]
  return {
    ...meta,
    totalRuns: meta.totalRuns + 1,
    totalWins: result.won ? meta.totalWins + 1 : meta.totalWins,
    bestScore: Math.max(meta.bestScore, result.score),
    highestLevel: Math.max(meta.highestLevel, result.level),
    achievements: allAchievements,
  }
}
