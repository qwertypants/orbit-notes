# Implementation Plan: Circular Music Theory Explorer

## Overview

Build a colorful, mobile-first browser tool for freely exploring music theory through a circular note map. Users choose a topic such as chords, scales, arpeggios, or the circle of fifths, select notes by touch, see their relationships, and hear selected notes together or in sequence. The circle itself shows note names only; optional explanations live in a separate learning panel. Use p5.js for the visualization and Tone.js for sound. The workspace is currently empty, so implementation begins with a small application scaffold.

## Product decisions

- Make the circle the primary interactive surface, with large touch targets and responsive sizing.
- Keep theory prose and controls outside the circle. The diagram displays note names and visual relationships.
- Provide free exploration through a topic menu; do not require a fixed lesson sequence.
- Support both chord playback and sequential/arpeggiated playback.
- Keep the initial theory model focused and accurate: twelve pitch classes, enharmonic spellings, interval sets, common chord qualities, scale patterns, and fifth relationships.
- Treat audio startup as user initiated to satisfy browser audio policies; provide a clear retry path if audio cannot start.

## Architecture direction

- Start with a lightweight TypeScript web app scaffold (Vite unless workspace tooling or user preference dictates otherwise).
- Keep theory data and transformations in a UI-independent module so the circle and learning panel use the same source of truth.
- Wrap p5 in a focused visualization component; send it selected topic, root, note set, and interaction callbacks rather than embedding theory rules in drawing code.
- Keep Tone.js lifecycle in an audio module that lazily starts the audio context, plays a selected set as a chord or sequence, and stops/disposes prior playback when selections change.
- Use semantic HTML controls around the canvas for topic selection, playback mode, and accessible operation; do not make canvas the only way to use core controls.

## Task List

### Phase 1: Foundation and theory model

#### Task 1: Scaffold the responsive app

**Description:** Establish the smallest runnable app with TypeScript, p5.js, Tone.js, a mobile-first page shell, and a clear separation between app UI, theory data, audio, and visualization.

**Acceptance criteria:**
- [ ] App runs locally and renders a phone-sized layout without horizontal overflow.
- [ ] p5.js and Tone.js are installed and isolated behind app modules/components.
- [ ] Main controls can be operated with touch and keyboard; canvas has an accessible description or equivalent text representation.

**Verification:** Run the project build and inspect the page at narrow and desktop widths; confirm focus order and keyboard activation for controls.

**Dependencies:** None.

**Files likely touched:** app scaffold/configuration, page shell, styles, package manifest.

**Estimated scope:** Medium.

#### Task 2: Implement pitch and relationship primitives

**Description:** Model the twelve pitch classes, note spelling/display, semitone and interval relationships, chord templates, scale patterns, and circle-of-fifths ordering independently of UI code.

**Acceptance criteria:**
- [ ] Root transposition produces correct note sets for common major/minor triads, seventh chords, and common scales.
- [ ] Circle-of-fifths neighbors and enharmonic equivalents are represented consistently.
- [ ] Each topic can produce a stable set of selected notes and relationship metadata for rendering and playback.

**Verification:** Add focused automated checks for pitch-class wraparound, transposition, chord/scale membership, and fifth ordering; run them and the build.

**Dependencies:** Task 1.

**Files likely touched:** theory model/types and focused tests.

**Estimated scope:** Medium.

### Checkpoint: Foundation

- [ ] App scaffold builds at mobile and desktop breakpoints.
- [ ] Theory primitives have focused coverage for transposition and note membership.
- [ ] Agree that initial topic set and note spelling are suitable before extending the explorer.

### Phase 2: Explore and hear

#### Task 3: Build the interactive circular note view

**Description:** Render twelve touch-friendly note positions in a circular layout and connect/highlight notes according to the chosen topic. Support selecting a root and toggling notes, with clear visual states and restrained note-name labels.

**Acceptance criteria:**
- [ ] Circle resizes to phone and desktop viewports while keeping note hit targets usable on touch.
- [ ] Selecting a root or note updates the theory state and highlights membership/relationships without placing explanatory prose on the circle.
- [ ] Chord, scale, arpeggio, and fifths topics each have a distinct, understandable visual pattern.
- [ ] Core selection is also reachable through accessible controls for keyboard and assistive technology users.

**Verification:** Build and manually inspect touch-sized and desktop layouts; verify selecting and deselecting notes updates the visual state and accessible controls.

**Dependencies:** Tasks 1 and 2.

**Files likely touched:** p5 visualization, explorer UI, responsive styles, interaction checks.

**Estimated scope:** Large; split into canvas rendering and interaction wiring if it exceeds one focused session.

#### Task 4: Add chord and arpeggio playback

**Description:** Add a clear playback-mode control and use Tone.js to play the selected pitches simultaneously or sequentially, with safe audio startup, stop/retrigger behavior, and manageable instrument/timbre defaults.

**Acceptance criteria:**
- [ ] User gesture starts audio and plays the currently selected notes as a chord or arpeggio.
- [ ] Changing or replaying selections does not leave stuck notes, overlapping stale sequences, or undisposed audio nodes.
- [ ] Audio startup failure is visible and recoverable; stopping playback works immediately.

**Verification:** Run focused audio lifecycle checks (including rejected audio-context startup if practical), build, and manually audition chord and arpeggio playback in a browser.

**Dependencies:** Tasks 2 and 3.

**Files likely touched:** Tone.js audio module, playback controls, focused tests.

**Estimated scope:** Medium.

### Checkpoint: Core exploration

- [ ] User can choose a topic, manipulate its notes, and see relationships update on the circle.
- [ ] Both playback modes match the visible notes and can be stopped/retriggered cleanly.
- [ ] Review on a real phone or touch device for target size, layout, and audio activation behavior.

### Phase 3: Learn and polish

#### Task 5: Add the optional theory panel and topic menu

**Description:** Provide a topic menu for free exploration and an optional, separate panel that explains the currently selected chord, scale, arpeggio, or fifth relationship using the same theory model as the circle.

**Acceptance criteria:**
- [ ] User can jump directly among chord, scale, arpeggio, and circle-of-fifths exploration.
- [ ] Panel can be opened/closed without obscuring the main circle on mobile.
- [ ] Explanations identify note names and relationships accurately and remain outside the circle visualization.
- [ ] Explorer state (root, topic, selected notes, playback mode) stays coherent when moving between topics.

**Verification:** Check topic switching and panel open/close at phone width and desktop; verify displayed names and membership against the theory model.

**Dependencies:** Tasks 2 and 3.

**Files likely touched:** topic menu, learning panel/content, responsive styles, interaction checks.

**Estimated scope:** Medium.

#### Task 6: Refine the visual language and accessibility

**Description:** Tune the color system, selected/related note states, motion, and responsive composition so the tool feels playful while retaining clear contrast and usable controls.

**Acceptance criteria:**
- [ ] Color distinguishes root, selected notes, and relationships without relying on color alone.
- [ ] Reduced-motion preferences are respected and animated spectrum feedback does not obscure note relationships.
- [ ] Text and control contrast, focus states, and touch targets are usable at mobile widths.
- [ ] The circular view remains the visual focus; learning copy stays in its panel.

**Verification:** Review keyboard navigation, reduced-motion behavior, contrast, and phone layout; run the full project build and relevant checks.

**Dependencies:** Tasks 3, 4, and 5.

**Files likely touched:** visualization styles/animation, page styles, accessibility checks.

**Estimated scope:** Medium.

### Checkpoint: Complete

- [ ] Chords, scales, arpeggios, and circle-of-fifths exploration work on mobile and desktop.
- [ ] Chord and arpeggio playback are reliable and synchronized to selection.
- [ ] Optional explanations match the visualized theory.
- [ ] Build and focused checks pass; manual mobile and audio review is recorded.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Enharmonic spelling and theory edge cases make labels inconsistent | High | Define explicit spelling rules and test transposition and membership before connecting UI. |
| Canvas interactions are difficult on small screens or inaccessible | High | Use generous touch targets and parallel semantic controls; verify phone layout early. |
| Browser audio requires a user gesture or may fail to start | Medium | Start audio only on an explicit playback gesture and expose a retryable state. |
| Continuous spectrum effects compete with note relationships | Medium | Treat spectrum as subtle feedback; keep note positions and relationship lines visually stable. |
| “Everything” in music theory exceeds a first release | High | Deliver the core topic model and make topic data extensible; add advanced theory as later topics. |

## Decisions made during implementation

- Use the existing flat display spelling for pitch classes, and spell named chord/scale tones from the root and diatonic degree so interval labels agree with note names.
- Show a subtle live Tone.js FFT ring only during playback; keep note positions and relationship lines stable. Respect reduced-motion preferences with a static spectrum snapshot.
- The initial free-exploration topics include common triads and seventh chords, major/natural-minor/pentatonic scales, arpeggios, and the circle of fifths. The topic model remains extensible for later music theory topics.
- Fifths playback stays within one octave while keeping fifth order, so it does not climb through an impractical register.

## Verification limits

- Unit tests, TypeScript checks, and production builds pass.
- Rendered phone/desktop layout, in-browser keyboard/touch behavior, live audible playback/FFT, and physical-device behavior could not be checked because the browser host was unavailable during this implementation session.
