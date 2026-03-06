import type { GameState, Boss, BossAction } from '../types/index.js'
import { meterFillPct } from '../engine/BossEngine.js'

// ── Boss screen renderer ───────────────────────────────────────────────────────
// Renders into the #scenario-card element for all boss-* statuses.

export function renderBossCard(state: GameState): void {
  const el = document.getElementById('scenario-card')!

  switch (state.status) {
    case 'boss-intro':
      el.innerHTML = buildBossIntro(state)
      break
    case 'boss-round':
      el.innerHTML = buildBossRound(state)
      break
    case 'boss-consequence':
      el.innerHTML = buildBossConsequence(state)
      break
    case 'boss-victory':
      el.innerHTML = buildBossVictory(state)
      break
    case 'boss-defeat':
      el.innerHTML = buildBossDefeat(state)
      break
  }
}

// ── Meter bar ─────────────────────────────────────────────────────────────────

function buildMeterBar(value: number, boss: Boss): string {
  const pct = meterFillPct(value, boss)
  const danger = boss.meterInverted ? pct <= 20 : pct >= 80
  const colorClass = danger ? 'meter-danger' : (boss.meterInverted ? 'meter-inverted' : 'meter-normal')
  return `
    <div class="boss-meter-wrap">
      <div class="boss-meter-label">${boss.meterName}: ${Math.round(value)}</div>
      <div class="boss-meter-track">
        <div class="boss-meter-fill ${colorClass}" style="width:${pct}%"></div>
      </div>
      <div class="boss-meter-hint">
        ${boss.meterInverted
          ? `Win: ≥${boss.meterWinThreshold} &nbsp; Lose: ≤${boss.meterLoseThreshold}`
          : `Win: ≤${boss.meterWinThreshold} &nbsp; Lose: ≥${boss.meterLoseThreshold}`}
      </div>
    </div>
  `
}

// ── Screen builders ───────────────────────────────────────────────────────────

function buildBossIntro(state: GameState): string {
  const boss = state.activeBoss!
  return `
    <div class="mc-panel boss-intro-card">
      <div class="boss-eyebrow">⚠ BOSS ENCOUNTER</div>
      <div class="boss-name">${boss.name}</div>
      <div class="boss-title">${boss.title}</div>
      <div class="boss-desc">${boss.description}</div>
      ${buildMeterBar(state.bossMeterValue, boss)}
      <div class="boss-rules">
        3 rounds · Choose your response each round · Meter decides the outcome
      </div>
      <button class="mc-btn mc-btn-danger" id="btn-continue" style="width:100%;justify-content:center">
        ▶ FACE THE BOSS
      </button>
    </div>
  `
}

function buildBossRound(state: GameState): string {
  const boss = state.activeBoss!
  const round = boss.rounds[state.bossRound as 0 | 1 | 2]
  if (!round) return ''

  const actionButtons = round.actions.map(a => buildActionButton(a, state)).join('')

  return `
    <div class="mc-panel boss-round-card">
      <div class="boss-eyebrow">ROUND ${state.bossRound + 1} / 3 &nbsp;·&nbsp; ${boss.name}</div>
      <div class="boss-setup">${round.setup}</div>
      ${buildMeterBar(state.bossMeterValue, boss)}
      <div class="boss-actions">
        ${actionButtons}
      </div>
    </div>
  `
}

function buildActionButton(action: BossAction, state: GameState): string {
  const itemRequired = action.itemConsumed
    ? state.inventory.some(s => s.item.id === action.itemConsumed)
    : true
  const disabled = action.itemConsumed && !itemRequired ? 'disabled' : ''
  const itemNote = action.itemConsumed
    ? itemRequired
      ? `<span class="action-item-note">Uses: ${action.itemConsumed}</span>`
      : `<span class="action-item-note missing">Requires: ${action.itemConsumed} (not in hotbar)</span>`
    : ''

  const meterNote = action.meterDelta !== 0
    ? `<span class="action-meter-note">${action.meterDelta > 0 ? '+' : ''}${action.meterDelta} meter</span>`
    : ''

  return `
    <button class="mc-btn boss-action-btn ${disabled ? 'mc-btn-disabled' : 'mc-btn-primary'}"
            data-boss-action="${action.id}" ${disabled}>
      <span class="action-text">${action.text}</span>
      <span class="action-notes">${meterNote}${itemNote}</span>
    </button>
  `
}

function buildBossConsequence(state: GameState): string {
  const boss = state.activeBoss!
  const chips = buildDeltaChips(state.lastStatDelta)

  // Check if next round or end
  const nextRound = state.bossRound + 1
  const isLastRound = nextRound >= 3

  return `
    <div class="mc-panel boss-consequence-card">
      <div class="boss-eyebrow">ROUND ${state.bossRound + 1} RESULT &nbsp;·&nbsp; ${boss.name}</div>
      <div class="consequence-text">${state.lastBossActionResult ?? ''}</div>
      ${chips}
      ${buildMeterBar(state.bossMeterValue, boss)}
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ${isLastRound ? '▶ FINAL RESULT' : `▶ ROUND ${nextRound + 1}`}
      </button>
    </div>
  `
}

function buildBossVictory(state: GameState): string {
  const boss = state.activeBoss!
  const chips = buildDeltaChips(state.lastStatDelta)
  return `
    <div class="mc-panel boss-victory-card">
      <div class="boss-eyebrow">⚔ BOSS DEFEATED</div>
      <div class="boss-name">${boss.name}</div>
      <div class="consequence-text">${state.lastConsequence}</div>
      ${chips}
      <div class="boss-xp-reward">+${boss.xpReward} XP</div>
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ▶ CONTINUE
      </button>
    </div>
  `
}

function buildBossDefeat(state: GameState): string {
  const boss = state.activeBoss!
  const chips = buildDeltaChips(state.lastStatDelta)
  return `
    <div class="mc-panel boss-defeat-card">
      <div class="boss-eyebrow">✗ BOSS ENCOUNTER FAILED</div>
      <div class="boss-name">${boss.name}</div>
      <div class="consequence-text">${state.lastConsequence}</div>
      ${chips}
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ▶ CONTINUE
      </button>
    </div>
  `
}

// ── Delta chips (shared util — keep in sync with ScenarioCard) ────────────────

import type { StatDelta } from '../types/index.js'

function buildDeltaChips(delta: StatDelta): string {
  const labels: Record<string, string> = {
    stakeholderTrust: 'TRUST',
    teamHealth:       'HEALTH',
    modelQuality:     'MODEL',
    deliverySpeed:    'SPEED',
    riskCompliance:   'RISK',
  }
  const chips = Object.entries(delta)
    .filter(([, v]) => v !== 0 && v !== undefined)
    .map(([k, v]) => {
      const val = v as number
      const isGood = k === 'riskCompliance' ? val < 0 : val > 0
      const sign = val > 0 ? '+' : ''
      return `<span class="delta-chip ${isGood ? 'positive' : 'negative'}">${sign}${val} ${labels[k] ?? k}</span>`
    })
    .join('')
  return chips ? `<div class="delta-chips">${chips}</div>` : ''
}
