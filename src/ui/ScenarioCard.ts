import type { GameState, Scenario, StatDelta } from '../types/index.js'
import { PHASE_LABELS, MAX_DAYS } from '../types/index.js'
import { getVictoryGrade } from '../engine/StatsEngine.js'
import { calcScore } from '../engine/BossEngine.js'
import { addToFeed } from './SidePanel.js'
import { renderBossCard } from './BossCard.js'

export function renderScenarioCard(state: GameState): Scenario | null {
  const el = document.getElementById('scenario-card')!

  switch (state.status) {
    case 'start':
      el.innerHTML = buildStart()
      return null

    case 'day-intro':
      el.innerHTML = buildDayIntro(state)
      return null

    case 'phase-intro':
      el.innerHTML = buildPhaseIntro(state)
      return null

    case 'scenario': {
      const scenario = getScenario(state)
      if (!scenario) return null
      el.innerHTML = buildScenario(scenario)
      return scenario
    }

    case 'consequence':
      // Feed the consequence text to the side panel log
      if (state.lastConsequence) addToFeed(state.lastConsequence.slice(0, 60) + '…')
      el.innerHTML = buildConsequence(state)
      return null

    case 'event':
      if (state.currentEvent) addToFeed(state.currentEvent.title)
      el.innerHTML = buildEvent(state)
      return null

    case 'day-summary':
      el.innerHTML = buildDaySummary(state)
      return null

    case 'level-up':
      el.innerHTML = buildLevelUp(state)
      return null

    case 'game-over':
      el.innerHTML = buildGameOver(state)
      return null

    case 'victory':
      el.innerHTML = buildVictory(state)
      return null

    case 'boss-intro':
    case 'boss-round':
    case 'boss-consequence':
    case 'boss-victory':
    case 'boss-defeat':
      renderBossCard(state)
      return null

    default:
      el.innerHTML = ''
      return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getScenario(state: GameState): Scenario | null {
  const phase = state.currentDay.phases.find(p => p.phase === state.phase)
  return phase?.scenario ?? null
}

// ── Screen builders ───────────────────────────────────────────────────────────

function buildStart(): string {
  return `
    <div class="mc-panel start-screen">
      <div class="pixel-title">SCOPECREEP</div>
      <div class="pixel-title accent">SURVIVAL</div>
      <div class="pixel-subtitle">Daily Life of an AI PM</div>
      <div class="start-body">
        <p>You are a Product Manager at a high-growth AI startup.</p>
        <p>Survive 5 days. Manage 5 stats. Ship the model.</p>
        <p class="flavor-text">The roadmap is a living document. It is currently dying.</p>
      </div>
      <button class="mc-btn mc-btn-primary" id="btn-start" style="width:100%;justify-content:center">
        ▶ START GAME
      </button>
      <p class="hint-text">
        Click choices to decide · Click hotbar items to use them<br>
        Keys 1–9: use hotbar slot · Enter: confirm · Ctrl+R: restart
      </p>
    </div>
  `
}

function buildDayIntro(state: GameState): string {
  const { dayNumber, currentDay } = state
  const messages = [
    'Low expectations. High hopes.',
    'The pressure builds.',
    'Hump day. The burndown has opinions.',
    'Demo day. All eyes on you.',
    'Final sprint. Everything counts.',
  ]
  return `
    <div class="mc-panel intro-card day-intro-card">
      <div class="intro-eyebrow">STARTING</div>
      <div class="intro-title">DAY ${dayNumber} / ${MAX_DAYS}</div>
      <div class="intro-subtitle">${messages[dayNumber - 1] ?? ''}</div>
      <div class="intro-brief">${currentDay.brief}</div>
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ▶ BEGIN DAY ${dayNumber}
      </button>
    </div>
  `
}

function buildPhaseIntro(state: GameState): string {
  const label = PHASE_LABELS[state.phase]
  const tips: Record<string, string> = {
    morning:   'Protect your team. Meetings multiply before 10 AM.',
    midday:    'The real decisions happen here.',
    afternoon: 'Delivery speed is burning. Make every choice count.',
    evening:   'What you do now echoes into tomorrow.',
  }
  return `
    <div class="mc-panel intro-card phase-intro-card">
      <div class="intro-eyebrow">ENTERING PHASE</div>
      <div class="intro-title">${label}</div>
      <div class="intro-tip">${tips[state.phase] ?? ''}</div>
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ▶ ENTER
      </button>
    </div>
  `
}

function buildScenario(scenario: Scenario): string {
  return `
    <div class="mc-panel scenario-panel" data-type="${scenario.type}">
      <div class="scenario-type-badge">${scenario.type.toUpperCase().replace(/-/g, ' ')}</div>
      <div class="scenario-title">${scenario.title}</div>
      <div class="scenario-flavor">${scenario.flavor}</div>
      <hr class="pixel-hr" />
      <div class="scenario-body">${scenario.description}</div>
    </div>
  `
}

function buildConsequence(state: GameState): string {
  const chips = buildDeltaChips(state.lastStatDelta)
  const itemLine = state.lastItemGained
    ? `<div class="item-gained">${state.lastItemGained.emoji} <strong>${state.lastItemGained.name}</strong> added to hotbar</div>`
    : ''
  return `
    <div class="mc-panel consequence-card">
      <div class="consequence-eyebrow">CONSEQUENCE</div>
      <div class="consequence-text">${state.lastConsequence}</div>
      ${chips}
      ${itemLine}
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ▶ CONTINUE
      </button>
    </div>
  `
}

function buildEvent(state: GameState): string {
  const ev = state.currentEvent
  if (!ev) return ''

  const typeLabel: Record<string, string> = {
    rare:          '⭐ RARE EVENT',
    cascade:       '🚨 CASCADE EVENT',
    random:        '📡 EVENT',
    'day-modifier':'🌅 DAY MODIFIER',
  }

  const chips = buildDeltaChips(ev.statDelta)
  const itemLine = ev.itemDropped
    ? `<div class="item-gained">📦 Received item: <strong>${ev.itemDropped}</strong></div>`
    : ''

  return `
    <div class="mc-panel event-card ${ev.type}">
      <div class="event-eyebrow">${typeLabel[ev.type] ?? 'EVENT'}</div>
      <div class="event-title">${ev.title}</div>
      <div class="event-body">${ev.description}</div>
      ${chips}
      ${itemLine}
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ▶ CONTINUE
      </button>
    </div>
  `
}

function buildDaySummary(state: GameState): string {
  const { stats, dayNumber, activeQuests, xp, level } = state
  const completed = activeQuests.filter(q => q.completed)
  const failed = activeQuests.filter(q => q.failed)

  const questLines = [
    ...completed.map(q => `<div class="quest-result complete">✓ ${q.quest.title} (+${q.quest.reward.xp} XP)</div>`),
    ...failed.map(q => `<div class="quest-result failed">✗ ${q.quest.title}</div>`),
  ].join('')

  return `
    <div class="mc-panel summary-card">
      <div class="summary-title">END OF DAY ${dayNumber}</div>
      <div class="summary-grid">
        ${buildSummaryRow('Stakeholder Trust', stats.stakeholderTrust, 10)}
        ${buildSummaryRow('Team Health',       stats.teamHealth,       10)}
        ${buildSummaryRow('Model Quality',     stats.modelQuality,     10)}
        ${buildSummaryRow('Delivery Speed',    stats.deliverySpeed,    100)}
        ${buildSummaryRow('Risk (lower=better)', 10 - stats.riskCompliance, 10)}
      </div>
      ${questLines ? `<div class="quest-results">${questLines}</div>` : ''}
      <div class="summary-xp">Total XP: ${xp} · Level: ${level}</div>
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ▶ NEXT DAY
      </button>
    </div>
  `
}

function buildSummaryRow(label: string, value: number, max: number): string {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return `
    <div class="summary-row">
      <span class="summary-label">${label}</span>
      <div class="summary-bar-track">
        <div class="summary-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="summary-value">${value}/${max}</span>
    </div>
  `
}

function buildLevelUp(state: GameState): string {
  return `
    <div class="mc-panel level-up-card">
      <div class="level-up-title">▲ LEVEL UP</div>
      <div class="level-up-level">LEVEL ${state.level}</div>
      ${state.levelUnlock
        ? `<div class="level-up-unlock">🔓 ${state.levelUnlock}</div>`
        : ''}
      <button class="mc-btn mc-btn-primary" id="btn-continue" style="width:100%;justify-content:center">
        ▶ CONTINUE
      </button>
    </div>
  `
}

function buildGameOver(state: GameState): string {
  const achHtml = buildAchievementsEarned(state)
  return `
    <div class="mc-panel game-over-card">
      <div class="game-over-title">GAME OVER</div>
      <div class="game-over-reason">${state.gameOverReason}</div>
      <div class="final-stats">
        Day ${state.dayNumber} &nbsp;·&nbsp;
        Trust ${state.stats.stakeholderTrust} &nbsp;·&nbsp;
        Health ${state.stats.teamHealth} &nbsp;·&nbsp;
        Quality ${state.stats.modelQuality}
      </div>
      ${achHtml}
      <button class="mc-btn" id="btn-restart" style="width:100%;justify-content:center">
        ↺ TRY AGAIN
      </button>
    </div>
  `
}

function buildVictory(state: GameState): string {
  const grade = getVictoryGrade(state.stats)
  const gradeText: Record<string, string> = {
    legendary: '⭐ LEGENDARY PM — The roadmap was a lie. You shipped anyway.',
    gold:      '🏅 GOLD STANDARD — You survived with your integrity intact.',
    standard:  '✓ SURVIVED — The sprint is closed. The scars will fade.',
  }
  const score = calcScore(state)
  const achHtml = buildAchievementsEarned(state)
  return `
    <div class="mc-panel victory-card">
      <div class="victory-title">SPRINT COMPLETE</div>
      <div class="victory-grade">${gradeText[grade]}</div>
      <div class="victory-score">FINAL SCORE: ${score}</div>
      <div class="final-stats">
        Trust ${state.stats.stakeholderTrust} ·
        Health ${state.stats.teamHealth} ·
        Model ${state.stats.modelQuality} ·
        Speed ${state.stats.deliverySpeed} ·
        Risk ${state.stats.riskCompliance} ·
        LV ${state.level}
      </div>
      ${achHtml}
      <button class="mc-btn mc-btn-primary" id="btn-restart" style="width:100%;justify-content:center">
        ↺ PLAY AGAIN
      </button>
    </div>
  `
}

// ── Achievements earned this run ──────────────────────────────────────────────

function buildAchievementsEarned(state: GameState): string {
  const achs = state.newlyEarnedAchievements
  if (!achs || achs.length === 0) return ''
  const items = achs.map(a =>
    `<div class="ach-item">${a.icon} <strong>${a.title}</strong> — ${a.description}</div>`
  ).join('')
  return `
    <div class="achievements-earned">
      <div class="achievements-title">ACHIEVEMENTS EARNED</div>
      ${items}
    </div>
  `
}

// ── Delta chips ───────────────────────────────────────────────────────────────

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
