import type { ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import type { HudCoordinator } from './hud-coordinator.ts'
import { mountNoteCircle } from './note-circle.ts'

const smallViewportQuery = '(max-width: 759px)'

export type NoteCircleHud = {
  setPlaybackActive(active: boolean): void
  update(state: ExplorerState): void
  startSpectrum(read: () => Float32Array | undefined): void
  stopSpectrum(): void
  pulseNote(note: PitchClass, elapsedMs?: number): void
  clearPulses(): void
  destroy(): void
}

export function mountNoteCircleHud(options: {
  anchor: HTMLElement
  initialState: ExplorerState
  onNoteToggle: (note: PitchClass) => void
  onRelativeMinorSelect?: (root: PitchClass) => void
  onPlay: () => void
  coordinator: HudCoordinator
}): NoteCircleHud {
  const root = document.createElement('div')
  root.className = 'note-circle-hud floating-hud'
  root.setAttribute('role', 'region')
  root.setAttribute('aria-label', 'Floating note circle')
  root.setAttribute('aria-hidden', 'true')
  root.inert = true

  const dragHandles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => {
    const handle = document.createElement('div')
    handle.className = `note-circle-hud__drag note-circle-hud__drag--${corner}`
    handle.setAttribute('role', 'group')
    handle.tabIndex = 0
    handle.setAttribute('aria-label', `Move note circle from ${corner} corner. Drag or use arrow keys.`)
    handle.title = 'Drag to move the note circle or focus it and use the arrow keys'
    return handle
  })

  const circleHost = document.createElement('div')
  circleHost.className = 'note-circle-hud__circle'

  const playButton = document.createElement('button')
  playButton.type = 'button'
  playButton.className = 'note-circle-hud__play'
  function setPlaybackActive(active: boolean): void {
    const label = active ? 'Stop playback' : 'Play selected notes'
    playButton.setAttribute('aria-label', label)
    playButton.title = label
    playButton.innerHTML = active
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8c0-.8.9-1.3 1.6-.9l9.1 5.3a1 1 0 0 1 0 1.7l-9.1 5.3c-.7.4-1.6-.1-1.6-.9V5.8Z"/></svg>'
  }
  setPlaybackActive(false)

  root.append(...dragHandles, circleHost, playButton)
  document.body.append(root)

  const circle = mountNoteCircle(circleHost, options.initialState, options.onNoteToggle, options.onRelativeMinorSelect)
  playButton.addEventListener('click', options.onPlay)
  const placement = options.coordinator.register({ id: 'circle', root, handles: dragHandles, preferred: 'top-right', storageKey: 'orbit.hud.circle.position' })

  const media = window.matchMedia(smallViewportQuery)
  let anchorVisible = true
  let smallViewport = media.matches
  let destroyed = false

  function syncVisibility(): void {
    const visible = smallViewport && !anchorVisible
    placement.setVisible(visible)
  }
  const onMediaChange = (event: MediaQueryListEvent) => {
    smallViewport = event.matches
    syncVisibility()
  }

  media.addEventListener('change', onMediaChange)

  const intersectionObserver = typeof IntersectionObserver === 'undefined'
    ? undefined
    : new IntersectionObserver((entries) => {
      const entry = entries.find(({ target }) => target === options.anchor)
      if (!entry) return
      anchorVisible = entry.isIntersecting || entry.boundingClientRect.bottom > 0
      syncVisibility()
    }, { threshold: 0 })
  intersectionObserver?.observe(options.anchor)

  syncVisibility()

  return {
    setPlaybackActive,
    update(state) {
      circle.update(state)
    },
    startSpectrum(read) {
      circle.startSpectrum(read)
    },
    stopSpectrum() {
      circle.stopSpectrum()
    },
    pulseNote(note, elapsedMs) {
      circle.pulseNote(note, elapsedMs)
    },
    clearPulses() {
      circle.clearPulses()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      intersectionObserver?.disconnect()
      media.removeEventListener('change', onMediaChange)
      placement.destroy()
      playButton.removeEventListener('click', options.onPlay)
      circle.destroy()
      root.remove()
    },
  }
}
