import { describe, expect, it } from 'vitest'
import { createExplorerState, toggleExplorerNote } from '../explorer-state.ts'
import { parseNoteName, type TopicSelection } from './music-theory.ts'
import { createLearningSummary } from './learning-summary.ts'

const root = parseNoteName('C')

describe('createLearningSummary', () => {
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

    expect(summary.title).toBe('D Natural minor scale')
    expect(summary.selectedNotes).toContain('D♭')
    expect(summary.relationships).toContain('♭3 · F — minor third from D')
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
})
