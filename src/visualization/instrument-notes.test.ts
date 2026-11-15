import { expect, it } from 'vitest'
import { createExplorerState, type ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import { noteLabelForState } from '../theory/learning-summary.ts'
import { guitarNotesForState, pianoNotesForState } from './instrument-notes.ts'

const stateWith = (...activeNotes: PitchClass[]): ExplorerState => ({
  ...createExplorerState({ topic: 'fifths', root: 0 }), activeNotes,
})

it('shows both Cs and all selected positions, without choosing a voicing', () => {
  const keys = pianoNotesForState(stateWith(0, 4, 7))
  expect(keys).toHaveLength(13)
  expect(keys.filter((key) => key.selected).map((key) => key.index)).toEqual([0, 4, 7, 12])
  const notes = guitarNotesForState(stateWith(0))
  expect(notes).toHaveLength(30)
  expect(notes.filter((note) => note.selected).map((note) => [note.string, note.fret]))
    .toEqual([[2, 1], [5, 3]])
})

it('handles empty and chromatic selections', () => {
  expect(guitarNotesForState(stateWith()).every((note) => !note.selected)).toBe(true)
  const all = Array.from({ length: 12 }, (_, index) => index as PitchClass)
  expect(pianoNotesForState(stateWith(...all)).every((key) => key.selected)).toBe(true)
  expect(guitarNotesForState(stateWith(...all)).every((note) => note.selected)).toBe(true)
})

it('shows both open E strings for E', () => {
  expect(guitarNotesForState(stateWith(4)).filter((note) => note.selected && note.fret === 0)
    .map((note) => note.string)).toEqual([1, 6])
})

it('uses state-aware spelling and highlights only a selected root', () => {
  const state = stateWith(1)
  expect(pianoNotesForState(state)[1].label).toBe(noteLabelForState(state, 1))
  expect(pianoNotesForState(state)[1].label).toBe('D♭')
  expect(pianoNotesForState(state)[0].root).toBe(false)
  expect(pianoNotesForState(state)[1].root).toBe(false)
  const base = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
  const doubleAccidental: ExplorerState = {
    ...base,
    activeNotes: [2],
    resolved: { ...base.resolved, notes: [...base.resolved.notes, { ...base.resolved.notes[0], pitchClass: 2, degree: '3' }] },
  }
  expect(pianoNotesForState(doubleAccidental).find((key) => key.pitchClass === 2)?.label).toBe('E𝄫')
})
