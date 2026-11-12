import './styles.css'
import { activeNotesInOrder, createExplorerState, toggleExplorerNote } from './explorer-state.ts'
import {
  chordPresets,
  noteName,
  parseNoteName,
  scalePresets,
  type ChordPreset,
  type PitchClass,
  type ScalePreset,
  type TopicId,
  type TopicSelection,
} from './theory/music-theory.ts'
import type { NoteCircle } from './visualization/note-circle.ts'
import type { PlaybackMode } from './audio/audio-engine.ts'
import { createLearningSummary, noteLabelForState } from './theory/learning-summary.ts'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) throw new Error('App root was not found')

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="wordmark" href="#" aria-label="Orbit home"><span class="wordmark-mark" aria-hidden="true">✳</span> orbit</a>
      <span class="topbar-note">A space to hear how notes fit</span>
    </header>

    <section class="explorer" aria-label="Music theory explorer">
      <div class="circle-wrap">
        <div id="note-circle" class="note-circle" role="img" aria-label="Interactive note circle" aria-describedby="circle-description">
          <p class="sr-only" id="circle-description"></p>
        </div>
        <button id="circle-play-button" class="circle-play-button" type="button" aria-label="Play selected notes" title="Play selected notes">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z" /></svg>
        </button>
        <div class="circle-caption" aria-hidden="true"><span class="caption-dot"></span> TWELVE NOTES · ENDLESS CONNECTIONS</div>
      </div>

      <div class="controls" aria-label="Explorer controls">
        <label class="control-field">
          <span class="control-label">Explore</span>
          <select id="topic-select" aria-label="Choose a music topic">
            <option value="chords">Chords</option>
            <option value="scales">Scales</option>
            <option value="arpeggios">Arpeggios</option>
            <option value="fifths">Circle of fifths</option>
          </select>
        </label>
        <label class="control-field">
          <span class="control-label">Start on</span>
          <select id="root-select" aria-label="Choose a root note">
            <option value="C">C</option><option value="C#">D♭</option><option value="D">D</option><option value="D#">E♭</option>
            <option value="E">E</option><option value="F">F</option><option value="F#">G♭</option><option value="G">G</option>
            <option value="G#">A♭</option><option value="A">A</option><option value="A#">B♭</option><option value="B">B</option>
          </select>
        </label>
        <label class="control-field" id="preset-field">
          <span class="control-label">Shape</span>
          <select id="preset-select" aria-label="Choose a chord or scale shape"></select>
        </label>
        <fieldset class="playback-choice">
          <legend class="control-label">Hear it</legend>
          <div class="segmented">
            <label><input type="radio" name="playback" value="together" checked /><span>Together</span></label>
            <label><input type="radio" name="playback" value="sequence" /><span>In a row</span></label>
          </div>
        </fieldset>
        <div class="playback-buttons">
          <button id="play-button" class="play-button" type="button"><span aria-hidden="true">▶</span> Play</button>
          <button id="stop-button" class="stop-button" type="button">Stop</button>
        </div>
        <fieldset class="note-picker">
          <legend class="control-label">Notes · tap to change the shape</legend>
          <div id="note-buttons" class="note-buttons"></div>
        </fieldset>
        <details class="theory-panel">
          <summary>Explore the theory</summary>
          <div id="theory-content" class="theory-content" aria-live="polite"></div>
        </details>
      </div>
      <p id="selection-status" class="sr-only" role="status" aria-live="polite"></p>
      <p id="audio-status" class="audio-status" role="status" aria-live="polite">Choose a topic and press play to listen.</p>
    </section>

    <footer class="footer"><span>Made for curious ears.</span><span class="footer-spark" aria-hidden="true">✳</span></footer>
  </main>
`

const topicSelect = document.querySelector<HTMLSelectElement>('#topic-select')!
const rootSelect = document.querySelector<HTMLSelectElement>('#root-select')!
const presetField = document.querySelector<HTMLLabelElement>('#preset-field')!
const presetSelect = document.querySelector<HTMLSelectElement>('#preset-select')!
const playButton = document.querySelector<HTMLButtonElement>('#play-button')!
const circlePlayButton = document.querySelector<HTMLButtonElement>('#circle-play-button')!
const stopButton = document.querySelector<HTMLButtonElement>('#stop-button')!
const audioStatus = document.querySelector<HTMLParagraphElement>('#audio-status')!
const selectionStatus = document.querySelector<HTMLParagraphElement>('#selection-status')!
const circleDescription = document.querySelector<HTMLParagraphElement>('#circle-description')!
const circleHost = document.querySelector<HTMLDivElement>('#note-circle')!
const noteButtons = document.querySelector<HTMLDivElement>('#note-buttons')!
const theoryContent = document.querySelector<HTMLDivElement>('#theory-content')!

type AudioModule = typeof import('./audio/audio-engine.ts')
let audioModulePromise: Promise<AudioModule> | undefined
let playRequest = 0
let circle: NoteCircle | undefined
let spectrumReader: (() => Float32Array | undefined) | undefined
let pageHidden = false

function audioModule(): Promise<AudioModule> {
  audioModulePromise ??= import('./audio/audio-engine.ts').catch((error: unknown) => {
    audioModulePromise = undefined
    throw error
  })
  return audioModulePromise
}

function stopCurrentPlayback(message?: string): void {
  playRequest += 1
  playButton.disabled = false
  circlePlayButton.disabled = false
  spectrumReader = undefined
  circle?.stopSpectrum()
  if (audioModulePromise) void audioModulePromise.then(({ stopPlayback }) => stopPlayback()).catch(() => {})
  if (message) audioStatus.textContent = message
}

function selectedTopic(): TopicId {
  const topic = topicSelect.value
  return topic === 'scales' || topic === 'arpeggios' || topic === 'fifths' ? topic : 'chords'
}

function populatePresets(): void {
  const topic = selectedTopic()
  presetField.hidden = topic === 'fifths'
  if (topic === 'fifths') return
  const options = topic === 'scales' ? scalePresets : chordPresets
  const previous = presetSelect.value
  presetSelect.replaceChildren(...Object.entries(options).map(([value, pattern]) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = pattern.label
    return option
  }))
  presetSelect.value = previous in options ? previous : 'major'
}

function topicSelection(): TopicSelection {
  const topic = selectedTopic()
  const root = parseNoteName(rootSelect.value)
  if (topic === 'fifths') return { topic, root }
  if (topic === 'scales') return { topic, root, preset: presetSelect.value as ScalePreset }
  return { topic, root, preset: presetSelect.value as ChordPreset }
}

populatePresets()
let explorerState = createExplorerState(topicSelection())
function toggleCircleNote(note: PitchClass): void {
  explorerState = toggleExplorerNote(explorerState, note)
  stopCurrentPlayback('Selection changed. Press Play to hear it.')
  renderSelection()
}

function renderSelection(): void {
  const active = new Set(explorerState.activeNotes)
  const root = explorerState.selection.root
  noteButtons.replaceChildren(...Array.from({ length: 12 }, (_, index) => {
    const note = index as PitchClass
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'note-button'
    button.dataset.note = String(note)
    button.textContent = noteLabelForState(explorerState, note)
    button.setAttribute('aria-pressed', String(active.has(note)))
    button.setAttribute('aria-label', `${noteLabelForState(explorerState, note)}${note === root ? ', root' : ''}`)
    if (note === root) button.dataset.root = 'true'
    return button
  }))
  const activeNames = activeNotesInOrder(explorerState).map((note) => noteLabelForState(explorerState, note)).join(', ') || 'none'
  const topicName = topicSelect.options[topicSelect.selectedIndex].text
  circleDescription.textContent = `${topicName} circle, root ${noteName(root, 'flat')}. Selected notes: ${activeNames}. Use the note buttons to change the selection.`
  selectionStatus.textContent = `Selected notes: ${activeNames}.`
  renderTheoryPanel()
  circle?.update(explorerState)
}

function renderTheoryPanel(): void {
  const summary = createLearningSummary(explorerState)
  const heading = document.createElement('h2')
  heading.textContent = summary.title
  const selected = document.createElement('p')
  selected.className = 'theory-selected'
  selected.innerHTML = '<span>Selected notes</span>'
  selected.append(document.createTextNode(summary.selectedNotes))
  const explanation = document.createElement('p')
  explanation.textContent = summary.explanation
  const listHeading = document.createElement('h3')
  listHeading.textContent = explorerState.selection.topic === 'fifths' ? 'Clockwise fifths' : 'Notes and relationships'
  const list = document.createElement('ol')
  list.className = 'theory-relationships'
  summary.relationships.forEach((relationship) => {
    const item = document.createElement('li')
    item.textContent = relationship
    list.append(item)
  })
  theoryContent.replaceChildren(heading, selected, explanation, listHeading, list)
}

function resetSelection(): void {
  explorerState = createExplorerState(topicSelection())
  stopCurrentPlayback('Selection changed. Press Play to hear it.')
  renderSelection()
}

noteButtons.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-note]')
  if (!button) return
  const note = Number(button.dataset.note) as PitchClass
  explorerState = toggleExplorerNote(explorerState, note)
  stopCurrentPlayback('Selection changed. Press Play to hear it.')
  renderSelection()
  noteButtons.querySelector<HTMLButtonElement>(`button[data-note="${note}"]`)?.focus()
})

renderSelection()

// The large p5 module loads after controls and note buttons are usable.
void import('./visualization/note-circle.ts').then(({ mountNoteCircle }) => {
  if (pageHidden) return
  circle = mountNoteCircle(circleHost, explorerState, toggleCircleNote)
  circle.update(explorerState)
  if (spectrumReader) circle.startSpectrum(spectrumReader)
}).catch(() => {
  audioStatus.textContent = 'The note circle could not load. Use the note buttons to explore.'
})

playButton.addEventListener('click', async () => {
  const notes = activeNotesInOrder(explorerState)
  if (notes.length === 0) {
    audioStatus.textContent = 'Choose at least one note before playing.'
    return
  }
  stopCurrentPlayback()
  const request = ++playRequest
  playButton.disabled = true
  circlePlayButton.disabled = true
  audioStatus.textContent = 'Waking up the sound…'
  try {
    const mode: PlaybackMode = document.querySelector<HTMLInputElement>('input[name="playback"]:checked')?.value === 'sequence' ? 'sequence' : 'together'
    const { playNotes, readSpectrum } = await audioModule()
    if (request !== playRequest) return
    const started = await playNotes(notes, mode, explorerState.selection.topic === 'fifths' ? 'within-octave' : 'ascending')
    if (request !== playRequest || !started) return
    spectrumReader = readSpectrum
    circle?.startSpectrum(readSpectrum)
    const names = notes.map((note) => noteLabelForState(explorerState, note)).join(', ')
    audioStatus.textContent = `Playing ${names} ${mode === 'sequence' ? 'in a row' : 'together'}.`
  } catch {
    if (request === playRequest) audioStatus.textContent = 'Sound could not start. Tap Play to try again.'
  } finally {
    if (request === playRequest) {
      playButton.disabled = false
      circlePlayButton.disabled = false
    }
  }
})

circlePlayButton.addEventListener('click', () => playButton.click())

stopButton.addEventListener('click', () => {
  stopCurrentPlayback('Playback stopped.')
})

topicSelect.addEventListener('change', () => {
  populatePresets()
  resetSelection()
  audioStatus.textContent = `${topicSelect.options[topicSelect.selectedIndex].text} selected.`
})

rootSelect.addEventListener('change', resetSelection)
presetSelect.addEventListener('change', resetSelection)

document.querySelectorAll<HTMLInputElement>('input[name="playback"]').forEach((input) => {
  input.addEventListener('change', () => {
    stopCurrentPlayback()
    audioStatus.textContent = `${input.value === 'sequence' ? 'In a row' : 'Together'} playback selected.`
  })
})

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) pageHidden = true
  stopCurrentPlayback()
  if (!event.persisted) circle?.destroy()
  if (audioModulePromise) void audioModulePromise.then(({ disposeAudio }) => disposeAudio()).catch(() => {})
})
