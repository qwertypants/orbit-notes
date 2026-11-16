import * as Tone from 'tone'
import type { PitchClass } from '../theory/music-theory.ts'

export type PlaybackMode = 'together' | 'sequence'
export type PlaybackVoicing = 'ascending' | 'within-octave'
export type SoundType = 'triangle' | 'sine' | 'sawtooth' | 'square' | 'fmsine' | 'piano' | 'guitar'
export type PlaybackPattern = 'once' | 'loop' | 'bounce'

const toneNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const sequenceStepMs = 280
const sequenceHoldMs = 240
const chordHoldMs = 1000
const releaseSeconds = 1
const samples = {
  piano: { C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3', C6: 'C6.mp3' },
  guitar: { 'C#4': 'Cs4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3', 'C#5': 'Cs5.mp3', E5: 'E5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3' },
}

type Voice = Tone.PolySynth<Tone.Synth> | Tone.Sampler
let synth: Voice | undefined
let analyser: Tone.Analyser | undefined
const pendingTimers = new Set<ReturnType<typeof setTimeout>>()
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

function instrument(sound: SoundType): Voice {
  if (synth && currentSound !== sound) {
    synth.dispose()
    synth = undefined
    analyser?.dispose()
    analyser = undefined
  }
  if (!synth) {
    currentSound = sound
    analyser = new Tone.Analyser({ type: 'fft', size: 128, smoothing: 0.8 })
    synth = sound === 'piano' || sound === 'guitar'
      ? new Tone.Sampler({ urls: samples[sound], baseUrl: `${import.meta.env.BASE_URL}audio/${sound === 'guitar' ? 'guitar-nylon' : 'piano'}/`, release: releaseSeconds, volume: -8 })
      : new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: sound },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.55, release: releaseSeconds },
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
  pendingTimers.clear()
  synth?.releaseAll()
}

function scheduleTimeout(callback: () => void, delayMs: number): void {
  const timer = setTimeout(() => {
    pendingTimers.delete(timer)
    callback()
  }, delayMs)
  pendingTimers.add(timer)
}

function releaseAfter(
  voice: Voice,
  pitches: string | string[],
  version: number,
  delayMs: number,
  notes: readonly PitchClass[],
  onNoteEnd?: (note: PitchClass) => void,
): void {
  scheduleTimeout(() => {
    if (version !== playbackVersion) return
    voice.triggerRelease(pitches)
    notes.forEach((note) => onNoteEnd?.(note))
  }, delayMs)
}

/** Returns false if Stop or a newer Play cancelled audio startup. */
export async function playNotes(
  notes: readonly PitchClass[],
  mode: PlaybackMode,
  voicing: PlaybackVoicing = 'ascending',
  onNoteStart?: (note: PitchClass) => void,
  sound: SoundType = 'triangle',
  pattern: PlaybackPattern = 'once',
  onNoteEnd?: (note: PitchClass) => void,
): Promise<boolean> {
  stopPlayback()
  if (notes.length === 0) return false

  const requestVersion = playbackVersion
  await Tone.start()
  if (requestVersion !== playbackVersion) return false

  const voice = instrument(sound)
  if (sound === 'piano' || sound === 'guitar') await Tone.loaded()
  if (requestVersion !== playbackVersion) return false
  const pitches = voicedNotes(notes, voicing)
  if (mode === 'together') {
    voice.triggerAttack(pitches)
    notes.forEach((note) => onNoteStart?.(note))
    releaseAfter(voice, pitches, requestVersion, chordHoldMs, notes, onNoteEnd)
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
          releaseAfter(voice, pitch, requestVersion, sequenceHoldMs, [note], onNoteEnd)
        }
        if (index === 0) attack()
        else {
          scheduleTimeout(attack, index * sequenceStepMs)
        }
      })
      if (pattern === 'loop' && requestVersion === playbackVersion) {
        scheduleTimeout(playPass, events.length * sequenceStepMs)
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
