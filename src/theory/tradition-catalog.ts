export type TraditionPattern = {
  readonly id: string
  readonly traditionId: string
  readonly traditionName: string
  readonly region: string
  readonly name: string
  readonly kind: 'scale' | 'arpeggio'
  readonly intervals: readonly number[]
  readonly degrees: readonly string[]
  readonly context: string
  readonly representationNote: string
  readonly sources: readonly {
    readonly title: string
    readonly url: string
    /** True only when the reference documents this specific pattern and kind. */
    readonly supportsPattern: boolean
  }[]
}

/** Pitch collections for listening, not complete models of these traditions.
 * No arpeggios are included: the consulted sources do not document a suitable pattern.
 * Javanese gamelan awaits support for ensemble-specific tuning.
 */
export const traditionPatterns: readonly TraditionPattern[] = [
  {
    id: 'bihor-hemitonic-pentatonic',
    traditionId: 'romanian-folklore',
    traditionName: 'Romanian folklore',
    region: 'Bihor region, Romania',
    name: 'Bihor hemitonic pentatonic (F–G–B–C–D)',
    kind: 'scale',
    intervals: [0, 2, 6, 7, 9],
    degrees: ['1', '2', '♯4', '5', '6'],
    context: 'This is one pitch collection identified in Bihor-region melodies, not a national Romanian system. The source discusses modal cadences and melodic behavior; this app only plays the pitch set.',
    representationNote: 'This equal-tempered example stores the source’s F–G–B–C–D collection as root-relative intervals. It represents one Bihor example and does not reproduce modal cadence, melodic behavior, or a traditional performance.',
    sources: [
      {
        title: 'Adrian Roşu, Types of modal cadences in Romanian folklore (2023), p. 370, Fig. 3',
        url: 'https://icc-online.arte-ct.ro/vol_09/34.pdf',
        supportsPattern: true,
      },
    ],
  },
  {
    id: 'chinese-c-gong-mode',
    traditionId: 'chinese-traditional-music',
    traditionName: 'Chinese traditional music',
    region: 'China',
    name: 'C gōng mode',
    kind: 'scale',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['1', '2', '3', '5', '6'],
    context: 'This example is specifically the C gōng mode, not a representation of all Chinese music. The cited dissertation describes the five-tone system and its five modes.',
    representationNote: 'This equal-tempered example represents C–D–E–G–A. The dissertation notes that traditional pitch derivation is not identical to equal temperament, which this app uses for playback.',
    sources: [
      {
        title: 'Yannan Li, Cross-Cultural Synthesis in Chen Qigang’s Piano Composition (DMA dissertation), Figure 2 and pp. 10–12',
        url: 'https://www.digitalgreensboro.org/record/12444/files/td_3292_PDF.pdf',
        supportsPattern: true,
      },
    ],
  },
  {
    id: 'maqam-ajam-c',
    traditionId: 'arab-maqam',
    traditionName: 'Arab maqām tradition',
    region: 'Arab musical traditions',
    name: 'Maqām ʿAjam on C',
    kind: 'scale',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
    context: 'The source defines maqām as more than a scale, including characteristic motifs and traditional use. This entry captures only the pitch collection shown for ascending maqām ʿAjam on C.',
    representationNote: 'This equal-tempered example stores the ascending pitch collection only. Playback does not reproduce maqām ʿAjam’s characteristic melodic motifs or traditional practice.',
    sources: [
      {
        title: 'Al-Ghawanmeh et al., Arab music improvisation corpus for research (AMICOR): development and machine translation experiments (2026), §2.1, Figure 1',
        url: 'https://link.springer.com/article/10.1007/s10579-026-09905-z',
        supportsPattern: true,
      },
    ],
  },
]

export function findTraditionPattern(id: string): TraditionPattern | undefined {
  return traditionPatterns.find((pattern) => pattern.id === id)
}
