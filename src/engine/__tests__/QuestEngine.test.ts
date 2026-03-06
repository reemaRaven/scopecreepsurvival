import { describe, it, expect } from 'vitest'
import {
  initQuests,
  progressQuest,
  resolveCompletedQuests,
  failExpiredQuests,
  unlockHiddenQuest,
} from '../QuestEngine.js'
import type { Quest, ActiveQuest } from '../../types/index.js'

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-test',
    title: 'Test Quest',
    description: 'Do the thing',
    type: 'daily',
    steps: 2,
    reward: { xp: 20, statDelta: { stakeholderTrust: 1 }, itemId: null },
    failPenalty: { teamHealth: -1 },
    expiresDay: null,
    hidden: false,
    ...overrides,
  }
}

describe('initQuests', () => {
  it('creates active quests from visible quests', () => {
    const quests = initQuests([makeQuest({ id: 'q1' }), makeQuest({ id: 'q2' })])
    expect(quests).toHaveLength(2)
    expect(quests[0].currentStep).toBe(0)
    expect(quests[0].completed).toBe(false)
  })

  it('excludes hidden quests', () => {
    const quests = initQuests([
      makeQuest({ id: 'q-visible' }),
      makeQuest({ id: 'q-hidden', hidden: true }),
    ])
    expect(quests).toHaveLength(1)
    expect(quests[0].quest.id).toBe('q-visible')
  })
})

describe('progressQuest', () => {
  it('increments currentStep', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q1', steps: 3 }), currentStep: 0, completed: false, failed: false },
    ]
    const result = progressQuest(active, 'q1')
    expect(result[0].currentStep).toBe(1)
    expect(result[0].completed).toBe(false)
  })

  it('marks quest completed when steps reached', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q1', steps: 2 }), currentStep: 1, completed: false, failed: false },
    ]
    const result = progressQuest(active, 'q1')
    expect(result[0].currentStep).toBe(2)
    expect(result[0].completed).toBe(true)
  })

  it('does not progress a completed quest', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q1', steps: 2 }), currentStep: 2, completed: true, failed: false },
    ]
    const result = progressQuest(active, 'q1')
    expect(result[0].currentStep).toBe(2)
  })

  it('does not progress a quest with wrong id', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q1' }), currentStep: 0, completed: false, failed: false },
    ]
    const result = progressQuest(active, 'q-other')
    expect(result[0].currentStep).toBe(0)
  })
})

describe('resolveCompletedQuests', () => {
  it('separates completed and remaining quests', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q-done' }), currentStep: 2, completed: true, failed: false },
      { quest: makeQuest({ id: 'q-active' }), currentStep: 0, completed: false, failed: false },
    ]
    const result = resolveCompletedQuests(active)
    expect(result.completedQuests).toHaveLength(1)
    expect(result.remainingQuests).toHaveLength(1)
  })

  it('sums XP from completed quests', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q1', reward: { xp: 20, itemId: null } }), currentStep: 2, completed: true, failed: false },
      { quest: makeQuest({ id: 'q2', reward: { xp: 30, itemId: null } }), currentStep: 2, completed: true, failed: false },
    ]
    const result = resolveCompletedQuests(active)
    expect(result.totalXP).toBe(50)
  })

  it('returns empty results for no completed quests', () => {
    const result = resolveCompletedQuests([])
    expect(result.completedQuests).toHaveLength(0)
    expect(result.totalXP).toBe(0)
    expect(result.itemsGranted).toHaveLength(0)
  })
})

describe('failExpiredQuests', () => {
  it('fails quests past their expiry day', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q-expired', expiresDay: 1 }), currentStep: 0, completed: false, failed: false },
    ]
    const { quests, penaltyDelta } = failExpiredQuests(active, 2)
    expect(quests[0].failed).toBe(true)
    expect(penaltyDelta.teamHealth).toBe(-1)
  })

  it('does not fail quests that have not expired yet', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q-ok', expiresDay: 3 }), currentStep: 0, completed: false, failed: false },
    ]
    const { quests } = failExpiredQuests(active, 2)
    expect(quests[0].failed).toBe(false)
  })

  it('does not fail quests with no expiry', () => {
    const active: ActiveQuest[] = [
      { quest: makeQuest({ id: 'q-no-expiry', expiresDay: null }), currentStep: 0, completed: false, failed: false },
    ]
    const { quests } = failExpiredQuests(active, 99)
    expect(quests[0].failed).toBe(false)
  })
})

describe('unlockHiddenQuest', () => {
  const hiddenQuest = makeQuest({ id: 'q-hidden', hidden: true })

  it('adds a hidden quest to active quests when unlocked', () => {
    const active: ActiveQuest[] = []
    const result = unlockHiddenQuest(active, 'q-hidden', [hiddenQuest])
    expect(result).toHaveLength(1)
    expect(result[0].quest.id).toBe('q-hidden')
  })

  it('does not add a quest that is already active', () => {
    const active: ActiveQuest[] = [
      { quest: hiddenQuest, currentStep: 0, completed: false, failed: false },
    ]
    const result = unlockHiddenQuest(active, 'q-hidden', [hiddenQuest])
    expect(result).toHaveLength(1)
  })

  it('returns unchanged list when quest id not found in day quests', () => {
    const result = unlockHiddenQuest([], 'q-unknown', [])
    expect(result).toHaveLength(0)
  })
})
