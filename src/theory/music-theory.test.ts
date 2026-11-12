import { describe, expect, it } from 'vitest'
import {
  circleOfFifths, enharmonicNames, fifthNeighbors, noteName, parseNoteName,
  pitchClass, resolveTopic, transpose,
} from './music-theory.ts'

describe('pitch classes and names', () => {
  it('wraps octave boundaries in both directions', () => {
    expect(pitchClass(12)).toBe(0)
    expect(pitchClass(-1)).toBe(11)
    expect(transpose(11, 2)).toBe(1)
    expect(() => pitchClass(1.5)).toThrow(RangeError)
  })

  it('parses common enharmonic spellings consistently', () => {
    expect(parseNoteName('C#')).toBe(parseNoteName('D♭'))
    expect(parseNoteName('B#')).toBe(0)
    expect(parseNoteName('C♭')).toBe(11)
    expect(noteName(3)).toBe('D♯')
    expect(noteName(3, 'flat')).toBe('E♭')
    expect(enharmonicNames(3)).toEqual(['D♯', 'E♭'])
    expect(enharmonicNames(4)).toEqual(['E'])
  })
})

describe('topic note membership', () => {
  it('transposes major and minor triads and keeps chord links at the root', () => {
    const cMajor = resolveTopic({ topic: 'chords', root: 0, preset: 'major' })
    const dMinor = resolveTopic({ topic: 'chords', root: 2, preset: 'minor' })
    expect(cMajor.notes.map((note) => note.pitchClass)).toEqual([0, 4, 7])
    expect(dMinor.notes.map((note) => note.pitchClass)).toEqual([2, 5, 9])
    expect(dMinor.notes.map((note) => note.interval)).toEqual(['R', 'm3', 'P5'])
    expect(cMajor.links).toEqual([
      { from: 0, to: 4, kind: 'root' },
      { from: 0, to: 7, kind: 'root' },
    ])
  })

  it('resolves seventh chords across the octave and preserves interval spelling', () => {
    const fSharpDominant = resolveTopic({ topic: 'chords', root: 6, preset: 'dominant7' })
    const aFlatMajorSeven = resolveTopic({ topic: 'chords', root: 8, preset: 'major7' })
    const cDiminished = resolveTopic({ topic: 'chords', root: 0, preset: 'diminished' })
    const cAugmented = resolveTopic({ topic: 'chords', root: 0, preset: 'augmented' })
    expect(fSharpDominant.notes.map((note) => note.pitchClass)).toEqual([6, 10, 1, 4])
    expect(aFlatMajorSeven.notes.map((note) => note.pitchClass)).toEqual([8, 0, 3, 7])
    expect(cDiminished.notes[2].interval).toBe('d5')
    expect(cAugmented.notes[2].interval).toBe('A5')
  })

  it('resolves major, natural minor, and pentatonic scales as ordered sets', () => {
    const gMajor = resolveTopic({ topic: 'scales', root: 7, preset: 'major' })
    const aMinor = resolveTopic({ topic: 'scales', root: 9, preset: 'naturalMinor' })
    const cMinorPentatonic = resolveTopic({ topic: 'scales', root: 0, preset: 'minorPentatonic' })
    expect(gMajor.notes.map((note) => note.pitchClass)).toEqual([7, 9, 11, 0, 2, 4, 6])
    expect(aMinor.notes.map((note) => note.pitchClass)).toEqual([9, 11, 0, 2, 4, 5, 7])
    expect(cMinorPentatonic.notes.map((note) => note.pitchClass)).toEqual([0, 3, 5, 7, 10])
    expect(gMajor.links).toHaveLength(6)
  })

  it('uses chord membership in order for arpeggios', () => {
    const result = resolveTopic({ topic: 'arpeggios', root: 4, preset: 'minor7' })
    expect(result.notes.map((note) => note.pitchClass)).toEqual([4, 7, 11, 2])
    expect(result.links.map((link) => link.kind)).toEqual(['step', 'step', 'step'])
  })
})

describe('circle of fifths', () => {
  it('has all twelve notes once in ascending fifth order', () => {
    expect(circleOfFifths).toEqual([0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5])
    expect(new Set(circleOfFifths).size).toBe(12)
    expect(fifthNeighbors(0)).toEqual({ previous: 5, next: 7 })
  })

  it('rotates from a selected root and closes the fifth chain', () => {
    const result = resolveTopic({ topic: 'fifths', root: 2 })
    expect(result.notes.map((note) => note.pitchClass)).toEqual([2, 9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7])
    expect(result.links[0]).toEqual({ from: 2, to: 9, kind: 'fifth' })
    expect(result.links[11]).toEqual({ from: 7, to: 2, kind: 'fifth' })
  })
})
