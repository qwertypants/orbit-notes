export type HudStop = 'top-left' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-right'

export type HudPosition = {
  readonly left: number
  readonly top: number
}

export type HudInsets = {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export const hudStops: readonly HudStop[] = [
  'top-left',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-right',
]

const defaultInset = 16

function normalizeInsets(insets: number | HudInsets): HudInsets {
  if (typeof insets === 'number') {
    const uniform = Math.max(0, insets)
    return { top: uniform, right: uniform, bottom: uniform, left: uniform }
  }

  return {
    top: Math.max(0, insets.top),
    right: Math.max(0, insets.right),
    bottom: Math.max(0, insets.bottom),
    left: Math.max(0, insets.left),
  }
}

function positionForStop(
  stop: HudStop,
  viewportWidth: number,
  viewportHeight: number,
  hudWidth: number,
  hudHeight: number,
  insets: HudInsets,
): HudPosition {
  const left = insets.left
  const right = Math.max(insets.left, viewportWidth - hudWidth - insets.right)
  const top = insets.top
  const bottom = Math.max(insets.top, viewportHeight - hudHeight - insets.bottom)
  const middle = Math.max(insets.top, (insets.top + viewportHeight - insets.bottom - hudHeight) / 2)

  switch (stop) {
    case 'top-left':
      return { left, top }
    case 'top-right':
      return { left: right, top }
    case 'middle-left':
      return { left, top: middle }
    case 'middle-right':
      return { left: right, top: middle }
    case 'bottom-left':
      return { left, top: bottom }
    case 'bottom-right':
      return { left: right, top: bottom }
  }
}

export function getHudStopPosition(
  stop: HudStop,
  viewportWidth: number,
  viewportHeight: number,
  hudWidth: number,
  hudHeight: number,
  insets: number | HudInsets = defaultInset,
): HudPosition {
  return positionForStop(stop, viewportWidth, viewportHeight, hudWidth, hudHeight, normalizeInsets(insets))
}

export function nearestHudStop(
  left: number,
  top: number,
  viewportWidth: number,
  viewportHeight: number,
  hudWidth: number,
  hudHeight: number,
  insets: number | HudInsets = defaultInset,
): HudStop {
  const safeInsets = normalizeInsets(insets)
  let nearest = hudStops[0]
  let nearestDistance = Number.POSITIVE_INFINITY

  hudStops.forEach((stop) => {
    const position = positionForStop(stop, viewportWidth, viewportHeight, hudWidth, hudHeight, safeInsets)
    const horizontalDistance = left - position.left
    const verticalDistance = top - position.top
    const distance = horizontalDistance * horizontalDistance + verticalDistance * verticalDistance
    if (distance < nearestDistance) {
      nearest = stop
      nearestDistance = distance
    }
  })

  return nearest
}

function isHudStop(value: string | null): value is HudStop {
  return value !== null && hudStops.includes(value as HudStop)
}

export function readHudStop(storage: Pick<Storage, 'getItem'>, key: string): HudStop | undefined {
  const savedStop = storage.getItem(key)
  return isHudStop(savedStop) ? savedStop : undefined
}

export function writeHudStop(storage: Pick<Storage, 'setItem'>, key: string, stop: HudStop): void {
  storage.setItem(key, stop)
}
