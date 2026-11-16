import type { PitchClass } from '../theory/music-theory.ts'
import type { ExplorerState } from '../explorer-state.ts'
import { instrumentRootLegend, renderInstrumentSvg } from './instrument-svg.ts'
import { guitarNotesForState, type GuitarPosition, type InstrumentKind } from './instrument-notes.ts'
import type { HudCoordinator, HudRegistration } from './hud-coordinator.ts'

export type InstrumentHud = { setPlaybackActive(active: boolean): void; update(state: ExplorerState): void; startNote(note: PitchClass, position?: GuitarPosition): void; endNote(note: PitchClass): void; clearPlayback(): void; destroy(): void }

export function mountInstrumentHud(options: {
  kind: InstrumentKind
  initialState: ExplorerState
  toggle: HTMLButtonElement
  onPlay?: () => void
  onNoteClick?: (position: GuitarPosition) => void
  coordinator: HudCoordinator
}): InstrumentHud {
  const { kind, toggle, coordinator } = options
  const root = document.createElement('section')
  root.id = `${kind}-hud`
  root.className = 'floating-hud instrument-hud'
  root.dataset.instrument = kind
  root.setAttribute('role', 'region')
  root.setAttribute('aria-label', `${kind[0].toUpperCase()}${kind.slice(1)} note reference`)
  root.setAttribute('aria-hidden', 'true')
  root.inert = true

  const header = document.createElement('header')
  header.className = 'instrument-hud__header'
  const title = document.createElement('span')
  title.textContent = kind === 'piano' ? 'Piano' : 'Guitar'
  const handle = document.createElement('div')
  handle.className = 'instrument-hud__drag'
  handle.tabIndex = 0
  handle.setAttribute('role', 'group')
  handle.setAttribute('aria-label', `Move ${kind} HUD. Drag or use arrow keys.`)
  handle.title = 'Drag to move or focus and use arrow keys'
  const hide = document.createElement('button')
  hide.type = 'button'
  hide.className = 'instrument-hud__hide'
  hide.textContent = 'Hide'
  hide.setAttribute('aria-label', `Hide ${kind}`)
  const play = document.createElement('button')
  play.type = 'button'
  play.className = 'instrument-hud__hide instrument-hud__play'
  const setPlaybackActive = (active: boolean) => {
    play.textContent = active ? 'Stop' : 'Play'
    play.setAttribute('aria-label', active ? 'Stop playback' : 'Play selected notes')
  }
  setPlaybackActive(false)
  const onPlay = () => options.onPlay?.()
  play.addEventListener('click', onPlay)
  header.append(title, handle, play, hide)
  const content = document.createElement('div')
  content.className = 'instrument-hud__content'
  content.innerHTML = renderInstrumentSvg(kind, options.initialState)
  const activate = (event: MouseEvent | KeyboardEvent) => {
    if (kind !== 'guitar' || !(event.target instanceof Element)) return
    const target = event.target.closest('[data-guitar-note]')
    if (!target || !content.contains(target)) return
    if (event instanceof KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      if (event.repeat) return
    }
    const position = guitarNotesForState(currentState).find(position =>
      `${position.string}-${position.fret}` === target.getAttribute('data-guitar-position'))
    if (position) options.onNoteClick?.(position)
  }
  content.addEventListener('click', activate)
  content.addEventListener('keydown', activate)
  const scope = document.createElement('p')
  scope.className = 'instrument-hud__scope'
  scope.textContent = kind === 'guitar'
    ? 'Note locations · standard tuning · frets 0–4; not a chord fingering. Top: high E (1); bottom: low E (6).'
    : 'Orange note badges mark selected keys. Pitch classes C–C; playback may use another octave.'
  scope.textContent += ' Cyan with a dashed outline: sounding note.'
  const legend = document.createElement('p')
  legend.className = 'instrument-hud__legend'
  legend.textContent = instrumentRootLegend(options.initialState)
  root.append(header, content, scope, legend)
  document.body.append(root)

  const placement: HudRegistration = coordinator.register({
    id: kind,
    root,
    handles: [handle],
    preferred: kind === 'piano' ? 'middle-right' : 'bottom-right',
    storageKey: `orbit.hud.${kind}.position`,
  })
  let visible = false
  const syncToggle = () => {
    const label = `${visible ? 'Hide' : 'Show'} ${kind}`
    toggle.setAttribute('aria-pressed', String(visible))
    toggle.setAttribute('aria-label', label)
    toggle.title = label
    placement.setVisible(visible)
  }
  const onToggle = () => { visible = !visible; syncToggle() }
  toggle.setAttribute('aria-controls', root.id)
  toggle.addEventListener('click', onToggle)
  const onHide = () => { visible = false; syncToggle(); toggle.focus() }
  hide.addEventListener('click', onHide)
  syncToggle()

  let currentState = options.initialState
  const soundingNotes = new Set<PitchClass>()
  let soundingPosition: GuitarPosition | undefined
  let destroyed = false
  const render = () => {
    if (destroyed) return
    const focused = document.activeElement
    const position = focused && content.contains(focused) ? focused.getAttribute('data-guitar-position') : null
    content.innerHTML = renderInstrumentSvg(kind, currentState, soundingNotes, soundingPosition)
    if (position) content.querySelector<SVGElement>(`[data-guitar-position="${position}"][data-guitar-note]`)?.focus()
    legend.textContent = instrumentRootLegend(currentState)
  }
  return {
    setPlaybackActive,
    update(state) {
      if (destroyed) return
      currentState = state
      render()
    },
    startNote(note, position) {
      if (destroyed || soundingNotes.has(note)) return
      soundingPosition = position
      soundingNotes.add(note)
      render()
    },
    endNote(note) {
      if (destroyed || !soundingNotes.delete(note)) return
      soundingPosition = undefined
      render()
    },
    clearPlayback() {
      if (destroyed || soundingNotes.size === 0) return
      soundingPosition = undefined
      soundingNotes.clear()
      render()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      soundingPosition = undefined
      soundingNotes.clear()
      content.removeEventListener('click', activate)
      content.removeEventListener('keydown', activate)
      toggle.removeEventListener('click', onToggle)
      hide.removeEventListener('click', onHide)
      play.removeEventListener('click', onPlay)
      placement.destroy()
      root.remove()
      visible = false
      syncToggle()
    },
  }
}
