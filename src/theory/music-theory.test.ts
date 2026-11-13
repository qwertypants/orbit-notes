import { describe, expect, it } from 'vitest'
import {
  circleOfFifths, enharmonicNames, fifthNeighbors, noteName, parseNoteName,
  pitchClass, resolveTopic, transpose,
} from './music-theory.ts'
import { defaultSelectionForTradition, selectionForTraditionPattern } from './tradition-catalog.ts'

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

describe('catalog pattern resolution', () => {
  it('updates the active pattern when a tradition is chosen', () => {
    const western = defaultSelectionForTradition('western-tonal-theory', 0)!
    expect(resolveTopic(western.selection).label).toBe('Major scale')
    expect(resolveTopic(western.selection).topic).toBe('scales')

    const romanian = defaultSelectionForTradition('romanian-folklore', 7)!
    expect(resolveTopic(romanian.selection).label).toBe('Bihor hemitonic pentatonic (F–G–B–C–D)')
    expect(resolveTopic(romanian.selection).notes.map(({ pitchClass }) => pitchClass)).toEqual([7, 9, 1, 2, 4])

    const arpeggio = selectionForTraditionPattern('western-major-triad-arpeggio', 2)!
    expect(resolveTopic(arpeggio.selection).topic).toBe('arpeggios')
    expect(resolveTopic(arpeggio.selection).notes.map(({ pitchClass }) => pitchClass)).toEqual([2, 6, 9])
  })

  it('resolves the Western default arpeggio in order after a pattern is selected', () => {
    const result = resolveTopic({ topic: 'arpeggios', root: 2, culturalPatternId: 'western-major-triad-arpeggio' })

    expect(result.label).toBe('Major triad arpeggio')
    expect(result.topic).toBe('arpeggios')
    expect(result.notes.map(({ pitchClass, degree }) => ({ pitchClass, degree }))).toEqual([
      { pitchClass: 2, degree: '1' },
      { pitchClass: 6, degree: '3' },
      { pitchClass: 9, degree: '5' },
    ])
  })

  it('transposes the Bihor pitch collection in catalog order with step links', () => {
    const result = resolveTopic({ topic: 'scales', root: 7, culturalPatternId: 'bihor-hemitonic-pentatonic' })

    expect(result).toEqual({
      topic: 'scales', root: 7, preset: 'bihor-hemitonic-pentatonic', label: 'Bihor hemitonic pentatonic (F–G–B–C–D)',
      notes: [
        { pitchClass: 7, semitonesFromRoot: 0, interval: 'R', degree: '1' },
        { pitchClass: 9, semitonesFromRoot: 2, interval: 'M2', degree: '2' },
        { pitchClass: 1, semitonesFromRoot: 6, interval: 'TT', degree: '♯4' },
        { pitchClass: 2, semitonesFromRoot: 7, interval: 'P5', degree: '5' },
        { pitchClass: 4, semitonesFromRoot: 9, interval: 'M6', degree: '6' },
      ],
      links: [
        { from: 7, to: 9, kind: 'step' },
        { from: 9, to: 1, kind: 'step' },
        { from: 1, to: 2, kind: 'step' },
        { from: 2, to: 4, kind: 'step' },
      ],
    })
  })

  it('transposes C gōng mode without changing its degrees or order', () => {
    const result = resolveTopic({ topic: 'scales', root: 10, culturalPatternId: 'chinese-c-gong-mode' })

    expect(result).toEqual({
      topic: 'scales', root: 10, preset: 'chinese-c-gong-mode', label: 'C gōng mode',
      notes: [
        { pitchClass: 10, semitonesFromRoot: 0, interval: 'R', degree: '1' },
        { pitchClass: 0, semitonesFromRoot: 2, interval: 'M2', degree: '2' },
        { pitchClass: 2, semitonesFromRoot: 4, interval: 'M3', degree: '3' },
        { pitchClass: 5, semitonesFromRoot: 7, interval: 'P5', degree: '5' },
        { pitchClass: 7, semitonesFromRoot: 9, interval: 'M6', degree: '6' },
      ],
      links: [
        { from: 10, to: 0, kind: 'step' },
        { from: 0, to: 2, kind: 'step' },
        { from: 2, to: 5, kind: 'step' },
        { from: 5, to: 7, kind: 'step' },
      ],
    })
  })

  it('rejects unknown catalog IDs instead of falling back to a standard preset', () => {
    expect(() => resolveTopic({ topic: 'scales', root: 0, culturalPatternId: 'major' }))
      .toThrow(new RangeError('Unknown cultural pattern ID: major'))
  })

  it('rejects selecting a catalog scale as an arpeggio', () => {
    expect(() => resolveTopic({ topic: 'arpeggios', root: 0, culturalPatternId: 'bihor-hemitonic-pentatonic' }))
      .toThrow(new RangeError('Cultural pattern bihor-hemitonic-pentatonic has kind scale and cannot resolve as arpeggios'))
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
