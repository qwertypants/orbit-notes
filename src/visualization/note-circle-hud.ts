import type { ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import { getHudStopPosition, hudStops, nearestHudStop, readHudStop, writeHudStop, type HudInsets, type HudStop } from './hud-position.ts'
import { mountNoteCircle } from './note-circle.ts'

const storageKey = 'orbit.note-circle-hud.stop'
const smallViewportQuery = '(max-width: 759px)'
const minimumInset = 16
const snapTransitionMs = 180

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
  onPlay: () => void
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}): NoteCircleHud {
  const root = document.createElement('div')
  root.className = 'note-circle-hud'
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

  const safeAreaProbe = document.createElement('div')
  safeAreaProbe.className = 'note-circle-hud__safe-area-probe'
  safeAreaProbe.style.position = 'fixed'
  safeAreaProbe.style.visibility = 'hidden'
  safeAreaProbe.style.pointerEvents = 'none'
  safeAreaProbe.style.width = '0px'
  safeAreaProbe.style.height = '0px'
  safeAreaProbe.style.paddingTop = 'max(16px, env(safe-area-inset-top))'
  safeAreaProbe.style.paddingRight = 'max(16px, env(safe-area-inset-right))'
  safeAreaProbe.style.paddingBottom = 'max(16px, env(safe-area-inset-bottom))'
  safeAreaProbe.style.paddingLeft = 'max(16px, env(safe-area-inset-left))'
  document.body.append(safeAreaProbe)

  const circle = mountNoteCircle(circleHost, options.initialState, options.onNoteToggle)
  playButton.addEventListener('click', options.onPlay)

  let activeStop: HudStop = 'top-right'
  let storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = options.storage
  if (!storage) {
    try {
      storage = window.localStorage
    } catch {
      storage = undefined
    }
  }
  try {
    activeStop = storage ? (readHudStop(storage, storageKey) ?? activeStop) : activeStop
  } catch {
    // Storage can be disabled by browser privacy settings. The HUD still works for this session.
  }

  const media = window.matchMedia(smallViewportQuery)
  let anchorVisible = true
  let smallViewport = media.matches
  let pointerId: number | undefined
  let activeDragHandle: HTMLElement | undefined
  let dragOrigin: { pointerX: number; pointerY: number; left: number; top: number } | undefined
  let snapTimer: number | undefined
  let destroyed = false

  function viewportSize(): { width: number; height: number } {
    return { width: window.innerWidth, height: window.innerHeight }
  }

  function measureSafeAreaInsets(): HudInsets {
    const resolved = window.getComputedStyle(safeAreaProbe)
    const readInset = (value: string): number => Math.max(minimumInset, Number.parseFloat(value) || minimumInset)
    return {
      top: readInset(resolved.paddingTop),
      right: readInset(resolved.paddingRight),
      bottom: readInset(resolved.paddingBottom),
      left: readInset(resolved.paddingLeft),
    }
  }

  let safeInsets = measureSafeAreaInsets()

  function hudSize(): { width: number; height: number } {
    const rect = root.getBoundingClientRect()
    return { width: rect.width || 204, height: rect.height || 204 }
  }

  function setPosition(left: number, top: number): void {
    root.style.left = `${left}px`
    root.style.top = `${top}px`
  }

  function positionAtStop(stop: HudStop): void {
    const viewport = viewportSize()
    const hud = hudSize()
    const position = getHudStopPosition(stop, viewport.width, viewport.height, hud.width, hud.height, safeInsets)
    setPosition(position.left, position.top)
  }

  function clampToViewport(left: number, top: number): { left: number; top: number } {
    const viewport = viewportSize()
    const hud = hudSize()
    return {
      left: Math.max(safeInsets.left, Math.min(viewport.width - hud.width - safeInsets.right, left)),
      top: Math.max(safeInsets.top, Math.min(viewport.height - hud.height - safeInsets.bottom, top)),
    }
  }

  function syncVisibility(): void {
    const visible = smallViewport && !anchorVisible
    root.classList.toggle('is-visible', visible)
    root.setAttribute('aria-hidden', String(!visible))
    root.inert = !visible
  }

  function saveStop(stop: HudStop): void {
    try {
      if (storage) writeHudStop(storage, storageKey, stop)
    } catch {
      // A storage failure must not interrupt dragging or snapping.
    }
  }

  function snapToStop(stop: HudStop): void {
    activeStop = stop
    root.classList.add('is-snapping')
    positionAtStop(activeStop)
    saveStop(activeStop)
    if (snapTimer !== undefined) window.clearTimeout(snapTimer)
    snapTimer = window.setTimeout(() => {
      root.classList.remove('is-snapping')
      snapTimer = undefined
    }, snapTransitionMs)
  }

  function stopInDirection(direction: 'left' | 'right' | 'up' | 'down'): HudStop | undefined {
    const viewport = viewportSize()
    const hud = hudSize()
    const current = getHudStopPosition(activeStop, viewport.width, viewport.height, hud.width, hud.height, safeInsets)
    const eligible = hudStops.flatMap((stop) => {
      if (stop === activeStop) return []
      const position = getHudStopPosition(stop, viewport.width, viewport.height, hud.width, hud.height, safeInsets)
      const dx = position.left - current.left
      const dy = position.top - current.top
      const isInDirection = direction === 'left' ? dx < 0
        : direction === 'right' ? dx > 0
          : direction === 'up' ? dy < 0 : dy > 0
      return isInDirection ? [{ stop, distance: dx * dx + dy * dy }] : []
    })
    eligible.sort((a, b) => a.distance - b.distance)
    return eligible[0]?.stop
  }

  function finishDrag(event: PointerEvent): void {
    if (pointerId !== event.pointerId || !dragOrigin) return
    pointerId = undefined
    dragOrigin = undefined
    if (activeDragHandle?.hasPointerCapture(event.pointerId)) activeDragHandle.releasePointerCapture(event.pointerId)
    activeDragHandle = undefined

    const rect = root.getBoundingClientRect()
    const viewport = viewportSize()
    const hud = hudSize()
    const stop = nearestHudStop(rect.left, rect.top, viewport.width, viewport.height, hud.width, hud.height, safeInsets)
    snapToStop(stop)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || destroyed || pointerId !== undefined) return
    if (!(event.currentTarget instanceof HTMLElement)) return
    event.preventDefault()
    const rect = root.getBoundingClientRect()
    pointerId = event.pointerId
    dragOrigin = { pointerX: event.clientX, pointerY: event.clientY, left: rect.left, top: rect.top }
    root.classList.remove('is-snapping')
    if (snapTimer !== undefined) {
      window.clearTimeout(snapTimer)
      snapTimer = undefined
    }
    activeDragHandle = event.currentTarget
    activeDragHandle.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId || !dragOrigin) return
    event.preventDefault()
    const next = clampToViewport(
      dragOrigin.left + event.clientX - dragOrigin.pointerX,
      dragOrigin.top + event.clientY - dragOrigin.pointerY,
    )
    setPosition(next.left, next.top)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const direction = event.key === 'ArrowLeft' ? 'left'
      : event.key === 'ArrowRight' ? 'right'
        : event.key === 'ArrowUp' ? 'up'
          : event.key === 'ArrowDown' ? 'down' : undefined
    if (!direction) return
    event.preventDefault()
    const stop = stopInDirection(direction)
    if (stop) snapToStop(stop)
  }

  const onPointerUp = (event: PointerEvent) => finishDrag(event)
  const onResize = () => {
    safeInsets = measureSafeAreaInsets()
    positionAtStop(activeStop)
  }
  const onMediaChange = (event: MediaQueryListEvent) => {
    smallViewport = event.matches
    syncVisibility()
  }

  dragHandles.forEach((handle) => {
    handle.addEventListener('pointerdown', onPointerDown)
    handle.addEventListener('keydown', onKeyDown)
  })
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('resize', onResize)
  media.addEventListener('change', onMediaChange)

  const intersectionObserver = typeof IntersectionObserver === 'undefined'
    ? undefined
    : new IntersectionObserver((entries) => {
      const entry = entries.find(({ target }) => target === options.anchor)
      if (!entry) return
      anchorVisible = entry.isIntersecting
      syncVisibility()
    }, { threshold: 0 })
  intersectionObserver?.observe(options.anchor)

  positionAtStop(activeStop)
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
      dragHandles.forEach((handle) => {
        handle.removeEventListener('pointerdown', onPointerDown)
        handle.removeEventListener('keydown', onKeyDown)
      })
      if (pointerId !== undefined && activeDragHandle?.hasPointerCapture(pointerId)) activeDragHandle.releasePointerCapture(pointerId)
      playButton.removeEventListener('click', options.onPlay)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('resize', onResize)
      if (snapTimer !== undefined) window.clearTimeout(snapTimer)
      circle.destroy()
      root.remove()
      safeAreaProbe.remove()
    },
  }
}
