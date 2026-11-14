import type { ExplorerState } from '../explorer-state.ts'
import { noteLabelForState } from './learning-summary.ts'

const chromaticDegrees = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'] as const

export function selectionSteps(state: ExplorerState): string {
  const root = state.selection.root
  const offset = (pitch: number) => (pitch - root + 12) % 12
  const notes = [...state.activeNotes].sort((a, b) => offset(a) - offset(b))
  if (!notes.length) return 'No notes selected'
  const label = (pitch: typeof root) => {
    const degree = state.selection.topic === 'fifths'
      ? chromaticDegrees[offset(pitch)]
      : state.resolved.notes.find((note) => note.pitchClass === pitch)?.degree ?? chromaticDegrees[offset(pitch)]
    return `${noteLabelForState(state, pitch)} (${degree})`
  }
  const parts = notes.map((pitch, index) => {
    const next = notes[index + 1]
    const gap = (next === undefined ? 12 : offset(next)) - offset(pitch)
    const step = gap === 1 ? 'half step' : gap === 2 ? 'whole step' : `${gap} semitones`
    return `${label(pitch)} —${step}→`
  })
  return `${parts.join(' ')} ${noteLabelForState(state, root)} (1, next octave)`
}
