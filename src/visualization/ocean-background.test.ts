import { describe, expect, it } from 'vitest'
import { oceanPerformanceTint, oceanRestingPalette } from './ocean-background.ts'
import { parseNoteName } from '../theory/music-theory.ts'

describe('ocean background palette', () => {
  it('exposes four resting field colors', () => {
    expect(oceanRestingPalette).toHaveLength(4)
    oceanRestingPalette.forEach((color) => expect(color).toMatch(/^rgba?\(/))
  })

  it('tints toward the played note with a small lightness lift', () => {
    const tint = oceanPerformanceTint(parseNoteName('C'))
    expect(tint).not.toBe(oceanRestingPalette[0])
    expect(tint).toMatch(/^rgba?\(/)
  })

  it('is deterministic per note', () => {
    expect(oceanPerformanceTint(parseNoteName('C'))).toBe(oceanPerformanceTint(parseNoteName('C')))
  })
})
