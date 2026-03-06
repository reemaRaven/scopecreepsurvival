import type { Quest, ActiveQuest, StatDelta } from '../types/index.js'

export function initQuests(dayQuests: Quest[]): ActiveQuest[] {
  return dayQuests
    .filter(q => !q.hidden)
    .map(q => ({ quest: q, currentStep: 0, completed: false, failed: false }))
}

export function unlockHiddenQuest(
  activeQuests: ActiveQuest[],
  questId: string,
  allDayQuests: Quest[]
): ActiveQuest[] {
  // Check it's not already active
  if (activeQuests.some(a => a.quest.id === questId)) return activeQuests
  const quest = allDayQuests.find(q => q.id === questId)
  if (!quest) return activeQuests
  return [...activeQuests, { quest, currentStep: 0, completed: false, failed: false }]
}

export function progressQuest(
  activeQuests: ActiveQuest[],
  questId: string
): ActiveQuest[] {
  return activeQuests.map(aq => {
    if (aq.quest.id !== questId || aq.completed || aq.failed) return aq
    const nextStep = aq.currentStep + 1
    const completed = nextStep >= aq.quest.steps
    return { ...aq, currentStep: nextStep, completed }
  })
}

export interface QuestCompletionResult {
  completedQuests: ActiveQuest[]
  remainingQuests: ActiveQuest[]
  totalStatDelta: StatDelta
  totalXP: number
  itemsGranted: string[]
}

export function resolveCompletedQuests(activeQuests: ActiveQuest[]): QuestCompletionResult {
  const completed = activeQuests.filter(aq => aq.completed)
  const remaining = activeQuests.filter(aq => !aq.completed)

  let totalStatDelta: StatDelta = {}
  let totalXP = 0
  const itemsGranted: string[] = []

  for (const aq of completed) {
    const { reward } = aq.quest
    if (reward.statDelta) {
      totalStatDelta = mergeDeltas(totalStatDelta, reward.statDelta)
    }
    totalXP += reward.xp
    if (reward.itemId) itemsGranted.push(reward.itemId)
  }

  return { completedQuests: completed, remainingQuests: remaining, totalStatDelta, totalXP, itemsGranted }
}

export function failExpiredQuests(
  activeQuests: ActiveQuest[],
  currentDay: number
): { quests: ActiveQuest[]; penaltyDelta: StatDelta } {
  let penaltyDelta: StatDelta = {}

  const quests = activeQuests.map(aq => {
    if (aq.completed || aq.failed) return aq
    const expires = aq.quest.expiresDay
    if (expires !== null && currentDay > expires) {
      if (aq.quest.failPenalty) {
        penaltyDelta = mergeDeltas(penaltyDelta, aq.quest.failPenalty)
      }
      return { ...aq, failed: true }
    }
    return aq
  })

  return { quests, penaltyDelta }
}

function mergeDeltas(a: StatDelta, b: StatDelta): StatDelta {
  const result: StatDelta = { ...a }
  for (const key of Object.keys(b) as (keyof StatDelta)[]) {
    result[key] = (result[key] ?? 0) + (b[key] ?? 0)
  }
  return result
}
