import { describe, it, expect } from 'vitest'
import {
  getLevelFromXP,
  getXPProgress,
  addXP,
  XP_THRESHOLDS,
} from '../XPEngine.js'

describe('getLevelFromXP', () => {
  it('returns level 1 at 0 XP', () => {
    expect(getLevelFromXP(0)).toBe(1)
  })

  it('returns level 2 at threshold', () => {
    expect(getLevelFromXP(XP_THRESHOLDS[1])).toBe(2)
  })

  it('returns level 2 one XP below level 3 threshold', () => {
    expect(getLevelFromXP(XP_THRESHOLDS[2] - 1)).toBe(2)
  })

  it('caps at level 20 (max level)', () => {
    expect(getLevelFromXP(99999)).toBe(20)
  })
})

describe('getXPProgress', () => {
  it('returns 0% at start of a level', () => {
    const xp = XP_THRESHOLDS[1]  // exactly level 2 start
    expect(getXPProgress(xp, 2)).toBe(0)
  })

  it('returns 100% at max level', () => {
    expect(getXPProgress(99999, 20)).toBe(100)
  })

  it('returns a value between 0 and 100 for mid-level XP', () => {
    const levelStart = XP_THRESHOLDS[1]  // 50
    const levelEnd = XP_THRESHOLDS[2]    // 120
    const midXP = Math.floor((levelStart + levelEnd) / 2)
    const pct = getXPProgress(midXP, 2)
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThan(100)
  })
})

describe('addXP', () => {
  it('accumulates XP correctly', () => {
    const result = addXP(0, 1, 30)
    expect(result.xp).toBe(30)
    expect(result.level).toBe(1)
    expect(result.leveledUp).toBe(false)
  })

  it('detects a level-up', () => {
    const result = addXP(45, 1, 10)  // 45 + 10 = 55 ≥ threshold[1]=50
    expect(result.level).toBe(2)
    expect(result.leveledUp).toBe(true)
    expect(result.newUnlock).toBeTruthy()
  })

  it('does not double-count levels when XP spans two thresholds', () => {
    const result = addXP(0, 1, 1500)  // well past level 10
    expect(result.level).toBe(10)
    expect(result.leveledUp).toBe(true)
  })

  it('returns null unlock when no level-up occurs', () => {
    const result = addXP(0, 1, 10)  // 10 XP, well below level 2 threshold (50)
    expect(result.leveledUp).toBe(false)
    expect(result.newUnlock).toBeNull()
  })
})
