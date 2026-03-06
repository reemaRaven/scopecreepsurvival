import type { Day, Phase, PhaseId, Scenario } from '../types/index.js'
import { PHASE_ORDER, MAX_DAYS } from '../types/index.js'

// ── Day loader (static imports — Vite resolves at build time) ─────────────────

import day1 from '../data/days/day-1.json'
import day2 from '../data/days/day-2.json'
import day3 from '../data/days/day-3.json'
import day4 from '../data/days/day-4.json'
import day5 from '../data/days/day-5.json'

const DAYS: Record<number, Day> = {
  1: day1 as unknown as Day,
  2: day2 as unknown as Day,
  3: day3 as unknown as Day,
  4: day4 as unknown as Day,
  5: day5 as unknown as Day,
}

export function loadDay(dayNumber: number): Day {
  const day = DAYS[dayNumber]
  if (!day) throw new Error(`Day ${dayNumber} data not found`)
  return day
}

// ── Phase utilities ───────────────────────────────────────────────────────────

export function getPhase(day: Day, phaseId: PhaseId): Phase {
  const phase = day.phases.find(p => p.phase === phaseId)
  if (!phase) throw new Error(`Phase "${phaseId}" not found in ${day.id}`)
  return phase
}

export function getScenario(day: Day, phaseId: PhaseId): Scenario {
  return getPhase(day, phaseId).scenario
}

export function getNextPhase(current: PhaseId): PhaseId | null {
  const idx = PHASE_ORDER.indexOf(current)
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null
  return PHASE_ORDER[idx + 1]
}

export function isLastPhase(phase: PhaseId): boolean {
  return phase === PHASE_ORDER[PHASE_ORDER.length - 1]
}

export function isLastDay(dayNumber: number): boolean {
  return dayNumber >= MAX_DAYS
}

// ── Advance logic ─────────────────────────────────────────────────────────────

export type AdvanceResult =
  | { next: 'phase'; phase: PhaseId }
  | { next: 'day'; dayNumber: number }
  | { next: 'victory' }

export function advanceFromPhase(currentPhase: PhaseId, currentDay: number): AdvanceResult {
  const nextPhase = getNextPhase(currentPhase)

  if (nextPhase) {
    return { next: 'phase', phase: nextPhase }
  }

  // Last phase of the day
  if (isLastDay(currentDay)) {
    return { next: 'victory' }
  }

  return { next: 'day', dayNumber: currentDay + 1 }
}
