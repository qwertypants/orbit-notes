import { findTraditionPattern } from './tradition-catalog.ts'

/** Pitch classes use C = 0 through B = 11, independent of octave or spelling. */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
export type Spelling = 'sharp' | 'flat'
export type TopicId = 'chords' | 'scales' | 'arpeggios' | 'fifths'

const sharpNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
const flatNames = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const
const naturalPitches: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Wrap any integer semitone value into the twelve pitch classes. */
export function pitchClass(value: number): PitchClass {
  if (!Number.isInteger(value)) throw new RangeError('A pitch class requires an integer semitone value')
  return ((value % 12 + 12) % 12) as PitchClass
}

export function transpose(root: PitchClass, semitones: number): PitchClass {
  return pitchClass(root + semitones)
}

/** Accept ASCII or musical accidental symbols, including enharmonic spellings. */
export function parseNoteName(name: string): PitchClass {
  const match = /^([A-Ga-g])([#♯b♭]?)$/.exec(name.trim())
  if (!match) throw new RangeError(`Unknown note name: ${name}`)
  const natural = naturalPitches[match[1].toUpperCase()]
  const accidental = match[2] === '#' || match[2] === '♯' ? 1 : match[2] === 'b' || match[2] === '♭' ? -1 : 0
  return pitchClass(natural + accidental)
}

export function noteName(note: PitchClass, spelling: Spelling = 'sharp'): string {
  return (spelling === 'flat' ? flatNames : sharpNames)[note]
}

/** Returns the two common names for chromatic pitches; natural pitches have one. */
export function enharmonicNames(note: PitchClass): readonly string[] {
  const sharp = sharpNames[note]
  const flat = flatNames[note]
  return sharp === flat ? [sharp] : [sharp, flat]
}

export const circleOfFifths = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5] as const satisfies readonly PitchClass[]

export function fifthNeighbors(root: PitchClass): { previous: PitchClass; next: PitchClass } {
  return { previous: transpose(root, -7), next: transpose(root, 7) }
}

type Pattern = { label: string; intervals: readonly number[]; degrees: readonly string[] }

export const chordPresets = {
  major: { label: 'Major', intervals: [0, 4, 7], degrees: ['1', '3', '5'] },
  minor: { label: 'Minor', intervals: [0, 3, 7], degrees: ['1', '♭3', '5'] },
  diminished: { label: 'Diminished', intervals: [0, 3, 6], degrees: ['1', '♭3', '♭5'] },
  augmented: { label: 'Augmented', intervals: [0, 4, 8], degrees: ['1', '3', '♯5'] },
  major7: { label: 'Major 7', intervals: [0, 4, 7, 11], degrees: ['1', '3', '5', '7'] },
  minor7: { label: 'Minor 7', intervals: [0, 3, 7, 10], degrees: ['1', '♭3', '5', '♭7'] },
  dominant7: { label: 'Dominant 7', intervals: [0, 4, 7, 10], degrees: ['1', '3', '5', '♭7'] },
  halfDiminished7: { label: 'Half-diminished 7', intervals: [0, 3, 6, 10], degrees: ['1', '♭3', '♭5', '♭7'] },
} as const satisfies Record<string, Pattern>

export const scalePresets = {
  major: { label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  naturalMinor: { label: 'Natural minor', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'] },
  majorPentatonic: { label: 'Major pentatonic', intervals: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'] },
  minorPentatonic: { label: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10], degrees: ['1', '♭3', '4', '5', '♭7'] },
} as const satisfies Record<string, Pattern>

export type ChordPreset = keyof typeof chordPresets
export type ScalePreset = keyof typeof scalePresets
export type TopicSelection =
  | { topic: 'chords' | 'arpeggios'; root: PitchClass; preset: ChordPreset }
  | { topic: 'scales'; root: PitchClass; preset: ScalePreset }
  | { topic: 'scales' | 'arpeggios'; root: PitchClass; culturalPatternId: string }
  | { topic: 'fifths'; root: PitchClass }

/** Ordered note and relationship data consumed by both the visual and audio layers. */
export type ResolvedNote = {
  pitchClass: PitchClass
  semitonesFromRoot: number
  interval: string
  degree: string
}

export type NoteLink = {
  from: PitchClass
  to: PitchClass
  kind: 'root' | 'step' | 'fifth'
}

export type ResolvedTopic = {
  topic: TopicId
  root: PitchClass
  preset: string
  label: string
  notes: readonly ResolvedNote[]
  links: readonly NoteLink[]
}

const intervalLabels = ['R', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7'] as const
const intervalByDegree: Record<string, string> = {
  '1': 'R', '2': 'M2', '♭3': 'm3', '3': 'M3', '4': 'P4', '♭5': 'd5',
  '5': 'P5', '♯5': 'A5', '♭6': 'm6', '6': 'M6', '♭7': 'm7', '7': 'M7',
}

function patternNotes(root: PitchClass, pattern: Pattern): ResolvedNote[] {
  return pattern.intervals.map((semitones, index) => ({
    pitchClass: transpose(root, semitones),
    semitonesFromRoot: semitones,
    interval: intervalByDegree[pattern.degrees[index]],
    degree: pattern.degrees[index],
  }))
}

function rootLinks(notes: readonly ResolvedNote[], root: PitchClass): NoteLink[] {
  return notes.slice(1).map((note) => ({ from: root, to: note.pitchClass, kind: 'root' }))
}

function stepLinks(notes: readonly ResolvedNote[]): NoteLink[] {
  return notes.slice(1).map((note, index) => ({ from: notes[index].pitchClass, to: note.pitchClass, kind: 'step' }))
}

/** Resolve a topic selection once, then share its note order with display and playback. */
export function resolveTopic(selection: TopicSelection): ResolvedTopic {
  const { topic, root } = selection
  if ('culturalPatternId' in selection) {
    const pattern = findTraditionPattern(selection.culturalPatternId)
    if (!pattern) throw new RangeError(`Unknown cultural pattern ID: ${selection.culturalPatternId}`)
    const patternTopic = pattern.kind === 'scale' ? 'scales' : 'arpeggios'
    if (topic !== patternTopic) {
      throw new RangeError(`Cultural pattern ${pattern.id} has kind ${pattern.kind} and cannot resolve as ${topic}`)
    }
    const notes = patternNotes(root, { label: pattern.name, intervals: pattern.intervals, degrees: pattern.degrees })
    return { topic, root, preset: pattern.id, label: pattern.name, notes, links: stepLinks(notes) }
  }

  if (topic === 'fifths') {
    const notes = Array.from({ length: 12 }, (_, index): ResolvedNote => {
      const note = transpose(root, index * 7)
      const semitonesFromRoot = (note - root + 12) % 12
      return { pitchClass: note, semitonesFromRoot, interval: intervalLabels[semitonesFromRoot], degree: index === 0 ? '1' : `fifth ${index}` }
    })
    const links = notes.map((note, index): NoteLink => ({ from: note.pitchClass, to: notes[(index + 1) % 12].pitchClass, kind: 'fifth' }))
    return { topic, root, preset: 'fifths', label: 'Circle of fifths', notes, links }
  }

  const pattern: Pattern = topic === 'scales' ? scalePresets[selection.preset] : chordPresets[selection.preset]
  const notes = patternNotes(root, pattern)
  return {
    topic,
    root,
    preset: selection.preset,
    label: pattern.label,
    notes,
    links: topic === 'chords' ? rootLinks(notes, root) : stepLinks(notes),
  }
}
