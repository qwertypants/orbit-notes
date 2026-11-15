import { describe, expect, it } from 'vitest'
import { moveHud, overlaps, packHuds, placeHud, type HudRect } from './hud-layout.ts'

describe('HUD layout geometry', () => {
  it('finds space without changing an occupied HUD', () => {
    const bounds = { left: 16, top: 16, width: 288, height: 536 }
    const circle = { left: 16, top: 16, width: 204, height: 204 }
    const original = { ...circle }
    const placed = placeHud({ left: 16, top: 16, width: 240, height: 124 }, bounds, [circle])!
    expect(placed.top).toBe(228)
    expect(overlaps(placed, circle)).toBe(false)
    expect(circle).toEqual(original)
  })

  it('stops at the boundary when a pointer jumps across an obstacle', () => {
    const from = { left: 16, top: 16, width: 100, height: 100 }
    const blocker = { left: 16, top: 200, width: 100, height: 100 }
    const result = moveHud(from, { left: 16, top: 450 }, { left: 16, top: 16, width: 300, height: 600 }, [blocker])
    expect(result.top).toBeCloseTo(92)
    expect(overlaps(result, blocker)).toBe(false)
  })

  it('packs three HUDs and preserves input order', () => {
    const sizes = [{ width: 204, height: 204 }, { width: 240, height: 124 }, { width: 240, height: 172 }]
    const result = packHuds(sizes, { left: 16, top: 16, width: 288, height: 536 })!
    expect(result).toHaveLength(3)
    for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) expect(overlaps(result[i], result[j])).toBe(false)
    expect(result.map(({ width, height }) => [width, height])).toEqual(sizes.map(({ width, height }) => [width, height]))
  })

  it('handles exact gap contact, rejects smaller gaps, and returns no fit', () => {
    const a = { left: 0, top: 0, width: 10, height: 10 }, b = { left: 17, top: 0, width: 10, height: 10 }
    expect(overlaps(a, { ...b, left: 18 }, 8)).toBe(false)
    expect(overlaps(a, b, 8)).toBe(true)
    expect(overlaps(a, b, 7)).toBe(false)
    expect(placeHud({ left: 0, top: 0, width: 20, height: 20 }, { left: 0, top: 0, width: 10, height: 10 }, [])).toBeUndefined()
    expect(packHuds([{ width: 30, height: 30 }], { left: 0, top: 0, width: 20, height: 20 })).toBeUndefined()
  })

  it('does not tunnel diagonally and honors asymmetric bounds', () => {
    const obstacle = { left: 100, top: 100, width: 50, height: 50 }
    const from = { left: 0, top: 0, width: 40, height: 40 }
    const bounds = { left: 10, top: 20, width: 240, height: 220 }
    const result = moveHud(from, { left: 200, top: 180 }, bounds, [obstacle])
    expect(result.left).toBeGreaterThanOrEqual(bounds.left)
    expect(result.top).toBeGreaterThanOrEqual(bounds.top)
    expect(overlaps(result, obstacle)).toBe(false)
  })

  it('keeps every sampled movement point clear and within asymmetric bounds', () => {
    const bounds = { left: 10, top: 20, width: 300, height: 260 }
    const obstacles: HudRect[] = [{ left: 100, top: 90, width: 70, height: 80 }, { left: 220, top: 180, width: 55, height: 40 }]
    const starts = [{ left: 20, top: 30 }, { left: 180, top: 30 }, { left: 20, top: 210 }]
    const targets = [{ left: 260, top: 230 }, { left: 25, top: 230 }, { left: 270, top: 25 }]
    for (const origin of starts) for (const target of targets) {
      const from = { ...origin, width: 30, height: 30 }
      const result = moveHud(from, target, bounds, obstacles)
      for (let step = 0; step <= 100; step++) {
        const t = step / 100
        const sample = { ...from, left: from.left + (result.left - from.left) * t, top: from.top + (result.top - from.top) * t }
        expect(sample.left).toBeGreaterThanOrEqual(bounds.left)
        expect(sample.top).toBeGreaterThanOrEqual(bounds.top)
        expect(sample.left + sample.width).toBeLessThanOrEqual(bounds.left + bounds.width)
        expect(sample.top + sample.height).toBeLessThanOrEqual(bounds.top + bounds.height)
        expect(obstacles.some(obstacle => overlaps(sample, obstacle))).toBe(false)
      }
    }
  })
})
