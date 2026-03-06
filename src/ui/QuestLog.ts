import type { GameState, ActiveQuest } from '../types/index.js'

export function renderQuestLog(state: GameState): void {
  const el = document.getElementById('quest-log')!
  if (state.status === 'start') { el.innerHTML = ''; return }
  el.innerHTML = buildQuestLog(state)

  // Wire mini-inventory click events (same as hotbar)
  state.inventory.forEach((_, i) => {
    document.getElementById(`mini-slot-${i}`)?.addEventListener('click', () => {
      // Dispatch use-item through the global handler registered in main.ts
      document.dispatchEvent(new CustomEvent('game:use-item', { detail: { index: i } }))
    })
  })
}

function buildQuestLog(state: GameState): string {
  const { activeQuests } = state

  const questItems = activeQuests.length
    ? activeQuests.map(buildQuestItem).join('')
    : `<div class="quest-item hidden"><span class="quest-name">No active quests</span></div>`

  const miniInv = buildMiniInventory(state)

  return `
    <div class="quest-log-header">◆ QUEST LOG</div>
    ${questItems}
    ${miniInv}
  `
}

function buildQuestItem(aq: ActiveQuest): string {
  const { quest, currentStep, completed, failed } = aq
  const cls = completed ? 'completed' : failed ? 'failed' : quest.hidden ? 'hidden' : ''
  const pct = Math.round((currentStep / quest.steps) * 100)
  const statusIcon = completed ? '✓' : failed ? '✗' : '◆'

  const rewardHint = quest.reward.statDelta
    ? Object.entries(quest.reward.statDelta)
        .filter(([, v]) => v !== 0 && v !== undefined)
        .map(([k, v]) => {
          const val = v as number
          const isGood = k === 'riskCompliance' ? val < 0 : val > 0
          const sign = val > 0 ? '+' : ''
          return `<span class="effect-tag ${isGood ? 'positive' : 'negative'}">${sign}${val} ${k.slice(0,5).toUpperCase()}</span>`
        }).join('')
    : ''

  return `
    <div class="quest-item ${cls}">
      <div class="quest-name">${statusIcon} ${quest.hidden ? '???' : quest.title}</div>
      ${!quest.hidden ? `<div class="quest-steps">${currentStep}/${quest.steps} steps${quest.expiresDay ? ` · expires day ${quest.expiresDay}` : ''}</div>` : ''}
      <div class="quest-progress-track">
        <div class="quest-progress-fill" style="width:${pct}%"></div>
      </div>
      ${rewardHint ? `<div class="delta-chips" style="margin-top:4px">${rewardHint}</div>` : ''}
    </div>
  `
}

function buildMiniInventory(state: GameState): string {
  if (state.inventory.length === 0) return ''

  const slots = state.inventory.slice(0, 8).map((slot, i) => `
    <div class="mini-slot" id="mini-slot-${i}" title="${slot.item.name}: ${slot.item.description}">
      ${slot.item.emoji}
      ${slot.usesRemaining > 0 && slot.usesRemaining !== -1
        ? `<span class="mini-slot-count">${slot.usesRemaining}</span>`
        : ''}
    </div>
  `).join('')

  return `
    <div class="mini-inventory-header">HELD ITEMS</div>
    <div class="mini-inventory-slots">${slots}</div>
  `
}
