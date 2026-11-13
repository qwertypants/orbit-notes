import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExplorerState, type ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import { mountNoteCircleHud } from './note-circle-hud.ts'
import { mountNoteCircle, type NoteCircle } from './note-circle.ts'

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
    this.listeners.get(type)?.forEach((listener) => listener({ preventDefault: vi.fn(), ...event }))
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
    this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
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

function makePointerEvent(pointerId: number, clientX: number, clientY: number): Record<string, unknown> {
  return { pointerId, clientX, clientY, button: 0, isPrimary: true, preventDefault: vi.fn() }
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
    const hud = mountNoteCircleHud({ anchor: anchor as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const root = currentHud()
    const handle = root.children[0]

    expect(handle.getAttribute('role')).toBe('group')
    expect(handle.tabIndex).toBe(0)
    expect(handle.getAttribute('aria-label')).toBe('Move note circle. Drag or use arrow keys.')
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
    const hud = mountNoteCircleHud({ anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle, onPlay })
    const [, mountedState, noteCallback] = vi.mocked(mountNoteCircle).mock.calls.at(-1)!
    const nextState = { ...state, activeNotes: [0, 5] as PitchClass[] }
    const readSpectrum = () => new Float32Array([0.25])

    expect(mountedState).toBe(state)
    hud.update(nextState)
    hud.startSpectrum(readSpectrum)
    hud.stopSpectrum()
    noteCallback(5)
    currentHud().children[2].click()

    expect(circle.update).toHaveBeenCalledWith(nextState)
    expect(circle.startSpectrum).toHaveBeenCalledWith(readSpectrum)
    expect(circle.stopSpectrum).toHaveBeenCalledOnce()
    expect(onNoteToggle).toHaveBeenCalledWith(5)
    expect(onPlay).toHaveBeenCalledOnce()
    expect(currentHud().children[2].getAttribute('aria-label')).toBe('Play selected notes')
    hud.destroy()
  })

  it('starts with an accessible play label, title, and icon', () => {
    const hud = mountNoteCircleHud({ anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const button = currentHud().children[2]

    expect(button.getAttribute('aria-label')).toBe('Play selected notes')
    expect(button.title).toBe('Play selected notes')
    expect(button.innerHTML).toContain('<path')
    expect(button.innerHTML).toContain('aria-hidden="true"')
    hud.destroy()
  })

  it('switches to an accessible stop action and restores play when playback stops', () => {
    const onPlay = vi.fn()
    const hud = mountNoteCircleHud({ anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay })
    const button = currentHud().children[2]
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

  it('measures asymmetric safe-area padding for placement and drag clamps, then remeasures on resize', () => {
    safeAreaInsets = { top: 30, right: 22, bottom: 44, left: 18 }
    const hud = mountNoteCircleHud({ anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const root = currentHud()
    const handle = root.children[0]
    const probe = body.children[1]

    expect(root.style.left).toBe('184px')
    expect(root.style.top).toBe('30px')
    expect(probe.className).toBe('note-circle-hud__safe-area-probe')

    handle.dispatch('pointerdown', makePointerEvent(8, 100, 100))
    fakeWindow.dispatch('pointermove', makePointerEvent(8, -100, 0))
    expect(root.style.left).toBe('18px')
    expect(root.style.top).toBe('30px')
    fakeWindow.dispatch('pointerup', makePointerEvent(8, -100, 0))

    safeAreaInsets = { top: 40, right: 24, bottom: 50, left: 25 }
    fakeWindow.dispatch('resize', {})
    expect(root.style.left).toBe('25px')
    expect(root.style.top).toBe('40px')

    hud.destroy()
    expect(body.children).toHaveLength(0)
  })

  it('drags only from the handle, snaps to an edge stop, and persists that stop', () => {
    const hud = mountNoteCircleHud({ anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const root = currentHud()
    const handle = root.children[0]
    const circleHost = root.children[1]
    const playButton = root.children[2]
    const initialLeft = root.style.left

    circleHost.dispatch('pointerdown', makePointerEvent(1, 100, 100))
    fakeWindow.dispatch('pointermove', makePointerEvent(1, 150, 400))
    expect(root.style.left).toBe(initialLeft)
    playButton.dispatch('pointerdown', makePointerEvent(2, 100, 100))
    fakeWindow.dispatch('pointermove', makePointerEvent(2, 150, 400))
    expect(root.style.left).toBe(initialLeft)

    handle.dispatch('pointerdown', makePointerEvent(3, 100, 100))
    fakeWindow.dispatch('pointermove', makePointerEvent(3, 100, 600))
    expect(root.style.top).toBe('516px')
    fakeWindow.dispatch('pointerup', makePointerEvent(3, 100, 600))

    expect(root.classList.contains('is-snapping')).toBe(true)
    expect(root.style.left).toBe('190px')
    expect(root.style.top).toBe('626px')
    expect(fakeWindow.localStorage.setItem).toHaveBeenCalledWith('orbit.note-circle-hud.stop', 'bottom-right')
    hud.destroy()
  })

  it('moves between nearest edge stops with arrow keys and prevents page scrolling', () => {
    const hud = mountNoteCircleHud({ anchor: new FakeElement() as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const root = currentHud()
    const handle = root.children[0]
    const downEvent = { key: 'ArrowDown', preventDefault: vi.fn() }

    handle.dispatch('keydown', downEvent)
    expect(downEvent.preventDefault).toHaveBeenCalledOnce()
    expect(root.style.left).toBe('190px')
    expect(root.style.top).toBe('321px')
    expect(fakeWindow.localStorage.setItem).toHaveBeenLastCalledWith('orbit.note-circle-hud.stop', 'middle-right')

    const leftEvent = { key: 'ArrowLeft', preventDefault: vi.fn() }
    handle.dispatch('keydown', leftEvent)
    expect(leftEvent.preventDefault).toHaveBeenCalledOnce()
    expect(root.style.left).toBe('16px')
    expect(root.style.top).toBe('321px')
    expect(fakeWindow.localStorage.setItem).toHaveBeenLastCalledWith('orbit.note-circle-hud.stop', 'middle-left')

    const boundaryEvent = { key: 'ArrowLeft', preventDefault: vi.fn() }
    handle.dispatch('keydown', boundaryEvent)
    expect(boundaryEvent.preventDefault).toHaveBeenCalledOnce()
    expect(fakeWindow.localStorage.setItem).toHaveBeenCalledTimes(2)
    hud.destroy()
    expect(handle.listeners.get('keydown')?.size).toBe(0)
  })

  it('restores the saved stop and disconnects resources on destroy', () => {
    savedStop = 'bottom-left'
    const anchor = new FakeElement()
    const hud = mountNoteCircleHud({ anchor: anchor as unknown as HTMLElement, initialState: state, onNoteToggle: vi.fn(), onPlay: vi.fn() })
    const root = currentHud()
    expect(root.style.left).toBe('16px')
    expect(root.style.top).toBe('626px')

    hud.destroy()
    expect(FakeIntersectionObserver.instance.disconnect).toHaveBeenCalledOnce()
    expect(circle.destroy).toHaveBeenCalledOnce()
    expect(body.children).toHaveLength(0)
    expect(mediaListeners.size).toBe(0)
    expect(windowListeners.get('pointermove')?.size).toBe(0)
  })
})
