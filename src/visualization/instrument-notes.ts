import type { ExplorerState } from '../explorer-state.ts'
import { noteLabelForState } from '../theory/learning-summary.ts'
import type { PitchClass } from '../theory/music-theory.ts'

export type InstrumentKind = 'piano' | 'guitar'
type InstrumentNote = {
  pitchClass: PitchClass
  label: string
  selected: boolean
  root: boolean
}
export type PianoKey = InstrumentNote & { index: number; black: boolean }
export type GuitarPosition = InstrumentNote & { string: number; fret: number }

function describe(state: ExplorerState, pitchClass: PitchClass): InstrumentNote {
  const selected = state.activeNotes.includes(pitchClass)
  return {
    pitchClass,
    label: noteLabelForState(state, pitchClass),
    selected,
    root: selected && pitchClass === state.resolved.root,
  }
}

export function pianoNotesForState(state: ExplorerState): PianoKey[] {
  return Array.from({ length: 13 }, (_, index) => ({
    ...describe(state, (index % 12) as PitchClass),
    index,
    black: [1, 3, 6, 8, 10].includes(index),
  }))
}

export function guitarNotesForState(state: ExplorerState): GuitarPosition[] {
  return ([4, 11, 7, 2, 9, 4] as const).flatMap((open, row) =>
    Array.from({ length: 5 }, (_, fret) => ({
      ...describe(state, ((open + fret) % 12) as PitchClass),
      string: row + 1,
      fret,
    })))
}
