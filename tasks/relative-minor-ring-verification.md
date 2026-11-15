# Browser verification of 644399c

2026-11-15: Independent headless Chrome verification using Playwright against Vite on localhost:5175.

Screenshots: /tmp/ring-{320,375,430,1440}.png and /tmp/ring-hud-{320,375,430}.png. Main canvas CSS widths were 288, 343, 398, and 560px; compact HUD canvas was 280px. Inspected 320px main/HUD screenshots: all twelve minor labels visible, including accidentals. Other screenshots captured but not independently visually inspected.

Actual runtime checks: A minor announces A B C D E F G; E minor announces E F♯ G A B C D. Staff toggle renders its named treble-staff SVG. Root-next changes E minor to F minor. Play announces the F minor notes; selecting A minor stops playback and announces the new notes. Native select accepts keyboard events, but the attempted key sequence retained A; this does not prove keyboard selection changes. Mode transition result is recorded in /tmp/ring-results.txt.

Remaining gates: exhaustive keyboard selection, all twelve rendered text contrast/font measurements, canvas tap hit testing, reduced motion, staff SVG pitch inspection and playback scheduling inspection. Physical audible output unverified. At 320px document overflow was detected in fifths mode and needs isolation; no source fix was made without diagnosing its source. This is partial evidence, not completion of every plan gate.

No push. Unrelated .ignore preserved.

## Completion pass, 2026-11-15

Fixed the 320px overflow at its source: the rotated `.orbit-wake` SVG extended its square bounding box beyond `.circle-wrap`. Local paint clipping with a 4px margin contains that decoration without changing instrument HUD code or sizing. Added explicit ArrowUp/ArrowDown/Home/End selection to the semantic minor select; native keyboard automation previously left its value unchanged.

Actual Chrome/Playwright assertions now pass: focused select ArrowDown twice selects E minor (value 4); keyboard Enter activates each topic button; Chords, Scales, and Arpeggios hide minor controls, and returning to Fifths clears the minor selection. Staff SVG output was captured for Am and Em in `/tmp/final-ring-results.txt`, including each note's accessible pitch and notehead coordinates. Am renders A4 B4 C4 D4 E4 F4 G4; Em renders E4 F♯4 G4 A4 B4 C4 D4. These match selected pitch classes; octave wrapping is the existing pitch-class staff convention.

Document scroll width stays within viewport at 320, 375, 430, 768, and 1440 under both normal and reduced motion. Screenshots: `/tmp/final-ring-{no-preference,reduce}-{width}.png`. Visually inspected reduced-motion 320px screenshot: all twelve inner labels including accidentals readable, no clipping, staff and keyboard focus visible. Other screenshots captured for review. Ring text uses white on opaque #25283a, selected text #1e1623 on #fbbf77 (both exceed 4.5:1); actual main minimum font is 14px at 288px canvas, compact minimum 14px at 280px canvas. Reduced motion hides orbit decoration and disables HUD transitions in CSS.

Fresh validation: 21 test files / 200 tests passed; `npm run check` and `npm run build` passed (existing large-chunk and dependency annotation warnings). Physical audible output remains unverified. Instrument HUD features preserved. No push; unrelated `.ignore` and untracked plan preserved.
