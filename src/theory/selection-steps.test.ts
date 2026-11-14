import { expect, test } from 'vitest'
import { createExplorerState } from '../explorer-state.ts'
import { selectionSteps } from './selection-steps.ts'

test('major scale pairs notes and degrees with whole and half steps', () => {
  const steps = selectionSteps(createExplorerState({ topic: 'scales', root: 0, preset: 'major' }))
  expect(steps).toEqual([
    { note: 'C', degree: '1', semitones: 2, nextNote: 'D' },
    { note: 'D', degree: '2', semitones: 2, nextNote: 'E' },
    { note: 'E', degree: '3', semitones: 1, nextNote: 'F' },
    { note: 'F', degree: '4', semitones: 2, nextNote: 'G' },
    { note: 'G', degree: '5', semitones: 2, nextNote: 'A' },
    { note: 'A', degree: '6', semitones: 2, nextNote: 'B' },
    { note: 'B', degree: '7', semitones: 1, nextNote: 'C' },
  ])
})

test('custom chord notes sort upward and empty selection has no ladder', () => {
  const state = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
  expect(selectionSteps({ ...state, activeNotes: [7, 0, 4] })).toEqual([
    { note: 'C', degree: '1', semitones: 4, nextNote: 'E' },
    { note: 'E', degree: '3', semitones: 3, nextNote: 'G' },
    { note: 'G', degree: '5', semitones: 5, nextNote: 'C' },
  ])
  expect(selectionSteps({ ...state, activeNotes: [] })).toEqual([])
})

test('transposition retains altered degrees and wraps to the root', () => {
  expect(selectionSteps(createExplorerState({ topic: 'chords', root: 10, preset: 'minor' }))).toEqual([
    { note: 'B♭', degree: '1', semitones: 3, nextNote: 'D♭' },
    { note: 'D♭', degree: '♭3', semitones: 4, nextNote: 'F' },
    { note: 'F', degree: '5', semitones: 5, nextNote: 'B♭' },
  ])
})
