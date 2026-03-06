import type { InventoryItem, InventorySlot, StatDelta } from '../types/index.js'
import { HOTBAR_SIZE } from '../types/index.js'
import itemsData from '../data/items.json'

const ITEMS_MAP = new Map<string, InventoryItem>(
  (itemsData as InventoryItem[]).map(item => [item.id, item])
)

export function getItem(id: string): InventoryItem | undefined {
  return ITEMS_MAP.get(id)
}

export function getAllItems(): InventoryItem[] {
  return itemsData as InventoryItem[]
}

export function addItemById(inventory: InventorySlot[], itemId: string): InventorySlot[] {
  const item = ITEMS_MAP.get(itemId)
  if (!item) return inventory

  const next = [...inventory]

  // Try to stack if item is already present and has remaining uses
  const existingIdx = next.findIndex(s => s.item.id === itemId && s.usesRemaining < item.uses)
  if (existingIdx >= 0 && item.uses > 1) {
    next[existingIdx] = { ...next[existingIdx], usesRemaining: next[existingIdx].usesRemaining + 1 }
    return next
  }

  // Add new slot if hotbar has space
  if (next.length < HOTBAR_SIZE) {
    next.push({ item, usesRemaining: item.uses === -1 ? -1 : item.uses })
  }

  return next
}

export function removeSlot(inventory: InventorySlot[], index: number): InventorySlot[] {
  return inventory.filter((_, i) => i !== index)
}

export function useItem(
  inventory: InventorySlot[],
  index: number
): { inventory: InventorySlot[]; effect: StatDelta; itemName: string } | null {
  const slot = inventory[index]
  if (!slot) return null

  let nextInventory: InventorySlot[]
  if (slot.usesRemaining === -1) {
    // Unlimited — keep in hotbar
    nextInventory = [...inventory]
  } else if (slot.usesRemaining <= 1) {
    // Last use — remove slot
    nextInventory = removeSlot(inventory, index)
  } else {
    // Decrement uses
    nextInventory = inventory.map((s, i) =>
      i === index ? { ...s, usesRemaining: s.usesRemaining - 1 } : s
    )
  }

  return {
    inventory: nextInventory,
    effect: slot.item.effect,
    itemName: slot.item.name,
  }
}

/** Returns true if player has at least one instance of the given item id */
export function hasItem(inventory: InventorySlot[], itemId: string): boolean {
  return inventory.some(s => s.item.id === itemId)
}

/** Returns true if player has the Tech Debt Bomb */
export function hasTechDebtBomb(inventory: InventorySlot[]): boolean {
  return hasItem(inventory, 'tech-debt-bomb')
}

/** Remove the Tech Debt Bomb from inventory (on explosion) */
export function removeTechDebtBomb(inventory: InventorySlot[]): InventorySlot[] {
  const idx = inventory.findIndex(s => s.item.id === 'tech-debt-bomb')
  if (idx < 0) return inventory
  return removeSlot(inventory, idx)
}
