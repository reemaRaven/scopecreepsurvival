import type { GameState, Choice, GameEvent } from '../types/index.js'
import { INITIAL_STATS, PHASE_ORDER } from '../types/index.js'
import { applyDelta, checkGameOver, withEvalVariance, TECH_DEBT_EXPLOSION_CHANCE } from './StatsEngine.js'
import { createSeed } from './RNG.js'
import { addItemById, useItem as useItemFromSlot, hasTechDebtBomb, removeTechDebtBomb } from './InventoryEngine.js'
import { initQuests, progressQuest, resolveCompletedQuests, failExpiredQuests, unlockHiddenQuest } from './QuestEngine.js'
import { addXP, XP_PER_CHOICE, XP_PER_DAY_COMPLETE, XP_RARE_EVENT_SURVIVED } from './XPEngine.js'
import { buildEventQueue, checkScopeCreep, rollTechDebtBomb, TECH_DEBT_EXPLOSION_EVENT, DAY_MODIFIER_EVENT } from './EventEngine.js'
import { getScenario, advanceFromPhase, loadDay } from './PhaseEngine.js'
import { checkBossTrigger, applyMeterDelta, isMeterInstantLose, isMeterWin, getBossAction, scaleDelta, calcScore } from './BossEngine.js'
import { loadMeta, getDifficultyConfig, getRoleBonus, checkAchievements, updateMetaAfterRun, saveMeta, getAchievementsByIds } from './MetaEngine.js'

// ── Engine Action Types ───────────────────────────────────────────────────────

export type EngineAction =
  | { type: 'start' }
  | { type: 'continue' }
  | { type: 'choose'; choice: Choice }
  | { type: 'use-item'; slotIndex: number }
  | { type: 'boss-action'; actionId: string }
  | { type: 'restart' }

// ── Initial State ─────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  const meta = loadMeta()
  const difficulty = getDifficultyConfig(meta.activeDifficulty)
  const roleBonus = getRoleBonus(meta.activeRole)

  const baseStats = { ...INITIAL_STATS }
  // Apply role bonuses
  if (roleBonus.stakeholderTrust) baseStats.stakeholderTrust = Math.max(0, Math.min(10, baseStats.stakeholderTrust + roleBonus.stakeholderTrust))
  if (roleBonus.teamHealth)       baseStats.teamHealth       = Math.max(0, Math.min(10, baseStats.teamHealth       + (roleBonus.teamHealth ?? 0)))
  if (roleBonus.modelQuality)     baseStats.modelQuality     = Math.max(0, Math.min(10, baseStats.modelQuality     + (roleBonus.modelQuality ?? 0)))
  if (roleBonus.deliverySpeed)    baseStats.deliverySpeed    = Math.max(0, Math.min(100, baseStats.deliverySpeed   + (roleBonus.deliverySpeed ?? 0)))
  if (roleBonus.riskCompliance)   baseStats.riskCompliance   = Math.max(0, Math.min(10, baseStats.riskCompliance   + (roleBonus.riskCompliance ?? 0)))

  // Apply difficulty stat overrides
  if (difficulty.teamHealthStart        !== undefined) baseStats.teamHealth       = difficulty.teamHealthStart
  if (difficulty.stakeholderTrustStart  !== undefined) baseStats.stakeholderTrust = difficulty.stakeholderTrustStart
  if (difficulty.deliverySpeedStart     !== undefined) baseStats.deliverySpeed    = difficulty.deliverySpeedStart

  const firstDay = loadDay(1)
  let inventory = addItemById([], 'rubber-duck')  // always start with rubber duck

  if (difficulty.startingItem) {
    inventory = addItemById(inventory, difficulty.startingItem)
  }

  return {
    dayNumber: 1,
    phase: PHASE_ORDER[0],
    stats: baseStats,
    inventory,
    activeQuests: initQuests(firstDay.quests),
    completedQuestIds: [],
    xp: 0,
    level: 1,
    pendingLevelUp: false,
    levelUnlock: null,
    currentDay: firstDay,
    eventQueue: [],
    status: 'start',
    lastConsequence: '',
    lastStatDelta: {},
    lastItemGained: null,
    currentEvent: null,
    scopeCreepCount: 0,
    riskConsecutivePhases: 0,
    completedScenarioIds: [],
    gameOverReason: '',
    rngSeed: createSeed(),
    // Boss
    activeBoss: null,
    bossRound: 0,
    bossMeterValue: 0,
    lastBossActionResult: null,
    bossesDefeated: [],
    // Per-run tracking
    scopeCreepTriggered: false,
    techDebtExploded: false,
    hadDoubleCritical: false,
    noScopeCreepChoices: true,
    // Run config from meta
    activeRole: meta.activeRole,
    activeDifficulty: meta.activeDifficulty,
    deltaMultiplier: difficulty.deltaMultiplier,
    hotbarSizeLimit: difficulty.hotbarSizeLimit,
    riskGameOverThreshold: difficulty.riskGameOverThreshold,
    noItemsMode: difficulty.noItemsMode,
    newlyEarnedAchievements: [],
  }
}

// ── State Machine ─────────────────────────────────────────────────────────────

export function transition(state: GameState, action: EngineAction): GameState {
  switch (action.type) {
    case 'restart':
      return createInitialState()

    case 'start':
      return { ...state, status: 'day-intro' }

    case 'continue':
      return handleContinue(state)

    case 'choose':
      return handleChoose(state, action.choice)

    case 'use-item':
      return handleUseItem(state, action.slotIndex)

    case 'boss-action':
      return handleBossAction(state, action.actionId)

    default:
      return state
  }
}

// ── Continue Handler ──────────────────────────────────────────────────────────

function handleContinue(state: GameState): GameState {
  switch (state.status) {

    // day-intro: apply day modifier if present, then go to first phase
    case 'day-intro': {
      const { currentDay } = state
      let nextStats = state.stats

      // Tech Debt Bomb check at start of each day (except day 1)
      let eventQueue: GameEvent[] = []
      let inventory = state.inventory
      let rngSeed = state.rngSeed
      let techDebtExploded = state.techDebtExploded
      if (state.dayNumber > 1 && hasTechDebtBomb(inventory)) {
        const roll = rollTechDebtBomb(TECH_DEBT_EXPLOSION_CHANCE, rngSeed)
        rngSeed = roll.nextSeed
        if (roll.explodes) {
          eventQueue = [TECH_DEBT_EXPLOSION_EVENT]
          inventory = removeTechDebtBomb(inventory)
          techDebtExploded = true
        }
      }

      // Fail any expired quests from previous day
      const { quests: updatedQuests, penaltyDelta } = failExpiredQuests(
        state.activeQuests, state.dayNumber
      )
      if (Object.keys(penaltyDelta).length > 0) {
        nextStats = applyDelta(nextStats, penaltyDelta)
      }

      // Add new day's quests (exclude already-known quest ids)
      const existingIds = new Set(updatedQuests.map(q => q.quest.id))
      const newQuests = initQuests(currentDay.quests.filter(q => !existingIds.has(q.id)))
      const allQuests = [...updatedQuests, ...newQuests]

      // If day has a modifier, queue it as the first event
      if (currentDay.modifier) {
        const modEvent = DAY_MODIFIER_EVENT(
          currentDay.modifier.title,
          currentDay.modifier.description,
          currentDay.modifier.statDelta
        )
        eventQueue = [modEvent, ...eventQueue]
      }

      if (eventQueue.length > 0) {
        const [currentEvent, ...rest] = eventQueue
        return {
          ...state,
          stats: nextStats,
          inventory,
          activeQuests: allQuests,
          eventQueue: rest,
          currentEvent,
          rngSeed,
          techDebtExploded,
          status: 'event',
        }
      }

      return {
        ...state,
        stats: nextStats,
        inventory,
        activeQuests: allQuests,
        rngSeed,
        techDebtExploded,
        status: 'phase-intro',
      }
    }

    // phase-intro: check for boss trigger before going to scenario
    case 'phase-intro': {
      const boss = checkBossTrigger(state.dayNumber, state.phase, state.bossesDefeated)
      if (boss) {
        return {
          ...state,
          activeBoss: boss,
          bossRound: 0,
          bossMeterValue: boss.meterStart,
          lastBossActionResult: null,
          status: 'boss-intro',
        }
      }
      return { ...state, status: 'scenario' }
    }

    // consequence: drain event queue or advance phase
    case 'consequence': {
      if (state.eventQueue.length > 0) {
        const [currentEvent, ...rest] = state.eventQueue
        const nextStats = applyDelta(state.stats, currentEvent.statDelta)
        let nextInventory = state.inventory
        let nextQuests = state.activeQuests

        // Handle item drop
        if (currentEvent.itemDropped) {
          nextInventory = addItemById(nextInventory, currentEvent.itemDropped)
        }
        // Handle quest unlock
        if (currentEvent.questUnlocked) {
          nextQuests = unlockHiddenQuest(nextQuests, currentEvent.questUnlocked, state.currentDay.quests)
        }

        // XP for surviving rare event
        const xpGain = currentEvent.type === 'rare' ? XP_RARE_EVENT_SURVIVED : 0
        const xpResult = addXP(state.xp, state.level, xpGain)

        const gameOver = checkGameOver(nextStats, state.riskConsecutivePhases, state.riskGameOverThreshold)
        if (gameOver.over) {
          return endRun(state, { ...state, stats: nextStats, inventory: nextInventory, status: 'game-over', gameOverReason: gameOver.reason })
        }

        return {
          ...state,
          stats: nextStats,
          inventory: nextInventory,
          activeQuests: nextQuests,
          xp: xpResult.xp,
          level: xpResult.level,
          pendingLevelUp: xpResult.leveledUp,
          levelUnlock: xpResult.newUnlock,
          eventQueue: rest,
          currentEvent,
          status: 'event',
        }
      }

      // No more events — advance phase
      return advancePhase(state)
    }

    // event: drain remaining queue or advance
    case 'event': {
      if (state.eventQueue.length > 0) {
        const [currentEvent, ...rest] = state.eventQueue
        const nextStats = applyDelta(state.stats, currentEvent.statDelta)
        let nextInventory = state.inventory
        let nextQuests = state.activeQuests

        if (currentEvent.itemDropped) {
          nextInventory = addItemById(nextInventory, currentEvent.itemDropped)
        }
        if (currentEvent.questUnlocked) {
          nextQuests = unlockHiddenQuest(nextQuests, currentEvent.questUnlocked, state.currentDay.quests)
        }

        const xpGain = currentEvent.type === 'rare' ? XP_RARE_EVENT_SURVIVED : 0
        const xpResult = addXP(state.xp, state.level, xpGain)

        const gameOver = checkGameOver(nextStats, state.riskConsecutivePhases, state.riskGameOverThreshold)
        if (gameOver.over) {
          return endRun(state, { ...state, stats: nextStats, inventory: nextInventory, status: 'game-over', gameOverReason: gameOver.reason })
        }

        return {
          ...state,
          stats: nextStats,
          inventory: nextInventory,
          activeQuests: nextQuests,
          xp: xpResult.xp,
          level: xpResult.level,
          pendingLevelUp: xpResult.leveledUp,
          levelUnlock: xpResult.newUnlock,
          eventQueue: rest,
          currentEvent,
          status: 'event',
        }
      }

      // All events consumed
      if (state.status === 'event' && state.currentEvent?.type === 'day-modifier') {
        return { ...state, currentEvent: null, status: 'phase-intro' }
      }

      return advancePhase(state)
    }

    case 'day-summary': {
      if (state.pendingLevelUp) {
        return { ...state, pendingLevelUp: false, status: 'level-up' }
      }
      return loadNextDayOrVictory(state)
    }

    case 'level-up':
      return loadNextDayOrVictory(state)

    // Boss flow
    case 'boss-intro':
      return { ...state, status: 'boss-round' }

    case 'boss-consequence': {
      const { activeBoss, bossRound } = state
      if (!activeBoss) return state

      const nextRound = bossRound + 1

      // Check instant lose
      if (isMeterInstantLose(state.bossMeterValue, activeBoss)) {
        return bossDeferEnd(state, false)
      }

      // All 3 rounds done
      if (nextRound >= 3) {
        const won = isMeterWin(state.bossMeterValue, activeBoss)
        return bossDeferEnd(state, won)
      }

      return { ...state, bossRound: nextRound, status: 'boss-round' }
    }

    case 'boss-victory':
    case 'boss-defeat': {
      // Boss encounter finished — resume normal flow at scenario
      return { ...state, activeBoss: null, status: 'scenario' }
    }

    case 'victory':
      return endRun(state, state)

    default:
      return state
  }
}

// ── Boss Action Handler ───────────────────────────────────────────────────────

function handleBossAction(state: GameState, actionId: string): GameState {
  const { activeBoss, bossRound } = state
  if (!activeBoss) return state

  const action = getBossAction(activeBoss, bossRound, actionId)
  if (!action) return state

  // Scale stat delta by difficulty multiplier
  const scaledDelta = scaleDelta(action.statDelta, state.deltaMultiplier)
  const nextStats = applyDelta(state.stats, scaledDelta)

  // Consume required item
  let nextInventory = state.inventory
  if (action.itemConsumed) {
    const idx = nextInventory.findIndex(s => s.item.id === action.itemConsumed)
    if (idx >= 0) {
      const result = useItemFromSlot(nextInventory, idx)
      if (result) nextInventory = result.inventory
    }
  }

  const nextMeter = applyMeterDelta(state.bossMeterValue, action.meterDelta, activeBoss.meterInverted)

  const gameOver = checkGameOver(nextStats, state.riskConsecutivePhases, state.riskGameOverThreshold)
  if (gameOver.over) {
    return endRun(state, { ...state, stats: nextStats, inventory: nextInventory, status: 'game-over', gameOverReason: gameOver.reason })
  }

  return {
    ...state,
    stats: nextStats,
    inventory: nextInventory,
    bossMeterValue: nextMeter,
    lastBossActionResult: action.consequence,
    lastStatDelta: scaledDelta,
    status: 'boss-consequence',
  }
}

// ── Boss deferred-end (after consequence shown) ───────────────────────────────

function bossDeferEnd(state: GameState, won: boolean): GameState {
  const { activeBoss } = state
  if (!activeBoss) return state

  if (won) {
    const scaledDelta = scaleDelta(activeBoss.victoryDelta, state.deltaMultiplier)
    const nextStats = applyDelta(state.stats, scaledDelta)
    const xpResult = addXP(state.xp, state.level, activeBoss.xpReward)
    return {
      ...state,
      stats: nextStats,
      xp: xpResult.xp,
      level: xpResult.level,
      pendingLevelUp: xpResult.leveledUp,
      levelUnlock: xpResult.newUnlock,
      bossesDefeated: [...state.bossesDefeated, activeBoss.id],
      lastConsequence: activeBoss.victoryConsequence,
      lastStatDelta: scaledDelta,
      status: 'boss-victory',
    }
  } else {
    const scaledDelta = scaleDelta(activeBoss.defeatDelta, state.deltaMultiplier)
    const nextStats = applyDelta(state.stats, scaledDelta)
    const gameOver = checkGameOver(nextStats, state.riskConsecutivePhases, state.riskGameOverThreshold)
    if (gameOver.over) {
      return endRun(state, { ...state, stats: nextStats, status: 'game-over', gameOverReason: gameOver.reason })
    }
    return {
      ...state,
      stats: nextStats,
      lastConsequence: activeBoss.defeatConsequence,
      lastStatDelta: scaledDelta,
      status: 'boss-defeat',
    }
  }
}

// ── Choose Handler ────────────────────────────────────────────────────────────

function handleChoose(state: GameState, choice: Choice): GameState {
  const scenario = getScenario(state.currentDay, state.phase)

  // Apply eval variance for model-eval scenarios
  let rngSeed = state.rngSeed
  let effectiveDelta = scaleDelta(choice.statDelta, state.deltaMultiplier)
  if (scenario.type === 'model-evals') {
    const result = withEvalVariance(effectiveDelta, rngSeed)
    effectiveDelta = result.delta
    rngSeed = result.nextSeed
  }

  let nextStats = applyDelta(state.stats, effectiveDelta)
  let nextInventory = state.inventory

  // Consume required item
  if (choice.itemConsumed) {
    const idx = nextInventory.findIndex(s => s.item.id === choice.itemConsumed)
    if (idx >= 0) {
      const result = useItemFromSlot(nextInventory, idx)
      if (result) nextInventory = result.inventory
    }
  }

  // Grant item (only if not noItemsMode)
  let lastItemGained = state.lastItemGained
  if (choice.itemGained && !state.noItemsMode) {
    nextInventory = addItemById(nextInventory, choice.itemGained)
    const added = nextInventory.find(s => s.item.id === choice.itemGained)
    lastItemGained = added?.item ?? null
  }

  // Quest progress
  let nextQuests = state.activeQuests
  if (choice.questProgress) {
    nextQuests = progressQuest(nextQuests, choice.questProgress)
  }

  // Scope creep mechanic
  const { newCount, overflowEvent } = checkScopeCreep(
    state.scopeCreepCount,
    choice.scopeCreep ?? false
  )
  const noScopeCreepChoices = state.noScopeCreepChoices && !(choice.scopeCreep ?? false)
  const scopeCreepTriggered = state.scopeCreepTriggered || (overflowEvent != null)

  // XP for making a choice
  const xpResult = addXP(state.xp, state.level, XP_PER_CHOICE)

  // Track risk consecutive phases
  const riskConsecutive =
    nextStats.riskCompliance >= state.riskGameOverThreshold
      ? state.riskConsecutivePhases + 1
      : 0

  // Track double-critical
  const critCount = [
    nextStats.stakeholderTrust <= 2,
    nextStats.teamHealth <= 2,
    nextStats.modelQuality <= 2,
  ].filter(Boolean).length
  const hadDoubleCritical = state.hadDoubleCritical || critCount >= 2

  // Build event queue: randomEvent always + rareEvent maybe + scope overflow if triggered
  const eqResult = buildEventQueue(scenario.randomEvent, scenario.rareEvent, rngSeed)
  rngSeed = eqResult.nextSeed
  let eventQueue = eqResult.queue
  if (overflowEvent) eventQueue = [...eventQueue, overflowEvent]

  // Mark scenario as completed
  const completedScenarioIds = [...state.completedScenarioIds, scenario.id]

  const nextState: GameState = {
    ...state,
    stats: nextStats,
    inventory: nextInventory,
    activeQuests: nextQuests,
    completedScenarioIds,
    xp: xpResult.xp,
    level: xpResult.level,
    pendingLevelUp: xpResult.leveledUp,
    levelUnlock: xpResult.newUnlock,
    scopeCreepCount: newCount,
    scopeCreepTriggered,
    noScopeCreepChoices,
    hadDoubleCritical,
    riskConsecutivePhases: riskConsecutive,
    rngSeed,
    eventQueue,
    lastConsequence: choice.consequence,
    lastStatDelta: effectiveDelta,
    lastItemGained,
    currentEvent: null,
    status: 'consequence',
  }

  const gameOver = checkGameOver(nextStats, riskConsecutive, state.riskGameOverThreshold)
  if (gameOver.over) {
    return endRun(nextState, { ...nextState, status: 'game-over', gameOverReason: gameOver.reason })
  }

  return nextState
}

// ── Use Item Handler ──────────────────────────────────────────────────────────

function handleUseItem(state: GameState, slotIndex: number): GameState {
  if (state.noItemsMode) return state
  const result = useItemFromSlot(state.inventory, slotIndex)
  if (!result) return state

  const nextStats = applyDelta(state.stats, result.effect)
  const gameOver = checkGameOver(nextStats, state.riskConsecutivePhases, state.riskGameOverThreshold)
  if (gameOver.over) {
    return endRun(state, { ...state, stats: nextStats, inventory: result.inventory, status: 'game-over', gameOverReason: gameOver.reason })
  }

  return { ...state, stats: nextStats, inventory: result.inventory }
}

// ── Phase Advance ─────────────────────────────────────────────────────────────

function advancePhase(state: GameState): GameState {
  const advance = advanceFromPhase(state.phase, state.dayNumber)

  if (advance.next === 'victory') {
    return endRun(state, { ...state, status: 'victory' })
  }

  if (advance.next === 'phase') {
    return { ...state, phase: advance.phase, status: 'phase-intro' }
  }

  // End of day — resolve quest completions + award XP
  const { completedQuests, remainingQuests, totalStatDelta, totalXP, itemsGranted } =
    resolveCompletedQuests(state.activeQuests)

  let nextStats = applyDelta(state.stats, totalStatDelta)
  let nextInventory = state.inventory
  for (const itemId of itemsGranted) {
    nextInventory = addItemById(nextInventory, itemId)
  }

  const xpWithDay = addXP(state.xp, state.level, XP_PER_DAY_COMPLETE + totalXP)

  const completedIds = [
    ...state.completedQuestIds,
    ...completedQuests.map(aq => aq.quest.id),
  ]

  const nextDay = loadDay(state.dayNumber + 1)

  return {
    ...state,
    stats: nextStats,
    inventory: nextInventory,
    activeQuests: remainingQuests,
    completedQuestIds: completedIds,
    xp: xpWithDay.xp,
    level: xpWithDay.level,
    pendingLevelUp: xpWithDay.leveledUp,
    levelUnlock: xpWithDay.newUnlock,
    currentDay: nextDay,
    dayNumber: state.dayNumber,
    phase: PHASE_ORDER[0],
    status: 'day-summary',
  }
}

// ── Load Next Day or Victory ──────────────────────────────────────────────────

function loadNextDayOrVictory(state: GameState): GameState {
  if (state.status === 'level-up' || state.status === 'day-summary') {
    return {
      ...state,
      dayNumber: state.dayNumber + 1,
      pendingLevelUp: false,
      levelUnlock: null,
      status: 'day-intro',
    }
  }
  return state
}

// ── End Run: compute achievements + update meta ────────────────────────────────

function endRun(_originalState: GameState, finalState: GameState): GameState {
  const meta = loadMeta()
  const won = finalState.status === 'victory'
  const score = calcScore(finalState)
  const newAchievementIds = checkAchievements(finalState, meta)
  const updatedMeta = updateMetaAfterRun(meta, {
    won,
    score,
    level: finalState.level,
    newAchievementIds,
  })
  saveMeta(updatedMeta)

  const newlyEarnedAchievements = getAchievementsByIds(newAchievementIds)
  return { ...finalState, newlyEarnedAchievements }
}

// ── Utility: get current scenario (for UI) ────────────────────────────────────

export function getCurrentScenario(state: GameState) {
  if (state.status !== 'scenario') return null
  try {
    return getScenario(state.currentDay, state.phase)
  } catch {
    return null
  }
}
