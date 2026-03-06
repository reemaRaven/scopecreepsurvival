import './style.css'
import { inject } from '@vercel/analytics'
import { trackPageVisit } from './tracking.js'
inject()
trackPageVisit('game')
import type { Choice, GameState } from './types/index.js'
import { createInitialState, transition, getCurrentScenario } from './engine/GameEngine.js'
import { saveGame, loadGame, clearSave } from './engine/SaveEngine.js'
import { applyDelta, isStatCritical } from './engine/StatsEngine.js'
import { renderHUD } from './ui/HUD.js'
import { renderQuestLog } from './ui/QuestLog.js'
import { renderScenarioCard } from './ui/ScenarioCard.js'
import { renderChoicePanel } from './ui/ChoicePanel.js'
import { renderSidePanel } from './ui/SidePanel.js'
import { renderHotbar } from './ui/Hotbar.js'
import { showToast, showItemUsed, showStatWarning } from './ui/Notifications.js'
import { musicEngine } from './audio/MusicEngine.js'

// ── State ─────────────────────────────────────────────────────────────────────

let state: GameState = loadGame() ?? createInitialState()

// ── Render ────────────────────────────────────────────────────────────────────

function render(): void {
  renderHUD(state)
  renderQuestLog(state)
  const scenario = renderScenarioCard(state)
  renderChoicePanel(state, scenario, handleChoice)
  renderSidePanel(state)
  renderHotbar(state, handleUseItem)
  wireButtons()
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

const BOSS_STATUSES = new Set(['boss-intro', 'boss-round', 'boss-consequence', 'boss-victory', 'boss-defeat'])

function dispatch(action: Parameters<typeof transition>[1]): void {
  const wasBoss     = BOSS_STATUSES.has(state.status)
  const wasGameOver = state.status === 'game-over'
  const wasVictory  = state.status === 'victory'
  state = transition(state, action)
  const isBoss     = BOSS_STATUSES.has(state.status)
  const isGameOver = state.status === 'game-over'
  const isVictory  = state.status === 'victory'

  if (!wasBoss && isBoss)       musicEngine.startBossMusic()
  else if (wasBoss && !isBoss)  musicEngine.stopBossMusic()

  if (!wasVictory  && isVictory)  musicEngine.victory()
  if (!wasGameOver && isGameOver) musicEngine.gameOver()

  if (state.status === 'start') clearSave()
  else saveGame(state)
  render()
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleChoice(choice: Choice): void {
  const simulated = applyDelta(state.stats, choice.statDelta)
  const criticals = isStatCritical(simulated)

  if (criticals.teamHealth)       showStatWarning('Team Health',        simulated.teamHealth)
  if (criticals.stakeholderTrust) showStatWarning('Stakeholder Trust',  simulated.stakeholderTrust)
  if (criticals.modelQuality)     showStatWarning('Model Quality',      simulated.modelQuality)
  if (criticals.deliverySpeed)    showStatWarning('Delivery Speed',     simulated.deliverySpeed)
  if (criticals.riskCompliance)   showToast({ message: '⚠ RISK/COMPLIANCE critically high!', type: 'danger' })

  dispatch({ type: 'choose', choice })
}

function handleUseItem(slotIndex: number): void {
  const slot = state.inventory[slotIndex]
  if (!slot) return
  musicEngine.sfxItem()
  showItemUsed(slot.item.name)
  dispatch({ type: 'use-item', slotIndex })
}

function wireButtons(): void {
  document.getElementById('btn-start')?.addEventListener('click', () => {
    musicEngine.start()
    dispatch({ type: 'start' })
  })
  document.getElementById('btn-continue')?.addEventListener('click', () => { musicEngine.sfxClick(); dispatch({ type: 'continue' }) })
  document.getElementById('btn-restart')?.addEventListener('click', () => { musicEngine.sfxClick(); dispatch({ type: 'restart' }) })
  document.getElementById('btn-mute')?.addEventListener('click', () => {
    musicEngine.toggle()
    syncMuteButton()
  })
  document.getElementById('btn-hud-restart')?.addEventListener('click', () => {
    musicEngine.sfxClick()
    dispatch({ type: 'restart' })
  })

  // Boss action buttons
  document.querySelectorAll<HTMLButtonElement>('[data-boss-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const actionId = btn.dataset.bossAction!
      musicEngine.sfxChoice()
      dispatch({ type: 'boss-action', actionId })
    })
  })
}

function syncMuteButton(): void {
  const btn = document.getElementById('btn-mute')
  if (!btn) return
  btn.textContent = musicEngine.muted ? '✕' : '♪'
  btn.classList.toggle('muted', musicEngine.muted)
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  // Ctrl+R → restart
  if (e.key === 'r' && e.ctrlKey) {
    e.preventDefault()
    dispatch({ type: 'restart' })
    return
  }

  // Enter/Space → click active continue/start button
  if (e.key === 'Enter' || e.key === ' ') {
    const btn = document.getElementById('btn-continue') ?? document.getElementById('btn-start')
    btn?.click()
    return
  }

  // 1–9 → use hotbar slot
  const digit = parseInt(e.key)
  if (digit >= 1 && digit <= 9) {
    handleUseItem(digit - 1)
  }
})

// ── Cross-component events ────────────────────────────────────────────────────
// QuestLog mini-inventory dispatches this custom event

document.addEventListener('game:use-item', (e) => {
  const { index } = (e as CustomEvent<{ index: number }>).detail
  handleUseItem(index)
})

// ── PM Thought Bubble ─────────────────────────────────────────────────────────

const PM_QUOTES = [
  'Can we just add\none more feature?\nIt\'s tiny I swear.',
  'This is totally\nin scope. Trust me.',
  'The stakeholders\nlove pivots. It\nshows agility!',
  'Let\'s timebox\nthis... to Q3.',
  'We\'ll fix it\nin post.',
  'Have you tried\nturning the\nroadmap off and\non again?',
  'This is a feature,\nnot a bug.',
  'I\'ll just add it\nto the backlog\n(never)',
  'Per my last\nSlack message...',
  'What if we use\nAI for that?',
  'The demo is\nTOTALLY ready.',
  'Story points are\njust a vibe anyway.',
  'Ship it. We can\niterate later.',
  'Velocity is up!\n(We lowered our\nstandards)',
  'Let\'s sync on this\nasync.',
]

let thoughtTimer: ReturnType<typeof setTimeout> | null = null

document.getElementById('pm-click-area')?.addEventListener('click', () => {
  const bubble = document.getElementById('pm-thought')
  if (!bubble) return

  if (thoughtTimer !== null) clearTimeout(thoughtTimer)
  const quote = PM_QUOTES[Math.floor(Math.random() * PM_QUOTES.length)]
  bubble.textContent = quote
  bubble.classList.add('visible')

  thoughtTimer = setTimeout(() => {
    bubble.classList.remove('visible')
    thoughtTimer = null
  }, 5000)
})

// ── Boot ──────────────────────────────────────────────────────────────────────

render()

// ── Public API (for debug console access) ─────────────────────────────────────
// @ts-ignore
window.__game = { getState: () => state, dispatch, getCurrentScenario: () => getCurrentScenario(state), clearSave }
