# ScopeCreep Survival: Daily Life of an AI PM

A browser-based pixel-art survival game where you play as an AI Product Manager navigating the chaos of shipping AI products.

## Gameplay

Survive 5 days as an AI PM — make decisions in standups, backlog grooming, escalations, privacy reviews, and more. Every choice affects your stats. Mismanage your team or stakeholders and it's game over.

**5 stats to balance:**
- Stakeholder Trust
- Team Health
- Model Quality
- Delivery Speed
- Risk / Compliance (lower is better)

**Lose if any stat hits 0** — or if Risk hits 10 for 2 consecutive phases.

**Win by surviving Day 5** with all stats intact and Delivery Speed ≥ 40.

## Features

- 5 days × 4 phases = 20 core scenarios
- 3 boss encounters (Demo Day, Model Incident, Procurement)
- 20 XP levels with meta-progression unlocks
- 3 roles, 9 difficulty settings, 4 locations, 10 daily modifiers
- 20 achievements
- 15 hotbar items (Tech Debt Bomb, anyone?)
- Scope Creep meter — let it fill and face a cascade event
- Chiptune soundtrack via Web Audio API
- Seeded RNG for reproducible runs

## Stack

- Vite 5 + TypeScript (strict mode)
- Vanilla DOM — no framework
- Press Start 2P + VT323 fonts
- JSON-driven game content

## Running Locally

```bash
bun install
bun run dev
```

Open http://localhost:5173

## Building

```bash
bun run build
```

## Tests

```bash
bun run test
```
