import { describe, expect, it } from 'vitest'
import { activeNotesInOrder, createExplorerState, selectRelativeMinor, toggleExplorerNote } from './explorer-state.ts'

describe('explorer selection', () => {
  it('starts chords and scales with their pattern notes in musical order', () => {
    expect(activeNotesInOrder(createExplorerState({ topic: 'chords', root: 0, preset: 'major' }))).toEqual([0, 4, 7])
    expect(activeNotesInOrder(createExplorerState({ topic: 'scales', root: 2, preset: 'major' }))).toEqual([2, 4, 6, 7, 9, 11, 1])
  })

  it('toggles notes without changing the chosen root or topic', () => {
    const initial = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
    const withoutThird = toggleExplorerNote(initial, 4)
    expect(activeNotesInOrder(withoutThird)).toEqual([0, 7])
    expect(activeNotesInOrder(toggleExplorerNote(withoutThird, 3))).toEqual([0, 7, 3])
    expect(withoutThird.selection).toBe(initial.selection)
  })

  it('begins fifths with the root and its two neighbors', () => {
    const state = createExplorerState({ topic: 'fifths', root: 0 })
    expect(activeNotesInOrder(state)).toEqual([0, 7, 5])
    expect(state.resolved.notes).toHaveLength(12)
  })
})


describe('relative minor selection', () => {
  it('selects A minor in fifths while retaining C as the outer root', () => {
    const state = selectRelativeMinor(createExplorerState({ topic: 'fifths', root: 0 }), 9)
    expect(state.selection).toEqual({ topic: 'fifths', root: 0, minorRoot: 9 })
    expect(activeNotesInOrder(state)).toEqual([9, 11, 0, 2, 4, 5, 7])
    expect(state.resolved.root).toBe(9)
    expect(state.resolved.topic).toBe('fifths')
    expect(state.resolved.preset).toBe('naturalMinor')
    expect(selectRelativeMinor(state, 9)).toEqual(state)
  })

  it('changes the minor root without moving the outer major root', () => {
    const state = selectRelativeMinor(createExplorerState({ topic: 'fifths', root: 0, minorRoot: 9 }), 4)
    expect(state.selection).toEqual({ topic: 'fifths', root: 0, minorRoot: 4 })
    expect(activeNotesInOrder(state)).toEqual([4, 6, 7, 9, 11, 0, 2])
    expect(state.resolved.root).toBe(4)
  })

  it('clears the minor-key claim when an outer note is removed or added', () => {
    const state = createExplorerState({ topic: 'fifths', root: 0, minorRoot: 9 })
    for (const pitch of [0, 1] as const) {
      const edited = toggleExplorerNote(state, pitch)
      expect(edited.selection).toEqual({ topic: 'fifths', root: 0 })
      expect(edited.resolved).toEqual(createExplorerState({ topic: 'fifths', root: 0 }).resolved)
      expect(edited.activeNotes.includes(pitch)).toBe(!state.activeNotes.includes(pitch))
      expect(edited.activeNotes).toHaveLength(pitch === 0 ? 6 : 8)
    }
  })

  it('keeps minor selection local to fifths and resets when another mode is created', () => {
    const chord = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
    expect(selectRelativeMinor(chord, 9)).toBe(chord)
    const scale = createExplorerState({ topic: 'scales', root: 0, preset: 'major' })
    expect(scale.selection).not.toHaveProperty('minorRoot')
    expect(scale.activeNotes).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(createExplorerState({ topic: 'fifths', root: 0 }).activeNotes).toEqual([0, 7, 5])
  })
})


it('resets a minor selection to the outer major root and its fifth neighbors', () => {
  const minor = createExplorerState({ topic: 'fifths', root: 2, minorRoot: 11 })
  const reset = selectRelativeMinor(minor, undefined)
  expect(reset.selection).toStrictEqual({ topic: 'fifths', root: 2 })
  expect(reset.activeNotes).toEqual([2, 9, 7])
  expect(reset.resolved.root).toBe(2)
})
