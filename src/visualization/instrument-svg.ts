import { activeNotesInOrder, type ExplorerState } from '../explorer-state.ts'
import { noteLabelForState } from '../theory/learning-summary.ts'
import { guitarNotesForState, pianoNotesForState, type InstrumentKind } from './instrument-notes.ts'

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[character]!))
}

function summary(state: ExplorerState): string {
  return activeNotesInOrder(state).map((pitch) => noteLabelForState(state, pitch)).join(', ') || 'none'
}

function renderPiano(state: ExplorerState): string {
  const keys = pianoNotesForState(state)
  const whiteIndices = [0, 2, 4, 5, 7, 9, 11, 12]
  const blackIndices = [1, 3, 6, 8, 10]
  const white = whiteIndices.map((index, position) => {
    const key = keys[index]
    const x = position * 28
    const label = key.selected ? `<text class="instrument-note-label" x="${x + 14}" y="67" text-anchor="middle">${escapeXml(key.label)}</text>` : ''
    return `<g data-key-index="${index}" data-selected="${key.selected}" data-root="${key.root}"><rect class="piano-key piano-key--white" x="${x}" y="1" width="28" height="74"/>${label}</g>`
  }).join('')
  const black = blackIndices.map((index, position) => {
    const key = keys[index]
    const x = [19.5, 47.5, 103.5, 131.5, 159.5][position]
    const label = key.selected ? `<text class="instrument-note-label" x="${x + 8.5}" y="32" text-anchor="middle">${escapeXml(key.label)}</text>` : ''
    return `<g data-key-index="${index}" data-selected="${key.selected}" data-root="${key.root}"><rect class="piano-key piano-key--black" x="${x}" y="1" width="17" height="45"/>${label}</g>`
  }).join('')
  return `<svg class="instrument-svg instrument-svg--piano" viewBox="0 0 224 76" role="img" aria-label="Piano pitch-class reference, C through C, selected: ${escapeXml(summary(state))}"><title>Piano pitch-class reference</title><desc>One octave from C through the next C. Selected notes: ${escapeXml(summary(state))}.</desc>${white}${black}</svg>`
}

function renderGuitar(state: ExplorerState): string {
  const positions = guitarNotesForState(state)
  const rows = positions.filter((position) => position.fret === 0).map((open) => {
    const y = 22 + (open.string - 1) * 18
    const label = `<text class="guitar-string-label" x="9" y="${y + 3}" text-anchor="middle">${['E', 'A', 'D', 'G', 'B', 'E'][open.string - 1]}</text>`
    const openDot = open.selected ? `<g data-guitar-position="${open.string}-${open.fret}" data-selected="true" data-root="${open.root}"><circle class="guitar-note-dot" cx="28" cy="${y}" r="8"/><text class="instrument-note-label" x="28" y="${y + 3}" text-anchor="middle">${escapeXml(open.label)}</text></g>` : `<g data-guitar-position="${open.string}-${open.fret}" data-selected="false" data-root="false"/>`
    const frets = positions.filter((position) => position.string === open.string && position.fret > 0).map((position) => {
      const x = [65, 107, 149, 191][position.fret - 1]
      return position.selected
        ? `<g data-guitar-position="${position.string}-${position.fret}" data-selected="true" data-root="${position.root}"><circle class="guitar-note-dot" cx="${x}" cy="${y}" r="8"/><text class="instrument-note-label" x="${x}" y="${y + 3}" text-anchor="middle">${escapeXml(position.label)}</text></g>`
        : `<g data-guitar-position="${position.string}-${position.fret}" data-selected="false" data-root="false"/>`
    }).join('')
    return `${label}${openDot}${frets}`
  }).join('')
  const fretLabels = [1, 2, 3, 4].map((fret) => `<text class="guitar-fret-label" x="${[65, 107, 149, 191][fret - 1]}" y="10" text-anchor="middle">${fret}</text>`).join('')
  const strings = Array.from({ length: 6 }, (_, row) => `<line class="guitar-string" x1="44" y1="${22 + row * 18}" x2="212" y2="${22 + row * 18}"/>`).join('')
  const frets = [86, 128, 170, 212].map((x) => `<line class="guitar-fret" x1="${x}" y1="22" x2="${x}" y2="112"/>`).join('')
  return `<svg class="instrument-svg instrument-svg--guitar" viewBox="0 0 224 124" role="img" aria-label="Standard tuning guitar, open strings through fret 4, selected: ${escapeXml(summary(state))}"><title>Standard tuning guitar reference</title><desc>Standard tuning, open strings and frets 1 through 4. Selected positions: ${positions.filter((position) => position.selected).map((position) => `string ${position.string}, fret ${position.fret}, ${position.label}`).join('; ') || 'none'}.</desc>${fretLabels}${strings}<line class="guitar-nut" x1="44" y1="22" x2="44" y2="112"/>${frets}${rows}</svg>`
}

export function renderInstrumentSvg(kind: InstrumentKind, state: ExplorerState): string {
  return kind === 'piano' ? renderPiano(state) : renderGuitar(state)
}
