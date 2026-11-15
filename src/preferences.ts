import { createExplorerState, type ExplorerState } from './explorer-state.ts'
import { chordPresets, scalePresets, type PitchClass, type TopicSelection } from './theory/music-theory.ts'
import { traditionPatterns } from './theory/tradition-catalog.ts'
import type { PlaybackMode, PlaybackPattern, SoundType } from './audio/audio-engine.ts'

export const preferencesKey = 'orbit.preferences'
export type Preferences = {
  state: ExplorerState
  sound: SoundType
  playback: PlaybackMode
  pattern: PlaybackPattern
  staffVisible: boolean
  pianoVisible: boolean
  guitarVisible: boolean
  theoryOpen: boolean
  theoryTab: 'theory' | 'traditions'
  browsedTraditionId: string | undefined
}
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function pitch(value: unknown): value is PitchClass {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 12
}
function ownKey<T extends object>(value: unknown, options: T): value is keyof T {
  return typeof value === 'string' && Object.hasOwn(options, value)
}
function readSelection(value: unknown): TopicSelection | undefined {
  if (!record(value) || !pitch(value.root)) return
  const { topic, root, preset, culturalPatternId, minorRoot } = value
  if (topic === 'fifths') {
    if (minorRoot !== undefined && !pitch(minorRoot)) return
    return minorRoot === undefined ? { topic, root } : { topic, root, minorRoot }
  }
  if (culturalPatternId !== undefined) {
    const pattern = traditionPatterns.find(pattern => pattern.id === culturalPatternId)
    if (!pattern || (topic !== 'scales' && topic !== 'arpeggios') || topic !== (pattern.kind === 'scale' ? 'scales' : 'arpeggios')) return
    return { topic, root, culturalPatternId: pattern.id }
  }
  if (topic === 'scales' && ownKey(preset, scalePresets)) return { topic, root, preset }
  if ((topic === 'chords' || topic === 'arpeggios') && ownKey(preset, chordPresets)) return { topic, root, preset }
}

export function loadPreferences(storage?: PreferenceStorage): Preferences | undefined {
  try {
    const raw = (storage ?? window.localStorage).getItem(preferencesKey)
    if (!raw) return
    const saved: unknown = JSON.parse(raw)
    if (!record(saved) || saved.version !== 1) return
    const selection = readSelection(saved.selection)
    if (!selection || !Array.isArray(saved.activeNotes) || !saved.activeNotes.every(pitch)) return
    const state = { ...createExplorerState(selection), activeNotes: [...new Set(saved.activeNotes)] }
    const sounds = ['triangle', 'sine', 'sawtooth', 'piano', 'guitar', 'square', 'fmsine'] as const satisfies readonly SoundType[]
    const sound = sounds.find(value => value === saved.sound)
    return {
      state,
      sound: sound ?? 'triangle',
      playback: selection.topic === 'arpeggios' ? 'sequence' : saved.playback === 'together' ? 'together' : 'sequence',
      pattern: saved.pattern === 'loop' || saved.pattern === 'bounce' ? saved.pattern : 'once',
      staffVisible: saved.staffVisible === true,
      pianoVisible: saved.pianoVisible === true,
      guitarVisible: saved.guitarVisible === true,
      theoryOpen: saved.theoryOpen === true,
      theoryTab: saved.theoryTab === 'traditions' ? 'traditions' : 'theory',
      browsedTraditionId: traditionPatterns.find(pattern => pattern.traditionId === saved.browsedTraditionId)?.traditionId,
    }
  } catch {
    return undefined
  }
}

export function savePreferences(preferences: Preferences, storage?: PreferenceStorage): void {
  try {
    const { state, ...options } = preferences
    ;(storage ?? window.localStorage).setItem(preferencesKey, JSON.stringify({
      version: 1, ...options, selection: state.selection, activeNotes: state.activeNotes,
    }))
  } catch {
    // Preferences are optional when browser storage is unavailable or full.
  }
}
