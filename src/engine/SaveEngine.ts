import type { GameState } from '../types/index.js'

const SAVE_KEY = 'scopecreep_save'
const SAVE_VERSION = 3  // bumped: boss + meta fields added to GameState

interface SaveEnvelope {
  version: number
  state: GameState
}

export function saveGame(state: GameState): void {
  try {
    const envelope: SaveEnvelope = { version: SAVE_VERSION, state }
    localStorage.setItem(SAVE_KEY, JSON.stringify(envelope))
  } catch {
    // Storage quota exceeded or private browsing — silently ignore
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const envelope = JSON.parse(raw) as SaveEnvelope
    if (envelope.version !== SAVE_VERSION) {
      clearSave()
      return null
    }
    return envelope.state
  } catch {
    clearSave()
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // ignore
  }
}
