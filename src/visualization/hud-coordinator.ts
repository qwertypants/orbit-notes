import { moveHud, packHuds, placeHud, type HudRect } from './hud-layout.ts'
import { getHudStopPosition, readHudStop, type HudStop } from './hud-position.ts'

export type HudId = 'circle' | 'piano' | 'guitar'
export type HudRegistration = { setVisible(visible: boolean): void; destroy(): void }
export type HudCoordinator = {
  register(options: { id: HudId; root: HTMLElement; handles: readonly HTMLElement[]; preferred: HudStop; storageKey: string }): HudRegistration
  destroy(): void
}
type Entry = { id: HudId; root: HTMLElement; handles: readonly HTMLElement[]; preferred: HudStop; storageKey: string; visible: boolean; drag?: { pointer: number; handle: HTMLElement; x: number; y: number } }
const gap = 8

export function createHudCoordinator(options: { storage?: Pick<Storage, 'getItem' | 'setItem'> } = {}): HudCoordinator {
  let storage = options.storage
  if (!storage) { try { storage = window.localStorage } catch { storage = undefined } }
  const entries = new Map<HudId, Entry>()
  const stack = document.createElement('div')
  stack.className = 'hud-stack'
  stack.setAttribute('aria-label', 'Open note views')
  document.body.append(stack)
  const probe = document.createElement('div')
  probe.className = 'hud-safe-area-probe'
  document.body.append(probe)
  let stacked = false
  let destroyed = false
  const getRect = (entry: Entry): HudRect => { const r = entry.root.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width || (entry.id === 'circle' ? 204 : 240), height: r.height || 140 } }
  const getBounds = (): HudRect => {
    const v = window.visualViewport
    const css = window.getComputedStyle(probe)
    const inset = (value: string) => Math.max(16, Number.parseFloat(value) || 16)
    const left = (v?.offsetLeft ?? 0) + inset(css.paddingLeft)
    const top = (v?.offsetTop ?? 0) + inset(css.paddingTop)
    const right = (v?.offsetLeft ?? 0) + (v?.width ?? window.innerWidth) - inset(css.paddingRight)
    const bottom = (v?.offsetTop ?? 0) + (v?.height ?? window.innerHeight) - inset(css.paddingBottom)
    return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
  }
  const setPosition = (entry: Entry, r: HudRect) => { entry.root.style.left = `${r.left}px`; entry.root.style.top = `${r.top}px` }
  const save = (entry: Entry) => {
    try {
      if (!storage) return
      const b = getBounds(), r = getRect(entry)
      storage.setItem(entry.storageKey, JSON.stringify({ version: 1, x: b.width > r.width ? (r.left - b.left) / (b.width - r.width) : 0, y: b.height > r.height ? (r.top - b.top) / (b.height - r.height) : 0 }))
    } catch { /* Storage is optional. */ }
  }
  const preference = (entry: Entry, target: HudRect, bounds: HudRect): HudRect => {
    try {
      const saved = storage?.getItem(entry.storageKey)
      if (saved) {
        const p = JSON.parse(saved)
        if (p?.version === 1 && Number.isFinite(p.x) && Number.isFinite(p.y)) return { ...target, left: bounds.left + Math.max(0, Math.min(1, p.x)) * Math.max(0, bounds.width - target.width), top: bounds.top + Math.max(0, Math.min(1, p.y)) * Math.max(0, bounds.height - target.height) }
      } else if (entry.id === 'circle' && storage) {
        const legacy = readHudStop(storage, 'orbit.note-circle-hud.stop')
        if (legacy) { const p = getHudStopPosition(legacy, window.innerWidth, window.innerHeight, target.width, target.height); return { ...target, left: p.left, top: p.top } }
      }
    } catch { /* Ignore invalid or inaccessible preferences. */ }
    return target
  }
  function layout(repack = false): void {
    if (destroyed) return
    const visible = [...entries.values()].filter(entry => entry.visible)
    const bounds = getBounds()
    // Measure in floating mode, not at a width imposed by the compact stack.
    entries.forEach(entry => { document.body.append(entry.root); entry.handles.forEach(handle => {
      handle.removeAttribute('aria-disabled'); handle.removeAttribute('aria-description')
    }) })
    const placed: HudRect[] = []
    const positions = visible.map(entry => {
      const r = getRect(entry)
      const preferred = getHudStopPosition(entry.preferred, bounds.width + bounds.left, bounds.height + bounds.top, r.width, r.height, { left: bounds.left, top: bounds.top, right: 0, bottom: 0 })
      const current = { ...r, left: Number.parseFloat(entry.root.style.left) || preferred.left, top: Number.parseFloat(entry.root.style.top) || preferred.top }
      const next = placeHud(preference(entry, current, bounds), bounds, placed, gap)
      if (next) placed.push(next)
      return next
    })
    if (positions.some(position => !position) && (repack || stacked)) {
      const packed = packHuds(visible.map(getRect), bounds, gap)
      if (packed) packed.forEach((rect, index) => { positions[index] = rect })
    }
    if (positions.some(position => !position)) {
      stacked = true
      stack.classList.add('is-visible')
      visible.forEach(entry => {
        stack.append(entry.root)
        entry.handles.forEach(handle => { handle.setAttribute('aria-disabled', 'true'); handle.setAttribute('aria-description', 'Movement resumes when there is room for all open views.') })
      })
      return
    }
    stacked = false
    stack.classList.remove('is-visible')
    visible.forEach((entry, index) => setPosition(entry, positions[index]!))
  }

  const onMove = (event: PointerEvent) => {
    const entry = [...entries.values()].find(item => item.drag?.pointer === event.pointerId)
    if (!entry || stacked) return
    const drag = entry.drag!
    const current = getRect(entry)
    const next = moveHud(current, { left: current.left + event.clientX - drag.x, top: current.top + event.clientY - drag.y }, getBounds(), [...entries.values()].filter(other => other.visible && other !== entry).map(getRect), gap)
    setPosition(entry, next); drag.x = event.clientX; drag.y = event.clientY
  }
  const onUp = (event: PointerEvent) => {
    const entry = [...entries.values()].find(item => item.drag?.pointer === event.pointerId)
    if (!entry) return
    const drag = entry.drag!
    if (drag.handle.hasPointerCapture(event.pointerId)) drag.handle.releasePointerCapture(event.pointerId)
    entry.drag = undefined; save(entry)
  }
  const onResize = () => layout(true)
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onResize)
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp); window.addEventListener('resize', onResize); window.visualViewport?.addEventListener('resize', onResize)
  return {
    register(config) {
      const entry: Entry = { ...config, visible: false }; entries.set(entry.id, entry); observer?.observe(entry.root)
      const onDown = (event: PointerEvent) => { if (!entry.visible || entry.drag || !event.isPrimary || event.button !== 0 || stacked) return; event.preventDefault(); const handle = event.currentTarget as HTMLElement; entry.drag = { pointer: event.pointerId, handle, x: event.clientX, y: event.clientY }; handle.setPointerCapture(event.pointerId) }
      const onKey = (event: KeyboardEvent) => {
        const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] } as const
        const d = delta[event.key as keyof typeof delta]; if (!d || stacked) return; event.preventDefault(); const r = getRect(entry)
        setPosition(entry, moveHud(r, { left: r.left + d[0], top: r.top + d[1] }, getBounds(), [...entries.values()].filter(other => other.visible && other !== entry).map(getRect), gap)); save(entry)
      }
      config.handles.forEach(handle => { handle.addEventListener('pointerdown', onDown); handle.addEventListener('keydown', onKey) })
      return {
        setVisible(visible: boolean) { if (!visible && entry.drag) { const d = entry.drag; entry.drag = undefined; if (d.handle.hasPointerCapture(d.pointer)) d.handle.releasePointerCapture(d.pointer) } entry.visible = visible; entry.root.classList.toggle('is-visible', visible); entry.root.setAttribute('aria-hidden', String(!visible)); entry.root.inert = !visible; layout() },
        destroy() { if (entry.drag?.handle.hasPointerCapture(entry.drag.pointer)) entry.drag.handle.releasePointerCapture(entry.drag.pointer); config.handles.forEach(handle => { handle.removeEventListener('pointerdown', onDown); handle.removeEventListener('keydown', onKey) }); observer?.unobserve(entry.root); entries.delete(entry.id); entry.root.remove(); layout() },
      }
    },
    destroy() { if (destroyed) return; destroyed = true; observer?.disconnect(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); window.removeEventListener('resize', onResize); window.visualViewport?.removeEventListener('resize', onResize); stack.remove(); probe.remove(); entries.clear() },
  }
}
