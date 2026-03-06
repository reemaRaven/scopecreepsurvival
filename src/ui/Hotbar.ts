import type { GameState, StatDelta } from '../types/index.js'
import { HOTBAR_SIZE } from '../types/index.js'

type OnUseItem = (index: number) => void

const STAT_LABELS: Record<string, string> = {
  teamHealth:        'Team Health',
  stakeholderTrust:  'Stakeholder Trust',
  modelQuality:      'Model Quality',
  deliverySpeed:     'Delivery Speed',
  riskCompliance:    'Risk/Compliance',
}

function buildEffectChips(effect: StatDelta | undefined): string {
  if (!effect) return ''
  return Object.entries(effect as Record<string, number>)
    .map(([stat, val]) => {
      const label = STAT_LABELS[stat] ?? stat
      const sign  = val > 0 ? '+' : ''
      const cls   = val > 0 ? (stat === 'riskCompliance' ? 'chip-bad' : 'chip-good')
                             : (stat === 'riskCompliance' ? 'chip-good' : 'chip-bad')
      return `<span class="stt-chip ${cls}">${sign}${val} ${label}</span>`
    })
    .join('')
}

export function renderHotbar(state: GameState, onUseItem: OnUseItem): void {
  const el = document.getElementById('hotbar')!
  el.innerHTML = buildHotbar(state)

  state.inventory.forEach((_, i) => {
    document.getElementById(`slot-${i}`)?.addEventListener('click', () => onUseItem(i))
  })
}

function buildHotbar(state: GameState): string {
  const slots: string[] = []

  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const slot = state.inventory[i]
    if (slot) {
      const usesLabel = slot.usesRemaining > 0 && slot.usesRemaining !== -1
        ? `<span class="slot-uses">${slot.usesRemaining}</span>`
        : ''
      const effectChips = buildEffectChips(slot.item.effect)
      slots.push(`
        <div class="hotbar-slot filled" id="slot-${i}">
          <span class="slot-emoji">${slot.item.emoji}</span>
          ${usesLabel}
          <div class="slot-tooltip">
            <div class="stt-name">${slot.item.emoji} ${slot.item.name}</div>
            <div class="stt-effects">${effectChips}</div>
            <div class="stt-desc">${slot.item.description}</div>
            <div class="stt-flavor">${slot.item.flavor}</div>
          </div>
        </div>
      `)
    } else {
      slots.push(`<div class="hotbar-slot empty"></div>`)
    }
  }

  const scopeBar = state.scopeCreepCount > 0
    ? `<div class="scope-creep-bar">
         <span class="scope-label">SCOPE</span>
         ${Array.from({ length: 5 }, (_, i) =>
           `<span class="scope-pip ${i < state.scopeCreepCount ? 'filled' : ''}">■</span>`
         ).join('')}
       </div>`
    : ''

  return `
    <div class="hotbar-wrap">
      <div class="hotbar-slots">${slots.join('')}</div>
      ${scopeBar}
      <div class="hotbar-hint">Hotbar — click item to use</div>
    </div>
  `
}
