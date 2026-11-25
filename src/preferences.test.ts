import { describe, expect, it } from 'vitest'
import { createExplorerState } from './explorer-state.ts'
import { loadPreferences, preferencesKey, savePreferences, type Preferences } from './preferences.ts'

function storage(initial?: string) {
  const values = new Map<string, string>(initial === undefined ? [] : [[preferencesKey, initial]])
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}
function preferences(): Preferences {
  return {
    state: { ...createExplorerState({ topic: 'scales', root: 2, preset: 'minorPentatonic' }), activeNotes: [2, 5, 9] },
    sound: 'piano', playback: 'sequence', pattern: 'bounce', staffVisible: true,
    pianoVisible: true, guitarVisible: false, theoryOpen: true, theoryTab: 'traditions',
    browsedTraditionId: 'western-tonal-theory',
  }
}
function saved(overrides: object = {}) {
  const { state, ...options } = preferences()
  return JSON.stringify({ version: 1, ...options, selection: state.selection, activeNotes: state.activeNotes, ...overrides })
}

describe('browser preferences', () => {
  it('restores options and custom notes across sessions and rebuilds resolved theory', () => {
    const browser = storage()
    savePreferences(preferences(), browser)
    expect(loadPreferences(browser)).toEqual(preferences())
    expect(browser.getItem(preferencesKey)).not.toContain('resolved')
  })
  it.each([
    { topic: 'fifths', root: 0, minorRoot: 9 },
    { topic: 'chords', root: 11, preset: 'dominant7' },
    { topic: 'arpeggios', root: 4, preset: 'minor' },
    { topic: 'scales', root: 5, culturalPatternId: 'western-major-scale' },
    { topic: 'chords', root: 5, preset: 'major', scaleSource: { topic: 'scales', root: 4, culturalPatternId: 'western-phrygian-mode' } },
  ])('restores selection %j', selection => {
    expect(loadPreferences(storage(saved({ selection })))?.state.selection).toEqual(selection)
  })
  it('preserves an empty custom selection', () => {
    expect(loadPreferences(storage(saved({ activeNotes: [] })))?.state.activeNotes).toEqual([])
  })
  it.each(['', 'null', '[]', '{', '{}', saved({ version: 99 }),
    saved({ selection: { topic: 'scales', root: 12, preset: 'major' } }),
    saved({ selection: { topic: 'scales', root: 0, preset: 'toString' } }),
    saved({ selection: { topic: 'chords', root: 0, preset: 'naturalMinor' } }),
    saved({ selection: { topic: 'fifths', root: 0, minorRoot: -1 } }),
    saved({ selection: { topic: 'scales', root: 0, culturalPatternId: 'removed' } }),
    saved({ selection: { topic: 'arpeggios', root: 0, culturalPatternId: 'western-major-scale' } }),
    saved({ activeNotes: [0, 12] }), saved({ activeNotes: ['0'] }),
  ])('ignores malformed, stale, or unsupported preferences %#', raw => {
    expect(loadPreferences(storage(raw))).toBeUndefined()
  })
  it('falls back for invalid display/audio options and forces arpeggios to sequence', () => {
    const loaded = loadPreferences(storage(saved({ sound: 'unknown', pattern: 'unknown', staffVisible: 'true', theoryTab: 'unknown',
      selection: { topic: 'arpeggios', root: 0, preset: 'major' }, playback: 'together' })))
    expect(loaded).toMatchObject({ sound: 'triangle', pattern: 'once', staffVisible: false, theoryTab: 'theory', playback: 'sequence' })
  })
  it('keeps the app usable when storage reads and writes fail', () => {
    const blocked = { getItem() { throw new Error('denied') }, setItem() { throw new Error('full') } }
    expect(loadPreferences(blocked)).toBeUndefined()
    expect(() => savePreferences(preferences(), blocked)).not.toThrow()
  })
})
