import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExplorerState } from '../explorer-state.ts'
import { mountInstrumentHud } from './instrument-hud.ts'
import type { HudCoordinator, HudRegistration } from './hud-coordinator.ts'

class FakeElement {
  id = ''
  className = ''
  dataset: Record<string, string> = {}
  attributes = new Map<string, string>()
  children: FakeElement[] = []
  listeners = new Map<string, Set<() => void>>()
  innerHTML = ''
  textContent = ''
  title = ''
  tabIndex = -1
  inert = false
  parent?: FakeElement
  setAttribute(name: string, value: string) { this.attributes.set(name, value) }
  getAttribute(name: string) { return this.attributes.get(name) ?? null }
  append(...children: FakeElement[]) { children.forEach(child => { child.parent = this; this.children.push(child) }) }
  addEventListener(name: string, fn: () => void) { const set = this.listeners.get(name) ?? new Set(); set.add(fn); this.listeners.set(name, set) }
  removeEventListener(name: string, fn: () => void) { this.listeners.get(name)?.delete(fn) }
  click() { this.listeners.get('click')?.forEach(fn => fn()) }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = undefined }
}

const body = new FakeElement()
vi.stubGlobal('document', { body, createElement: () => new FakeElement() })
afterEach(() => { body.children = [] })
afterEach(() => { vi.restoreAllMocks() })

function setup(kind: 'piano' | 'guitar') {
  const toggle = new FakeElement() as unknown as HTMLButtonElement
  let registration: HudRegistration | undefined
  const coordinator = { register: vi.fn(() => {
    registration = { setVisible: vi.fn(), destroy: vi.fn() }
    return registration
  }), destroy: vi.fn() } as unknown as HudCoordinator
  const hud = mountInstrumentHud({ kind, initialState: createExplorerState({ topic: 'fifths', root: 0 }), toggle, coordinator })
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

  it('renders a display-only guitar reference with a single drag handle', () => {
    setup('guitar')
    const root = body.children[0]
    expect(root.children[1].innerHTML).toContain('role="img"')
    expect(root.children[1].innerHTML).not.toContain('<button')
    expect(root.children[0].children[1].tabIndex).toBe(0)
  })
})
