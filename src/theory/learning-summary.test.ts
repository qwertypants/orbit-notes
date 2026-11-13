import { describe, expect, it } from 'vitest'
import { createExplorerState, toggleExplorerNote } from '../explorer-state.ts'
import { parseNoteName, type TopicSelection } from './music-theory.ts'
import { createLearningSummary, noteLabelForState } from './learning-summary.ts'
import { findTraditionPattern } from './tradition-catalog.ts'

const root = parseNoteName('C')

describe('createLearningSummary', () => {
  it.each([
    ['bihor-hemitonic-pentatonic', 'Bihor hemitonic pentatonic (F–G–B–C–D)', 'Romanian folklore', 'Bihor region, Romania', 'C, D, F♯, G, A'],
    ['chinese-c-gong-mode', 'C gōng mode', 'Chinese traditional music', 'China', 'C, D, E, G, A'],
    ['maqam-ajam-c', 'Maqām ʿAjam on C', 'Arab maqām tradition', 'Arab musical traditions', 'C, D, E, F, G, A, B'],
  ])('attributes %s with its ordered notes and representation limits', (id, name, traditionName, region, notes) => {
    const summary = createLearningSummary(createExplorerState({ topic: 'scales', root, culturalPatternId: id }))
    const pattern = findTraditionPattern(id)!

    expect(summary.title).toBe(`C ${name} · Scale`)
    expect(summary.patternName).toBe(name)
    expect(summary.patternKind).toBe('scale')
    expect(summary.traditionName).toBe(traditionName)
    expect(summary.region).toBe(region)
    expect(summary.selectedNotes).toBe(notes)
    expect(summary.context).toBe(pattern.context)
    expect(summary.explanation).toBe(pattern.context)
    expect(summary.representationNote).toBe(pattern.representationNote)
    expect(summary.sources).toEqual(pattern.sources)
  })

  it.each<TopicSelection>([
    { topic: 'chords', root, preset: 'major' },
    { topic: 'scales', root, preset: 'major' },
    { topic: 'arpeggios', root, preset: 'minor7' },
    { topic: 'fifths', root },
  ])('keeps the standard $topic summary shape', (selection) => {
    expect(Object.keys(createLearningSummary(createExplorerState(selection))).sort()).toEqual([
      'explanation', 'relationships', 'selectedNotes', 'title',
    ])
  })

  it('identifies edited catalog notes as custom while retaining the source caveat', () => {
    const state = toggleExplorerNote(createExplorerState({ topic: 'scales', root, culturalPatternId: 'chinese-c-gong-mode' }), parseNoteName('D'))
    const summary = createLearningSummary(state)

    expect(summary.title).toBe('Custom notes around C')
    expect(summary.selectedNotes).toBe('C, E, G, A')
    expect(summary.explanation).toContain('These are your selected notes')
    expect(summary.context).toBe(findTraditionPattern('chinese-c-gong-mode')!.context)
    expect(summary.representationNote).toContain('not identical to equal temperament')
  })

  it('keeps the Bihor source-root caveat when the app root transposes its notes', () => {
    const summary = createLearningSummary(createExplorerState({
      topic: 'scales', root: parseNoteName('G'), culturalPatternId: 'bihor-hemitonic-pentatonic',
    }))

    expect(summary.selectedNotes).toBe('G, A, C♯, D, E')
    expect(summary.representationNote).toContain('At the named F reference root')
    expect(summary.representationNote).toContain('Selecting another app root transposes that set')
  })

  it('describes chord tones by their interval from the root', () => {
    const summary = createLearningSummary(createExplorerState({ topic: 'chords', root, preset: 'major' }))

    expect(summary.title).toBe('C Major chord')
    expect(summary.selectedNotes).toBe('C, E, G')
    expect(summary.relationships).toEqual([
      '1 · C — root from C',
      '3 · E — major third from C',
      '5 · G — perfect fifth from C',
    ])
  })

  it('tracks a changed root, scale pattern, and custom note selection', () => {
    let state = createExplorerState({ topic: 'scales', root: parseNoteName('D'), preset: 'naturalMinor' })
    state = toggleExplorerNote(state, parseNoteName('C#'))
    const summary = createLearningSummary(state)

    expect(summary.title).toBe('Custom notes around D')
    expect(summary.selectedNotes).toContain('C♯')
    expect(summary.relationships).toContain('♭3 · F — minor third from D')
    expect(summary.relationships).toContain('7 · C♯ — major seventh from D')
  })

  it('explains arpeggios as ordered chord tones', () => {
    const selection: TopicSelection = { topic: 'arpeggios', root, preset: 'minor7' }
    const summary = createLearningSummary(createExplorerState(selection))

    expect(summary.title).toBe('C Minor 7 arpeggio')
    expect(summary.explanation).toContain('one at a time, in order')
    expect(summary.relationships).toContain('♭7 · B♭ — minor seventh from C')
  })

  it('lists the fifth sequence and limits active notes to the current selection', () => {
    const summary = createLearningSummary(createExplorerState({ topic: 'fifths', root }))

    expect(summary.title).toBe('C circle of fifths')
    expect(summary.relationships.slice(0, 4)).toEqual(['C', 'G', 'D', 'A'])
    expect(summary.selectedNotes).toBe('C, G, F')
    expect(summary.explanation).toContain('perfect fifth')
  })

  it('spells ordinary major sevenths according to their degree', () => {
    const state = createExplorerState({ topic: 'chords', root: parseNoteName('G'), preset: 'major7' })
    const summary = createLearningSummary(state)
    expect(summary.selectedNotes).toBe('G, B, D, F♯')
    expect(summary.relationships).toContain('7 · F♯ — major seventh from G')
    expect(noteLabelForState(state, parseNoteName('F#'))).toBe('F♯')
  })

  it('uses the root spelling to name a flat-key scale', () => {
    const summary = createLearningSummary(createExplorerState({ topic: 'scales', root: parseNoteName('Gb'), preset: 'major' }))
    expect(summary.selectedNotes).toBe('G♭, A♭, B♭, C♭, D♭, E♭, F')
    expect(summary.relationships).toContain('4 · C♭ — perfect fourth from G♭')
  })

  it('shows only active intervals after a chord is customized', () => {
    let state = createExplorerState({ topic: 'chords', root, preset: 'major' })
    state = toggleExplorerNote(toggleExplorerNote(state, parseNoteName('E')), parseNoteName('Eb'))
    const summary = createLearningSummary(state)
    expect(summary.title).toBe('Custom notes around C')
    expect(summary.selectedNotes).toBe('C, G, E♭')
    expect(summary.relationships).toEqual([
      '1 · C — root from C',
      '5 · G — perfect fifth from C',
      '♭3 · E♭ — minor third from C',
    ])
  })

  it('preserves a retained preset degree when another chord tone is removed', () => {
    let state = createExplorerState({ topic: 'chords', root, preset: 'augmented' })
    state = toggleExplorerNote(state, parseNoteName('E'))
    const summary = createLearningSummary(state)

    expect(summary.title).toBe('Custom notes around C')
    expect(summary.selectedNotes).toBe('C, G♯')
    expect(summary.relationships).toEqual([
      '1 · C — root from C',
      '♯5 · G♯ — augmented fifth from C',
    ])
  })
})
