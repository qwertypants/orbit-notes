import { describe, expect, it } from 'vitest'
import { createExplorerState, activeNotesInOrder, type ExplorerState } from '../explorer-state.ts'
import { parseNoteName } from '../theory/music-theory.ts'
import { staffNotesForState } from './staff-notes.ts'

function stateWithNotes(...names: string[]): ExplorerState {
  const base = createExplorerState({ topic: 'fifths', root: parseNoteName('C') })
  return { ...base, activeNotes: names.map(parseNoteName) }
}

describe('staffNotesForState', () => {
  it('returns no staff notes for an empty selection', () => {
    expect(staffNotesForState(stateWithNotes())).toEqual([])
  })

  it('maps C to the C4 ledger line below the treble staff', () => {
    expect(staffNotesForState(stateWithNotes('C'))[0]).toMatchObject({ pitchClass: parseNoteName('C'), letter: 'C', accidental: '', octave: 4, staffStep: -2 })
  })

  it('maps natural E4 to the bottom staff line', () => {
    expect(staffNotesForState(stateWithNotes('E'))[0]).toMatchObject({ letter: 'E', accidental: '', octave: 4, staffStep: 0 })
  })

  it('keeps sharp spelling', () => {
    const state = createExplorerState({ topic: 'chords', root: parseNoteName('G'), preset: 'major' })
    expect(staffNotesForState({ ...state, activeNotes: [parseNoteName('F♯')] })[0]).toMatchObject({ letter: 'F', accidental: '♯', octave: 4 })
  })

  it('preserves a supported double sharp and its diatonic staff position', () => {
    const state = createExplorerState({ topic: 'chords', root: parseNoteName('B'), preset: 'augmented' })
    expect(staffNotesForState({ ...state, activeNotes: [parseNoteName('G')] })[0]).toMatchObject({
      pitchClass: parseNoteName('G'), letter: 'F', accidental: '𝄪', octave: 4, staffStep: 1,
    })
  })

  it('preserves the state-aware flat spelling', () => {
    expect(staffNotesForState(stateWithNotes('B♭'))[0]).toMatchObject({ letter: 'B', accidental: '♭', octave: 4 })
  })

  it('uses active note order', () => {
    const state = stateWithNotes('G', 'C', 'E')
    expect(staffNotesForState(state).map((note) => note.pitchClass)).toEqual(activeNotesInOrder(state))
  })
})
