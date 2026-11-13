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
    id: 'ryukyu-song-scale',
    traditionId: 'ryukyuan-song',
    traditionName: 'Ryukyuan song traditions',
    region: 'Ryukyu Archipelago, especially Okinoerabu through Yaeyama',
    name: 'Ryukyu song scale',
    kind: 'scale',
    intervals: [0, 4, 5, 7, 11],
    degrees: ['1', '3', '4', '5', '7'],
    context: 'The Ryukyu scale is one scale type found in Ryukyuan songs. Other scale types also occur across the islands; this example does not represent every local song tradition.',
    representationNote: 'This equal-tempered example follows the pitch collection in the source’s score figure. Playback omits nuclear-tone emphasis, vocal inflection and song-specific melodic movement; it does not reproduce a traditional performance or its tuning.',
    sources: [
      {
        title: 'Yuri Nishikawa and Yasuo Ihara, Exploring factors for melodic diversification of folk songs in the Ryukyu Archipelago (2025), Figure 1(a)',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12516598/',
        supportsPattern: true,
      },
    ],
  },
  {
    id: 'bhupali-svara-set',
    traditionId: 'hindustani-raga',
    traditionName: 'Hindustani rāga',
    region: 'Northern Indian subcontinent',
    name: 'Bhūpālī, ascending svara set',
    kind: 'scale',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['1', '2', '3', '5', '6'],
    context: 'Bhūpālī uses Sa, Re, Ga, Pa and Dha. Ga has particular prominence. Its phrasing and treatment of notes distinguish it from rāgas that share these pitches.',
    representationNote: 'This equal-tempered example plays only the ascending pitch collection once within an octave. The degree numbers describe the app’s pitch mapping. Playback omits rāga-specific intonation, ornaments, note emphasis and melodic grammar; it is not a rendition of Bhūpālī.',
    sources: [
      {
        title: 'Achintya Prahlad, Quantifying Alpatva (Scarcity) and Bahutva (Abundance), AAWM 11/1 (2023), Table 1 and §18',
        url: 'https://journal.iftawm.org/previous/2023-volume-11-no-1/prahlad/',
        supportsPattern: true,
      },
    ],
  },
]

export function findTraditionPattern(id: string): TraditionPattern | undefined {
  return traditionPatterns.find((pattern) => pattern.id === id)
}
