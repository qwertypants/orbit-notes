import { chordPresets, transpose, type PitchClass, type ScaleChordSource } from './music-theory.ts'
import { findTraditionPattern } from './tradition-catalog.ts'
import { createExplorerState } from '../explorer-state.ts'
import { noteLabelForState } from './learning-summary.ts'

const triadPresets = ['major', 'minor', 'diminished', 'augmented'] as const
const romanDegrees: Record<string, string> = {
  '1': 'I', '2': 'II', '♭2': '♭II', '3': 'III', '♭3': '♭III',
  '4': 'IV', '5': 'V', '6': 'VI', '♭6': '♭VI', '7': 'VII', '♭7': '♭VII',
}

/** Western triads whose three chord tones belong to the source collection.
 * Triad qualities follow https://viva.pressbooks.pub/openmusictheory/chapter/triads/.
 */
export function scaleChords(source: ScaleChordSource) {
  if ('culturalPatternId' in source) {
    const pattern = findTraditionPattern(source.culturalPatternId)
    if (pattern?.traditionId !== 'western-tonal-theory' || pattern.kind !== 'scale') return []
  }
  const scaleSelection = source.topic === 'fifths'
    ? { topic: 'scales' as const, root: source.minorRoot ?? source.root, preset: source.minorRoot === undefined ? 'major' as const : 'naturalMinor' as const }
    : source
  const state = createExplorerState(scaleSelection)
  const notes = state.resolved.notes
  const pitches = new Set(notes.map(note => note.pitchClass))
  return notes.flatMap(note => triadPresets.flatMap(preset => {
    const pattern = chordPresets[preset]
    const chordNotes: PitchClass[] = pattern.intervals.map(interval => transpose(note.pitchClass, interval))
    if (!chordNotes.every(pitch => pitches.has(pitch))) return []
    const numeral = romanDegrees[note.degree] ?? note.degree
    const degree = preset === 'minor' || preset === 'diminished' ? numeral.toLowerCase() : numeral
    const suffix = preset === 'diminished' ? '°' : preset === 'augmented' ? '+' : ''
    return [{ root: note.pitchClass, preset, label: `${degree}${suffix} · ${noteLabelForState(state, note.pitchClass)} ${pattern.label.toLowerCase()}` }]
  }))
}
