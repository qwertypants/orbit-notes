import { activeNotesInOrder, type ExplorerState } from '../explorer-state.ts'
import { noteLabelForState } from '../theory/learning-summary.ts'
import type { PitchClass } from '../theory/music-theory.ts'

export type StaffNote = {
  pitchClass: PitchClass
  letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  accidental: '' | '♯' | '♭'
  octave: number
  staffStep: number
}

const letterSteps: Record<StaffNote['letter'], number> = { C: 1, D: 2, E: 3, F: 4, G: 5, A: 6, B: 7 }
const labelPattern = /^([A-G])([♯♭]?)$/

function staffStep(letter: StaffNote['letter'], octave: number): number {
  return (octave - 4) * 7 + letterSteps[letter] - letterSteps.E
}

export function staffNotesForState(state: ExplorerState): StaffNote[] {
  return activeNotesInOrder(state).map((pitchClass) => {
    const match = labelPattern.exec(noteLabelForState(state, pitchClass))
    if (!match) throw new RangeError(`Unsupported staff note spelling: ${noteLabelForState(state, pitchClass)}`)
    const letter = match[1] as StaffNote['letter']
    const octave = 4
    return { pitchClass, letter, accidental: match[2] as StaffNote['accidental'], octave, staffStep: staffStep(letter, octave) }
  })
}
