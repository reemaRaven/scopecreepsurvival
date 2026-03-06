import type { GameState } from '../types/index.js'
import { isStatCritical } from '../engine/StatsEngine.js'

// ── Event feed (module-level ring buffer, max 5 entries) ──────────────────────

const MAX_FEED = 5
const feedHistory: Array<{ text: string; isRecent: boolean }> = []

export function addToFeed(text: string): void {
  // Age all existing entries
  feedHistory.forEach(e => { e.isRecent = false })
  feedHistory.unshift({ text, isRecent: true })
  if (feedHistory.length > MAX_FEED) feedHistory.length = MAX_FEED
}

export function renderSidePanel(state: GameState): void {
  const el = document.getElementById('side-panel')!
  if (state.status === 'start') { el.innerHTML = ''; return }
  el.innerHTML = buildSidePanel(state)
}

function buildSidePanel(state: GameState): string {
  const { stats } = state
  const criticals = isStatCritical(stats)

  return `
    <div class="side-header">STATS</div>
    ${buildStatRow('TRUST',  stats.stakeholderTrust, 10,  'var(--c-trust)',  criticals.stakeholderTrust)}
    ${buildStatRow('MODEL',  stats.modelQuality,     10,  'var(--c-model)',  criticals.modelQuality)}
    ${buildStatRow('SPEED',  stats.deliverySpeed,    100, 'var(--c-speed)',  criticals.deliverySpeed)}
    ${buildRiskRow(stats.riskCompliance, criticals.riskCompliance)}
    ${buildFeed()}
  `
}

function buildStatRow(
  label: string,
  value: number,
  max: number,
  color: string,
  critical: boolean | undefined
): string {
  const pct = Math.round((value / max) * 100)
  return `
    <div class="stat-row ${critical ? 'critical' : ''}">
      <div class="stat-row-header">
        <span class="stat-row-label">${label}</span>
        <span class="stat-row-value">${value}${max === 10 ? '/10' : ''}</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill" style="width:${pct}%;background-color:${color}"></div>
      </div>
    </div>
  `
}

function buildRiskRow(risk: number, critical: boolean | undefined): string {
  const pct = Math.round((risk / 10) * 100)
  const color = risk >= 8 ? 'var(--c-risk)' : risk >= 5 ? 'var(--text-warning)' : '#888'
  const warningIcon = risk >= 8 ? ' ⚠' : ''
  return `
    <div class="stat-row ${critical ? 'critical' : ''}">
      <div class="stat-row-header">
        <span class="stat-row-label">RISK${warningIcon}</span>
        <span class="stat-row-value">${risk}/10</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill" style="width:${pct}%;background-color:${color}"></div>
      </div>
    </div>
  `
}

function buildFeed(): string {
  if (feedHistory.length === 0) return ''

  const items = feedHistory
    .map(e => `<div class="feed-item ${e.isRecent ? 'recent' : ''}">${e.text}</div>`)
    .join('')

  return `
    <div class="event-feed-header">EVENT LOG</div>
    <div class="event-feed">${items}</div>
  `
}
