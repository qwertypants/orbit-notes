import * as Tone from 'tone'
import type { PitchClass } from '../theory/music-theory.ts'

export type PlaybackMode = 'together' | 'sequence'
export type PlaybackVoicing = 'ascending' | 'within-octave'
export type SoundType = 'triangle' | 'sine' | 'sawtooth' | 'square' | 'fmsine'
export type PlaybackPattern = 'once' | 'loop' | 'bounce'

const toneNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const sequenceStepMs = 280
const sequenceHoldMs = 240
const chordHoldMs = 1000

let synth: Tone.PolySynth<Tone.Synth> | undefined
let analyser: Tone.Analyser | undefined
let pendingTimers: ReturnType<typeof setTimeout>[] = []
let playbackVersion = 0
let currentSound: SoundType = 'triangle'

/** Keep a cyclic fifth sequence in one register; other patterns cross one octave as needed. */
function voicedNotes(notes: readonly PitchClass[], voicing: PlaybackVoicing): string[] {
  if (voicing === 'within-octave') return notes.map((pitch) => `${toneNames[pitch]}4`)
  let octave = 4
  let previous = -1
  return notes.map((pitch) => {
    if (pitch <= previous) octave += 1
    previous = pitch
    return `${toneNames[pitch]}${octave}`
  })
}

function instrument(sound: SoundType): Tone.PolySynth<Tone.Synth> {
  if (synth && currentSound !== sound) {
    synth.dispose()
    synth = undefined
    analyser?.dispose()
    analyser = undefined
  }
  if (!synth) {
    currentSound = sound
    analyser = new Tone.Analyser({ type: 'fft', size: 128, smoothing: 0.8 })
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: sound },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.55, release: 0.3 },
      volume: -12,
    })
    synth.connect(analyser)
    analyser.toDestination()
  }
  return synth
}

/** The analyser follows the audible synth path. Silence is available before audio starts. */
export function readSpectrum(): Float32Array | undefined {
  const values = analyser?.getValue()
  return values instanceof Float32Array ? values : undefined
}

/** Cancel pending notes and release voices already sounding. */
export function stopPlayback(): void {
  playbackVersion += 1
  pendingTimers.forEach(clearTimeout)
  pendingTimers = []
  synth?.releaseAll()
}

function releaseAfter(voice: Tone.PolySynth<Tone.Synth>, pitches: string | string[], version: number, delayMs: number): void {
  const timer = setTimeout(() => {
    if (version === playbackVersion) voice.triggerRelease(pitches)
  }, delayMs)
  pendingTimers.push(timer)
}

/** Returns false if Stop or a newer Play cancelled audio startup. */
export async function playNotes(
  notes: readonly PitchClass[],
  mode: PlaybackMode,
  voicing: PlaybackVoicing = 'ascending',
  onNoteStart?: (note: PitchClass) => void,
  sound: SoundType = 'triangle',
  pattern: PlaybackPattern = 'once',
): Promise<boolean> {
  stopPlayback()
  if (notes.length === 0) return false

  const requestVersion = playbackVersion
  await Tone.start()
  if (requestVersion !== playbackVersion) return false

  const voice = instrument(sound)
  const pitches = voicedNotes(notes, voicing)
  if (mode === 'together') {
    voice.triggerAttack(pitches)
    notes.forEach((note) => onNoteStart?.(note))
    releaseAfter(voice, pitches, requestVersion, chordHoldMs)
  } else {
    const events = notes.map((note, index) => ({ pitch: pitches[index], note }))
    if (pattern === 'bounce') events.push(...events.slice(0, -1).reverse())

    const playPass = () => {
      if (requestVersion !== playbackVersion) return
      events.forEach(({ pitch, note }, index) => {
        const attack = () => {
          if (requestVersion !== playbackVersion) return
          voice.triggerAttack(pitch)
          onNoteStart?.(note)
          releaseAfter(voice, pitch, requestVersion, sequenceHoldMs)
        }
        if (index === 0) attack()
        else {
          const timer = setTimeout(attack, index * sequenceStepMs)
          pendingTimers.push(timer)
        }
      })
      if (pattern === 'loop' && requestVersion === playbackVersion) {
        const timer = setTimeout(playPass, events.length * sequenceStepMs)
        pendingTimers.push(timer)
      }
    }
    playPass()
  }
  return true
}

/** Dispose the reusable instrument when the page is left. */
export function disposeAudio(): void {
  stopPlayback()
  synth?.dispose()
  synth = undefined
  analyser?.dispose()
  analyser = undefined
}
