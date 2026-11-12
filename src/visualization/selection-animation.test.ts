import { describe, expect, it } from 'vitest'
import {
  changedConnections,
  changedNotes,
  easeOutCubic,
  transitionProgress,
} from './selection-animation.ts'

describe('changed notes', () => {
  it('returns notes added or removed in pitch-class order', () => {
    expect(changedNotes([0, 4], [0, 7])).toEqual([4, 7])
    expect(changedNotes([7, 0, 4], [7, 0])).toEqual([4])
    expect(changedNotes([0, 4], [4, 0])).toEqual([])
  })

  it('does not depend on input ordering or duplicates', () => {
    expect(changedNotes([7, 0, 4, 4], [7, 0, 7])).toEqual([4])
    expect(changedNotes([0, 4], [7, 0])).toEqual(changedNotes([4, 0], [0, 7]))
  })
})

describe('changed connections', () => {
  it('diffs undirected links and returns canonical endpoint ordering', () => {
    expect(changedConnections(
      [{ from: 0, to: 4 }, { from: 4, to: 7 }],
      [{ from: 7, to: 4 }, { from: 0, to: 7 }],
    )).toEqual({
      added: [{ from: 0, to: 7 }],
      removed: [{ from: 0, to: 4 }],
      unchanged: [{ from: 4, to: 7 }],
    })
  })

  it('sorts output links deterministically and ignores duplicate links', () => {
    expect(changedConnections(
      [{ from: 4, to: 7 }, { from: 0, to: 4 }, { from: 4, to: 0 }],
      [{ from: 7, to: 4 }, { from: 0, to: 7 }, { from: 7, to: 0 }],
    )).toEqual({
      added: [{ from: 0, to: 7 }],
      removed: [{ from: 0, to: 4 }],
      unchanged: [{ from: 4, to: 7 }],
    })
  })
})

describe('selection transition timing', () => {
  it('clamps progress before and after the transition interval', () => {
    expect(transitionProgress(100, 50, 320)).toBe(0)
    expect(transitionProgress(100, 100, 320)).toBe(0)
    expect(transitionProgress(100, 260, 320)).toBe(0.5)
    expect(transitionProgress(100, 500, 320)).toBe(1)
  })

  it('treats a non-positive duration as complete', () => {
    expect(transitionProgress(100, 100, 0)).toBe(1)
  })

  it('applies clamped ease-out cubic progress', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(0.5)).toBe(0.875)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(2)).toBe(1)
  })
})
