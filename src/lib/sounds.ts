// Kitchen sound language, synthesised with Web Audio (no audio files):
// the pass bell, a thermal-printer chatter, a check click, a HACCP alarm
// and a whoosh for transitions. Browsers only allow audio after a user
// gesture, so callers should be ready for `unlock()` to report "blocked".

type Kind = 'ding' | 'print' | 'check' | 'alarm' | 'whoosh' | 'click'

const STORAGE_KEY = 'chefsuite_sound'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

export function soundEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off' } catch { return true }
}

export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off') } catch { /* private mode */ }
  if (!on && ctx) void ctx.suspend()
}

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function audio(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.35
  master.connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

/** Resolves true when audio can play right now (i.e. after a user gesture). */
export async function unlock(): Promise<boolean> {
  const c = audio()
  if (!c) return false
  if (c.state === 'running') return true
  try {
    await Promise.race([c.resume(), new Promise((r) => setTimeout(r, 300))])
  } catch { /* ignored */ }
  // Re-read: resume() may have changed the state since the check above.
  return (c.state as AudioContextState) === 'running'
}

function burst(t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number) {
  if (!ctx || !master || !noise) return
  const src = ctx.createBufferSource()
  const flt = ctx.createBiquadFilter()
  const g = ctx.createGain()
  src.buffer = noise
  flt.type = type
  flt.Q.value = type === 'bandpass' ? 1.2 : 0.7
  flt.frequency.setValueAtTime(f0, t)
  if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(flt); flt.connect(g); g.connect(master)
  src.start(t); src.stop(t + dur + 0.05)
}

function tone(t: number, f: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  if (!ctx || !master) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(master)
  o.start(t); o.stop(t + dur + 0.05)
}

/** The pass bell: inharmonic partials of a struck desk bell. */
function ding(t: number) {
  for (const [ratio, gain, dur] of [[1, 0.6, 2.4], [2.76, 0.28, 1.4], [5.4, 0.14, 0.8], [8.93, 0.07, 0.45]]) {
    tone(t, 1320 * ratio, dur, gain)
  }
  burst(t, 0.03, 'highpass', 5000, 0, 0.25)
}

function schedule(kind: Kind, t: number) {
  switch (kind) {
    case 'ding': ding(t); break
    case 'click': burst(t, 0.04, 'highpass', 3500, 0, 0.3); break
    case 'check': burst(t, 0.04, 'highpass', 3500, 0, 0.3); tone(t + 0.01, 1760, 0.12, 0.12); break
    case 'whoosh': burst(t, 0.7, 'bandpass', 300, 3200, 0.22); break
    case 'print':
      for (let k = 0; k < 8; k++) burst(t + k * 0.1, 0.05, 'bandpass', 2400, 0, 0.14)
      burst(t + 0.85, 0.06, 'highpass', 3000, 0, 0.3)
      break
    case 'alarm':
      for (let r = 0; r < 3; r++) {
        tone(t + r * 0.32, 880, 0.14, 0.2, 'square')
        tone(t + r * 0.32 + 0.15, 660, 0.14, 0.2, 'square')
      }
      break
  }
}

/** Plays one sound now (no-op when sound is off or audio is locked). */
export function play(kind: Kind) {
  if (!soundEnabled()) return
  const c = audio()
  if (!c) return
  if (c.state !== 'running') void c.resume()
  schedule(kind, c.currentTime + 0.02)
}

/** The intro soundtrack, timed to the IntroSplash animation (≈ 5.6 s). */
export function playIntro() {
  if (!soundEnabled() || prefersReducedMotion() || !ctx || ctx.state !== 'running') return
  const t0 = ctx.currentTime + 0.05
  burst(t0 + 0.25, 0.5, 'lowpass', 120, 60, 0.5)
  burst(t0 + 0.45, 0.6, 'bandpass', 700, 2600, 0.1)
  for (let j = 0; j < 9; j++) burst(t0 + 0.62 + j * 0.088, 0.025, 'highpass', 4200, 0, 0.16)
  for (const s of [2.3, 2.45, 2.6]) burst(t0 + s + 0.12, 0.035, 'highpass', 3500, 0, 0.35)
  for (let k = 0; k < 10; k++) burst(t0 + 2.75 + k * 0.12, 0.05, 'bandpass', 2400, 0, 0.12)
  burst(t0 + 4.05, 0.09, 'lowpass', 900, 200, 0.6)
  ding(t0 + 4.35)
  burst(t0 + 4.75, 0.75, 'bandpass', 300, 3200, 0.22)
}

export function stopAll() {
  if (ctx) void ctx.suspend()
}
