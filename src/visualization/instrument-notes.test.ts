import { expect, it } from 'vitest'
import { createExplorerState, selectRelativeMinor, toggleExplorerNote, type ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import { guitarPlaybackPosition, guitarNotesForState, pianoNotesForState } from './instrument-notes.ts'

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
  expect(pianoNotesForState(state)[1].label).toBe('D♭')
  expect(pianoNotesForState(state)[0].root).toBe(false)
  expect(pianoNotesForState(state)[1].root).toBe(false)

})

const allPitches: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

it('maps every piano key to a literal pitch class and black-key group', () => {
  expect(pianoNotesForState(stateWith(...allPitches)).map(({ index, pitchClass, black }) => [index, pitchClass, black]))
    .toEqual([
      [0, 0, false], [1, 1, true], [2, 2, false], [3, 3, true], [4, 4, false],
      [5, 5, false], [6, 6, true], [7, 7, false], [8, 8, true], [9, 9, false],
      [10, 10, true], [11, 11, false], [12, 0, false],
    ])
})

it('maps every string and fret to literal standard-tuning pitches', () => {
  expect(guitarNotesForState(stateWith(...allPitches)).map(({ string, fret, pitchClass }) => [string, fret, pitchClass]))
    .toEqual([
      [1, 0, 4], [1, 1, 5], [1, 2, 6], [1, 3, 7], [1, 4, 8],
      [2, 0, 11], [2, 1, 0], [2, 2, 1], [2, 3, 2], [2, 4, 3],
      [3, 0, 7], [3, 1, 8], [3, 2, 9], [3, 3, 10], [3, 4, 11],
      [4, 0, 2], [4, 1, 3], [4, 2, 4], [4, 3, 5], [4, 4, 6],
      [5, 0, 9], [5, 1, 10], [5, 2, 11], [5, 3, 0], [5, 4, 1],
      [6, 0, 4], [6, 1, 5], [6, 2, 6], [6, 3, 7], [6, 4, 8],
    ])
})

it.each(allPitches)('selects only pitch class %i on both instruments', (pitch) => {
  for (const notes of [pianoNotesForState(stateWith(pitch)), guitarNotesForState(stateWith(pitch))]) {
    expect(notes.some((note) => note.selected)).toBe(true)
    expect(notes.every((note) => note.selected === (note.pitchClass === pitch))).toBe(true)
  }
})

it('marks A as the resolved tonic when the C outer ring selects A minor', () => {
  const state = selectRelativeMinor(createExplorerState({ topic: 'fifths', root: 0 }), 9)
  expect(state.selection.root).toBe(0)
  expect(state.resolved.root).toBe(9)
  expect(pianoNotesForState(state).filter((note) => note.root).map((note) => note.index)).toEqual([9])
  expect(guitarNotesForState(state).filter((note) => note.root).map((note) => [note.string, note.fret]))
    .toEqual([[3, 2], [5, 0]])
})

it('retains the major tonic for custom selections and removes emphasis when it is deselected', () => {
  const major = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
  const custom = toggleExplorerNote(major, 1)
  for (const state of [major, custom]) {
    expect(pianoNotesForState(state).filter((note) => note.root).map((note) => note.index)).toEqual([0, 12])
    expect(guitarNotesForState(state).filter((note) => note.root).map((note) => [note.string, note.fret]))
      .toEqual([[2, 1], [5, 3]])
  }
  for (const notes of [pianoNotesForState(toggleExplorerNote(custom, 0)), guitarNotesForState(toggleExplorerNote(custom, 0))]) {
    expect(notes.every((note) => !note.root)).toBe(true)
  }
})

it.each([
  [createExplorerState({ topic: 'fifths', root: 0 }), ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B', 'C']],
  [createExplorerState({ topic: 'chords', root: 1, preset: 'diminished' }), ['C', 'D♭', 'D', 'E♭', 'F♭', 'F', 'G♭', 'A𝄫', 'A♭', 'A', 'B♭', 'B', 'C']],
  [createExplorerState({ topic: 'chords', root: 11, preset: 'augmented' }), ['C', 'D♭', 'D', 'D♯', 'E', 'F', 'G♭', 'F𝄪', 'A♭', 'A', 'B♭', 'B', 'C']],
  [createExplorerState({ topic: 'scales', root: 6, preset: 'major' }), ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'C♭', 'C']],
  [selectRelativeMinor(createExplorerState({ topic: 'fifths', root: 0 }), 6), ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B', 'C']],
])('uses literal state-aware spellings on both instruments', (state, labels) => {
  expect(pianoNotesForState(state).map((note) => note.label)).toEqual(labels)
  for (const note of guitarNotesForState(state)) expect(note.label).toBe(labels[note.pitchClass])
})

it.each(allPitches)('chooses the lowest-fret representative for pitch %i', pitch => {
  const positions = guitarNotesForState(stateWith())
  const picked = guitarPlaybackPosition(positions, pitch)!
  expect(picked.pitchClass).toBe(pitch)
  expect(picked.fret).toBe(Math.min(...positions.filter(p => p.pitchClass === pitch).map(p => p.fret)))
  expect(picked.string).toBe(Math.min(...positions.filter(p => p.pitchClass === pitch && p.fret === picked.fret).map(p => p.string)))
})
