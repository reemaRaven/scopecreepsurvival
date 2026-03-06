/**
 * Chiptune music engine using the Web Audio API.
 *
 * Two tracks:
 *   - Normal: 4-bar C minor groove at 132 BPM
 *   - Boss:   4-bar C minor battle theme at 172 BPM — faster, heavier drums, driving ostinato
 *
 * Architecture: lookahead scheduler pattern.
 *   - scheduleLoop() places all notes for one loop precisely on the audio clock.
 *   - A setTimeout fires ~200ms before the loop ends to schedule the next one.
 *   - Switching modes cancels the pending timer and restarts the loop immediately.
 */

// ── Note frequencies (C minor scale, octaves 3–5) ────────────────────────────

const R   = 0
const C3  = 130.81; const Eb3 = 155.56
const F3  = 174.61; const G3  = 196.00; const Ab3 = 207.65; const Bb3 = 233.08
const C4  = 261.63; const D4  = 293.66; const Eb4 = 311.13
const F4  = 349.23; const G4  = 392.00; const Ab4 = 415.30; const Bb4 = 466.16
const C5  = 523.25; const D5  = 587.33; const Eb5 = 622.25

// ── Track definitions ─────────────────────────────────────────────────────────

interface Track {
  bpm:     number
  melody:  number[]
  bass:    number[]
  perc:    number[]   // 0=rest 1=hi-hat 2=snare 3=kick
}

// Normal track — 132 BPM, chill-tense C minor groove
const NORMAL_TRACK: Track = {
  bpm: 132,
  melody: [
    Eb5, R,   D5,  R,   C5,  R,   Bb4, R,   C5,  R,   Eb5, G4,  R,   R,   R,   R,
    F4,  R,   G4,  R,   Ab4, R,   G4,  F4,  Eb4, R,   D4,  R,   C4,  R,   R,   R,
    G4,  R,   Ab4, R,   Bb4, R,   C5,  R,   Bb4, R,   Ab4, R,   G4,  R,   R,   R,
    F4,  R,   Eb4, R,   D4,  Eb4, C4,  R,   R,   G3,  R,   R,   C4,  R,   R,   R,
  ],
  bass: [
    C3,  R,   R,   C3,  Eb3, R,   R,   Eb3, F3,  R,   R,   F3,  G3,  R,   R,   G3,
    Ab3, R,   R,   Ab3, G3,  R,   R,   G3,  F3,  R,   R,   F3,  Eb3, R,   R,   Eb3,
    G3,  R,   R,   G3,  Ab3, R,   R,   Ab3, Bb3, R,   R,   Bb3, C4,  R,   R,   C4,
    F3,  R,   R,   F3,  Eb3, R,   R,   Eb3, C3,  R,   R,   R,   C3,  R,   R,   R,
  ],
  perc: [
    3, 1, 1, 1,  2, 1, 1, 1,  3, 1, 1, 1,  2, 1, 1, 1,
    3, 1, 1, 1,  2, 1, 1, 1,  3, 1, 1, 1,  2, 1, 1, 1,
    3, 1, 1, 1,  2, 1, 1, 1,  3, 1, 1, 1,  2, 1, 1, 1,
    3, 1, 1, 1,  2, 1, 1, 1,  3, 1, 3, 1,  2, 3, 1, 3,
  ],
}

// Boss track — 172 BPM, aggressive double-kick, driving ostinato, tight staccato melody
const BOSS_TRACK: Track = {
  bpm: 172,
  melody: [
    // Bar 1 — punchy hook, short bursts
    C5,  R,   G4,  Eb5, C5,  R,   Bb4, R,   G4,  Eb5, R,   D5,  C5,  Bb4, R,   R,
    // Bar 2 — lower answer, more aggression
    F4,  G4,  Ab4, G4,  F4,  R,   Eb4, R,   D4,  Eb4, F4,  G4,  Ab4, R,   G4,  R,
    // Bar 3 — climbing tension
    G4,  Ab4, Bb4, Ab4, G4,  Bb4, C5,  Bb4, Ab4, G4,  Ab4, Bb4, C5,  Bb4, Ab4, R,
    // Bar 4 — rapid fire cadence
    Eb5, D5,  C5,  Bb4, Ab4, G4,  F4,  Eb4, D4,  Eb4, F4,  G4,  C5,  R,   R,   R,
  ],
  bass: [
    // Driving eighth-note ostinato throughout
    C3,  C3,  Eb3, C3,  F3,  C3,  G3,  C3,  Ab3, C3,  G3,  C3,  F3,  Eb3, C3,  R,
    C3,  C3,  Eb3, C3,  F3,  C3,  G3,  C3,  Ab3, C3,  G3,  C3,  Eb3, C3,  C3,  R,
    G3,  G3,  Ab3, G3,  Bb3, G3,  C4,  Bb3, Ab3, G3,  Ab3, Bb3, C4,  Bb3, Ab3, R,
    F3,  G3,  Ab3, G3,  F3,  Eb3, D4,  C4,  G3,  Ab3, Bb3, C4,  C3,  R,   R,   R,
  ],
  perc: [
    // Heavy double-kick pattern, tight snare, constant hi-hats
    3, 1, 3, 1,  2, 1, 3, 1,  3, 1, 3, 1,  2, 1, 3, 1,
    3, 1, 3, 1,  2, 1, 3, 1,  3, 1, 3, 1,  2, 1, 3, 1,
    3, 1, 3, 1,  2, 3, 1, 3,  3, 1, 3, 1,  2, 3, 1, 3,
    // Bar 4: relentless build — triple kicks before loop restarts
    3, 3, 1, 3,  2, 3, 3, 1,  3, 3, 1, 3,  2, 3, 3, 3,
  ],
}

// ── Gains ─────────────────────────────────────────────────────────────────────

const MELODY_GAIN = 0.18
const BASS_GAIN   = 0.14
const KICK_GAIN   = 0.30
const SNARE_GAIN  = 0.14
const HIHAT_GAIN  = 0.06

const LOOKAHEAD = 0.2

// ── Noise buffer ──────────────────────────────────────────────────────────────

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len  = ctx.sampleRate * 0.5
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

// ── Note schedulers ───────────────────────────────────────────────────────────

function playNote(
  ctx: AudioContext, dest: AudioNode,
  freq: number, startTime: number, duration: number,
  gainValue: number, type: OscillatorType = 'square',
): void {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type            = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(gainValue, startTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gain)
  gain.connect(dest)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.01)
}

function playKick(ctx: AudioContext, dest: AudioNode, startTime: number): void {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, startTime)
  osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.08)
  gain.gain.setValueAtTime(KICK_GAIN, startTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15)
  osc.connect(gain)
  gain.connect(dest)
  osc.start(startTime)
  osc.stop(startTime + 0.2)
}

function playSnare(
  ctx: AudioContext, dest: AudioNode, noise: AudioBuffer, startTime: number,
): void {
  const src    = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain   = ctx.createGain()
  src.buffer             = noise
  filter.type            = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value         = 0.8
  gain.gain.setValueAtTime(SNARE_GAIN, startTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(dest)
  src.start(startTime)
  src.stop(startTime + 0.15)
  playNote(ctx, dest, 180, startTime, 0.06, SNARE_GAIN * 0.6, 'triangle')
}

function playHihat(
  ctx: AudioContext, dest: AudioNode, noise: AudioBuffer, startTime: number,
): void {
  const src    = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain   = ctx.createGain()
  src.buffer             = noise
  filter.type            = 'highpass'
  filter.frequency.value = 7000
  gain.gain.setValueAtTime(HIHAT_GAIN, startTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(dest)
  src.start(startTime)
  src.stop(startTime + 0.06)
}

// ── Main engine ───────────────────────────────────────────────────────────────

const MASTER_GAIN = 0.7

class ChiptuneEngine {
  private ctx:        AudioContext | null = null
  private master:     GainNode    | null = null
  private noise:      AudioBuffer | null = null
  private nextLoop:   number             = 0
  private timer:      ReturnType<typeof setTimeout> | null = null
  private fadeTimer:  ReturnType<typeof setTimeout> | null = null
  private _muted      = false
  private _bossFight  = false

  get muted(): boolean     { return this._muted }
  get bossFight(): boolean { return this._bossFight }

  /** Call inside a user-gesture handler (browser policy). */
  start(): void {
    if (this.timer !== null && !this._muted) return  // loop already running
    this._muted = false
    const c = this.ensureCtx()
    if (!c) return
    c.ctx.resume().then(() => {
      if (this.timer !== null || this._muted) return
      this.master!.gain.cancelScheduledValues(c.ctx.currentTime)
      this.master!.gain.setValueAtTime(MASTER_GAIN, c.ctx.currentTime)
      this.nextLoop = c.ctx.currentTime + 0.05
      this.scheduleLoop()
    })
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.ctx?.suspend()
    this._muted = true
  }

  toggle(): void {
    if (this._muted) this.start()
    else             this.stop()
  }

  /** Fade out normal music, then start boss track with a fade-in. */
  startBossMusic(): void {
    if (this._bossFight) return
    this.stopLoop()
    this.fadeOut(0.35, () => {
      this._bossFight = true
      this.restartLoop()
      this.fadeIn(0.4)
    })
  }

  /** Fade out boss music smoothly, then restart the normal track. */
  stopBossMusic(): void {
    if (!this._bossFight) return
    this.stopLoop()
    this.fadeOut(0.9, () => {
      this._bossFight = false
      if (!this._muted) {
        this.restartLoop()
        this.fadeIn(0.6)
      }
    })
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /** Cancel the pending loop-scheduler timer (but keep context running). */
  private stopLoop(): void {
    if (this.timer     !== null) { clearTimeout(this.timer);     this.timer     = null }
    if (this.fadeTimer !== null) { clearTimeout(this.fadeTimer); this.fadeTimer = null }
  }

  /** Ramp master gain to near-zero over `duration` seconds, then call `cb`. */
  private fadeOut(duration: number, cb: () => void): void {
    if (!this.master || !this.ctx) { cb(); return }
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setValueAtTime(this.master.gain.value, t)
    this.master.gain.linearRampToValueAtTime(0.0001, t + duration)
    this.fadeTimer = setTimeout(cb, duration * 1000 + 30)
  }

  /** Ramp master gain back to full over `duration` seconds. */
  private fadeIn(duration: number): void {
    if (!this.master || !this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setValueAtTime(0.0001, t)
    this.master.gain.linearRampToValueAtTime(MASTER_GAIN, t + duration)
  }

  /** Cancel pending schedule and restart the loop right now with current track. */
  private restartLoop(): void {
    if (this._muted || !this.ctx) return
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
    const c = this.ensureCtx()
    if (!c) return
    c.ctx.resume().then(() => {
      if (this._muted) return
      this.nextLoop = c.ctx.currentTime + 0.05
      this.scheduleLoop()
    })
  }

  private scheduleLoop(): void {
    if (!this.ctx || !this.master || !this.noise) return

    const track  = this._bossFight ? BOSS_TRACK : NORMAL_TRACK
    const step   = 60 / track.bpm / 4
    const loopDur = step * 64   // 4 bars × 16 steps

    const t     = this.nextLoop
    const ctx   = this.ctx
    const dest  = this.master
    const noise = this.noise

    for (let i = 0; i < 64; i++) {
      const stepTime = t + i * step

      if (track.melody[i] !== R) {
        playNote(ctx, dest, track.melody[i], stepTime, step * 0.75, MELODY_GAIN)
      }
      if (track.bass[i] !== R) {
        // Boss bass: shorter staccato to punch harder
        const bassLen = this._bossFight ? step * 0.9 : step * 1.6
        playNote(ctx, dest, track.bass[i], stepTime, bassLen, BASS_GAIN)
      }

      const p = track.perc[i]
      if (p === 3) playKick(ctx, dest, stepTime)
      else if (p === 2) playSnare(ctx, dest, noise, stepTime)
      else if (p === 1) playHihat(ctx, dest, noise, stepTime)
    }

    this.nextLoop += loopDur
    const msUntilNext = (loopDur - LOOKAHEAD) * 1000
    this.timer = setTimeout(() => this.scheduleLoop(), msUntilNext)
  }

  private ensureCtx(): { ctx: AudioContext; master: GainNode } | null {
    if (this._muted) return null
    if (!this.ctx) {
      this.ctx    = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = MASTER_GAIN
      this.master.connect(this.ctx.destination)
      this.noise  = makeNoiseBuffer(this.ctx)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return { ctx: this.ctx, master: this.master! }
  }

  // ── Victory / Game over ─────────────────────────────────────────────────────

  /**
   * Stop music and play the victory fanfare 3 times, then stay silent.
   * Audio stays silent until start() is called again.
   */
  victory(): void {
    this.stopLoop()
    this._bossFight = false
    const c = this.ensureCtx()
    if (!c) { this._muted = true; return }
    const GAP = 0.5
    let cursor = c.ctx.currentTime + 0.1
    for (let i = 0; i < 3; i++) cursor = this.sfxVictory(cursor) + GAP
    this._muted = true
    setTimeout(() => { this.ctx?.suspend() }, (cursor - c.ctx.currentTime) * 1000 + 400)
  }

  /**
   * Stop the music loop and play the game-over dirge 3 times, then stay silent.
   * Audio stays silent until start() is called again.
   */
  gameOver(): void {
    this.stopLoop()
    this._bossFight = false
    const c = this.ensureCtx()
    if (!c) { this._muted = true; return }
    const GAP = 0.4
    let cursor = c.ctx.currentTime + 0.15
    for (let i = 0; i < 3; i++) cursor = this.sfxGameOver(cursor) + GAP
    this._muted = true
    setTimeout(() => { this.ctx?.suspend() }, (cursor - c.ctx.currentTime) * 1000 + 400)
  }

  /**
   * Ascending major-key fanfare — C4 arpeggio → bounce → held chord → flourish.
   * Accepts an absolute audio-clock start time; returns the end time.
   */
  sfxVictory(startAt?: number): number {
    const c = this.ensureCtx()
    if (!c) return 0
    const { ctx, master } = c
    const t = startAt ?? (ctx.currentTime + 0.1)

    const E4 = 329.63
    const E5 = 659.25

    // Ascending arpeggio — C4 E4 G4 C5
    playNote(ctx, master, C4,  t + 0.00, 0.12, 0.24)
    playNote(ctx, master, E4,  t + 0.13, 0.12, 0.24)
    playNote(ctx, master, G4,  t + 0.26, 0.12, 0.24)
    playNote(ctx, master, C5,  t + 0.39, 0.22, 0.28)
    // Short bounce up
    playNote(ctx, master, G4,  t + 0.61, 0.09, 0.22)
    playNote(ctx, master, C5,  t + 0.70, 0.09, 0.22)
    playNote(ctx, master, E5,  t + 0.79, 0.09, 0.22)
    // Held victory chord
    playNote(ctx, master, C5,  t + 0.88, 0.65, 0.28)
    playNote(ctx, master, E5,  t + 0.88, 0.65, 0.22, 'triangle')
    playNote(ctx, master, G3,  t + 0.88, 0.65, 0.18, 'triangle')
    playNote(ctx, master, C3,  t + 0.88, 0.65, 0.22, 'triangle')
    // Finishing flourish
    playNote(ctx, master, C5,  t + 1.60, 0.07, 0.20)
    playNote(ctx, master, D5,  t + 1.67, 0.07, 0.20)
    playNote(ctx, master, E5,  t + 1.74, 0.07, 0.20)
    // Final long note + bass chord
    playNote(ctx, master, C5,  t + 1.81, 0.80, 0.28)
    playNote(ctx, master, E5,  t + 1.81, 0.80, 0.20, 'triangle')
    playNote(ctx, master, C3,  t + 1.81, 0.80, 0.22, 'triangle')
    playNote(ctx, master, G3,  t + 1.81, 0.80, 0.16, 'triangle')
    return t + 1.81 + 0.80
  }

  /**
   * Descending chromatic dirge — C5 → Bb4 → Ab4 → G4 → Eb4 → C4.
   * Accepts an absolute audio-clock start time; returns the end time.
   */
  sfxGameOver(startAt?: number): number {
    const c = this.ensureCtx()
    if (!c) return 0
    const { ctx, master } = c
    const t = startAt ?? (ctx.currentTime + 0.15)

    const seq: [number, number][] = [
      [C5,  0.12],
      [Bb4, 0.12],
      [Ab4, 0.12],
      [G4,  0.12],
      [Eb4, 0.22],
    ]
    let off = 0
    for (const [freq, gap] of seq) {
      playNote(ctx, master, freq, t + off, gap * 1.15, 0.22)
      off += gap
    }
    // Final low thud — long held note + bass chord
    playNote(ctx, master, C4, t + off, 0.9, 0.22)
    playNote(ctx, master, C3, t + off, 0.8, 0.20, 'triangle')
    playNote(ctx, master, G3, t + off, 0.8, 0.14, 'triangle')
    return t + off + 0.9
  }

  // ── Sound effects ───────────────────────────────────────────────────────────

  /** Short blip — navigation buttons */
  sfxClick(): void {
    const c = this.ensureCtx()
    if (!c) return
    const t = c.ctx.currentTime
    playNote(c.ctx, c.master, 440, t,        0.04, 0.25)
    playNote(c.ctx, c.master, 330, t + 0.05, 0.04, 0.15)
  }

  /** Ascending two-note confirm — choice selected */
  sfxChoice(): void {
    const c = this.ensureCtx()
    if (!c) return
    const t = c.ctx.currentTime
    playNote(c.ctx, c.master, 523.25, t,        0.06, 0.22)   // C5
    playNote(c.ctx, c.master, 783.99, t + 0.07, 0.08, 0.20)   // G5
  }

  /** Three-note ascending pickup — item used */
  sfxItem(): void {
    const c = this.ensureCtx()
    if (!c) return
    const t = c.ctx.currentTime
    playNote(c.ctx, c.master, 523.25, t,        0.05, 0.18)   // C5
    playNote(c.ctx, c.master, 659.25, t + 0.06, 0.05, 0.18)   // E5
    playNote(c.ctx, c.master, 783.99, t + 0.12, 0.08, 0.22)   // G5
  }
}

export const musicEngine = new ChiptuneEngine()
