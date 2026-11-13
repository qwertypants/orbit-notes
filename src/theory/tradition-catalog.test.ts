import { describe, expect, it } from 'vitest'
import { defaultPatternForTradition, defaultSelectionForTradition, findTraditionPattern, selectionForTraditionPattern, traditionPatterns } from './tradition-catalog.ts'
import type { TraditionPattern } from './tradition-catalog.ts'

describe('tradition catalog', () => {
  it('provides a small, nonempty collection with unique stable identities', () => {
    expect(traditionPatterns.length).toBeGreaterThan(0)
    expect(new Set(traditionPatterns.map(({ id }) => id)).size).toBe(traditionPatterns.length)
    for (const pattern of traditionPatterns) {
      for (const value of [pattern.id, pattern.traditionId, pattern.traditionName,
        pattern.region, pattern.name, pattern.context, pattern.representationNote]) {
        expect(value.trim()).not.toBe('')
      }
      expect(['scale', 'arpeggio']).toContain(pattern.kind)
    }
  })

  it('keeps playable intervals ascending within one octave with matching supported degrees', () => {
    const degreeOffsets: Record<string, number> = {
      '1': 0, '2': 2, '♭3': 3, '3': 4, '4': 5, '♭5': 6, '♯4': 6,
      '5': 7, '♯5': 8, '♭6': 8, '6': 9, '♭7': 10, '7': 11,
    }
    for (const pattern of traditionPatterns) {
      expect(pattern.intervals[0]).toBe(0)
      expect(pattern.degrees.length).toBe(pattern.intervals.length)
      pattern.intervals.forEach((interval, index) => {
        expect(Number.isInteger(interval)).toBe(true)
        expect(interval).toBeGreaterThanOrEqual(0)
        expect(interval).toBeLessThanOrEqual(11)
        if (index > 0) expect(interval).toBeGreaterThan(pattern.intervals[index - 1])
        expect(degreeOffsets[pattern.degrees[index]]).toBe(interval)
      })
    }
  })

  it('attributes each pattern with a reference supporting its pitch collection', () => {
    for (const pattern of traditionPatterns) {
      expect(pattern.sources.length).toBeGreaterThan(0)
      for (const source of pattern.sources) {
        expect(source.title.trim()).not.toBe('')
        expect(new URL(source.url).protocol).toBe('https:')
        expect(typeof source.supportsPattern).toBe('boolean')
      }
      expect(pattern.sources.some(({ supportsPattern }) => supportsPattern)).toBe(true)
    }
  })

  it('requires a pattern-specific reference for every arpeggio', () => {
    const patterns: readonly TraditionPattern[] = traditionPatterns
    for (const pattern of patterns.filter(({ kind }) => kind === 'arpeggio')) {
      expect(pattern.sources.some(({ supportsPattern }) => supportsPattern)).toBe(true)
    }
  })

  it('preserves the documented cultural pitch collections and their representation limits', () => {
    expect(findTraditionPattern('western-major-scale')?.intervals).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(findTraditionPattern('western-major-triad-arpeggio')?.intervals).toEqual([0, 4, 7])
    expect(findTraditionPattern('bihor-hemitonic-pentatonic')?.intervals).toEqual([0, 2, 6, 7, 9])
    expect(findTraditionPattern('chinese-c-gong-mode')?.intervals).toEqual([0, 2, 4, 7, 9])
    expect(findTraditionPattern('maqam-ajam-c')?.intervals).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(findTraditionPattern('maqam-ajam-c')?.name).toContain('ʿAjam')
    for (const pattern of traditionPatterns) {
      expect(pattern.representationNote).toContain('equal-tempered')
    }
  })

  it('describes the C gōng representation limits', () => {
    const note = findTraditionPattern('chinese-c-gong-mode')!.representationNote
    expect(note).toContain('Historical pitch derivation may differ from the equal temperament')
    expect(note).toContain('C–D–E–G–A')
  })

  it('chooses the first sourced pattern as the active default when a tradition is selected', () => {
    expect(defaultPatternForTradition('western-tonal-theory')?.id).toBe('western-major-scale')
    expect(defaultPatternForTradition('romanian-folklore')?.id).toBe('bihor-hemitonic-pentatonic')
    expect(defaultPatternForTradition('chinese-traditional-music')?.id).toBe('chinese-c-gong-mode')
    expect(defaultPatternForTradition('arab-maqam')?.id).toBe('maqam-ajam-c')
    expect(defaultPatternForTradition('unknown-tradition')).toBeUndefined()
  })

  it('updates the active topic and pattern selection to the chosen tradition at the selected root', () => {
    const westernDefault = defaultSelectionForTradition('western-tonal-theory', 0)
    expect(westernDefault?.selection).toEqual({ topic: 'scales', root: 0, culturalPatternId: 'western-major-scale' })
    expect(westernDefault?.pattern.kind).toBe('scale')

    expect(selectionForTraditionPattern('western-major-triad-arpeggio', 2)?.selection)
      .toEqual({ topic: 'arpeggios', root: 2, culturalPatternId: 'western-major-triad-arpeggio' })

    expect(defaultSelectionForTradition('arab-maqam', 5)?.selection)
      .toEqual({ topic: 'scales', root: 5, culturalPatternId: 'maqam-ajam-c' })
    expect(defaultSelectionForTradition('unknown-tradition', 0)).toBeUndefined()
    expect(selectionForTraditionPattern('unknown-pattern', 0)).toBeUndefined()
  })

  it('distinguishes each source reference root from the app root used for transposition', () => {
    expect(findTraditionPattern('bihor-hemitonic-pentatonic')!.representationNote)
      .toContain('At the named F reference root, this equal-tempered example reproduces F–G–B–C–D. Selecting another app root transposes that set.')
    expect(findTraditionPattern('chinese-c-gong-mode')!.representationNote)
      .toContain('At the named C reference root, this equal-tempered example reproduces C–D–E–G–A. Selecting another app root transposes that set.')
    expect(findTraditionPattern('maqam-ajam-c')!.representationNote)
      .toContain('At the named C reference root, this equal-tempered example reproduces the ascending pitch set. Selecting another app root transposes that set.')
  })

  it('finds records by exact ID and leaves unknown IDs unresolved', () => {
    for (const pattern of traditionPatterns) expect(findTraditionPattern(pattern.id)).toBe(pattern)
    expect(findTraditionPattern('unknown-pattern')).toBeUndefined()
    expect(findTraditionPattern('')).toBeUndefined()
  })
})
