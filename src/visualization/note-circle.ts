import p5 from 'p5'
import { activeNotesInOrder, type ExplorerState } from '../explorer-state.ts'
import { circleOfFifths, noteName, type PitchClass } from '../theory/music-theory.ts'

const chromaticOrder = Array.from({ length: 12 }, (_, index) => index as PitchClass)

type Point = { x: number; y: number }

export type NoteCircle = {
  update(state: ExplorerState): void
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

  const sketchInstance = new p5((sketch) => {
    function order(): readonly PitchClass[] {
      return state.selection.topic === 'fifths' ? circleOfFifths : chromaticOrder
    }

    function point(note: PitchClass): Point {
      const index = order().indexOf(note)
      const angle = (index / 12) * sketch.TWO_PI - sketch.HALF_PI
      const radius = canvasSize * 0.37
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
      sketch.noLoop()
      observer = new ResizeObserver(resize)
      observer.observe(host)
      resize()
    }

    sketch.draw = () => {
      const selected = new Set(state.activeNotes)
      const activeOrder = activeNotesInOrder(state)
      const topic = state.selection.topic
      const root = state.selection.root

      sketch.clear()
      sketch.noFill()
      sketch.stroke('rgba(226, 225, 255, 0.17)')
      sketch.strokeWeight(1.5)
      sketch.circle(canvasSize / 2, canvasSize / 2, canvasSize * 0.74)

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
        sketch.noStroke()
        sketch.fill(isSelected && isRoot ? '#1e1623' : isSelected ? '#ffffff' : isPatternNote ? '#c8c8d8' : '#8a8da2')
        sketch.textSize(Math.max(12, canvasSize * 0.04))
        sketch.textStyle(isRoot || isSelected ? sketch.BOLD : sketch.NORMAL)
        sketch.text(noteName(note, 'flat'), x, y + 1)
      })
    }
  }, host)

  return {
    update(nextState) {
      state = nextState
      sketchInstance.redraw()
    },
    destroy() {
      observer?.disconnect()
      sketchInstance.remove()
    },
  }
}
