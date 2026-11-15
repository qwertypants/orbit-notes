export type HudRect = { left: number; top: number; width: number; height: number }
export type HudPoint = Pick<HudRect, 'left' | 'top'>

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function overlaps(a: HudRect, b: HudRect, gap = 8): boolean {
  return a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
    && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top
}

function candidates(size: Pick<HudRect, 'width' | 'height'>, bounds: HudRect, occupied: readonly HudRect[], gap: number, desired?: HudPoint): HudRect[] {
  const maxX = bounds.left + bounds.width - size.width
  const maxY = bounds.top + bounds.height - size.height
  if (maxX < bounds.left || maxY < bounds.top) return []
  const xs = new Set([bounds.left, maxX])
  const ys = new Set([bounds.top, maxY, bounds.top + (bounds.height - size.height) / 2])
  if (desired) {
    xs.add(clamp(desired.left, bounds.left, maxX))
    ys.add(clamp(desired.top, bounds.top, maxY))
  }
  for (const obstacle of occupied) {
    xs.add(clamp(obstacle.left - size.width - gap, bounds.left, maxX))
    xs.add(clamp(obstacle.left + obstacle.width + gap, bounds.left, maxX))
    ys.add(clamp(obstacle.top - size.height - gap, bounds.top, maxY))
    ys.add(clamp(obstacle.top + obstacle.height + gap, bounds.top, maxY))
  }
  return [...xs].flatMap(left => [...ys].map(top => ({ left, top, width: size.width, height: size.height })))
}

export function placeHud(desired: HudRect, bounds: HudRect, occupied: readonly HudRect[], gap = 8): HudRect | undefined {
  if (desired.width > bounds.width || desired.height > bounds.height) return undefined
  const clamped = { ...desired,
    left: clamp(desired.left, bounds.left, bounds.left + bounds.width - desired.width),
    top: clamp(desired.top, bounds.top, bounds.top + bounds.height - desired.height),
  }
  return candidates(desired, bounds, occupied, gap, clamped)
    .filter(rect => occupied.every(obstacle => !overlaps(rect, obstacle, gap)))
    .sort((a, b) => ((a.left - clamped.left) ** 2 + (a.top - clamped.top) ** 2)
      - ((b.left - clamped.left) ** 2 + (b.top - clamped.top) ** 2) || a.top - b.top || a.left - b.left)[0]
}

export function moveHud(from: HudRect, toward: HudPoint, bounds: HudRect, occupied: readonly HudRect[], gap = 8): HudRect {
  const start = { ...from }
  const maxX = bounds.left + bounds.width - from.width
  const maxY = bounds.top + bounds.height - from.height
  const end = { left: clamp(toward.left, bounds.left, maxX), top: clamp(toward.top, bounds.top, maxY) }
  const dx = end.left - start.left, dy = end.top - start.top
  let safeTime = 1
  for (const obstacle of occupied) {
    const minX = obstacle.left - from.width - gap, maxForbiddenX = obstacle.left + obstacle.width + gap
    const minY = obstacle.top - from.height - gap, maxForbiddenY = obstacle.top + obstacle.height + gap
    const slab = (origin: number, delta: number, min: number, max: number): [number, number] | undefined => {
      if (delta === 0) return origin > min && origin < max ? [-Infinity, Infinity] : undefined
      const a = (min - origin) / delta, b = (max - origin) / delta
      return [Math.min(a, b), Math.max(a, b)]
    }
    const x = slab(start.left, dx, minX, maxForbiddenX), y = slab(start.top, dy, minY, maxForbiddenY)
    if (!x || !y) continue
    const entry = Math.max(x[0], y[0], 0), exit = Math.min(x[1], y[1], 1)
    if (entry < exit) safeTime = Math.min(safeTime, Math.max(0, entry))
  }
  let result = { ...from, left: start.left + dx * safeTime, top: start.top + dy * safeTime }
  if (occupied.some(obstacle => overlaps(result, obstacle, gap))) {
    const epsilon = 1e-7
    result.left = start.left + dx * Math.max(0, safeTime - epsilon)
    result.top = start.top + dy * Math.max(0, safeTime - epsilon)
  }
  return result
}

export function packHuds(sizes: readonly Pick<HudRect, 'width' | 'height'>[], bounds: HudRect, gap = 8): HudRect[] | undefined {
  if (sizes.length > 3 || sizes.some(size => size.width > bounds.width || size.height > bounds.height)) return undefined
  const result: (HudRect | undefined)[] = Array(sizes.length)
  const order = sizes.map((size, index) => ({ size, index })).sort((a, b) => b.size.width * b.size.height - a.size.width * a.size.height)
  const search = (depth: number): boolean => {
    if (depth === order.length) return true
    const { size, index } = order[depth]
    const placed = result.filter((rect): rect is HudRect => rect !== undefined)
    const options = candidates(size, bounds, placed, gap).filter(rect => placed.every(other => !overlaps(rect, other, gap)))
      .sort((a, b) => a.top - b.top || a.left - b.left)
    for (const rect of options) {
      result[index] = rect
      if (search(depth + 1)) return true
    }
    result[index] = undefined
    return false
  }
  return search(0) ? result as HudRect[] : undefined
}
