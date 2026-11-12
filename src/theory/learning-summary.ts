import { activeNotesInOrder, type ExplorerState } from '../explorer-state.ts'
import { noteName, type PitchClass } from './music-theory.ts'

export type LearningSummary = {
  title: string
  selectedNotes: string
  relationships: string[]
  explanation: string
}

const intervalNames: Record<string, string> = {
  R: 'root',
  m2: 'minor second',
  M2: 'major second',
  m3: 'minor third',
  M3: 'major third',
  P4: 'perfect fourth',
  TT: 'tritone',
  P5: 'perfect fifth',
  m6: 'minor sixth',
  M6: 'major sixth',
  m7: 'minor seventh',
  M7: 'major seventh',
  d5: 'diminished fifth',
  A5: 'augmented fifth',
}

const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const naturalPitches = [0, 2, 4, 5, 7, 9, 11] as const
const customDegrees = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'] as const
const customIntervals = ['R', 'm2', 'M2', 'm3', 'M3', 'P4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7'] as const

/** Spell a chord or scale tone using its degree's expected letter from the root. */
function spellDegree(root: string, degree: string, pitch: PitchClass): string {
  const degreeNumber = Number(degree.match(/[1-7]/)?.[0])
  if (!degreeNumber) return noteName(pitch, 'flat')
  const letterIndex = (letters.indexOf(root[0] as typeof letters[number]) + degreeNumber - 1) % 7
  const difference = (pitch - naturalPitches[letterIndex] + 12) % 12
  const accidentals: Record<number, string> = { 0: '', 1: '♯', 2: '𝄪', 10: '𝄫', 11: '♭' }
  const accidental = accidentals[difference]
  return accidental === undefined ? noteName(pitch, 'flat') : `${letters[letterIndex]}${accidental}`
}

/** Keep selected note labels consistent across the circle, controls, and learning panel. */
export function noteLabelForState(state: ExplorerState, pitch: PitchClass): string {
  if (state.selection.topic === 'fifths') return noteName(pitch, 'flat')
  const root = noteName(state.selection.root, 'flat')
  const patternNote = state.resolved.notes.find((note) => note.pitchClass === pitch)
  if (patternNote) return spellDegree(root, patternNote.degree, pitch)
  if (!state.activeNotes.includes(pitch)) return noteName(pitch, 'flat')
  const semitones = (pitch - state.selection.root + 12) % 12
  return spellDegree(root, customDegrees[semitones], pitch)
}

function titleFor(state: ExplorerState, root: string): string {
  switch (state.selection.topic) {
    case 'chords': return `${root} ${state.resolved.label} chord`
    case 'scales': return `${root} ${state.resolved.label} scale`
    case 'arpeggios': return `${root} ${state.resolved.label} arpeggio`
    case 'fifths': return `${root} circle of fifths`
  }
}

/** Builds the optional learning copy from the same resolved topic and selected notes as the circle. */
export function createLearningSummary(state: ExplorerState): LearningSummary {
  const root = noteName(state.selection.root, 'flat')
  const activeNotes = activeNotesInOrder(state)

  if (state.selection.topic === 'fifths') {
    const sequence = state.resolved.notes.map((note) => noteName(note.pitchClass, 'flat'))
    return {
      title: titleFor(state, root),
      selectedNotes: activeNotes.map((note) => noteName(note, 'flat')).join(', ') || 'None selected',
      relationships: sequence,
      explanation: 'Each move in the sequence goes up a perfect fifth. The circle visits all twelve pitch classes before returning to the start.',
    }
  }

  const patternNotes = state.resolved.notes
  const isCustom = activeNotes.length !== patternNotes.length || activeNotes.some((note) => !patternNotes.some((pattern) => pattern.pitchClass === note))
  const notes = isCustom
    ? activeNotes.map((pitchClass) => {
      const retainedPatternNote = patternNotes.find((note) => note.pitchClass === pitchClass)
      if (retainedPatternNote) return retainedPatternNote
      const semitones = (pitchClass - state.selection.root + 12) % 12
      return { pitchClass, degree: customDegrees[semitones], interval: customIntervals[semitones] }
    })
    : patternNotes
  const namedNotes = notes.map((note) => ({ ...note, name: noteLabelForState(state, note.pitchClass) }))
  const selectedNotes = namedNotes.map((note) => note.name).join(', ') || 'None selected'
  const relationships = namedNotes.map((note) => `${note.degree} · ${note.name} — ${intervalNames[note.interval] ?? note.interval} from ${root}`)

  if (isCustom) {
    return {
      title: `Custom notes around ${root}`,
      selectedNotes,
      relationships,
      explanation: 'These are your selected notes. Each interval is measured from the root.',
    }
  }

  const explanation = state.selection.topic === 'scales'
    ? 'These notes make the selected scale. Each degree describes a note’s place relative to the root.'
    : state.selection.topic === 'arpeggios'
      ? 'An arpeggio plays the chord tones one at a time, in order.'
      : 'A chord sounds its notes together. Each interval here is measured from the root.'

  return { title: titleFor(state, root), selectedNotes, relationships, explanation }
}
