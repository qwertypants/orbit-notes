# Guitar and piano HUD review and repair plan

Verdict: request changes. Implementation reviewed statically; 200 tests pass and production build passes. Browser appearance, contrast, clipping, and touch behavior remain unverified; do not treat this review as visual acceptance.

## Required findings

1. Wrong root emphasis after relative-minor selection (`src/visualization/instrument-notes.ts:22`). Root markers compare against `selection.root` (the major-circle selection), while minor selections resolve their actual tonic in `resolved.root`. A minor reached from C can therefore emphasize C instead of A on both instruments. Compare with the resolved tonic and add literal A-minor expectations for both instruments, plus major, custom, and deselected-root cases.

2. Guitar reference can be mistaken for a playable chord shape (`src/visualization/instrument-svg.ts:34-52`, `src/visualization/instrument-hud.ts:25`). It displays every matching pitch across six strings, often multiple markers on one string, without a visible explanation. Add brief visible copy: “Note locations · standard tuning · frets 0–4; not a chord fingering.” Identify high E/string 1 and low E/string 6 visibly. Retain the correct top-to-bottom E B G D A E orientation.

3. Root styling lacks an accessible explanation (`src/visualization/instrument-svg.ts:16-52`). SVG descriptions list selected pitches/positions but do not identify the tonic or explain its outline. Provide a visible root legend and include the resolved root in the accessible description, with explicit behavior when the root is deselected. Clarify that piano keys represent pitch classes across C–C, not the register or voicing of playback.

4. Accuracy coverage is too narrow (`src/visualization/instrument-notes.test.ts`, `src/visualization/instrument-svg.test.ts`). Only C locations and open E receive literal location checks. The spelling test mostly compares the renderer with its own shared helper. The test titled “escapes note labels” supplies no escapable input. Add independent literal fixtures covering all twelve pitch classes, every string/fret, black-key grouping, enharmonic spellings, and relative-minor roots. Rename or replace the misleading escaping test with meaningful boundary coverage.

## Confirmed correct from source

- Piano maps thirteen successive semitones C–C to eight white and five black keys; black keys sit between C/D, D/E, F/G, G/A, A/B, with none between E/F or B/C.
- Guitar pitch classes follow standard tuning and chromatic fret increments. Dots lie between nut/fret lines, with open notes outside the nut.
- Both references use the canonical state-aware spelling helper and active selection. They are deliberately display-only and do not promise playback synchronization.
- No new external data flow, dependencies, or obvious injection/performance blocker was identified in these rendering paths. Rendering is bounded to 13 keys/30 positions.

## Implementation and acceptance sequence

1. Correct resolved-tonic mapping and add focused regression tests.
2. Add the instrument scope/orientation copy and root legend; keep descriptions consistent with visible meaning.
3. Strengthen independent pitch and SVG geometry fixtures. Verify literal expected notes rather than deriving expected values from production helpers.
4. Run the full suite and production build.
5. Inspect actual rendered HUDs on desktop and a 320px phone viewport: C major, A minor from the relative-minor ring, an accidental-heavy selection, chromatic and empty selections. Confirm readable labels (currently SVG text is only 8–9 units at a 224-unit width), double accidentals fit within 16-unit guitar dots/17-unit black keys, root indicators remain recognizable, and toggles/dragging/stacking do not obscure the reference. Enlarge labels/markers or adapt layout if inspection fails. Check keyboard and screen-reader descriptions. Record screenshots before accepting visual accuracy.

No implementation changes, commits, or pushes are included in this review.

## Execution result

Implemented with two scoped implementation agents and an independent read-only reviewer. Corrected resolved-tonic emphasis; added reference scope, orientation and root explanations; enlarged HUD labels and markers; added literal pitch/geometry/spelling regression fixtures. Independent review approved with no required code findings. Full suite: 223 passing; production build and diff whitespace check pass.

Browser inspected at 1280px desktop and 320px width with both references open. C-major labels, white root outlines, string numbering, keyboard grouping, and reference copy render correctly; both HUD bounds fit the narrow viewport without overlapping each other. Screenshots recorded in browser artifacts. Remaining acceptance limits: accidental-heavy/empty/chromatic cases are covered by automated fixtures, but were not each visually inspected; physical touch dragging and screen-reader output were not tested. No commit or push performed.
