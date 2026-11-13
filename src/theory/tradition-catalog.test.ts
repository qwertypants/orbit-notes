import { describe, expect, it } from 'vitest'
import { findTraditionPattern, traditionPatterns } from './tradition-catalog.ts'
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
      '1': 0, '2': 2, '♭3': 3, '3': 4, '4': 5, '♭5': 6,
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

  it('preserves the verified starter pitch collections and their representation limits', () => {
    expect(findTraditionPattern('ryukyu-song-scale')?.intervals).toEqual([0, 4, 5, 7, 11])
    expect(findTraditionPattern('bhupali-svara-set')?.intervals).toEqual([0, 2, 4, 7, 9])
    expect(findTraditionPattern('bhupali-svara-set')?.name).toContain('Bhūpālī')
    for (const pattern of traditionPatterns) {
      expect(pattern.representationNote).toContain('equal-tempered')
    }
  })

  it('describes Bhūpālī as a stored collection without prescribing a playback mode', () => {
    const note = findTraditionPattern('bhupali-svara-set')!.representationNote
    expect(note).toContain('stores the ascending pitch collection within one octave')
    expect(note).not.toContain('plays only')
    expect(note).not.toContain('once')
    expect(note).toContain('omits rāga-specific intonation, ornaments, note emphasis and melodic grammar')
  })

  it('finds records by exact ID and leaves unknown IDs unresolved', () => {
    for (const pattern of traditionPatterns) expect(findTraditionPattern(pattern.id)).toBe(pattern)
    expect(findTraditionPattern('unknown-pattern')).toBeUndefined()
    expect(findTraditionPattern('')).toBeUndefined()
  })
})
