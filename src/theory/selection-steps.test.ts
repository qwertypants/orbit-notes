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


test('minor-key ladder measures degrees and steps from the minor root', () => {
  const state = createExplorerState({ topic: 'fifths', root: 7, minorRoot: 4 })
  expect(selectionSteps(state)).toEqual([
    { note: 'E', degree: '1', semitones: 2, nextNote: 'F♯' },
    { note: 'F♯', degree: '2', semitones: 1, nextNote: 'G' },
    { note: 'G', degree: '♭3', semitones: 2, nextNote: 'A' },
    { note: 'A', degree: '4', semitones: 2, nextNote: 'B' },
    { note: 'B', degree: '5', semitones: 1, nextNote: 'C' },
    { note: 'C', degree: '♭6', semitones: 2, nextNote: 'D' },
    { note: 'D', degree: '♭7', semitones: 2, nextNote: 'E' },
  ])
})

test('Phrygian preserves its lowered degrees and transposes from C to E', () => {
  const steps = selectionSteps(createExplorerState({ topic: 'scales', root: 0, culturalPatternId: 'western-phrygian-mode' }))
  expect(steps.map(step => step.note)).toEqual(['C', 'D♭', 'E♭', 'F', 'G', 'A♭', 'B♭'])
  expect(steps.map(step => step.degree)).toEqual(['1', '♭2', '♭3', '4', '5', '♭6', '♭7'])
  expect(steps.map(step => step.semitones)).toEqual([1, 2, 2, 2, 1, 2, 2])
  expect(steps[6].nextNote).toBe('C')
  const transposed = selectionSteps(createExplorerState({ topic: 'scales', root: 4, culturalPatternId: 'western-phrygian-mode' }))
  expect(transposed.map(step => step.note)).toEqual(['E', 'F', 'G', 'A', 'B', 'C', 'D'])
})
