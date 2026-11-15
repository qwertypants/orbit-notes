import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createExplorerState, selectRelativeMinor, toggleExplorerNote } from '../explorer-state.ts'
import { circleOfFifths, relativeMinorRoot } from '../theory/music-theory.ts'
import { mountNoteCircle, type NoteCircle } from './note-circle.ts'

const drawing = vi.hoisted(() => ({
  text: vi.fn(),
  textSize: vi.fn(),
  circle: vi.fn(),
  fill: vi.fn(),
  pointer: (_event: { clientX: number; clientY: number }) => {},
  resize: () => {},
  width: 320,
  bounds: { left: 0, top: 0, width: 320, height: 320 },
}))

// p5 needs a browser canvas. Record its drawing commands while running the real
// component's setup, state updates, geometry, and pointer handler.
vi.mock('p5', () => ({
  default: function (configure: (sketch: { setup(): void; draw(): void }) => void) {
    const sketch = {
      setup() {}, draw() {},
      TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2,
      CENTER: 'center', BOLD: 'bold', NORMAL: 'normal',
      createCanvas: () => ({
        parent() {},
        elt: {
          setAttribute() {},
          getBoundingClientRect: () => drawing.bounds,
          addEventListener: (_type: string, listener: typeof drawing.pointer) => { drawing.pointer = listener },
        },
      }),
      resizeCanvas() {}, redraw: () => sketch.draw(),
      text: drawing.text, textSize: drawing.textSize, circle: drawing.circle, fill: drawing.fill,
      textFont() {}, textAlign() {}, frameRate() {}, noLoop() {}, loop() {}, remove() {},
      noFill() {}, noStroke() {}, stroke() {}, strokeWeight() {}, textStyle() {}, line() {}, clear() {},
      color: () => ({ setAlpha() {} }), alpha: () => 255,
    }
    configure(sketch)
    queueMicrotask(() => sketch.setup())
    return sketch
  },
}))

let circle: NoteCircle | undefined

beforeEach(() => {
  vi.clearAllMocks()
  drawing.width = 320
  drawing.bounds = { left: 0, top: 0, width: 320, height: 320 }
  vi.stubGlobal('Option', class { constructor(public text: string, public value: string) {} })
  vi.stubGlobal('document', { createElement: () => ({ className: '', value: '', hidden: false, setAttribute() {}, append() {}, addEventListener() {}, remove() {} }) })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) })
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { drawing.resize = callback }
    observe() {} disconnect() {}
  })
})

afterEach(() => {
  circle?.destroy()
  circle = undefined
  vi.unstubAllGlobals()
})

async function mount(state = createExplorerState({ topic: 'fifths', root: 0 })) {
  const outer = vi.fn()
  const inner = vi.fn()
  // The component only measures the host; p5 owns the DOM canvas in production.
  const host = { after() {}, getBoundingClientRect: () => ({ width: drawing.width }) } as HTMLElement
  circle = mountNoteCircle(host, state, outer, inner)
  await Promise.resolve()
  return { outer, inner }
}

function clickPosition(index: number, radius: number) {
  const angle = index * Math.PI / 6 - Math.PI / 2
  drawing.pointer({
    clientX: drawing.bounds.left + (0.5 + Math.cos(angle) * radius) * drawing.bounds.width,
    clientY: drawing.bounds.top + (0.5 + Math.sin(angle) * radius) * drawing.bounds.height,
  })
}

describe('relative minor circle rendering', () => {
  it('places all twelve minor keys inside their relative major, above relationships', async () => {
    await mount()
    const labels = drawing.text.mock.calls.slice(-24)
    expect(labels.slice(0, 12).map(([label]) => label)).toEqual(['C', 'G', 'D', 'A', 'E', 'B', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'])
    expect(labels.slice(12).map(([label]) => label)).toEqual(['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'])
    expect(labels[12]).toEqual(['Am', 160, 90.6])
    expect(drawing.textSize.mock.calls.slice(12).every(([size]) => size >= 14)).toBe(true)
    // Every inner label has its own opaque backing and contrasting text.
    for (let index = 12; index < 24; index += 1) {
      const textOrder = drawing.text.mock.invocationCallOrder[index]
      const fillsBeforeLabel = drawing.fill.mock.calls.filter((_, fillIndex) => drawing.fill.mock.invocationCallOrder[fillIndex] < textOrder)
      expect(fillsBeforeLabel.slice(-2)).toEqual([['#25283a'], ['#ffffff']])
      const [, x, y] = labels[index]
      expect(drawing.circle).toHaveBeenCalledWith(x, y - 1, 30)
    }
  })

  it.each([250, 284, 320, 375, 430, 520])('keeps inner and outer targets independent at %i pixels', async (width) => {
    drawing.width = width
    const { inner, outer } = await mount()
    circleOfFifths.forEach((major, index) => {
      clickPosition(index, 0.22)
      expect(inner).toHaveBeenLastCalledWith(relativeMinorRoot(major))
      expect(outer).toHaveBeenCalledTimes(index)
      clickPosition(index, 0.34)
      expect(outer).toHaveBeenLastCalledWith(major)
      expect(inner).toHaveBeenCalledTimes(index + 1)
    })
    drawing.pointer({ clientX: 160, clientY: 160 })
    expect(inner).toHaveBeenCalledTimes(12)
    expect(outer).toHaveBeenCalledTimes(12)
  })

  it('preserves touch padding outside the visible inner note backing', async () => {
    const { inner, outer } = await mount()
    clickPosition(0, 0.22 + 17 / 320)
    expect(inner).toHaveBeenCalledExactlyOnceWith(9)
    expect(outer).not.toHaveBeenCalled()
  })

  it('uses scaled canvas coordinates after resizing and CSS scaling', async () => {
    const { inner, outer } = await mount()
    drawing.width = 430
    drawing.bounds = { left: 30, top: 80, width: 215, height: 215 }
    drawing.resize()
    clickPosition(1, 0.22)
    expect(inner).toHaveBeenCalledExactlyOnceWith(4)
    expect(outer).not.toHaveBeenCalled()
  })

  it('shows selected minor styling and retains major labels when scale spelling differs', async () => {
    const state = selectRelativeMinor(createExplorerState({ topic: 'fifths', root: 0 }), 1)
    await mount(state)
    expect(drawing.text.mock.calls[7][0]).toBe('D♭')
    const selectedLabel = drawing.text.mock.calls.findIndex(([label]) => label === 'C♯m')
    const textOrder = drawing.text.mock.invocationCallOrder[selectedLabel]
    const fillsBeforeLabel = drawing.fill.mock.calls.filter((_, index) => drawing.fill.mock.invocationCallOrder[index] < textOrder)
    expect(fillsBeforeLabel.slice(-2)).toEqual([['#fbbf77'], ['#1e1623']])
    drawing.text.mockClear()
    drawing.fill.mockClear()
    circle?.update(toggleExplorerNote(state, 1))
    expect(drawing.text.mock.calls.slice(12).map(([label]) => label)).toHaveLength(12)
    expect(drawing.fill.mock.calls.slice(-24)).not.toContainEqual(['#fbbf77'])
  })

  it('dispatches repeated minor selection through the state action without toggling pitches', async () => {
    let state = createExplorerState({ topic: 'fifths', root: 0 })
    const { inner, outer } = await mount(state)
    inner.mockImplementation((root) => {
      state = selectRelativeMinor(state, root)
      circle?.update(state)
    })
    clickPosition(0, 0.22)
    clickPosition(0, 0.22)
    expect(state.selection).toEqual({ topic: 'fifths', root: 0, minorRoot: 9 })
    expect(state.activeNotes).toEqual([9, 11, 0, 2, 4, 5, 7])
    clickPosition(1, 0.22)
    expect(state.activeNotes).toEqual([4, 6, 7, 9, 11, 0, 2])
    expect(outer).not.toHaveBeenCalled()
  })

  it('removes inner labels and hit targets when leaving fifths', async () => {
    const { inner } = await mount()
    drawing.text.mockClear()
    circle?.update(createExplorerState({ topic: 'scales', root: 0, preset: 'major' }))
    expect(drawing.text).toHaveBeenCalledTimes(12)
    expect(drawing.text.mock.calls.some(([label]) => label.endsWith('m'))).toBe(false)
    clickPosition(0, 0.22)
    expect(inner).not.toHaveBeenCalled()
  })
})
