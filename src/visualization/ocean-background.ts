import gsap from 'gsap'

type Drift = {
  from: { x: number; y: number; scale: number; opacity: number }
  to: { x: number; y: number; scale: number; opacity: number }
  duration: number
}

// Each field drifts and crossfades on its own clock so the blended color keeps
// shifting. Only transform and opacity animate, which stays on the compositor.
const drifts: Drift[] = [
  { from: { x: -4, y: -3, scale: 1, opacity: .55 }, to: { x: 7, y: 6, scale: 1.14, opacity: .78 }, duration: 26 },
  { from: { x: 5, y: -2, scale: 1.06, opacity: .48 }, to: { x: -6, y: 8, scale: .9, opacity: .7 }, duration: 33 },
  { from: { x: -3, y: 4, scale: .95, opacity: .46 }, to: { x: 6, y: -6, scale: 1.12, opacity: .66 }, duration: 29 },
  { from: { x: 4, y: 3, scale: 1, opacity: .44 }, to: { x: -7, y: -5, scale: 1.1, opacity: .62 }, duration: 37 },
]

const layerMarkup = `
  <span class="ocean-blob ocean-blob--a"></span>
  <span class="ocean-blob ocean-blob--b"></span>
  <span class="ocean-blob ocean-blob--c"></span>
  <span class="ocean-blob ocean-blob--d"></span>
  <span class="ocean-surface"></span>
  <span class="ocean-veil"></span>
`

export function mountOceanBackground(): { destroy(): void } {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const layer = document.createElement('div')
  layer.className = 'ocean'
  layer.setAttribute('aria-hidden', 'true')
  layer.innerHTML = layerMarkup
  document.body.prepend(layer)

  const blobs = [...layer.querySelectorAll<HTMLElement>('.ocean-blob')]
  const surface = layer.querySelector<HTMLElement>('.ocean-surface')
  const tweens: gsap.core.Tween[] = []
  let disposed = false
  let running = false

  function start(): void {
    if (disposed || running || preference.matches || document.hidden) return
    running = true
    blobs.forEach((blob, index) => {
      const drift = drifts[index]
      if (!drift) return
      gsap.set(blob, { xPercent: drift.from.x, yPercent: drift.from.y, scale: drift.from.scale, opacity: drift.from.opacity })
      tweens.push(gsap.to(blob, {
        xPercent: drift.to.x, yPercent: drift.to.y, scale: drift.to.scale, opacity: drift.to.opacity,
        duration: drift.duration, repeat: -1, yoyo: true, ease: 'sine.inOut',
      }))
    })
    if (surface) {
      gsap.set(surface, { opacity: .55, scale: 1 })
      tweens.push(gsap.to(surface, {
        opacity: .95, scale: 1.08, duration: 18, repeat: -1, yoyo: true, ease: 'sine.inOut',
      }))
    }
  }

  function stop(): void {
    running = false
    tweens.forEach((tween) => tween.kill())
    tweens.length = 0
    // Drop inline drift styles so the fields rest at their CSS base placement.
    gsap.set([...blobs, ...(surface ? [surface] : [])], { clearProps: 'all' })
  }

  function sync(): void {
    if (document.hidden || preference.matches) stop()
    else start()
  }

  start()
  document.addEventListener('visibilitychange', sync)
  preference.addEventListener('change', sync)

  function destroy(): void {
    if (disposed) return
    disposed = true
    stop()
    document.removeEventListener('visibilitychange', sync)
    preference.removeEventListener('change', sync)
    layer.remove()
  }

  return { destroy }
}