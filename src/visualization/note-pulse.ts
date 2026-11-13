import gsap from 'gsap'

export type NotePulse = {
  again(elapsedMs?: number): void
  stop(): void
}

const RISE_SECONDS = 0.12
const FADE_SECONDS = 0.38

/** Create an event-triggered pulse that rises quickly and settles within half a second. */
export function createNotePulse(
  onUpdate: (progress: number) => void,
  reducedMotion: boolean,
): NotePulse {
  const state = { progress: 0 }
  let timeline: gsap.core.Timeline | undefined
  let stopped = false

  const report = () => onUpdate(state.progress)

  return {
    again(elapsedMs = 0) {
      if (stopped || reducedMotion || elapsedMs >= (RISE_SECONDS + FADE_SECONDS) * 1000) return

      timeline?.kill()
      state.progress = 0
      report()
      timeline = gsap.timeline({
        onUpdate: report,
        onComplete: () => {
          state.progress = 0
          report()
          timeline = undefined
        },
      })
        .to(state, {
          progress: 1,
          duration: RISE_SECONDS,
          ease: 'power2.out',
          overwrite: 'auto',
        })
        .to(state, {
          progress: 0,
          duration: FADE_SECONDS,
          ease: 'power2.inOut',
          overwrite: 'auto',
        })

      if (elapsedMs > 0) timeline.totalTime(elapsedMs / 1000)
    },
    stop() {
      if (stopped) return
      stopped = true
      timeline?.kill()
      timeline = undefined
      state.progress = 0
      report()
    },
  }
}
