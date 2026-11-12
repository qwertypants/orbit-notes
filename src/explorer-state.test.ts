import { describe, expect, it } from 'vitest'
import { activeNotesInOrder, createExplorerState, toggleExplorerNote } from './explorer-state.ts'

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
