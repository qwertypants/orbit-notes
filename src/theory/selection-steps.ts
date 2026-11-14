import type { ExplorerState } from '../explorer-state.ts'
import { noteLabelForState } from './learning-summary.ts'

const chromaticDegrees = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'] as const

export type SelectionStep = { note: string; degree: string; semitones: number; nextNote: string }

export function selectionSteps(state: ExplorerState): SelectionStep[] {
  const root = state.selection.root
  const offset = (pitch: number) => (pitch - root + 12) % 12
  const notes = [...state.activeNotes].sort((a, b) => offset(a) - offset(b))
  if (!notes.length) return []
  const label = (pitch: typeof root) => {
    const degree = state.selection.topic === 'fifths'
      ? chromaticDegrees[offset(pitch)]
      : state.resolved.notes.find((note) => note.pitchClass === pitch)?.degree ?? chromaticDegrees[offset(pitch)]
    return { note: noteLabelForState(state, pitch), degree }
  }
  return notes.map((pitch, index) => {
    const next = notes[index + 1]
    return {
      ...label(pitch),
      semitones: (next === undefined ? 12 : offset(next)) - offset(pitch),
      nextNote: noteLabelForState(state, next ?? root),
    }
  })
}
