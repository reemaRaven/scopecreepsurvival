import type { GameState } from '../types/index.js'
import { PHASE_LABELS, MAX_DAYS } from '../types/index.js'
import { getXPProgress } from '../engine/XPEngine.js'

export function renderHUD(state: GameState): void {
  document.getElementById('hud')!.innerHTML = buildHUD(state)
  // Also populate the mobile XP strip (visible only on small screens via CSS)
  const strip = document.getElementById('level-strip')
  if (strip) {
    strip.innerHTML = state.status !== 'start' ? buildXPBar(state.xp, state.level) : ''
  }
}

function buildHUD(state: GameState): string {
  const { stats, dayNumber, phase, status, xp, level } = state
  const show = status !== 'start'

  return `
    <div class="hud-left">
      ${buildHeartRow(stats.teamHealth)}
      ${buildShieldRow(stats.stakeholderTrust)}
    </div>

    <div class="hud-center">
      <div class="hud-title">ScopeCreep Survival</div>
      ${show ? buildXPBar(xp, level) : ''}
    </div>

    <div class="hud-right" style="align-items:flex-end">
      ${show ? `<div class="hud-day-phase">
        <span class="day">DAY ${dayNumber}/${MAX_DAYS}</span>
        ${status !== 'day-intro' ? `<span class="phase"> &nbsp;•&nbsp; ${PHASE_LABELS[phase]}</span>` : ''}
      </div>` : ''}
      <div class="hud-buttons">
        <button class="mute-btn" id="btn-mute" title="Toggle music">♪</button>
        <button class="hud-restart-btn" id="btn-hud-restart" title="Restart game">↺ RESTART</button>
        <button class="hud-logout-btn" id="btn-logout" title="Sign out">⏻ LOGOUT</button>
      </div>
    </div>
  `
}

// ── Hearts (team health) ──────────────────────────────────────────────────────

function buildHeartRow(health: number): string {
  let hearts = '<span class="label">HP</span>'
  for (let i = 1; i <= 10; i += 2) {
    if (health >= i + 1)  hearts += '<span class="heart full">❤</span>'
    else if (health >= i) hearts += '<span class="heart half">❤</span>'
    else                  hearts += '<span class="heart empty">♡</span>'
  }
  return `<div class="heart-row">${hearts}</div>`
}

// ── Shields (stakeholder trust) ───────────────────────────────────────────────

function buildShieldRow(trust: number): string {
  let shields = '<span class="label">TR</span>'
  for (let i = 1; i <= 10; i++) {
    shields += `<span class="shield ${i <= trust ? 'full' : 'empty'}">${i <= trust ? '🛡' : '·'}</span>`
  }
  return `<div class="shield-row">${shields}</div>`
}

// ── XP Bar ────────────────────────────────────────────────────────────────────

function buildXPBar(xp: number, level: number): string {
  const pct = getXPProgress(xp, level)
  return `
    <div class="xp-bar-wrap">
      <span class="xp-level-tag">LV ${level}</span>
      <div class="xp-track">
        <div class="xp-fill" style="width:${pct}%"></div>
      </div>
      <span class="xp-label">${xp} XP</span>
    </div>
  `
}
