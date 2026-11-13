import type { ExplorerState } from '../explorer-state.ts'
import { staffNotesForState } from './staff-notes.ts'

export type NoteStaff = {
  update(state: ExplorerState): void
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
    return `<g role="img" data-staff-note="${note.pitchClass}" aria-label="${label}"><title>${label}</title>${accidental}<ellipse class="staff-notehead" cx="${x}" cy="${stepY(note.staffStep)}" rx="8" ry="5.5" transform="rotate(-18 ${x} ${stepY(note.staffStep)})" />${note.staffStep <= -2 ? `<line class="staff-ledger" x1="${x - 14}" y1="${stepY(note.staffStep)}" x2="${x + 14}" y2="${stepY(note.staffStep)}" />` : ''}</g>`
  }).join('')
  const width = Math.max(320, 174 + notes.length * 56)
  const lines = lineSteps.map((step) => `<line data-staff-line x1="76" y1="${stepY(step)}" x2="${width - 14}" y2="${stepY(step)}" />`).join('')
  return `<svg class="note-staff-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 210" role="img" aria-label="Selected notes on a treble staff" aria-describedby="staff-description"><desc id="staff-description">Selected notes are shown in octave four on a five-line treble staff.</desc><g class="staff-lines">${lines}</g><text class="staff-clef" x="24" y="156" aria-hidden="true">𝄞</text>${noteMarkup}</svg>`
}

export function mountNoteStaff(host: HTMLElement, initialState: ExplorerState): NoteStaff {
  const update = (state: ExplorerState) => { host.innerHTML = renderNoteStaffSvg(state) }
  update(initialState)
  return { update, destroy: () => host.replaceChildren() }
}
