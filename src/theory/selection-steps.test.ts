import { expect, test } from 'vitest'
import { createExplorerState } from '../explorer-state.ts'
import { selectionSteps } from './selection-steps.ts'

test('major scale shows degrees, whole and half steps, and octave closure', () => {
  expect(selectionSteps(createExplorerState({ topic: 'scales', root: 0, preset: 'major' }))).toBe('C (1) —whole step→ D (2) —whole step→ E (3) —half step→ F (4) —whole step→ G (5) —whole step→ A (6) —whole step→ B (7) —half step→ C (1, next octave)')
})

test('chord gaps use semitones and order custom notes upward from the root', () => {
  const state = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
  expect(selectionSteps({ ...state, activeNotes: [7, 0, 4] })).toBe('C (1) —4 semitones→ E (3) —3 semitones→ G (5) —5 semitones→ C (1, next octave)')
  expect(selectionSteps({ ...state, activeNotes: [] })).toBe('No notes selected')
})

test('transposed selections wrap through C and keep altered degrees', () => {
  expect(selectionSteps(createExplorerState({ topic: 'chords', root: 10, preset: 'minor' }))).toBe('B♭ (1) —3 semitones→ D♭ (♭3) —4 semitones→ F (5) —5 semitones→ B♭ (1, next octave)')
})
