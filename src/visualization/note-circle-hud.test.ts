import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExplorerState, type ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import { mountNoteCircleHud } from './note-circle-hud.ts'
import { mountNoteCircle, type NoteCircle } from './note-circle.ts'
import type { HudCoordinator, HudRegistration } from './hud-coordinator.ts'

vi.mock('./note-circle.ts', () => ({ mountNoteCircle: vi.fn() }))

type Listener = (event: any) => void

class FakeClassList {
  private readonly names = new Set<string>()

  add(name: string): void { this.names.add(name) }
  remove(name: string): void { this.names.delete(name) }
  contains(name: string): boolean { return this.names.has(name) }
  toggle(name: string, force?: boolean): boolean {
    const shouldAdd = force ?? !this.names.has(name)
    if (shouldAdd) this.names.add(name)
    else this.names.delete(name)
    return shouldAdd
  }
}

class FakeElement {
  className = ''
  classList = new FakeClassList()
  style: Record<string, string> = {}
  attributes = new Map<string, string>()
  children: FakeElement[] = []
  listeners = new Map<string, Set<Listener>>()
  textContent = ''
  innerHTML = ''
  title = ''
  type = ''
  tabIndex = -1
  hidden = false
  inert = false
  parent: FakeElement | undefined
  capturedPointer: number | undefined

  append(...children: FakeElement[]): void {
    children.forEach((child) => {
      child.parent = this
      this.children.push(child)
    })
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value) }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: Listener): void { this.listeners.get(type)?.delete(listener) }

  dispatch(type: string, event: Record<string, unknown> = {}): void {
    this.listeners.get(type)?.forEach((listener) => listener({ preventDefault: vi.fn(), currentTarget: this, ...event }))
  }

  click(): void { this.dispatch('click') }

  setPointerCapture(pointerId: number): void { this.capturedPointer = pointerId }
  hasPointerCapture(pointerId: number): boolean { return this.capturedPointer === pointerId }
  releasePointerCapture(pointerId: number): void {
    if (this.capturedPointer === pointerId) this.capturedPointer = undefined
  }

  getBoundingClientRect(): DOMRect {
    const left = Number.parseFloat(this.style.left ?? '0') || 0
    const top = Number.parseFloat(this.style.top ?? '0') || 0
    const width = 184
    const height = 202
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
  }

  remove(): void {
    if (!this.parent) return
    this.parent.children = this.parent.children.filter((child) => child !== this)
    this.parent = undefined
  }
}

class FakeIntersectionObserver {
  static instance: FakeIntersectionObserver
  readonly observe = vi.fn()
  readonly disconnect = vi.fn()

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instance = this
  }

  emit(target: Element, isIntersecting: boolean): void {
    this.callback([{ target, isIntersecting, boundingClientRect: { bottom: isIntersecting ? 100 : -1 } } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

let body: FakeElement
let fakeWindow: {
  innerWidth: number
  innerHeight: number
  localStorage: Storage
  matchMedia: ReturnType<typeof vi.fn>
  getComputedStyle: (element: Element) => CSSStyleDeclaration
  addEventListener: (type: string, listener: Listener) => void
  removeEventListener: (type: string, listener: Listener) => void
  dispatch: (type: string, event: Record<string, unknown>) => void
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
}
let mediaMatches: boolean
let mediaListeners: Set<Listener>
let windowListeners: Map<string, Set<Listener>>
let savedStop: string | null
let circle: NoteCircle
let state: ExplorerState
let safeAreaInsets: { top: number; right: number; bottom: number; left: number }

function currentHud(): FakeElement { return body.children[0] }

function fakeCoordinator(): HudCoordinator {
  return { register: ({ root, handles }) => {
    const placement: HudRegistration = {
      setVisible(visible) { root.classList.toggle('is-visible', visible); root.setAttribute('aria-hidden', String(!visible)); root.inert = !visible },
      destroy() { handles.forEach(handle => { (handle as unknown as FakeElement).listeners.clear() }) },
    }
    return placement
  }, destroy() {} }
}

beforeEach(() => {
  vi.clearAllMocks()
  mediaMatches = true
  mediaListeners = new Set()
  windowListeners = new Map()
  savedStop = null
  safeAreaInsets = { top: 16, right: 16, bottom: 16, left: 16 }
  body = new FakeElement()
  const media = {
    get matches() { return mediaMatches },
    addEventListener: (_type: string, listener: Listener) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => mediaListeners.delete(listener),
  }
  const storage = {
    getItem: vi.fn(() => savedStop),
    setItem: vi.fn((_key: string, value: string) => { savedStop = value }),
  }
  fakeWindow = {
    innerWidth: 390,
    innerHeight: 844,
    localStorage: storage as unknown as Storage,
    matchMedia: vi.fn(() => media),
    getComputedStyle: vi.fn(() => ({
      paddingTop: `${safeAreaInsets.top}px`,
      paddingRight: `${safeAreaInsets.right}px`,
      paddingBottom: `${safeAreaInsets.bottom}px`,
      paddingLeft: `${safeAreaInsets.left}px`,
    }) as CSSStyleDeclaration),
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) ?? new Set<Listener>()
      listeners.add(listener)
      windowListeners.set(type, listeners)
    },
    removeEventListener(type, listener) { windowListeners.get(type)?.delete(listener) },
    dispatch(type, event) { windowListeners.get(type)?.forEach((listener) => listener(event)) },
    setTimeout,
    clearTimeout,
  }
  vi.stubGlobal('window', fakeWindow)
  vi.stubGlobal('HTMLElement', FakeElement)
  vi.stubGlobal('document', { body, createElement: vi.fn(() => new FakeElement()) })
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)

  state = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
  circle = {
    update: vi.fn(),
    startSpectrum: vi.fn(),
    stopSpectrum: vi.fn(),
    destroy: vi.fn(),
  } as unknown as NoteCircle
  vi.mocked(mountNoteCircle).mockReturnValue(circle)
})

describe('mountNoteCircleHud', () => {
  it('starts hidden and appears only on a small viewport while the anchor is outside view', () => {
    const anchor = new FakeElement()
    const hud = mountNoteCircleHud({ coordinator: fakeCoordinator(), anchor: anchor as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const root = currentHud()
    const handle = root.children[0]

    expect(handle.getAttribute('role')).toBe('group')
    expect(handle.tabIndex).toBe(0)
    expect(handle.getAttribute('aria-label')).toBe('Move note circle from top-left corner. Drag or use arrow keys.')
    expect(root.classList.contains('is-visible')).toBe(false)
    expect(root.getAttribute('aria-hidden')).toBe('true')
    FakeIntersectionObserver.instance.emit(anchor as unknown as Element, false)
    expect(root.classList.contains('is-visible')).toBe(true)

    mediaMatches = false
    mediaListeners.forEach((listener) => listener({ matches: false }))
    expect(root.classList.contains('is-visible')).toBe(false)
    mediaMatches = true
    mediaListeners.forEach((listener) => listener({ matches: true }))
    expect(root.classList.contains('is-visible')).toBe(true)
    FakeIntersectionObserver.instance.emit(anchor as unknown as Element, true)
    expect(root.classList.contains('is-visible')).toBe(false)
    hud.destroy()
  })

  it('forwards state, spectrum, note, and play actions', () => {
    const onNoteToggle = vi.fn()
    const onPlay = vi.fn()
    const hud = mountNoteCircleHud({ coordinator: fakeCoordinator(), anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle, onPlay })
    const [, mountedState, noteCallback] = vi.mocked(mountNoteCircle).mock.calls.at(-1)!
    const nextState = { ...state, activeNotes: [0, 5] as PitchClass[] }
    const readSpectrum = () => new Float32Array([0.25])

    expect(mountedState).toBe(state)
    hud.update(nextState)
    hud.startSpectrum(readSpectrum)
    hud.stopSpectrum()
    noteCallback(5)
    currentHud().children[4].children.find((child) => child.className === 'note-circle-hud__play')!.click()

    expect(circle.update).toHaveBeenCalledWith(nextState)
    expect(circle.startSpectrum).toHaveBeenCalledWith(readSpectrum)
    expect(circle.stopSpectrum).toHaveBeenCalledOnce()
    expect(onNoteToggle).toHaveBeenCalledWith(5)
    expect(onPlay).toHaveBeenCalledOnce()
    expect(currentHud().children[4].children.find((child) => child.className === 'note-circle-hud__play')!.getAttribute('aria-label')).toBe('Play selected notes')
    hud.destroy()
  })

  it('starts with an accessible play label, title, and icon', () => {
    const hud = mountNoteCircleHud({ coordinator: fakeCoordinator(), anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const button = currentHud().children[4].children.find((child) => child.className === 'note-circle-hud__play')!

    expect(button.getAttribute('aria-label')).toBe('Play selected notes')
    expect(button.title).toBe('Play selected notes')
    expect(button.innerHTML).toContain('<path')
    expect(button.innerHTML).toContain('aria-hidden="true"')
    hud.destroy()
  })

  it('switches to an accessible stop action and restores play when playback stops', () => {
    const onPlay = vi.fn()
    const hud = mountNoteCircleHud({ coordinator: fakeCoordinator(), anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay })
    const button = currentHud().children[4].children.find((child) => child.className === 'note-circle-hud__play')!
    const playIcon = button.innerHTML

    hud.setPlaybackActive(true)
    expect(button.getAttribute('aria-label')).toBe('Stop playback')
    expect(button.title).toBe('Stop playback')
    expect(button.innerHTML).toContain('<rect')
    expect(button.innerHTML).toContain('aria-hidden="true"')
    expect(button.innerHTML).not.toBe(playIcon)
    button.click()
    expect(onPlay).toHaveBeenCalledOnce()

    hud.setPlaybackActive(false)
    expect(button.getAttribute('aria-label')).toBe('Play selected notes')
    expect(button.title).toBe('Play selected notes')
    expect(button.innerHTML).toBe(playIcon)
    hud.destroy()
  })

  it('collapses without replacing handles or losing playback and removes the toggle listener', () => {
    const hud = mountNoteCircleHud({ coordinator: fakeCoordinator(), anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const root = currentHud()
    const handles = root.children.slice(0, 4)
    const content = root.children[4]
    const toggle = root.children[5]
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    toggle.click()
    expect(content.hidden).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.innerHTML).toContain('<rect')
    hud.setPlaybackActive(true)
    hud.update(state)
    toggle.click()
    expect(content.hidden).toBe(false)
    expect(root.children.slice(0, 4)).toEqual(handles)
    expect(content.children[1].getAttribute('aria-label')).toBe('Stop playback')
    expect(circle.update).toHaveBeenCalledWith(state)
    hud.destroy()
    expect(toggle.listeners.get('click')?.size).toBe(0)
  })

  it('disconnects resources on destroy', () => {
    const hud = mountNoteCircleHud({ coordinator: fakeCoordinator(), anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    hud.destroy()
    expect(FakeIntersectionObserver.instance.disconnect).toHaveBeenCalledOnce()
    expect(circle.destroy).toHaveBeenCalledOnce()
    expect(body.children).toHaveLength(0)
    expect(mediaListeners.size).toBe(0)
  })
})
