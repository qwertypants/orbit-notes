# Cultural catalog update report

## Status

Completed the follow-up catalog update. Replaced the Ryukyuan and Hindustani starter entries with Romanian Bihor, Chinese C gōng, and Arab maqām ʿAjam examples. Kept all entries as scales and added no arpeggios.

## Catalog entries

- **Bihor hemitonic pentatonic (F–G–B–C–D)** — intervals `[0, 2, 6, 7, 9]`; degrees `1, 2, ♯4, 5, 6`. The context identifies this as one Bihor-region example rather than a national Romanian system, and distinguishes the source’s modal cadence and melodic discussion from the app’s pitch-set playback. Reference: Adrian Roşu, “Types of modal cadences in Romanian folklore” (2023), p. 370, Figure 3, https://icc-online.arte-ct.ro/vol_09/34.pdf.
- **C gōng mode** — intervals `[0, 2, 4, 7, 9]`; degrees `1, 2, 3, 5, 6`. Copy identifies this specifically as C gōng, not all Chinese music, and notes that the dissertation’s traditional pitch derivation is not identical to equal temperament. Reference: Yannan Li, *Cross-Cultural Synthesis in Chen Qigang’s Piano Composition*, Figure 2 and pp. 10–12, https://www.digitalgreensboro.org/record/12444/files/td_3292_PDF.pdf.
- **Maqām ʿAjam on C** — intervals `[0, 2, 4, 5, 7, 9, 11]`; degrees `1, 2, 3, 4, 5, 6, 7`. Copy explains this entry stores only the pitch collection and omits the maqām’s characteristic motifs and traditional practice. Reference: Al-Ghawanmeh et al., “Arab music improvisation corpus for research (AMICOR): development and machine translation experiments” (2026), §2.1, Figure 1, https://link.springer.com/article/10.1007/s10579-026-09905-z.

Every catalog source is marked as supporting the specific pattern. No arpeggio is included because the reviewed sources do not document a suitable tradition-specific arpeggio for this collection.

## Implementation and verification

Updated the catalog and hard-coded theory tests for pattern IDs, labels, collections, attribution, and representation limits. Added the `♯4` to `TT` interval mapping in `music-theory.ts`; the Bihor entry exposed that the existing resolver had no mapping for this degree, so it could not resolve the new catalog data without that minimal adjustment. Selection, playback, UI, and styling contracts were otherwise left intact.

- Focused theory tests: 4 files passed, 47 tests passed.
- `npm test`: 11 files passed, 104 tests passed.
- `npm run check`: passed.
- `npm run build`: passed. Vite emitted existing dependency comment-annotation and large-chunk warnings.
- `git diff --check`: passed.

## Scope

Only the catalog, its named hard-coded theory tests, and the minimal interval-degree mapping were changed. The unrelated untracked `.ignore` file was left untouched. No push or publication was performed.

## Citation correction

Corrected the Romanian reference from the PDF’s internal line/page numbering to the published pagination: the Bihor pitch set is on p. 370, Figure 3 (published pp. 369–375). Updated the catalog citation and entry above. The focused catalog test and `git diff --check` passed. Commit: `Correct Romanian catalog citation`.

## Root transposition clarification

Updated each representation note to identify the source reference root: F reproduces the listed Bihor F–G–B–C–D notes, while C reproduces the listed Chinese C gōng and maqām ʿAjam examples. Each note now says that selecting another app root transposes the source pitch set. Added focused assertions for all three notes. The UI and resolver behavior remain unchanged. Focused catalog tests and `git diff --check` passed.
