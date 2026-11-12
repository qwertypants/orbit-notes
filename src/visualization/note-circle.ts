import p5 from 'p5'
import { activeNotesInOrder, type ExplorerState } from '../explorer-state.ts'
import { circleOfFifths, type PitchClass } from '../theory/music-theory.ts'
import { noteLabelForState } from '../theory/learning-summary.ts'
import { spectrumLevels } from './spectrum.ts'

const chromaticOrder = Array.from({ length: 12 }, (_, index) => index as PitchClass)

type Point = { x: number; y: number }

export type NoteCircle = {
  update(state: ExplorerState): void
  startSpectrum(read: () => Float32Array | undefined): void
  stopSpectrum(): void
  destroy(): void
}

export function mountNoteCircle(
  host: HTMLElement,
  initialState: ExplorerState,
  onNoteToggle: (note: PitchClass) => void,
): NoteCircle {
  let state = initialState
  let canvasSize = 1
  let observer: ResizeObserver | undefined
  let readSpectrum: (() => Float32Array | undefined) | undefined
  let spectrum: number[] = spectrumLevels(undefined)
  let visualizing = false
  let silentFrames = 0
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  const sketchInstance = new p5((sketch) => {
    function order(): readonly PitchClass[] {
      return state.selection.topic === 'fifths' ? circleOfFifths : chromaticOrder
    }

    function point(note: PitchClass): Point {
      const index = order().indexOf(note)
      const angle = (index / 12) * sketch.TWO_PI - sketch.HALF_PI
      const radius = canvasSize * 0.34
      return {
        x: canvasSize / 2 + Math.cos(angle) * radius,
        y: canvasSize / 2 + Math.sin(angle) * radius,
      }
    }

    function resize(): void {
      const nextSize = Math.max(1, Math.floor(Math.min(host.getBoundingClientRect().width, 520)))
      if (nextSize === canvasSize) return
      canvasSize = nextSize
      sketch.resizeCanvas(canvasSize, canvasSize)
      sketch.redraw()
    }

    function drawLink(from: PitchClass, to: PitchClass, color: string, weight: number): void {
      const a = point(from)
      const b = point(to)
      sketch.stroke(color)
      sketch.strokeWeight(weight)
      sketch.line(a.x, a.y, b.x, b.y)
    }

    function drawSpectrum(): void {
      const center = canvasSize / 2
      const innerRadius = canvasSize * 0.425
      spectrum.forEach((level, index) => {
        const angle = (index / spectrum.length) * sketch.TWO_PI - sketch.HALF_PI
        const outerRadius = innerRadius + canvasSize * (0.01 + level * 0.045)
        sketch.stroke(`hsla(${(index / spectrum.length) * 360 + 20}, 88%, 68%, ${0.3 + level * 0.55})`)
        sketch.strokeWeight(Math.max(1.5, canvasSize * 0.004))
        sketch.line(
          center + Math.cos(angle) * innerRadius,
          center + Math.sin(angle) * innerRadius,
          center + Math.cos(angle) * outerRadius,
          center + Math.sin(angle) * outerRadius,
        )
      })
    }

    sketch.setup = () => {
      const canvas = sketch.createCanvas(1, 1)
      canvas.parent(host)
      canvas.elt.setAttribute('aria-hidden', 'true')
      canvas.elt.addEventListener('pointerdown', (event: PointerEvent) => {
        const bounds = canvas.elt.getBoundingClientRect()
        const x = ((event.clientX - bounds.left) / bounds.width) * canvasSize
        const y = ((event.clientY - bounds.top) / bounds.height) * canvasSize
        const hitRadius = Math.max(22, canvasSize * 0.068)
        const hit = order().find((note) => {
          const position = point(note)
          return Math.hypot(position.x - x, position.y - y) <= hitRadius
        })
        if (hit !== undefined) onNoteToggle(hit)
      })
      sketch.textFont('system-ui, sans-serif')
      sketch.textAlign(sketch.CENTER, sketch.CENTER)
      sketch.frameRate(30)
      sketch.noLoop()
      observer = new ResizeObserver(resize)
      observer.observe(host)
      resize()
    }

    sketch.draw = () => {
      if (visualizing && !reducedMotion.matches) {
        spectrum = spectrumLevels(readSpectrum?.())
        silentFrames = spectrum.some((level) => level > 0.025) ? 0 : silentFrames + 1
        if (silentFrames > 18) {
          visualizing = false
          readSpectrum = undefined
          spectrum = spectrumLevels(undefined)
          sketch.noLoop()
        }
      }
      const selected = new Set(state.activeNotes)
      const activeOrder = activeNotesInOrder(state)
      const topic = state.selection.topic
      const root = state.selection.root

      sketch.clear()
      drawSpectrum()
      sketch.noFill()
      sketch.stroke('rgba(226, 225, 255, 0.17)')
      sketch.strokeWeight(1.5)
      sketch.circle(canvasSize / 2, canvasSize / 2, canvasSize * 0.68)

      if (topic === 'fifths') {
        state.resolved.links.forEach(({ from, to }) => {
          if (selected.has(from) && selected.has(to)) drawLink(from, to, 'rgba(137, 226, 242, 0.92)', 3)
        })
      } else if (topic === 'chords') {
        const links = activeOrder.length >= 3
          ? activeOrder.map((from, index) => [from, activeOrder[(index + 1) % activeOrder.length]] as const)
          : activeOrder.length === 2 ? [[activeOrder[0], activeOrder[1]] as const] : []
        links.forEach(([from, to]) => drawLink(from, to, 'rgba(255, 183, 116, 0.9)', 3))
      } else {
        activeOrder.slice(1).forEach((to, index) => {
          const from = activeOrder[index]
          drawLink(from, to, topic === 'scales' ? 'rgba(125, 226, 198, 0.78)' : 'rgba(241, 156, 209, 0.82)', topic === 'scales' ? 2.5 : 3)
          if (topic === 'arpeggios') {
            const a = point(from)
            const b = point(to)
            sketch.noStroke()
            sketch.fill('rgba(255, 211, 235, 0.95)')
            sketch.circle(a.x + (b.x - a.x) * 0.72, a.y + (b.y - a.y) * 0.72, Math.max(5, canvasSize * 0.018))
          }
        })
      }

      order().forEach((note) => {
        const { x, y } = point(note)
        const isRoot = note === root
        const isSelected = selected.has(note)
        const isPatternNote = state.resolved.notes.some((entry) => entry.pitchClass === note)
        const radius = Math.max(22, canvasSize * 0.068)
        const hue = topic === 'chords' ? 33 : topic === 'scales' ? 155 : topic === 'arpeggios' ? 315 : 189

        sketch.stroke(isRoot ? '#ffd092' : isSelected ? `hsl(${hue} 85% 72%)` : 'rgba(233, 230, 255, 0.3)')
        sketch.strokeWeight(isRoot ? 3 : isSelected ? 2 : 1)
        sketch.fill(isSelected ? (isRoot ? '#fbbf77' : `hsl(${hue} 56% 25%)`) : isPatternNote ? '#272a3a' : '#1b1d2b')
        sketch.circle(x, y, radius * 2)
        if (isRoot) {
          sketch.noFill()
          sketch.stroke('#ffd092')
          sketch.strokeWeight(1.5)
          sketch.circle(x, y, radius * 2 + 8)
        }
        sketch.noStroke()
        sketch.fill(isSelected && isRoot ? '#1e1623' : isSelected ? '#ffffff' : isPatternNote ? '#c8c8d8' : '#8a8da2')
        sketch.textSize(Math.max(12, canvasSize * 0.04))
        sketch.textStyle(isRoot || isSelected ? sketch.BOLD : sketch.NORMAL)
        sketch.text(noteLabelForState(state, note), x, y + 1)
      })
    }
  }, host)

  const onMotionChange = () => {
    if (reducedMotion.matches) sketchInstance.noLoop()
    else if (visualizing) sketchInstance.loop()
    sketchInstance.redraw()
  }
  reducedMotion.addEventListener('change', onMotionChange)

  return {
    update(nextState) {
      state = nextState
      sketchInstance.redraw()
    },
    startSpectrum(read) {
      readSpectrum = read
      spectrum = spectrumLevels(read())
      visualizing = true
      silentFrames = 0
      if (reducedMotion.matches) sketchInstance.redraw()
      else sketchInstance.loop()
    },
    stopSpectrum() {
      visualizing = false
      readSpectrum = undefined
      spectrum = spectrumLevels(undefined)
      sketchInstance.noLoop()
      sketchInstance.redraw()
    },
    destroy() {
      reducedMotion.removeEventListener('change', onMotionChange)
      observer?.disconnect()
      sketchInstance.remove()
    },
  }
}
