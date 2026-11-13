import type { PitchClass, TopicSelection } from './music-theory.ts'

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
 * The initial arpeggio is a sourced Western major-triad example; no non-Western
 * arpeggio is included because the consulted sources did not document a suitable pattern.
 * Javanese gamelan awaits support for ensemble-specific tuning.
 */
export const traditionPatterns: readonly TraditionPattern[] = [
  {
    id: 'western-major-scale',
    traditionId: 'western-tonal-theory',
    traditionName: 'Western tonal theory',
    region: 'Common-practice tradition',
    name: 'Major scale',
    kind: 'scale',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
    context: 'A familiar major-scale pattern built from whole and half steps. This is a compact Western starting point, not a summary of every Western tradition.',
    representationNote: 'This equal-tempered example is rooted at the selected app note; choosing another root transposes the scale.',
    sources: [
      {
        title: 'Open Music Theory, Scales and scale degrees, “The major scale”',
        url: 'https://open-musictheory.github.io/docs/fundamentals/scales/',
        supportsPattern: true,
      },
    ],
  },
  {
    id: 'western-major-triad-arpeggio',
    traditionId: 'western-tonal-theory',
    traditionName: 'Western tonal theory',
    region: 'Common-practice tradition',
    name: 'Major triad arpeggio',
    kind: 'arpeggio',
    intervals: [0, 4, 7],
    degrees: ['1', '3', '5'],
    context: 'The major-key tonic triad contains do, mi and sol. Here those chord tones are played in ascending order as an arpeggio.',
    representationNote: 'This equal-tempered example plays the major triad from the selected app root. Choosing another root transposes it.',
    sources: [
      {
        title: 'Open Music Theory, Triads and seventh chords, “Triad qualities” and “Triads in every major key”',
        url: 'https://openmusictheory.github.io/triads.html',
        supportsPattern: true,
      },
      {
        title: 'The Open University, Voice-leading analysis of music 1, §3.4.1 “Arpeggiation”',
        url: 'https://www.open.edu/openlearn/history-the-arts/music/voice-leading-analysis-music-1-the-foreground/content-section-3.4.1',
        supportsPattern: true,
      },
    ],
  },
  {
    id: 'bihor-hemitonic-pentatonic',
    traditionId: 'romanian-folklore',
    traditionName: 'Romanian folklore',
    region: 'Bihor region, Romania',
    name: 'Bihor hemitonic pentatonic (F–G–B–C–D)',
    kind: 'scale',
    intervals: [0, 2, 6, 7, 9],
    degrees: ['1', '2', '♯4', '5', '6'],
    context: 'This is one pitch collection found in Bihor-region melodies, not a national Romanian system. A note sequence alone cannot capture its modal cadences or melodic behavior.',
    representationNote: 'At the named F reference root, this equal-tempered example reproduces F–G–B–C–D. Selecting another app root transposes that set. It represents one Bihor example, not a traditional performance.',
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
    context: 'This example is specifically the C gōng mode, not a representation of all Chinese music. The five-tone system includes five named modes.',
    representationNote: 'At the named C reference root, this equal-tempered example reproduces C–D–E–G–A. Selecting another app root transposes that set. Historical pitch derivation may differ from the equal temperament this app uses for playback.',
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
    context: 'A maqām includes characteristic melodic motifs and traditional note use, beyond a scale. This entry shows only the ascending pitch collection for maqām ʿAjam on C.',
    representationNote: 'At the named C reference root, this equal-tempered example reproduces the ascending pitch set. Selecting another app root transposes that set. Playback does not reproduce maqām ʿAjam’s characteristic melodic motifs or traditional practice.',
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

export function defaultPatternForTradition(traditionId: string): TraditionPattern | undefined {
  return traditionPatterns.find((pattern) => pattern.traditionId === traditionId)
}

export function selectionForTraditionPattern(patternId: string, root: PitchClass): {
  readonly pattern: TraditionPattern
  readonly selection: TopicSelection
} | undefined {
  const pattern = findTraditionPattern(patternId)
  if (!pattern) return undefined

  return {
    pattern,
    selection: {
      topic: pattern.kind === 'scale' ? 'scales' : 'arpeggios',
      root,
      culturalPatternId: pattern.id,
    },
  }
}

export function defaultSelectionForTradition(traditionId: string, root: PitchClass): {
  readonly pattern: TraditionPattern
  readonly selection: TopicSelection
} | undefined {
  const pattern = defaultPatternForTradition(traditionId)
  return pattern ? selectionForTraditionPattern(pattern.id, root) : undefined
}
