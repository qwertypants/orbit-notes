import type { PitchClass } from '../theory/music-theory.ts'

export type CircleLink = { from: PitchClass; to: PitchClass }

export type ConnectionDiff = {
  added: CircleLink[]
  removed: CircleLink[]
  unchanged: CircleLink[]
}

/** Return pitch classes whose membership differs, sorted in chromatic order. */
export function changedNotes(previous: readonly PitchClass[], next: readonly PitchClass[]): PitchClass[] {
  const previousSet = new Set(previous)
  const nextSet = new Set(next)
  return [...new Set([...previous, ...next])]
    .filter((note) => previousSet.has(note) !== nextSet.has(note))
    .sort((left, right) => left - right)
}

function canonicalLink(link: CircleLink): CircleLink {
  return link.from <= link.to
    ? { from: link.from, to: link.to }
    : { from: link.to, to: link.from }
}

function linkKey(link: CircleLink): string {
  return `${link.from}:${link.to}`
}

function canonicalLinks(links: readonly CircleLink[]): Map<string, CircleLink> {
  const result = new Map<string, CircleLink>()
  links.forEach((link) => {
    const canonical = canonicalLink(link)
    result.set(linkKey(canonical), canonical)
  })
  return result
}

function sortLinks(links: CircleLink[]): CircleLink[] {
  return links.sort((left, right) => left.from - right.from || left.to - right.to)
}

/** Compare undirected links and return canonical, deterministic endpoint order. */
export function changedConnections(previous: readonly CircleLink[], next: readonly CircleLink[]): ConnectionDiff {
  const previousLinks = canonicalLinks(previous)
  const nextLinks = canonicalLinks(next)

  const added = [...nextLinks].filter(([key]) => !previousLinks.has(key)).map(([, link]) => link)
  const removed = [...previousLinks].filter(([key]) => !nextLinks.has(key)).map(([, link]) => link)
  const unchanged = [...nextLinks].filter(([key]) => previousLinks.has(key)).map(([, link]) => link)

  return {
    added: sortLinks(added),
    removed: sortLinks(removed),
    unchanged: sortLinks(unchanged),
  }
}

function clampProgress(progress: number): number {
  if (Number.isNaN(progress)) return 0
  return Math.max(0, Math.min(1, progress))
}

/** Return elapsed transition progress clamped to its start/end bounds. */
export function transitionProgress(startedAtMs: number, nowMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1
  return clampProgress((nowMs - startedAtMs) / durationMs)
}

/** Ease a clamped transition progress value with a cubic ease-out curve. */
export function easeOutCubic(progress: number): number {
  const clamped = clampProgress(progress)
  return 1 - (1 - clamped) ** 3
}
