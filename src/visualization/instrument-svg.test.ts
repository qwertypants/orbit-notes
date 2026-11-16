import { expect, it } from 'vitest'
import { createExplorerState, selectRelativeMinor, type ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import { renderInstrumentSvg } from './instrument-svg.ts'

const stateWith = (...activeNotes: PitchClass[]): ExplorerState => ({
  ...createExplorerState({ topic: 'fifths', root: 0 }), activeNotes,
})

it('renders piano and interactive guitar references with their complete positions', () => {
  const piano = renderInstrumentSvg('piano', stateWith(0))
  const guitar = renderInstrumentSvg('guitar', stateWith(0))
  expect(piano.match(/data-key-index=/g)).toHaveLength(13)
  expect(guitar.match(/data-guitar-position=/g)).toHaveLength(30)
  expect(piano.match(/data-selected="true"/g)).toHaveLength(2)
  expect(guitar.match(/data-selected="true"/g)).toHaveLength(2)
  for (const svg of [piano, guitar]) {
    expect(svg).toContain('role="group"')
    expect(svg).toContain('aria-label=')
    expect(svg).toContain('<title>')
    expect(svg).toContain('<desc>')
    expect(svg).not.toMatch(/on\w+=/i)
  }
})

it('renders canonical enharmonic labels and an explicit selected-root explanation', () => {
  const svg = renderInstrumentSvg('piano', stateWith(1))
  expect(svg).toContain('D♭</text>')
  expect(svg).toContain('Root C is not selected; no root outline.')
  expect(svg).toContain('not the register or voicing of playback')
})

it('describes the resolved A-minor root and its absence after deselection', () => {
  const minor = selectRelativeMinor(createExplorerState({ topic: 'fifths', root: 0 }), 9)
  for (const kind of ['piano', 'guitar'] as const) {
    expect(renderInstrumentSvg(kind, minor)).toContain('White outline: root A.')
    expect(renderInstrumentSvg(kind, { ...minor, activeNotes: [] })).toContain('Root A is not selected; no root outline.')
  }
})

it('places black piano keys between the correct white-key pairs', () => {
  const svg = renderInstrumentSvg('piano', stateWith())
  const blackKeys = [...svg.matchAll(/data-key-index="(\d+)"[^>]*><rect class="piano-key piano-key--black" x="([\d.]+)" y="1" width="21" height="45"/g)]
  expect(blackKeys.map((match) => [Number(match[1]), Number(match[2])])).toEqual([
    [1, 17.5], [3, 45.5], [6, 101.5], [8, 129.5], [10, 157.5],
  ])
  const whiteKeys = [...svg.matchAll(/data-key-index="(\d+)"[^>]*><rect class="piano-key piano-key--white" x="(\d+)"/g)]
  expect(whiteKeys.map((match) => [Number(match[1]), Number(match[2])])).toEqual([
    [0, 0], [2, 28], [4, 56], [5, 84], [7, 112], [9, 140], [11, 168], [12, 196],
  ])
})

it('keeps guitar markers between fret lines and identifies string orientation', () => {
  const svg = renderInstrumentSvg('guitar', stateWith(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11))
  const positions = [...svg.matchAll(/data-guitar-position="(\d)-(\d)"[^>]*><ellipse class="guitar-note-dot" cx="(\d+)" cy="(\d+)" rx="12" ry="10"/g)]
  expect(positions.map((match) => [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])])).toEqual(
    [28, 52, 76, 100, 124, 148].flatMap((y, row) => [28, 65, 107, 149, 191].map((x, fret) => [row + 1, fret, x, y])),
  )
  expect(svg).toContain('Top: high E, string 1. Bottom: low E, string 6.')
  expect(svg).toContain('not a chord fingering')
  expect(svg).toContain('>1 E</text>')
  expect(svg).toContain('>6 E</text>')
})

it('fits double-accidental labels inside black keys and guitar markers', () => {
  const base = createExplorerState({ topic: 'chords', root: 1, preset: 'major' })
  const state: ExplorerState = {
    ...base,
    activeNotes: [3],
    resolved: { ...base.resolved, notes: [{ ...base.resolved.notes[0], pitchClass: 3, degree: '3' }] },
  }
  expect(renderInstrumentSvg('piano', state)).toContain('textLength="18" lengthAdjust="spacingAndGlyphs">F𝄫</text>')
  expect(renderInstrumentSvg('guitar', state)).toContain('textLength="21" lengthAdjust="spacingAndGlyphs">F𝄫</text>')
})

it('highlights one representative position per sounding note independently of selection', () => {
  for (const kind of ['piano', 'guitar'] as const) {
    const svg = renderInstrumentSvg(kind, stateWith(), new Set<PitchClass>([0, 4]))
    expect(svg.match(/data-playing="true"/g)).toHaveLength(2)
    expect(renderInstrumentSvg(kind, stateWith(0, 4))).not.toContain('data-playing="true"')
    if (kind === 'piano') {
      expect(svg).toMatch(/data-key-index="0"[^>]*data-playing="true"/)
      expect(svg).toMatch(/data-key-index="12"[^>]*data-playing="false"/)
    } else {
      expect(svg).toMatch(/data-guitar-position="2-1"[^>]*data-playing="true"/)
      expect(svg).toMatch(/data-guitar-position="1-0"[^>]*data-playing="true"/)
      expect(svg).toMatch(/data-guitar-position="6-0"[^>]*data-playing="false"/)
    }
  }
})

it('makes only labeled open and fretted guitar positions keyboard controls', () => {
  const svg = renderInstrumentSvg('guitar', stateWith(4))
  const groups = [...svg.matchAll(/<g (data-guitar-note[^>]+)>(.*?)<\/g>/g)]
  expect(groups.length).toBeGreaterThan(0)
  for (const [, attributes, children] of groups) {
    expect(attributes).toContain('data-guitar-note="4"')
    expect(attributes).toContain('role="button" tabindex="0"')
    expect(attributes).toMatch(/aria-label="Play E, string [1-6], fret [0-4]"/)
    expect(children).toContain('instrument-note-label')
  }
  expect(svg).toContain('Play E, string 1, fret 0')
  expect(svg).toContain('Play E, string 2, fret 5'.replace('2, fret 5', '4, fret 2'))
  expect(svg).toMatch(/<g data-guitar-position="1-1"[^>]+\/>/)
  expect(renderInstrumentSvg('piano', stateWith(4))).not.toContain('data-guitar-note')
})


it('makes highlighted white and black piano keys accessible note controls', () => {
  const svg = renderInstrumentSvg('piano', stateWith(0, 1))
  const controls = [...svg.matchAll(/<g ([^>]*data-piano-note[^>]*)>/g)]
  expect(controls).toHaveLength(3)
  for (const [, attributes] of controls) {
    expect(attributes).toContain('role="button" tabindex="0"')
    expect(attributes).toMatch(/aria-label="Play (C|D♭)"/)
    expect(attributes).toContain('data-selected="true"')
  }
  expect(svg).toMatch(/data-key-index="2"[^>]*data-selected="false"/)
  expect(renderInstrumentSvg('piano', stateWith())).not.toContain('data-piano-note')
})
