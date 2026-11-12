# Note Circle Animation Design

## Goal

Make note selection feel magical and tactile while keeping the circle calm when it is idle. Preserve all existing note, topic, playback, and spectrum behavior.

## Approved direction

Use a soft constellation treatment:

- A selected note's halo fades in; a deselected note's halo fades out.
- Connections affected by a selection change briefly draw into their final positions.
- The interacted note emits one small, expanding ripple.
- Effects settle quickly and stop. There is no idle animation or orbiting particle layer.
- The existing live FFT ring remains the only animation driven by sound.

## Rendering and state

- Keep p5.js as the renderer and keep the current note coordinates, labels, hit targets, and relationship geometry fixed.
- Drive selection effects from the existing `NoteCircle.update(state)` path so canvas taps and accessible note buttons receive the same animation.
- Compare the previous and next active-note sets to animate only changed notes and their affected connections.
- Use a short easing window (roughly 250–400 ms) and stop the p5 draw loop as soon as the transition finishes. Do not add a permanently running animation loop.
- Keep animation state local to the circle renderer; do not alter `ExplorerState`, theory resolution, or Tone.js playback.

## Accessibility and behavior

- With `prefers-reduced-motion: reduce`, skip halos' transitions, line drawing, and ripples; redraw the final state once.
- Do not move notes or labels, alter their hit areas, cover note names, or delay selection and playback.
- Keep the existing spectrum animation and its reduced-motion behavior unchanged.

## Verification

- Add focused unit coverage for transition progress/easing and for identifying changed notes/connections.
- Run the focused tests, TypeScript check, and production build.
- Inspect selection and deselection effects at phone and desktop widths, verify the canvas becomes idle after each transition, and check reduced-motion behavior in a browser. Record if real-device validation is unavailable.

## Scope boundaries

- No ambient shimmer, continuous particle motion, color-system redesign, sound changes, control changes, or changes to note geometry.
- No new animation dependency.
