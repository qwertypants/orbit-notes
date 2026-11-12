import {
  fifthNeighbors,
  resolveTopic,
  type PitchClass,
  type ResolvedTopic,
  type TopicSelection,
} from './theory/music-theory.ts'

export type ExplorerState = {
  selection: TopicSelection
  resolved: ResolvedTopic
  activeNotes: readonly PitchClass[]
}

export function createExplorerState(selection: TopicSelection): ExplorerState {
  const resolved = resolveTopic(selection)
  const activeNotes = selection.topic === 'fifths'
    ? [selection.root, fifthNeighbors(selection.root).next, fifthNeighbors(selection.root).previous]
    : resolved.notes.map((note) => note.pitchClass)

  return { selection, resolved, activeNotes }
}

export function toggleExplorerNote(state: ExplorerState, note: PitchClass): ExplorerState {
  const activeNotes = state.activeNotes.includes(note)
    ? state.activeNotes.filter((active) => active !== note)
    : [...state.activeNotes, note]
  return { ...state, activeNotes }
}

/** Pattern notes keep their musical order; added notes follow in circle order. */
export function activeNotesInOrder(state: ExplorerState): PitchClass[] {
  const active = new Set(state.activeNotes)
  const pattern = state.resolved.notes.map((note) => note.pitchClass).filter((note) => active.has(note))
  const extras = [...active].filter((note) => !pattern.includes(note)).sort((a, b) => a - b)
  return [...pattern, ...extras]
}
