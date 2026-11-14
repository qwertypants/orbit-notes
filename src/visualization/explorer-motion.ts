import gsap from 'gsap'
import type { PitchClass } from '../theory/music-theory.ts'

const itemSelector = '.wordmark, .topbar-note, .circle-play-button, .circle-caption, .controls, .controls > *, .audio-status, .footer'
const controlSelector = 'button:not(:disabled), .segmented label:has(input:not(:disabled)), summary'

export function mountExplorerMotion(root: HTMLElement) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const listeners = new AbortController()
  const entrances = new Map<HTMLElement, gsap.core.Tween>()
  const presses = new Map<HTMLElement, gsap.core.Tween>()
  const lights = new Map<HTMLElement, gsap.core.Tween>()
  const waiting = new Set<HTMLElement>()
  const circleHost = root.querySelector<HTMLElement>('#note-circle')!
  const circleWrap = root.querySelector<HTMLElement>('.circle-wrap')!
  let disposed = false
  let circleEntranceAllowed = document.documentElement.dataset.orbitBoot === 'pending'
  let sweep: gsap.core.Timeline | undefined

  const orbit = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  orbit.setAttribute('viewBox', '0 0 100 100')
  orbit.setAttribute('aria-hidden', 'true')
  orbit.classList.add('orbit-wake')
  orbit.innerHTML = `
    <circle cx="50" cy="50" r="42.5" pathLength="1" stroke-width="1.2" opacity=".12" />
    <circle cx="50" cy="50" r="42.5" pathLength="1" stroke-width=".35" opacity=".5" />
    <circle cx="50" cy="50" r="42.5" pathLength="1" stroke-width=".2" stroke-dasharray=".025 1" />
  `

  function clearItem(element: HTMLElement): void {
    element.style.removeProperty('--orbit-alpha')
    element.style.removeProperty('--orbit-lift')
    delete element.dataset.orbitItem
  }

  function reveal(element: HTMLElement, delay = 0): void {
    if (disposed) return
    observer.unobserve(element)
    waiting.delete(element)
    entrances.get(element)?.kill()
    if (preference.matches || document.hidden) {
      clearItem(element)
      entrances.delete(element)
      return
    }
    element.dataset.orbitItem = ''
    entrances.set(element, gsap.fromTo(element,
      { '--orbit-alpha': 0, '--orbit-lift': element === circleHost ? '0px' : '10px' },
      {
        '--orbit-alpha': 1, '--orbit-lift': '0px', duration: .55, delay,
        ease: 'power3.out', overwrite: 'auto',
        onComplete: () => { clearItem(element); entrances.delete(element) },
      },
    ))
  }

  function sweepOrbit(): void {
    if (disposed || preference.matches || document.hidden) return
    sweep?.kill()
    sweep = gsap.timeline({ onComplete: () => { orbit.removeAttribute('style'); sweep = undefined } })
      .fromTo(orbit, { rotation: -110, opacity: 0 }, { rotation: 250, opacity: .85, duration: .85, ease: 'power2.inOut', overwrite: 'auto' })
      .to(orbit, { opacity: 0, duration: .35, overwrite: 'auto' }, '-=.25')
  }

  function clearPlayback(): void {
    lights.forEach((tween, element) => {
      tween.kill()
      element.style.removeProperty('--note-light')
    })
    lights.clear()
  }

  function settle(): void {
    circleEntranceAllowed = false
    observer.disconnect()
    canvasObserver.disconnect()
    waiting.forEach(clearItem)
    waiting.clear()
    entrances.forEach((tween, element) => { tween.kill(); clearItem(element) })
    entrances.clear()
    presses.forEach((tween, element) => { tween.kill(); element.style.removeProperty('--press-scale') })
    presses.clear()
    clearPlayback()
    sweep?.kill()
    sweep = undefined
    orbit.removeAttribute('style')
    document.documentElement.dataset.orbitBoot = 'settled'
  }

  const observer = new IntersectionObserver((entries) => {
    let delay = 0
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting && target instanceof HTMLElement && waiting.has(target)) {
        reveal(target, delay)
        delay += .035
      }
    })
  }, { threshold: .08 })

  const canvasObserver = new MutationObserver(() => {
    const canvas = circleHost.querySelector('canvas')
    if (!canvas) return
    canvasObserver.disconnect()
    // The renderer reserves a square before its lazy-loaded canvas is ready.
    if (!circleEntranceAllowed || preference.matches || document.hidden) return
    reveal(circleHost)
    sweepOrbit()
  })

  function destroy(): void {
    if (disposed) return
    disposed = true
    listeners.abort()
    canvasObserver.disconnect()
    settle()
    orbit.remove()
  }

  try {
    circleWrap.append(orbit)
    const boot = document.documentElement.dataset.orbitBoot
    if (!preference.matches && !document.hidden && boot === 'pending') {
      root.querySelectorAll<HTMLElement>(itemSelector).forEach((element) => {
        if (element.hidden) return
        element.dataset.orbitItem = ''
        element.style.setProperty('--orbit-alpha', '0')
        waiting.add(element)
        observer.observe(element)
      })
      // Prepare every start value before releasing the first-paint gate.
      document.documentElement.dataset.orbitBoot = 'running'
    } else {
      document.documentElement.dataset.orbitBoot = 'settled'
    }
    window.dispatchEvent(new Event('orbit:motion-ready'))
    canvasObserver.observe(circleHost, { childList: true })

    root.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const control = target.closest<HTMLElement>(controlSelector)
      if (!control || preference.matches || document.hidden) return
      // Note buttons are replaced by the state render; animate the current node.
      const note = control.dataset.note
      queueMicrotask(() => {
        if (disposed || preference.matches || document.hidden) return
        const current = note === undefined ? control : root.querySelector<HTMLElement>(`button[data-note="${note}"]`)
        if (!current?.isConnected) return
        presses.get(current)?.kill()
        presses.set(current, gsap.fromTo(current, { '--press-scale': .94 }, {
          '--press-scale': 1, duration: .48, ease: 'elastic.out(1, .5)', overwrite: 'auto',
          onComplete: () => { current.style.removeProperty('--press-scale'); presses.delete(current) },
        }))
      })
    }, { signal: listeners.signal })

    root.addEventListener('focusin', (event) => {
      if (!(event.target instanceof Element)) return
      const target = event.target
      // Keyboard focus must never land inside an invisible entrance.
      for (const element of [...waiting, ...entrances.keys()]) {
        if (element.contains(target)) {
          observer.unobserve(element)
          waiting.delete(element)
          entrances.get(element)?.kill()
          entrances.delete(element)
          clearItem(element)
        }
      }
    }, { signal: listeners.signal })

    root.querySelector<HTMLDetailsElement>('.theory-panel')?.addEventListener('toggle', (event) => {
      const panel = event.target
      if (!(panel instanceof HTMLDetailsElement) || !panel.open) return
      panel.querySelectorAll<HTMLElement>('.theory-tabs, .theory-content:not([hidden])').forEach((element) => reveal(element))
    }, { signal: listeners.signal })

    preference.addEventListener('change', settle, { signal: listeners.signal })
    window.addEventListener('pagehide', settle, { signal: listeners.signal })
    document.addEventListener('visibilitychange', () => { if (document.hidden) settle() }, { signal: listeners.signal })
  } catch (error) {
    destroy()
    throw error
  }

  return {
    reveal,
    sweepOrbit,
    clearPlayback,
    pulseNote(note: PitchClass) {
      if (disposed || preference.matches || document.hidden) return
      const button = root.querySelector<HTMLElement>(`button[data-note="${note}"]`)
      if (!button) return
      lights.get(button)?.kill()
      lights.set(button, gsap.fromTo(button, { '--note-light': 1 }, {
        '--note-light': 0, duration: .5, ease: 'power2.out', overwrite: 'auto',
        onComplete: () => { button.style.removeProperty('--note-light'); lights.delete(button) },
      }))
    },
    destroy,
  }
}
