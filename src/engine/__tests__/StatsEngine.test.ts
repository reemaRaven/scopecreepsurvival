import { describe, it, expect } from 'vitest'
import { applyDelta, applyDeltas, withEvalVariance, checkGameOver, isStatCritical } from '../StatsEngine.js'
import type { Stats } from '../../types/index.js'

const BASE: Stats = {
  stakeholderTrust: 7,
  teamHealth: 8,
  modelQuality: 7,
  deliverySpeed: 50,
  riskCompliance: 2,
}

describe('applyDelta', () => {
  it('applies positive deltas', () => {
    const result = applyDelta(BASE, { stakeholderTrust: 2, teamHealth: 1 })
    expect(result.stakeholderTrust).toBe(9)
    expect(result.teamHealth).toBe(9)
    expect(result.deliverySpeed).toBe(50)  // unchanged
  })

  it('applies negative deltas', () => {
    const result = applyDelta(BASE, { deliverySpeed: -20, teamHealth: -3 })
    expect(result.deliverySpeed).toBe(30)
    expect(result.teamHealth).toBe(5)
  })

  it('clamps stats to their max caps', () => {
    const result = applyDelta(BASE, { stakeholderTrust: 99, deliverySpeed: 999 })
    expect(result.stakeholderTrust).toBe(10)
    expect(result.deliverySpeed).toBe(100)
  })

  it('clamps stats to 0 minimum', () => {
    const result = applyDelta(BASE, { teamHealth: -100, stakeholderTrust: -100 })
    expect(result.teamHealth).toBe(0)
    expect(result.stakeholderTrust).toBe(0)
  })

  it('does not mutate the original stats object', () => {
    applyDelta(BASE, { teamHealth: -3 })
    expect(BASE.teamHealth).toBe(8)
  })
})

describe('applyDeltas', () => {
  it('applies an array of deltas in order', () => {
    const result = applyDeltas(BASE, [
      { teamHealth: -2 },
      { teamHealth: -2 },
    ])
    expect(result.teamHealth).toBe(4)
  })

  it('returns original stats for empty array', () => {
    const result = applyDeltas(BASE, [])
    expect(result).toEqual(BASE)
  })
})

describe('withEvalVariance', () => {
  it('does not modify delta when modelQuality is absent', () => {
    const delta = { teamHealth: 1 }
    const { delta: result } = withEvalVariance(delta, 12345)
    expect(result).toEqual(delta)
  })

  it('returns a value within ±2 of the original modelQuality delta', () => {
    const delta = { modelQuality: 3 }
    for (let seed = 0; seed < 50; seed++) {
      const { delta: result } = withEvalVariance(delta, seed)
      expect(result.modelQuality).toBeGreaterThanOrEqual(1)   // 3 - 2
      expect(result.modelQuality).toBeLessThanOrEqual(5)      // 3 + 2
    }
  })

  it('returns a different nextSeed than the input seed', () => {
    const { nextSeed } = withEvalVariance({ modelQuality: 2 }, 42)
    expect(nextSeed).not.toBe(42)
  })
})

describe('checkGameOver', () => {
  it('returns over=false for healthy stats', () => {
    const result = checkGameOver(BASE, 0)
    expect(result.over).toBe(false)
  })

  it('triggers on teamHealth=0', () => {
    const result = checkGameOver({ ...BASE, teamHealth: 0 }, 0)
    expect(result.over).toBe(true)
    expect(result.reason).toMatch(/Team Health/)
  })

  it('triggers on stakeholderTrust=0', () => {
    const result = checkGameOver({ ...BASE, stakeholderTrust: 0 }, 0)
    expect(result.over).toBe(true)
    expect(result.reason).toMatch(/Stakeholder Trust/)
  })

  it('triggers on modelQuality=0', () => {
    const result = checkGameOver({ ...BASE, modelQuality: 0 }, 0)
    expect(result.over).toBe(true)
  })

  it('triggers on deliverySpeed=0', () => {
    const result = checkGameOver({ ...BASE, deliverySpeed: 0 }, 0)
    expect(result.over).toBe(true)
  })

  it('triggers on riskCompliance=10 for 2+ consecutive phases', () => {
    const result = checkGameOver({ ...BASE, riskCompliance: 10 }, 2)
    expect(result.over).toBe(true)
    expect(result.reason).toMatch(/Compliance/)
  })

  it('does NOT trigger on riskCompliance=10 for only 1 phase', () => {
    const result = checkGameOver({ ...BASE, riskCompliance: 10 }, 1)
    expect(result.over).toBe(false)
  })
})

describe('isStatCritical', () => {
  it('flags low stats as critical', () => {
    const criticals = isStatCritical({ ...BASE, teamHealth: 2, deliverySpeed: 10 })
    expect(criticals.teamHealth).toBe(true)
    expect(criticals.deliverySpeed).toBe(true)
  })

  it('flags high riskCompliance as critical', () => {
    const criticals = isStatCritical({ ...BASE, riskCompliance: 8 })
    expect(criticals.riskCompliance).toBe(true)
  })

  it('does not flag healthy stats', () => {
    const criticals = isStatCritical(BASE)
    expect(Object.values(criticals).every(v => !v)).toBe(true)
  })
})
