import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNotePulse } from './note-pulse.ts'

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('createNotePulse', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts, rises, and returns to rest', async () => {
    const updates: number[] = []
    const pulse = createNotePulse((progress) => updates.push(progress), false)

    pulse.again()
    expect(updates.at(-1)).toBe(0)
    await wait(180)
    expect(updates.some((progress) => progress > 0)).toBe(true)
    await wait(450)
    expect(updates.at(-1)).toBe(0)
    expect(updates.every((progress) => progress >= 0 && progress <= 1)).toBe(true)
    pulse.stop()
  })

  it('restarts a pulse from rest without accumulating active timelines', async () => {
    const updates: number[] = []
    const pulse = createNotePulse((progress) => updates.push(progress), false)

    pulse.again()
    await wait(160)
    const previousUpdateCount = updates.length
    pulse.again()
    expect(updates.at(-1)).toBe(0)
    await wait(180)
    expect(updates.length).toBeGreaterThan(previousUpdateCount + 1)
    expect(updates.at(-1)).toBeGreaterThan(0)
    pulse.stop()
  })

  it('seeks into the remaining pulse window for a delayed onset', () => {
    const updates: number[] = []
    const pulse = createNotePulse((progress) => updates.push(progress), false)

    pulse.again(250)

    expect(updates.at(-1)).toBeGreaterThan(0)
    expect(updates.at(-1)).toBeLessThan(1)
    pulse.stop()
  })

  it('does not start a pulse after its 500 ms window has elapsed', () => {
    const onUpdate = vi.fn()
    const pulse = createNotePulse(onUpdate, false)

    pulse.again(500)

    expect(onUpdate).not.toHaveBeenCalled()
    pulse.stop()
  })

  it('omits updates when reduced motion is enabled', () => {
    const onUpdate = vi.fn()
    const pulse = createNotePulse(onUpdate, true)

    pulse.again()
    expect(onUpdate).not.toHaveBeenCalled()
    pulse.stop()
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(0)
  })

  it('stops idempotently at rest and prevents later updates', async () => {
    const updates: number[] = []
    const pulse = createNotePulse((progress) => updates.push(progress), false)

    pulse.again()
    await wait(100)
    pulse.stop()
    expect(updates.at(-1)).toBe(0)
    const stoppedUpdateCount = updates.length
    pulse.stop()
    pulse.again()
    await wait(100)
    expect(updates).toHaveLength(stoppedUpdateCount)
  })
})
