# Note Circle Selection Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add short, magical selection effects to the note circle while leaving its note layout, playback, and audio-reactive spectrum behavior intact.

**Architecture:** Add pure animation helpers for progress, changed notes, and affected links, then consume them only inside the p5 note-circle renderer. The renderer will run its draw loop only while a transition or the existing spectrum visualization is active and will redraw the final state without motion under reduced-motion preferences.

**Tech Stack:** TypeScript, p5.js, Vitest, existing `ExplorerState` and `NoteCircle` interfaces.

## Global Constraints

- “Keep p5.js as the renderer and keep the current note coordinates, labels, hit targets, and relationship geometry fixed.”
- “Drive selection effects from the existing `NoteCircle.update(state)` path so canvas taps and accessible note buttons receive the same animation.”
- “Do not add a permanently running animation loop.”
- “With `prefers-reduced-motion: reduce`, skip halos' transitions, line drawing, and ripples; redraw the final state once.”
- Do not change topic selection, note selection, playback behavior, audio synthesis, or the existing FFT feed.
- Add no animation dependency.

---

## File structure

- `src/visualization/selection-animation.ts`: pure helpers for changed pitch classes, connection diffing, clamped transition progress, and easing.
- `src/visualization/selection-animation.test.ts`: focused Vitest coverage for those helpers.
- `src/visualization/note-circle.ts`: transition lifecycle and p5 rendering of soft halos, briefly drawn affected links, and a single-note ripple.

## Task 1: Model short selection transitions

**Files:**
- Create: `src/visualization/selection-animation.ts`
- Test: `src/visualization/selection-animation.test.ts`

**Interfaces:**
- Produce `changedNotes(previous: readonly PitchClass[], next: readonly PitchClass[]): PitchClass[]` with deterministic pitch-class order.
- Produce `changedConnections(previous: readonly CircleLink[], next: readonly CircleLink[]): { added: CircleLink[]; removed: CircleLink[]; unchanged: CircleLink[] }`, treating a link as undirected and sorting output deterministically.
- Produce `transitionProgress(startedAtMs: number, nowMs: number, durationMs: number): number`, clamped from 0 to 1.
- Produce `easeOutCubic(progress: number): number`, clamped to 0–1 and equal to `1 - (1 - progress) ** 3`.

Use this key when diffing links so reverse endpoint order still matches:

```ts
type CircleLink = { from: PitchClass; to: PitchClass }

function linkKey(link: CircleLink): string {
  const low = Math.min(link.from, link.to)
  const high = Math.max(link.from, link.to)
  return `${low}:${high}`
}
```

The changed-note helper must be stable regardless of the input order:

```ts
export function changedNotes(previous: readonly PitchClass[], next: readonly PitchClass[]): PitchClass[] {
  const oldSet = new Set(previous)
  const nextSet = new Set(next)
  return [...new Set([...previous, ...next])]
    .filter((note) => oldSet.has(note) !== nextSet.has(note))
    .sort((left, right) => left - right)
}
```

- [x] Write tests showing `changedNotes([0, 4], [0, 7])` returns `[4, 7]`; unchanged input returns an empty array; and order does not depend on input array order.
- [x] Write tests showing `changedConnections([{ from: 0, to: 4 }, { from: 4, to: 7 }], [{ from: 7, to: 4 }, { from: 0, to: 7 }])` returns `{ added: [{ from: 0, to: 7 }], removed: [{ from: 0, to: 4 }], unchanged: [{ from: 4, to: 7 }] }` after canonicalizing output endpoints.
- [x] Write tests showing transition progress clamps before/after the interval and easing starts at 0 and ends at 1.
- [x] Use assertions equivalent to `expect(changedNotes([0, 4], [0, 7])).toEqual([4, 7])`, `expect(transitionProgress(100, 100, 320)).toBe(0)`, and `expect(easeOutCubic(1)).toBe(1)`.
- [x] Run `npm run test -- src/visualization/selection-animation.test.ts`; confirm it fails because the helpers do not exist yet.
- [x] Implement the four small pure helpers with no p5 or DOM dependency.
- [x] Re-run the focused test command and confirm it passes.
- [x] Commit these files as `feat: model note selection transitions`.

## Task 2: Render and retire selection effects

**Files:**
- Modify: `src/visualization/note-circle.ts`
- Use: `src/visualization/selection-animation.ts`

**Interfaces:**
- Keep the public `NoteCircle.update(nextState: ExplorerState): void` interface unchanged.
- Keep `startSpectrum`, `stopSpectrum`, `destroy`, and the current `NoteCircle` setup unchanged in behavior.
- Store transition state privately in `mountNoteCircle`; do not add fields to `ExplorerState`.

Use a local transition record with `startedAtMs`, changed notes, added/removed/unchanged links, and an optional `rippleNote`. A ripple note is present only when exactly one pitch class changed. For each frame derive eased progress from `performance.now()` and the helper functions; do not write animation values back to explorer state.

- [x] Capture the previous explorer state and visible connection list in `update`, calculate changed notes and connection diffs, and start a short 320 ms transition only when reduced motion is off and the topic is unchanged. Topic changes redraw directly so the existing topic-specific note positions/styles do not animate or drift.
- [x] When exactly one note changed, remember that note for one ripple. For multi-note topic/root/preset changes, animate affected note and link states without emitting multiple ripples.
- [x] Add a soft, low-alpha halo behind changed note circles. Fade selected halos in and deselected halos out using `easeOutCubic`; do not scale or move note circles, text, or hit areas.
- [x] Draw added connections from their start point to their final endpoint as progress advances; fade removed connections out; keep unchanged connections fully drawn.
- [x] Draw one subtle expanding, fading ripple at the changed note's fixed point; skip it when no single note changed.
- [x] In the p5 draw loop, continue while either the selection transition or existing audio spectrum is active. When selection motion ends, stop looping if spectrum visualization is not active; when spectrum goes silent, stop looping if no selection transition remains.
- [x] Under reduced motion, discard transition state and redraw the final selection once. Preserve the existing behavior when the OS motion preference changes during playback.
- [x] Manually review the draw lifecycle to ensure `stopSpectrum`, `startSpectrum`, `update`, and reduced-motion changes cannot leave a stale loop running or stop the spectrum loop prematurely.
- [x] Run `npm run test`, `npm run check`, `npm run build`, and `git diff --check`.
- [x] Commit as `feat: animate note selection in the circle`.

## Checkpoint: Complete

- [x] Unit tests cover helper boundaries and changed-link detection.
- [x] TypeScript check and production build pass.
- [x] Source review confirms selection effects settle and leave p5 idle; playback FFT continues unchanged.
- [x] Source review confirms reduced-motion mode redraws final state with no transition or ripple.
- [ ] Inspect rendered animations at phone and desktop widths in a browser; the browser host is unavailable in this session, so timing and visual subtlety remain unverified.
