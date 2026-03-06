import type { Choice, GameState, StatDelta } from '../types/index.js'
import { musicEngine } from '../audio/MusicEngine.js'

type OnChoose = (choice: Choice) => void

export function renderChoicePanel(
  state: GameState,
  scenario: { choices: Choice[] } | null,
  onChoose: OnChoose
): void {
  const el = document.getElementById('choice-panel')!
  const show = state.status === 'scenario' && scenario !== null

  el.style.display = show ? 'flex' : 'none'
  if (!show || !scenario) { el.innerHTML = ''; return }

  el.innerHTML = scenario.choices.map((c, i) => buildChoiceBtn(c, i, state.level)).join('')

  scenario.choices.forEach((choice, i) => {
    const btn = document.getElementById(`choice-${i}`) as HTMLButtonElement | null
    if (!btn || btn.disabled) return
    btn.addEventListener('click', () => {
      musicEngine.sfxChoice()
      disableAll()
      btn.classList.add('chosen')
      setTimeout(() => onChoose(choice), 280)
    })
  })
}

function buildChoiceBtn(choice: Choice, index: number, level: number): string {
  const locked = choice.requiresLevel !== undefined && level < choice.requiresLevel
  const effects = buildEffectTags(choice.statDelta)
  const itemTag = choice.itemGained
    ? `<span class="effect-tag item-tag">+ ${choice.itemGained}</span>`
    : ''
  const scopeTag = choice.scopeCreep
    ? `<span class="effect-tag scope-tag">⚠ scope</span>`
    : ''
  const lockNote = locked
    ? `<span class="choice-lock">🔒 Requires Level ${choice.requiresLevel}</span>`
    : ''

  return `
    <button
      class="mc-btn choice-btn ${locked ? 'locked' : ''}"
      id="choice-${index}"
      ${locked ? 'disabled' : ''}
    >
      <span class="choice-text">${choice.text}</span>
      <span class="choice-tags">${effects}${itemTag}${scopeTag}${lockNote}</span>
    </button>
  `
}

function buildEffectTags(delta: StatDelta): string {
  const labels: Record<string, string> = {
    stakeholderTrust: 'TRUST',
    teamHealth:       'HLTH',
    modelQuality:     'MODEL',
    deliverySpeed:    'SPEED',
    riskCompliance:   'RISK',
  }
  return Object.entries(delta)
    .filter(([, v]) => v !== 0 && v !== undefined)
    .map(([k, v]) => {
      const val = v as number
      const isGood = k === 'riskCompliance' ? val < 0 : val > 0
      const cls = isGood ? 'positive' : 'negative'
      const sign = val > 0 ? '+' : ''
      return `<span class="effect-tag ${cls}">${sign}${val} ${labels[k] ?? k}</span>`
    })
    .join('')
}

function disableAll(): void {
  document.querySelectorAll('.choice-btn').forEach(b => {
    (b as HTMLButtonElement).disabled = true
    b.classList.add('disabled')
  })
}
