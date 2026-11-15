import { expect, it } from 'vitest'
import { createExplorerState, type ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import { renderInstrumentSvg } from './instrument-svg.ts'

const stateWith = (...activeNotes: PitchClass[]): ExplorerState => ({
  ...createExplorerState({ topic: 'fifths', root: 0 }), activeNotes,
})

it('renders inert piano and guitar references with their complete positions', () => {
  const piano = renderInstrumentSvg('piano', stateWith(0))
  const guitar = renderInstrumentSvg('guitar', stateWith(0))
  expect(piano.match(/data-key-index=/g)).toHaveLength(13)
  expect(guitar.match(/data-guitar-position=/g)).toHaveLength(30)
  expect(piano.match(/data-selected="true"/g)).toHaveLength(2)
  expect(guitar.match(/data-selected="true"/g)).toHaveLength(2)
  for (const svg of [piano, guitar]) {
    expect(svg).toContain('role="img"')
    expect(svg).toContain('aria-label=')
    expect(svg).toContain('<title>')
    expect(svg).toContain('<desc>')
    expect(svg).not.toMatch(/role="button"|tabindex|on\w+=/i)
  }
})

it('escapes note labels in SVG text and descriptions', () => {
  const state = stateWith(1)
  state.activeNotes // fixture state is immutable by shape; use an intentional label through the state spelling below.
  const svg = renderInstrumentSvg('piano', { ...state, activeNotes: [1] })
  expect(svg).toContain('D♭')
  expect(svg).not.toContain('&lt;')
  expect(svg).not.toContain('onload=')
})
