import { describe, it, expect } from 'vitest'
import { addItemById, useItem, hasItem, hasTechDebtBomb, removeTechDebtBomb } from '../InventoryEngine.js'
import type { InventorySlot } from '../../types/index.js'

// A known item from items.json
const COFFEE_ID = 'coffee'
const TECH_DEBT_ID = 'tech-debt-bomb'

describe('addItemById', () => {
  it('adds a new item to empty inventory', () => {
    const inv = addItemById([], COFFEE_ID)
    expect(inv).toHaveLength(1)
    expect(inv[0].item.id).toBe(COFFEE_ID)
  })

  it('returns unchanged inventory for unknown item id', () => {
    const inv = addItemById([], 'nonexistent-item')
    expect(inv).toHaveLength(0)
  })

  it('does not exceed HOTBAR_SIZE (9 slots)', () => {
    let inv: InventorySlot[] = []
    for (let i = 0; i < 12; i++) {
      inv = addItemById(inv, 'rubber-duck')
    }
    expect(inv.length).toBeLessThanOrEqual(9)
  })

  it('does not mutate the original inventory array', () => {
    const original: InventorySlot[] = []
    addItemById(original, COFFEE_ID)
    expect(original).toHaveLength(0)
  })
})

describe('useItem', () => {
  it('returns null for an empty/invalid slot index', () => {
    expect(useItem([], 0)).toBeNull()
  })

  it('decrements usesRemaining on use', () => {
    let inv = addItemById([], COFFEE_ID)
    const uses = inv[0].usesRemaining
    const result = useItem(inv, 0)
    if (uses > 1) {
      expect(result!.inventory[0].usesRemaining).toBe(uses - 1)
    } else {
      // single-use: slot should be removed
      expect(result!.inventory).toHaveLength(0)
    }
  })

  it('removes the slot on last use', () => {
    let inv = addItemById([], COFFEE_ID)
    // drain all uses
    while (inv.length > 0 && inv[0].usesRemaining > 0) {
      const result = useItem(inv, 0)
      if (!result) break
      inv = result.inventory
    }
    expect(inv).toHaveLength(0)
  })

  it('keeps unlimited items in the hotbar', () => {
    // rubber-duck has uses: -1 (unlimited)
    const inv = addItemById([], 'rubber-duck')
    if (inv[0].usesRemaining === -1) {
      const result = useItem(inv, 0)
      expect(result!.inventory).toHaveLength(1)
    }
  })

  it('returns the item effect', () => {
    const inv = addItemById([], COFFEE_ID)
    const result = useItem(inv, 0)
    expect(result!.effect).toBeDefined()
  })
})

describe('hasTechDebtBomb / removeTechDebtBomb', () => {
  it('detects tech-debt-bomb in inventory', () => {
    const inv = addItemById([], TECH_DEBT_ID)
    expect(hasTechDebtBomb(inv)).toBe(true)
  })

  it('returns false when bomb is absent', () => {
    expect(hasTechDebtBomb([])).toBe(false)
  })

  it('removes the bomb from inventory', () => {
    const inv = addItemById([], TECH_DEBT_ID)
    const after = removeTechDebtBomb(inv)
    expect(hasTechDebtBomb(after)).toBe(false)
  })

  it('is a no-op when bomb is not present', () => {
    const inv = addItemById([], COFFEE_ID)
    const after = removeTechDebtBomb(inv)
    expect(after).toHaveLength(inv.length)
  })
})

describe('hasItem', () => {
  it('returns true for an item in inventory', () => {
    const inv = addItemById([], COFFEE_ID)
    expect(hasItem(inv, COFFEE_ID)).toBe(true)
  })

  it('returns false for an absent item', () => {
    expect(hasItem([], COFFEE_ID)).toBe(false)
  })
})
