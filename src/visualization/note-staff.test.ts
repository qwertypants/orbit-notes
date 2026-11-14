import { describe, expect, it, vi } from 'vitest'
import { createExplorerState, type ExplorerState } from '../explorer-state.ts'
import { parseNoteName } from '../theory/music-theory.ts'
import { mountNoteStaff, renderNoteStaffSvg, staffNotePitchFromEvent } from './note-staff.ts'

function stateWithNotes(...names: string[]): ExplorerState {
  const base = createExplorerState({ topic: 'fifths', root: parseNoteName('C') })
  return { ...base, activeNotes: names.map(parseNoteName) }
}

describe('staffNotePitchFromEvent', () => {
  it('resolves the pitch class when a click lands on a staff note', () => {
    const event = { target: { closest: () => ({ getAttribute: (name: string) => name === 'data-staff-note' ? '7' : null }) } } as unknown as { target: EventTarget | null }
    expect(staffNotePitchFromEvent(event)).toBe(7)
  })

  it('resolves accidentals and flat spellings from the staff note attribute', () => {
    expect(staffNotePitchFromEvent({ target: { closest: () => ({ getAttribute: () => '11' }) } } as unknown as { target: EventTarget | null })).toBe(11)
  })

  it('returns undefined when the click misses the staff notes', () => {
    expect(staffNotePitchFromEvent({ target: { closest: () => null } } as unknown as { target: EventTarget | null })).toBeUndefined()
  })
})

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

type StaffNoteEntry = { dataset: { staffNote: string }; classList: { add(name: string): void; remove(name: string): void; toggle(name: string, force: boolean): void; contains(name: string): boolean } }

function createStaffHost() {
  const notes = new Map<string, StaffNoteEntry>()
  let currentLabel = ''
  let markup = ''
  const clickHandlers = new Set<(event: Event) => void>()
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
    addEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
      if (_type === 'click') clickHandlers.add(listener as EventListener)
    },
    removeEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
      if (_type === 'click') clickHandlers.delete(listener as EventListener)
    },
  } as unknown as HTMLElement
  return { host, notes, get currentLabel() { return currentLabel }, clickHandlers }
}

describe('mounted note staff playback', () => {
  it('highlights active notes and falls back to the latest note still active', () => {
    const staffHost = createStaffHost()
    const staff = mountNoteStaff(staffHost.host, stateWithNotes('C', 'E', 'G'))

    staff.startNote(parseNoteName('C'))
    staff.startNote(parseNoteName('E'))
    expect(staffHost.host.querySelector('[data-staff-note="0"]')?.classList.contains('is-active')).toBe(true)
    expect(staffHost.host.querySelector('[data-staff-note="4"]')?.classList.contains('is-active')).toBe(true)
    expect(staffHost.currentLabel).toBe('E4')

    staff.endNote(parseNoteName('E'))
    expect(staffHost.host.querySelector('[data-staff-note="4"]')?.classList.contains('is-active')).toBe(false)
    expect(staffHost.currentLabel).toBe('C4')

    staff.clearPlayback()
    expect([...staffHost.notes.values()].filter((note) => note.classList.contains('is-active'))).toHaveLength(0)
    expect(staffHost.currentLabel).toBe('')
    staff.destroy()
  })

  it('auditions the clicked staff note through the note click callback', () => {
    const onNoteClick = vi.fn()
    const { host, clickHandlers } = createStaffHost()
    mountNoteStaff(host, stateWithNotes('C', 'E', 'G'), { onNoteClick })
    const handler = [...clickHandlers][0]

    handler?.({
      target: {
        closest: (selector: string) => selector === 'g[data-staff-note]' ? { getAttribute: (name: string) => name === 'data-staff-note' ? '7' : null } : null,
      },
    } as unknown as Event)

    expect(onNoteClick).toHaveBeenCalledWith(7)
  })

  it('ignores clicks that miss the staff notes', () => {
    const onNoteClick = vi.fn()
    const { host, clickHandlers } = createStaffHost()
    mountNoteStaff(host, stateWithNotes('C', 'E', 'G'), { onNoteClick })
    const handler = [...clickHandlers][0]

    handler?.({ target: { closest: () => null } } as unknown as Event)
    handler?.({ target: { closest: (selector: string) => selector === 'g.staff-lines' ? { getAttribute: () => null } : null } } as unknown as Event)

    expect(onNoteClick).not.toHaveBeenCalled()
  })
})
