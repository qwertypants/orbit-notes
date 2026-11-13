import { describe, expect, it } from 'vitest'
import { createExplorerState, type ExplorerState } from '../explorer-state.ts'
import { parseNoteName } from '../theory/music-theory.ts'
import { mountNoteStaff, renderNoteStaffSvg } from './note-staff.ts'

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

describe('mounted note staff playback', () => {
  it('highlights active notes and falls back to the latest note still active', () => {
    const notes = new Map<string, { dataset: { staffNote: string }; classList: { add(name: string): void; remove(name: string): void; toggle(name: string, force: boolean): void; contains(name: string): boolean } }>()
    let currentLabel = ''
    let markup = ''
    const host = {
      set innerHTML(value: string) {
        markup = value
        notes.clear()
        for (const match of value.matchAll(/<g[^>]*data-staff-note="(\d+)"[^>]*>/g)) {
          const classes = new Set<string>()
          notes.set(match[1], { dataset: { staffNote: match[1] }, classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), toggle: (name, force) => force ? classes.add(name) : classes.delete(name), contains: (name) => classes.has(name) } })
        }
        currentLabel = value.match(/<[^>]+class="staff-current-note"[^>]*>([^<]*)</)?.[1] ?? ''
      },
      get innerHTML() { return markup },
      querySelectorAll(selector: string) {
        if (selector === 'g[data-staff-note]') return [...notes.values()]
        return []
      },
      querySelector(selector: string) {
        if (selector === '.staff-current-note') return { set textContent(value: string) { currentLabel = value }, get textContent() { return currentLabel } }
        const pitch = selector.match(/\[data-staff-note="(\d+)"\]/)?.[1]
        return pitch ? notes.get(pitch) ?? null : null
      },
      replaceChildren() { markup = ''; notes.clear(); currentLabel = '' },
    } as unknown as HTMLElement
    const staff = mountNoteStaff(host, stateWithNotes('C', 'E', 'G'))

    staff.startNote(parseNoteName('C'))
    staff.startNote(parseNoteName('E'))
    expect(host.querySelector('[data-staff-note="0"]')?.classList.contains('is-active')).toBe(true)
    expect(host.querySelector('[data-staff-note="4"]')?.classList.contains('is-active')).toBe(true)
    expect(currentLabel).toBe('E4')

    staff.endNote(parseNoteName('E'))
    expect(host.querySelector('[data-staff-note="4"]')?.classList.contains('is-active')).toBe(false)
    expect(currentLabel).toBe('C4')

    staff.clearPlayback()
    expect([...notes.values()].filter((note) => note.classList.contains('is-active'))).toHaveLength(0)
    expect(currentLabel).toBe('')
    staff.destroy()
  })
})
