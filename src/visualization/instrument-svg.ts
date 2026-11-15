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

export function instrumentRootLegend(state: ExplorerState): string {
  const root = noteLabelForState(state, state.resolved.root)
  return state.activeNotes.includes(state.resolved.root)
    ? `White outline: root ${root}.`
    : `Root ${root} is not selected; no root outline.`
}

function labelFit(label: string, width: number): string {
  return label.length > 2 ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"` : ''
}

function renderPiano(state: ExplorerState): string {
  const keys = pianoNotesForState(state)
  const whiteIndices = [0, 2, 4, 5, 7, 9, 11, 12]
  const blackIndices = [1, 3, 6, 8, 10]
  const white = whiteIndices.map((index, position) => {
    const key = keys[index]
    const x = position * 28
    const label = key.selected ? `<circle class="piano-selection-marker" cx="${x + 14}" cy="63" r="10"/><text class="instrument-note-label" x="${x + 14}" y="67" text-anchor="middle">${escapeXml(key.label)}</text>` : ''
    return `<g data-key-index="${index}" data-selected="${key.selected}" data-root="${key.root}"><rect class="piano-key piano-key--white" x="${x}" y="1" width="28" height="74"/>${label}</g>`
  }).join('')
  const black = blackIndices.map((index, position) => {
    const key = keys[index]
    const x = [17.5, 45.5, 101.5, 129.5, 157.5][position]
    const label = key.selected ? `<circle class="piano-selection-marker" cx="${x + 10.5}" cy="28" r="10"/><text class="instrument-note-label" x="${x + 10.5}" y="32" text-anchor="middle"${labelFit(key.label, 18)}>${escapeXml(key.label)}</text>` : ''
    return `<g data-key-index="${index}" data-selected="${key.selected}" data-root="${key.root}"><rect class="piano-key piano-key--black" x="${x}" y="1" width="21" height="45"/>${label}</g>`
  }).join('')
  return `<svg class="instrument-svg instrument-svg--piano" viewBox="0 0 224 76" role="img" aria-label="Piano pitch-class reference, C through C, selected: ${escapeXml(summary(state))}. ${escapeXml(instrumentRootLegend(state))}"><title>Piano pitch-class reference</title><desc>Pitch classes across C–C, not the register or voicing of playback. Selected notes: ${escapeXml(summary(state))}. ${escapeXml(instrumentRootLegend(state))}</desc>${white}${black}</svg>`
}

function renderGuitar(state: ExplorerState): string {
  const positions = guitarNotesForState(state)
  const rows = positions.filter((position) => position.fret === 0).map((open) => {
    const y = 28 + (open.string - 1) * 24
    const label = `<text class="guitar-string-label" x="6" y="${y + 3}" text-anchor="middle">${['1 E', '2 B', '3 G', '4 D', '5 A', '6 E'][open.string - 1]}</text>`
    const openDot = open.selected ? `<g data-guitar-position="${open.string}-${open.fret}" data-selected="true" data-root="${open.root}"><ellipse class="guitar-note-dot" cx="28" cy="${y}" rx="12" ry="10"/><text class="instrument-note-label" x="28" y="${y + 3}" text-anchor="middle"${labelFit(open.label, 21)}>${escapeXml(open.label)}</text></g>` : `<g data-guitar-position="${open.string}-${open.fret}" data-selected="false" data-root="false"/>`
    const frets = positions.filter((position) => position.string === open.string && position.fret > 0).map((position) => {
      const x = [65, 107, 149, 191][position.fret - 1]
      return position.selected
        ? `<g data-guitar-position="${position.string}-${position.fret}" data-selected="true" data-root="${position.root}"><ellipse class="guitar-note-dot" cx="${x}" cy="${y}" rx="12" ry="10"/><text class="instrument-note-label" x="${x}" y="${y + 3}" text-anchor="middle"${labelFit(position.label, 21)}>${escapeXml(position.label)}</text></g>`
        : `<g data-guitar-position="${position.string}-${position.fret}" data-selected="false" data-root="false"/>`
    }).join('')
    return `${label}${openDot}${frets}`
  }).join('')
  const fretLabels = [1, 2, 3, 4].map((fret) => `<text class="guitar-fret-label" x="${[65, 107, 149, 191][fret - 1]}" y="10" text-anchor="middle">${fret}</text>`).join('')
  const strings = Array.from({ length: 6 }, (_, row) => `<line class="guitar-string" x1="44" y1="${28 + row * 24}" x2="212" y2="${28 + row * 24}"/>`).join('')
  const frets = [86, 128, 170, 212].map((x) => `<line class="guitar-fret" x1="${x}" y1="28" x2="${x}" y2="148"/>`).join('')
  return `<svg class="instrument-svg instrument-svg--guitar" viewBox="-5 0 229 162" role="img" aria-label="Standard tuning guitar, open strings through fret 4, selected: ${escapeXml(summary(state))}. ${escapeXml(instrumentRootLegend(state))}"><title>Standard tuning guitar reference</title><desc>Note locations in standard tuning, frets 0–4; not a chord fingering. Top: high E, string 1. Bottom: low E, string 6. ${escapeXml(instrumentRootLegend(state))} Selected positions: ${positions.filter((position) => position.selected).map((position) => `string ${position.string}, fret ${position.fret}, ${position.label}`).join('; ') || 'none'}.</desc>${fretLabels}${strings}<line class="guitar-nut" x1="44" y1="28" x2="44" y2="148"/>${frets}${rows}</svg>`
}

export function renderInstrumentSvg(kind: InstrumentKind, state: ExplorerState): string {
  return kind === 'piano' ? renderPiano(state) : renderGuitar(state)
}
