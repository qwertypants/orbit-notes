import { describe, expect, it, vi } from 'vitest'
import { getHudStopPosition, hudStops, nearestHudStop, readHudStop, writeHudStop } from './hud-position.ts'

describe('HUD edge stops', () => {
  it.each([
    ['top-left', { left: 16, top: 16 }],
    ['top-right', { left: 254, top: 16 }],
    ['middle-left', { left: 16, top: 362 }],
    ['middle-right', { left: 254, top: 362 }],
    ['bottom-left', { left: 16, top: 708 }],
    ['bottom-right', { left: 254, top: 708 }],
  ] as const)('places %s inside the viewport safe inset', (stop, position) => {
    expect(getHudStopPosition(stop, 390, 844, 120, 120)).toEqual(position)
  })

  it('chooses the nearest edge stop after a drag', () => {
    expect(nearestHudStop(250, 18, 390, 844, 120, 120)).toBe('top-right')
  })

  it('keeps stops inside a viewport smaller than the HUD', () => {
    hudStops.forEach((stop) => {
      const position = getHudStopPosition(stop, 80, 90, 120, 120)
      expect(position.left).toBeGreaterThanOrEqual(16)
      expect(position.top).toBeGreaterThanOrEqual(16)
    })
  })

  it('uses asymmetric safe-area insets for edge and centered stops', () => {
    const insets = { top: 30, right: 22, bottom: 44, left: 18 }
    expect(getHudStopPosition('top-right', 390, 844, 120, 120, insets)).toEqual({ left: 248, top: 30 })
    expect(getHudStopPosition('bottom-left', 390, 844, 120, 120, insets)).toEqual({ left: 18, top: 680 })
    expect(getHudStopPosition('middle-left', 390, 844, 120, 120, insets)).toEqual({ left: 18, top: 355 })
    expect(nearestHudStop(245, 35, 390, 844, 120, 120, insets)).toBe('top-right')
  })

  it('ignores a missing or unknown saved stop and persists valid stops', () => {
    const getItem = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce('freeform')
    const setItem = vi.fn()
    expect(readHudStop({ getItem }, 'orbit.note-circle-hud.stop')).toBeUndefined()
    expect(readHudStop({ getItem }, 'orbit.note-circle-hud.stop')).toBeUndefined()
    writeHudStop({ setItem }, 'orbit.note-circle-hud.stop', 'middle-left')
    expect(setItem).toHaveBeenCalledWith('orbit.note-circle-hud.stop', 'middle-left')
  })
})
