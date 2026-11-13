import { describe, expect, it } from 'vitest'
import { createExplorerState, type ExplorerState } from '../explorer-state.ts'
import { parseNoteName } from '../theory/music-theory.ts'
import { renderNoteStaffSvg } from './note-staff.ts'

function stateWithNotes(...names: string[]): ExplorerState {
  const base = createExplorerState({ topic: 'fifths', root: parseNoteName('C') })
  return { ...base, activeNotes: names.map(parseNoteName) }
}

describe('renderNoteStaffSvg', () => {
  it('renders every selected note with an accessible label', () => {
    const markup = renderNoteStaffSvg(stateWithNotes('C', 'E', 'G'))

    expect(markup.match(/data-staff-line/g)).toHaveLength(5)
    expect(markup.match(/data-staff-note/g)).toHaveLength(3)
    expect(markup).toContain('aria-label="C4"')
    expect(markup).toContain('<title>C4</title>')
  })

  it('replaces removed notes and reflects current state spelling', () => {
    const first = renderNoteStaffSvg(stateWithNotes('C', 'E', 'G'))
    const next = renderNoteStaffSvg(stateWithNotes('B♭'))

    expect(first.match(/data-staff-note/g)).toHaveLength(3)
    expect(next.match(/data-staff-note/g)).toHaveLength(1)
    expect(next).toContain('aria-label="B♭4"')
    expect(next).toContain('>♭</text>')
    expect(next).not.toContain('aria-label="C4"')
  })

  it('shows double accidentals and gives the staff an accessible description', () => {
    const state = createExplorerState({ topic: 'chords', root: parseNoteName('B'), preset: 'augmented' })
    const markup = renderNoteStaffSvg({ ...state, activeNotes: [parseNoteName('G')] })

    expect(markup).toContain('role="img"')
    expect(markup).toContain('aria-label="Selected notes on a treble staff"')
    expect(markup).toContain('𝄪')
    expect(markup).toContain('aria-label="F𝄪4"')
  })
})
