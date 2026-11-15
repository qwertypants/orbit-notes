import type { ExplorerState } from '../explorer-state.ts'
import { renderInstrumentSvg } from './instrument-svg.ts'
import type { InstrumentKind } from './instrument-notes.ts'
import type { HudCoordinator, HudRegistration } from './hud-coordinator.ts'

export type InstrumentHud = { update(state: ExplorerState): void; destroy(): void }

export function mountInstrumentHud(options: {
  kind: InstrumentKind
  initialState: ExplorerState
  toggle: HTMLButtonElement
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
  header.append(title, handle)
  const content = document.createElement('div')
  content.className = 'instrument-hud__content'
  content.innerHTML = renderInstrumentSvg(kind, options.initialState)
  root.append(header, content)
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
  syncToggle()

  let destroyed = false
  return {
    update(state) {
      if (!destroyed) content.innerHTML = renderInstrumentSvg(kind, state)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      toggle.removeEventListener('click', onToggle)
      placement.destroy()
      root.remove()
      visible = false
      syncToggle()
    },
  }
}
