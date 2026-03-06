import { describe, it, expect } from 'vitest'
import { buildEventQueue, checkScopeCreep, rollTechDebtBomb } from '../EventEngine.js'
import type { GameEvent } from '../../types/index.js'

const makeEvent = (id: string, rarity: number): GameEvent => ({
  id,
  type: 'random',
  rarity,
  title: 'Test Event',
  description: 'desc',
  statDelta: {},
  itemDropped: null,
  questUnlocked: null,
})

const RANDOM_EVENT = makeEvent('e-random', 1)
const RARE_EVENT   = makeEvent('e-rare', 0.2)

describe('buildEventQueue', () => {
  it('always includes the random event', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { queue } = buildEventQueue(RANDOM_EVENT, RARE_EVENT, seed)
      expect(queue[0].id).toBe('e-random')
    }
  })

  it('returns a different nextSeed', () => {
    const seed = 999
    const { nextSeed } = buildEventQueue(RANDOM_EVENT, RARE_EVENT, seed)
    expect(nextSeed).not.toBe(seed)
  })

  it('rare event fires with rarity=1 (always)', () => {
    const alwaysRare = makeEvent('e-always-rare', 1)
    for (let seed = 0; seed < 20; seed++) {
      const { queue } = buildEventQueue(RANDOM_EVENT, alwaysRare, seed)
      expect(queue).toHaveLength(2)
    }
  })

  it('rare event never fires with rarity=0 (never)', () => {
    const neverRare = makeEvent('e-never-rare', 0)
    for (let seed = 0; seed < 20; seed++) {
      const { queue } = buildEventQueue(RANDOM_EVENT, neverRare, seed)
      expect(queue).toHaveLength(1)
    }
  })
})

describe('checkScopeCreep', () => {
  it('increments count when choice triggers scope creep', () => {
    const { newCount, overflowEvent } = checkScopeCreep(1, true)
    expect(newCount).toBe(2)
    expect(overflowEvent).toBeNull()
  })

  it('does not increment when choice does not trigger scope creep', () => {
    const { newCount } = checkScopeCreep(3, false)
    expect(newCount).toBe(3)
  })

  it('triggers overflow event at count 5 and resets to 0', () => {
    const { newCount, overflowEvent } = checkScopeCreep(4, true)  // 4+1=5
    expect(newCount).toBe(0)
    expect(overflowEvent).not.toBeNull()
    expect(overflowEvent!.type).toBe('cascade')
  })
})

describe('rollTechDebtBomb', () => {
  it('returns a boolean result', () => {
    const { explodes } = rollTechDebtBomb(0.3, 42)
    expect(typeof explodes).toBe('boolean')
  })

  it('never explodes when chance is 0', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { explodes } = rollTechDebtBomb(0, seed)
      expect(explodes).toBe(false)
    }
  })

  it('always explodes when chance is 1', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { explodes } = rollTechDebtBomb(1, seed)
      expect(explodes).toBe(true)
    }
  })

  it('returns a different nextSeed', () => {
    const seed = 777
    const { nextSeed } = rollTechDebtBomb(0.3, seed)
    expect(nextSeed).not.toBe(seed)
  })

  it('produces the same result for the same seed (deterministic)', () => {
    const { explodes: a } = rollTechDebtBomb(0.3, 12345)
    const { explodes: b } = rollTechDebtBomb(0.3, 12345)
    expect(a).toBe(b)
  })
})
