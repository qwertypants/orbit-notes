import p5 from 'p5'
import { activeNotesInOrder, type ExplorerState } from '../explorer-state.ts'
import { circleOfFifths, type PitchClass } from '../theory/music-theory.ts'
import { noteLabelForState } from '../theory/learning-summary.ts'
import { spectrumLevels } from './spectrum.ts'
import { changedConnections, changedNotes, easeOutCubic, transitionProgress, type CircleLink } from './selection-animation.ts'
import { createNotePulse, type NotePulse } from './note-pulse.ts'

const chromaticOrder = Array.from({ length: 12 }, (_, index) => index as PitchClass)

type Point = { x: number; y: number }
type SelectionTransition = {
  startedAtMs: number
  changed: ReadonlySet<PitchClass>
  added: readonly CircleLink[]
  removed: readonly CircleLink[]
  unchanged: readonly CircleLink[]
  rippleNote: PitchClass | undefined
}

const selectionDurationMs = 320

function connectionKey({ from, to }: CircleLink): string {
  return `${Math.min(from, to)}:${Math.max(from, to)}`
}

function visibleConnections(state: ExplorerState): CircleLink[] {
  const activeOrder = activeNotesInOrder(state)
  if (state.selection.topic === 'fifths') {
    const selected = new Set(state.activeNotes)
    return state.resolved.links.filter(({ from, to }) => selected.has(from) && selected.has(to))
  }
  if (state.selection.topic === 'chords' && activeOrder.length >= 3) {
    return activeOrder.map((from, index) => ({ from, to: activeOrder[(index + 1) % activeOrder.length] }))
  }
  return activeOrder.slice(1).map((to, index) => ({ from: activeOrder[index], to }))
}

function matchingConnections(links: readonly CircleLink[], matches: readonly CircleLink[]): CircleLink[] {
  const keys = new Set(matches.map(connectionKey))
  return links.filter((link) => keys.has(connectionKey(link)))
}

export type NoteCircle = {
  update(state: ExplorerState): void
  startSpectrum(read: () => Float32Array | undefined): void
  stopSpectrum(): void
  pulseNote(note: PitchClass, elapsedMs?: number): void
  clearPulses(): void
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
  let selectionTransition: SelectionTransition | undefined
  const pulseControllers = new Map<PitchClass, NotePulse>()
  const pulseProgress = new Map<PitchClass, number>()
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

    function drawLink(from: PitchClass, to: PitchClass, color: string, weight: number, progress = 1, opacity = 1): void {
      const a = point(from)
      const b = point(to)
      const strokeColor = sketch.color(color)
      strokeColor.setAlpha(sketch.alpha(strokeColor) * opacity)
      sketch.stroke(strokeColor)
      sketch.strokeWeight(weight)
      sketch.line(a.x, a.y, a.x + (b.x - a.x) * progress, a.y + (b.y - a.y) * progress)
    }

    function drawConnection(link: CircleLink, progress = 1, opacity = 1): void {
      const topic = state.selection.topic
      const color = topic === 'fifths' ? 'rgba(137, 226, 242, 0.92)'
        : topic === 'chords' ? 'rgba(255, 183, 116, 0.9)'
          : topic === 'scales' ? 'rgba(125, 226, 198, 0.78)' : 'rgba(241, 156, 209, 0.82)'
      drawLink(link.from, link.to, color, topic === 'scales' ? 2.5 : 3, progress, opacity)
      if (topic === 'arpeggios') {
        const a = point(link.from)
        const b = point(link.to)
        sketch.noStroke()
        sketch.fill(`rgba(255, 211, 235, ${0.95 * opacity * Math.min(1, progress / 0.72)})`)
        sketch.circle(a.x + (b.x - a.x) * 0.72, a.y + (b.y - a.y) * 0.72, Math.max(5, canvasSize * 0.018))
      }
    }

    function drawNoteEffects(selected: ReadonlySet<PitchClass>, transition: SelectionTransition | undefined, progress: number): void {
      const topic = state.selection.topic
      const hue = topic === 'chords' ? 33 : topic === 'scales' ? 155 : topic === 'arpeggios' ? 315 : 189
      const radius = Math.max(22, canvasSize * 0.068)
      order().forEach((note) => {
        const changed = transition?.changed.has(note)
        const strength = changed ? (selected.has(note) ? progress : 1 - progress) : selected.has(note) ? 1 : 0
        if (strength === 0) return
        const { x, y } = point(note)
        sketch.noStroke()
        for (let layer = 3; layer >= 1; layer -= 1) {
          sketch.fill(`hsla(${note === state.selection.root ? 35 : hue}, 86%, 70%, ${0.028 * strength})`)
          sketch.circle(x, y, radius * 2 + layer * 9)
        }
      })
      if (transition?.rippleNote !== undefined) {
        const { x, y } = point(transition.rippleNote)
        sketch.noFill()
        sketch.stroke(`hsla(${hue}, 85%, 78%, ${0.25 * (1 - progress)})`)
        sketch.strokeWeight(1.25)
        sketch.circle(x, y, radius * 2 + 4 + progress * 30)
      }
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

    function drawPlaybackPulses(): void {
      const topic = state.selection.topic
      const hue = topic === 'chords' ? 33 : topic === 'scales' ? 155 : topic === 'arpeggios' ? 315 : 189
      const radius = Math.max(22, canvasSize * 0.068)
      pulseProgress.forEach((progress, note) => {
        if (progress <= 0) return
        const { x, y } = point(note)
        const colorHue = note === state.selection.root ? 35 : hue
        sketch.noStroke()
        for (let layer = 3; layer >= 1; layer -= 1) {
          sketch.fill(`hsla(${colorHue}, 86%, 70%, ${(0.045 * progress) / layer})`)
          sketch.circle(x, y, radius * 2 + layer * (8 + progress * 6))
        }
        sketch.noFill()
        sketch.stroke(`hsla(${colorHue}, 92%, 78%, ${0.72 * progress})`)
        sketch.strokeWeight(Math.max(1.5, canvasSize * 0.004) * (0.65 + progress * 0.5))
        sketch.circle(x, y, radius * 2 + 8 + (1 - progress) * canvasSize * 0.12)
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
      // setup may finish after callers have already started activity. Reconcile against
      // current state so setup cannot leave an active animation stopped.
      syncLoop()
      sketch.redraw()
    }

    sketch.draw = () => {
      if (visualizing && !reducedMotion.matches) {
        spectrum = spectrumLevels(readSpectrum?.())
        silentFrames = spectrum.some((level) => level > 0.025) ? 0 : silentFrames + 1
        if (silentFrames > 18) {
          visualizing = false
          readSpectrum = undefined
          spectrum = spectrumLevels(undefined)
        }
      }
      const transition = selectionTransition
      const elapsed = transition ? transitionProgress(transition.startedAtMs, performance.now(), selectionDurationMs) : 1
      const progress = easeOutCubic(elapsed)
      if (elapsed >= 1) selectionTransition = undefined
      const selected = new Set(state.activeNotes)
      const topic = state.selection.topic
      const root = state.selection.root

      sketch.clear()
      drawSpectrum()
      sketch.noFill()
      sketch.stroke('rgba(226, 225, 255, 0.17)')
      sketch.strokeWeight(1.5)
      sketch.circle(canvasSize / 2, canvasSize / 2, canvasSize * 0.68)

      if (transition) {
        transition.unchanged.forEach((link) => drawConnection(link))
        transition.removed.forEach((link) => drawConnection(link, 1, 1 - progress))
        transition.added.forEach((link) => drawConnection(link, progress))
      } else {
        visibleConnections(state).forEach((link) => drawConnection(link))
      }

      drawNoteEffects(selected, transition, progress)
      drawPlaybackPulses()

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
      const pulseActive = [...pulseProgress.values()].some((value) => value > 0)
      if (!visualizing && !selectionTransition && !pulseActive) sketch.noLoop()
    }
  }, host)

  function syncLoop(): void {
    const pulseActive = [...pulseProgress.values()].some((value) => value > 0)
    if (!reducedMotion.matches && (visualizing || selectionTransition || pulseActive)) sketchInstance.loop()
    else sketchInstance.noLoop()
  }

  function clearPulses(): void {
    pulseControllers.forEach((pulse) => pulse.stop())
    pulseControllers.clear()
    pulseProgress.clear()
    syncLoop()
    sketchInstance.redraw()
  }

  const onMotionChange = () => {
    if (reducedMotion.matches) {
      selectionTransition = undefined
      clearPulses()
    }
    syncLoop()
    sketchInstance.redraw()
  }
  reducedMotion.addEventListener('change', onMotionChange)

  return {
    update(nextState) {
      const changed = changedNotes(state.activeNotes, nextState.activeNotes)
      const previousLinks = visibleConnections(state)
      const nextLinks = visibleConnections(nextState)
      const connections = changedConnections(previousLinks, nextLinks)
      if (reducedMotion.matches || state.selection.topic !== nextState.selection.topic) {
        selectionTransition = undefined
      } else if (changed.length > 0 || connections.added.length > 0 || connections.removed.length > 0) {
        selectionTransition = {
          startedAtMs: performance.now(),
          changed: new Set(changed),
          added: matchingConnections(nextLinks, connections.added),
          removed: matchingConnections(previousLinks, connections.removed),
          unchanged: matchingConnections(nextLinks, connections.unchanged),
          rippleNote: changed.length === 1 ? changed[0] : undefined,
        }
      }
      state = nextState
      syncLoop()
      sketchInstance.redraw()
    },
    startSpectrum(read) {
      readSpectrum = read
      spectrum = spectrumLevels(read())
      visualizing = true
      silentFrames = 0
      syncLoop()
      if (reducedMotion.matches) sketchInstance.redraw()
    },
    stopSpectrum() {
      visualizing = false
      readSpectrum = undefined
      spectrum = spectrumLevels(undefined)
      syncLoop()
      sketchInstance.redraw()
    },
    pulseNote(note, elapsedMs = 0) {
      if (reducedMotion.matches) return
      let pulse = pulseControllers.get(note)
      if (!pulse) {
        pulse = createNotePulse((progress) => {
          pulseProgress.set(note, progress)
          syncLoop()
          sketchInstance.redraw()
        }, reducedMotion.matches)
        pulseControllers.set(note, pulse)
      }
      pulse.again(elapsedMs)
      syncLoop()
    },
    clearPulses() {
      clearPulses()
    },
    destroy() {
      pulseControllers.forEach((pulse) => pulse.stop())
      pulseControllers.clear()
      pulseProgress.clear()
      reducedMotion.removeEventListener('change', onMotionChange)
      observer?.disconnect()
      sketchInstance.remove()
    },
  }
}
