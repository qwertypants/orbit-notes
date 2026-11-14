import type { ExplorerState } from '../explorer-state.ts'
import type { PitchClass } from '../theory/music-theory.ts'
import { staffNotesForState } from './staff-notes.ts'

export type NoteStaff = {
  update(state: ExplorerState): void
  startNote(note: PitchClass): void
  endNote(note: PitchClass): void
  clearPlayback(): void
  destroy(): void
}

const lineSteps = [0, 2, 4, 6, 8]
const stepY = (step: number) => 160 - step * 10

export function renderNoteStaffSvg(state: ExplorerState): string {
  const notes = staffNotesForState(state)
  const noteMarkup = notes.map((note, index) => {
    const x = 132 + index * 56
    const label = `${note.letter}${note.accidental}${note.octave}`
    const accidental = note.accidental
      ? `<text class="staff-accidental" x="${x - 19}" y="${stepY(note.staffStep) + 5}" text-anchor="end">${note.accidental}</text>`
      : ''
    return `<g class="staff-note" role="img" data-staff-note="${note.pitchClass}" aria-label="${label}"><title>${label}</title>${accidental}<ellipse class="staff-notehead" cx="${x}" cy="${stepY(note.staffStep)}" rx="8" ry="5.5" transform="rotate(-18 ${x} ${stepY(note.staffStep)})" />${note.staffStep <= -2 ? `<line class="staff-ledger" x1="${x - 14}" y1="${stepY(note.staffStep)}" x2="${x + 14}" y2="${stepY(note.staffStep)}" />` : ''}</g>`
  }).join('')
  const width = Math.max(320, 174 + notes.length * 56)
  const lines = lineSteps.map((step) => `<line data-staff-line x1="76" y1="${stepY(step)}" x2="${width - 14}" y2="${stepY(step)}" />`).join('')
  return `<svg class="note-staff-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 210" role="img" aria-label="Selected notes on a treble staff" aria-describedby="staff-description"><desc id="staff-description">Selected notes are shown in octave four on a five-line treble staff.</desc><g class="staff-notation"><g class="staff-lines">${lines}</g><text class="staff-clef" x="24" y="156" aria-hidden="true">𝄞</text>${noteMarkup}</g></svg>`
}

export function mountNoteStaff(host: HTMLElement, initialState: ExplorerState): NoteStaff {
  let state = initialState
  const activeNotes: PitchClass[] = []
  let destroyed = false
  const fitNotation = () => {
    if (destroyed) return
    const svg = host.querySelector<SVGSVGElement>('.note-staff-svg')
    const notation = host.querySelector<SVGGElement>('.staff-notation')
    if (!svg || !notation) return
    const bounds = notation.getBBox()
    if (bounds.width === 0 || bounds.height === 0) return
    // Leave room for strokes and active-note outlines beyond the measured geometry.
    const bleed = 2
    const viewBox = `${bounds.x - bleed} ${bounds.y - bleed} ${bounds.width + bleed * 2} ${bounds.height + bleed * 2}`
    if (svg.getAttribute('viewBox') !== viewBox) svg.setAttribute('viewBox', viewBox)
  }
  const updateLabel = () => {
    const currentNote = [...activeNotes].reverse().find((pitch) => staffNotesForState(state).some((note) => note.pitchClass === pitch))
    const spelling = currentNote === undefined ? '' : staffNotesForState(state).find((note) => note.pitchClass === currentNote)
    const label = host.querySelector<HTMLElement>('.staff-current-note')
    if (label) label.textContent = spelling ? `${spelling.letter}${spelling.accidental}${spelling.octave}` : ''
  }
  const applyActiveNotes = () => {
    const groups = host.querySelectorAll<SVGGElement>('g[data-staff-note]')
    groups.forEach((group) => group.classList.toggle('is-active', activeNotes.includes(Number(group.dataset.staffNote) as PitchClass)))
    updateLabel()
  }
  const update = (nextState: ExplorerState) => {
    state = nextState
    host.innerHTML = `<div class="staff-current-note" aria-live="polite"></div>${renderNoteStaffSvg(state)}`
    applyActiveNotes()
    fitNotation()
  }
  const startNote = (note: PitchClass) => {
    const currentIndex = activeNotes.indexOf(note)
    if (currentIndex !== -1) activeNotes.splice(currentIndex, 1)
    activeNotes.push(note)
    applyActiveNotes()
  }
  const endNote = (note: PitchClass) => {
    const index = activeNotes.indexOf(note)
    if (index !== -1) activeNotes.splice(index, 1)
    applyActiveNotes()
  }
  const clearPlayback = () => {
    activeNotes.length = 0
    applyActiveNotes()
  }
  update(initialState)
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fitNotation)
  observer?.observe(host)
  void host.ownerDocument?.fonts.ready.then(fitNotation)
  return { update, startNote, endNote, clearPlayback, destroy: () => {
    destroyed = true
    observer?.disconnect()
    host.replaceChildren()
  } }
}
