import { activeNotesInOrder, type ExplorerState } from '../explorer-state.ts'
import { noteName } from './music-theory.ts'

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
  const selectedNotes = activeNotesInOrder(state).map((note) => noteName(note, 'flat')).join(', ') || 'None selected'

  if (state.selection.topic === 'fifths') {
    const sequence = state.resolved.notes.map((note) => noteName(note.pitchClass, 'flat'))
    return {
      title: titleFor(state, root),
      selectedNotes,
      relationships: sequence,
      explanation: 'Each move in the sequence goes up a perfect fifth. The circle visits all twelve pitch classes before returning to the start.',
    }
  }

  const relationships = state.resolved.notes.map((note) => {
    const name = noteName(note.pitchClass, 'flat')
    const interval = intervalNames[note.interval] ?? note.interval
    return `${note.degree} · ${name} — ${interval} from ${root}`
  })

  const explanation = state.selection.topic === 'scales'
    ? 'These notes make the selected scale. Each degree describes a note’s place relative to the root.'
    : state.selection.topic === 'arpeggios'
      ? 'An arpeggio plays the chord tones one at a time, in order.'
      : 'A chord sounds its notes together. Each interval here is measured from the root.'

  return { title: titleFor(state, root), selectedNotes, relationships, explanation }
}
