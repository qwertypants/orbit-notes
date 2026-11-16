import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExplorerState, selectRelativeMinor } from '../explorer-state.ts'
import { mountInstrumentHud } from './instrument-hud.ts'
import type { HudCoordinator, HudRegistration } from './hud-coordinator.ts'

class FakeElement {
  id = ''
  className = ''
  dataset: Record<string, string> = {}
  attributes = new Map<string, string>()
  children: FakeElement[] = []
  listeners = new Map<string, Set<(event: any) => void>>()
  innerHTML = ''
  textContent = ''
  title = ''
  tabIndex = -1
  inert = false
  parent?: FakeElement
  setAttribute(name: string, value: string) { this.attributes.set(name, value) }
  getAttribute(name: string) { return this.attributes.get(name) ?? null }
  append(...children: FakeElement[]) { children.forEach(child => { child.parent = this; this.children.push(child) }) }
  addEventListener(name: string, fn: (event: any) => void) { const set = this.listeners.get(name) ?? new Set(); set.add(fn); this.listeners.set(name, set) }
  removeEventListener(name: string, fn: (event: any) => void) { this.listeners.get(name)?.delete(fn) }
  contains(target: FakeElement): boolean { return target === this || this.children.some(child => child.contains(target)) }
  closest(selector: string): FakeElement | null { return selector === '[data-guitar-note]' && this.attributes.has('data-guitar-note') ? this : this.parent?.closest(selector) ?? null }
  querySelector(selector: string): FakeElement | null { return this.children.find(child => selector.includes(`"${child.getAttribute('data-guitar-position')}"`) && child.attributes.has('data-guitar-note')) ?? null }
  focus() { (document as unknown as { activeElement: FakeElement }).activeElement = this }
  dispatch(name: string, event: any) { this.listeners.get(name)?.forEach(fn => fn(event)) }
  click() { this.listeners.get('click')?.forEach(fn => fn({ target: this })) }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = undefined }
}

class FakeKeyboardEvent { constructor(public key: string, public repeat = false) {} target!: FakeElement; preventDefault = vi.fn() }
vi.stubGlobal('Element', FakeElement)
vi.stubGlobal('KeyboardEvent', FakeKeyboardEvent)
const body = new FakeElement()
vi.stubGlobal('document', { body, createElement: () => new FakeElement() })
afterEach(() => { body.children = [] })
afterEach(() => { vi.restoreAllMocks() })

function setup(kind: 'piano' | 'guitar', onNoteClick = vi.fn()) {
  const toggle = new FakeElement() as unknown as HTMLButtonElement
  let registration: HudRegistration | undefined
  const coordinator = { register: vi.fn(() => {
    registration = { setVisible: vi.fn(), destroy: vi.fn() }
    return registration
  }), destroy: vi.fn() } as unknown as HudCoordinator
  const hud = mountInstrumentHud({ kind, initialState: createExplorerState({ topic: 'fifths', root: 0 }), toggle, coordinator, onNoteClick })
  return { toggle: toggle as unknown as FakeElement, hud, coordinator, get registration() { return registration! } }
}

describe('instrument HUD', () => {
  it.each(['piano', 'guitar'] as const)('mounts %s hidden and toggles its own visibility', (kind) => {
    const { toggle, coordinator, registration } = setup(kind)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toBe(`Show ${kind}`)
    expect(coordinator.register).toHaveBeenCalledWith(expect.objectContaining({ id: kind, preferred: kind === 'piano' ? 'middle-right' : 'bottom-right', storageKey: `orbit.hud.${kind}.position` }))
    toggle.click()
    expect(toggle.getAttribute('aria-label')).toBe(`Hide ${kind}`)
    expect(registration.setVisible).toHaveBeenCalledWith(true)
    toggle.click()
    expect(registration.setVisible).toHaveBeenLastCalledWith(false)
  })

  it('updates the SVG without replacing its header and cleans up once', () => {
    const { toggle, hud, registration } = setup('piano')
    const root = body.children[0]
    const header = root.children[0]
    const content = root.children[1]
    const first = content.innerHTML
    hud.update({ ...createExplorerState({ topic: 'fifths', root: 0 }), activeNotes: [] })
    expect(root.children[0]).toBe(header)
    expect(content.innerHTML).not.toBe(first)
    hud.destroy(); hud.destroy()
    expect(body.children).toHaveLength(0)
    expect(registration.destroy).toHaveBeenCalledTimes(1)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    toggle.click()
    expect(toggle.getAttribute('aria-label')).toBe('Show piano')
  })

  it('shows scope copy and updates the visible resolved-root legend', () => {
    const { hud } = setup('guitar')
    const root = body.children[0]
    expect(root.children[2].textContent).toContain('Note locations · standard tuning · frets 0–4; not a chord fingering.')
    expect(root.children[2].textContent).toContain('Top: high E (1); bottom: low E (6).')
    const minor = selectRelativeMinor(createExplorerState({ topic: 'fifths', root: 0 }), 9)
    hud.update(minor)
    expect(root.children[3].textContent).toBe('White outline: root A.')
    hud.update({ ...minor, activeNotes: [] })
    expect(root.children[3].textContent).toBe('Root A is not selected; no root outline.')
  })

  it('renders a interactive guitar reference with a single drag handle', () => {
    setup('guitar')
    const root = body.children[0]
    expect(root.children[1].innerHTML).toContain('role="group"')
    expect(root.children[1].innerHTML).not.toContain('<button')
    expect(root.children[0].children[1].tabIndex).toBe(0)
  })
})

it.each(['piano', 'guitar'] as const)('hides %s from its header and can reopen', kind => {
  const { toggle, registration } = setup(kind)
  toggle.click()
  body.children[0].children[0].children[3].click()
  expect(toggle.getAttribute('aria-pressed')).toBe('false')
  expect(registration.setVisible).toHaveBeenLastCalledWith(false)
  toggle.click()
  expect(registration.setVisible).toHaveBeenLastCalledWith(true)
})

it.each(['piano', 'guitar'] as const)('tracks %s playback across hiding, updates, release and stop', kind => {
  const { hud, toggle } = setup(kind)
  const content = body.children[0].children[1]
  const count = () => (content.innerHTML.match(/data-playing="true"/g) ?? []).length
  hud.startNote(0); hud.startNote(4)
  expect(count()).toBe(2)
  toggle.click()
  hud.update(createExplorerState({ topic: 'fifths', root: 0 }))
  expect(count()).toBe(2)
  hud.endNote(0)
  expect(count()).toBe(1)
  toggle.click(); hud.endNote(4); toggle.click()
  expect(count()).toBe(0)
  hud.startNote(7); hud.clearPlayback()
  expect(count()).toBe(0)
  hud.destroy()
  const before = content.innerHTML
  hud.startNote(0); hud.endNote(4); hud.clearPlayback()
  expect(content.innerHTML).toBe(before)
})

function noteTarget(content: FakeElement) {
  const note = new FakeElement()
  note.setAttribute('data-guitar-note', '4')
  note.setAttribute('data-guitar-position', '6-0')
  const label = new FakeElement(), dot = new FakeElement()
  note.append(label, dot); content.append(note)
  return { note, label, dot }
}
it('delegates descendant label and dot clicks and rejects blank space', () => {
  const callback = vi.fn(); setup('guitar', callback)
  const content = body.children[0].children[1]
  const { label, dot } = noteTarget(content)
  for (const target of [label, dot, content]) content.dispatch('click', { target })
  expect(callback.mock.calls).toEqual([[expect.objectContaining({ pitchClass: 4, midi: 40, string: 6, fret: 0 })], [expect.objectContaining({ pitchClass: 4, midi: 40, string: 6, fret: 0 })]])
})
it.each(['Enter', ' '])('activates %s, prevents default and suppresses repeats', key => {
  const callback = vi.fn(); setup('guitar', callback)
  const content = body.children[0].children[1], { label } = noteTarget(content)
  for (const repeat of [false, true]) {
    const event = new FakeKeyboardEvent(key, repeat); event.target = label
    content.dispatch('keydown', event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  }
  const other = new FakeKeyboardEvent('ArrowRight'); other.target = label
  content.dispatch('keydown', other)
  expect(other.preventDefault).not.toHaveBeenCalled()
  expect(callback.mock.calls).toEqual([[expect.objectContaining({ pitchClass: 4, midi: 40, string: 6, fret: 0 })]])
})
it.each(['piano', 'guitar'] as const)('rejects piano activation and detached events after destroying %s', kind => {
  const callback = vi.fn(), { hud } = setup(kind, callback)
  const content = body.children[0].children[1], { dot } = noteTarget(content)
  if (kind === 'piano') content.dispatch('click', { target: dot })
  hud.destroy()
  content.dispatch('click', { target: dot })
  const event = new FakeKeyboardEvent('Enter'); event.target = dot
  content.dispatch('keydown', event)
  expect(callback).not.toHaveBeenCalled()
})
it('restores the same guitar position after SVG replacement during update and playback', () => {
  const { hud } = setup('guitar')
  const content = body.children[0].children[1]
  let current = noteTarget(content).note
  current.focus()
  let markup = content.innerHTML
  Object.defineProperty(content, 'innerHTML', { get: () => markup, set(value: string) {
    markup = value; content.children = []; current = noteTarget(content).note
  } })
  for (const render of [() => hud.update(createExplorerState({ topic: 'fifths', root: 0 })), () => hud.startNote(4), () => hud.endNote(4)]) {
    const previous = current; render()
    expect(current).not.toBe(previous)
    expect(document.activeElement).toBe(current)
  }
})


it('highlights the clicked low E position instead of the high E representative', () => {
  const { hud } = setup('guitar')
  const content = body.children[0].children[1]
  hud.startNote(4, { pitchClass: 4, label: 'E', string: 6, fret: 0, midi: 40, selected: true, root: false })
  expect(content.innerHTML).toMatch(/data-guitar-position="6-0"[^>]*data-playing="true"/)
  expect(content.innerHTML).toMatch(/data-guitar-position="1-0"[^>]*data-playing="false"/)
  hud.endNote(4)
  expect(content.innerHTML).not.toContain('data-playing="true"')
})
