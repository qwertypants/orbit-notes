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
import { defaultSelectionForTradition, selectionForTraditionPattern, traditionPatterns, type TraditionPattern } from './theory/tradition-catalog.ts'
import type { NoteCircle } from './visualization/note-circle.ts'
import type { NoteCircleHud } from './visualization/note-circle-hud.ts'
import type { PlaybackMode, PlaybackPattern } from './audio/audio-engine.ts'
import { createLearningSummary, noteLabelForState } from './theory/learning-summary.ts'
import { renderTheorySummary, renderTraditionSummary } from './theory/learning-panel.ts'
import { mountNoteStaff, type NoteStaff } from './visualization/note-staff.ts'
import { setStaffVisibility } from './visualization/staff-visibility.ts'
import { mountExplorerMotion } from './visualization/explorer-motion.ts'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => {})
  }, { once: true })
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) throw new Error('App root was not found')

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="wordmark" href="#" aria-label="Orbit home"><span class="wordmark-mark" aria-hidden="true">✳</span> orbit</a>
      <span class="topbar-note">A space to hear how notes fit</span>
    </header>

    <section class="explorer" aria-label="Music theory explorer">
      <div class="visualization-row">
        <div class="circle-wrap">
          <div id="note-circle" class="note-circle" role="img" aria-label="Interactive note circle" aria-describedby="circle-description">
            <p class="sr-only" id="circle-description"></p>
          </div>
          <button id="circle-play-button" class="circle-play-button" type="button" aria-label="Play selected notes" title="Play selected notes">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z" /></svg>
          </button>
          <div class="circle-caption" aria-hidden="true"><span class="caption-dot"></span> TWELVE NOTES · ENDLESS CONNECTIONS</div>
        </div>
        <section class="staff-panel" aria-label="Staff visualization">
          <div id="note-staff" class="note-staff" hidden></div>
        </section>
      </div>

      <div class="controls" aria-label="Explorer controls">
        <div class="control-field explore-field">
          <div class="explore-heading">
            <span class="control-label">Explore</span>
            <button id="staff-toggle" class="staff-toggle" type="button" aria-pressed="false" aria-controls="note-staff" aria-label="Show staff" title="Show staff">
              <svg class="control-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M3 7h22M3 11h22M3 15h22M3 19h22M3 23h22" opacity=".55"/><path d="M18 18V4l5 2v5"/><ellipse cx="14.5" cy="18.5" rx="3.5" ry="2.5" fill="currentColor" transform="rotate(-20 14.5 18.5)"/></svg>
            </button>
          </div>
          <div id="topic-buttons" class="topic-buttons" role="group" aria-label="Choose a music topic">
            <button class="topic-button" type="button" data-topic="chords" aria-pressed="false">Chords</button>
            <button class="topic-button" type="button" data-topic="scales" aria-pressed="true">Scales</button>
            <button class="topic-button" type="button" data-topic="arpeggios" aria-pressed="false">Arpeggios</button>
            <button class="topic-button" type="button" data-topic="fifths" aria-pressed="false">Fifths</button>
          </div>
        </div>
        <label class="control-field">
          <span class="control-label">Start on</span>
          <select id="root-select" aria-label="Choose a root note">
            <option value="C">C</option><option value="C#">D♭</option><option value="D">D</option><option value="D#">E♭</option>
            <option value="E">E</option><option value="F">F</option><option value="F#">G♭</option><option value="G">G</option>
            <option value="G#">A♭</option><option value="A">A</option><option value="A#">B♭</option><option value="B">B</option>
          </select>
        </label>
        <label class="control-field">
          <span class="control-label">Sound</span>
          <select id="sound-select" aria-label="Choose a sound">
            <option value="triangle">Soft</option><option value="sine">Pure</option><option value="sawtooth">Bright</option>
            <option value="square">Retro</option><option value="fmsine">Bell</option>
          </select>
        </label>
        <div class="control-field" id="preset-field">
          <span class="control-label">Shape</span>
          <div id="preset-buttons" class="preset-buttons" role="group" aria-label="Choose a chord or scale shape"></div>
        </div>
        <fieldset class="playback-choice">
          <legend class="control-label">Hear it</legend>
          <div class="segmented">
            <label title="Together"><input type="radio" name="playback" value="together" aria-label="Together" checked /><span><svg class="control-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M18 21V4"/><ellipse cx="14" cy="9" rx="4" ry="2.5" fill="currentColor"/><ellipse cx="14" cy="15" rx="4" ry="2.5" fill="currentColor"/><ellipse cx="14" cy="21" rx="4" ry="2.5" fill="currentColor"/></svg></span></label>
            <label title="In a row"><input type="radio" name="playback" value="sequence" aria-label="In a row" /><span><svg class="control-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M8 21V10m8 7V6m8 7V2"/><ellipse cx="5" cy="21" rx="3" ry="2" fill="currentColor"/><ellipse cx="13" cy="17" rx="3" ry="2" fill="currentColor"/><ellipse cx="21" cy="13" rx="3" ry="2" fill="currentColor"/></svg></span></label>
          </div>
        </fieldset>
        <fieldset class="playback-choice" id="pattern-field">
          <legend class="control-label">Play pattern</legend>
          <div class="segmented pattern-segmented">
            <label title="Once"><input type="radio" name="playback-pattern" value="once" aria-label="Once" checked /><span><svg class="control-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M4 14h17m-6-6 6 6-6 6M25 7v14"/></svg></span></label>
            <label title="Loop"><input type="radio" name="playback-pattern" value="loop" aria-label="Loop" /><span><svg class="control-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="m19 3 5 5-5 5M24 8H9a5 5 0 0 0-5 5m5 12-5-5 5-5M4 20h15a5 5 0 0 0 5-5"/></svg></span></label>
            <label title="Up and down"><input type="radio" name="playback-pattern" value="bounce" aria-label="Up and down" /><span><svg class="control-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M8 23V5m-5 5 5-5 5 5m7-5v18m-5-5 5 5 5-5"/></svg></span></label>
          </div>
        </fieldset>
        <div class="playback-buttons">
          <button id="play-button" class="play-button" type="button"><span aria-hidden="true">▶</span> Play</button>
        </div>
        <fieldset class="note-picker">
          <legend class="control-label">Notes · tap to change the shape</legend>
          <div id="note-buttons" class="note-buttons"></div>
        </fieldset>
        <details class="theory-panel">
          <summary>Explore the theory</summary>
          <div class="theory-tabs" role="tablist" aria-label="Explore the theory">
            <button id="theory-tab" type="button" role="tab" aria-selected="true" aria-controls="theory-content" tabindex="0">Theory</button>
            <button id="traditions-tab" type="button" role="tab" aria-selected="false" aria-controls="traditions-content" tabindex="-1">Traditions</button>
          </div>
          <div id="theory-content" class="theory-content" role="tabpanel" aria-labelledby="theory-tab" tabindex="0" aria-live="polite"></div>
          <div id="traditions-content" class="theory-content" role="tabpanel" aria-labelledby="traditions-tab" tabindex="0" hidden>
            <div id="tradition-buttons" class="tradition-buttons" role="group" aria-label="Choose a musical tradition"></div>
            <div id="tradition-patterns" class="tradition-buttons" role="group" aria-label="Choose a tradition pattern"></div>
            <div id="tradition-summary" aria-live="polite"></div>
            <p class="tradition-empty">The curated non-Western entries currently include scales; no documented non-Western arpeggios are in this collection yet.</p>
          </div>
        </details>
      </div>
      <p id="selection-status" class="sr-only" role="status" aria-live="polite"></p>
      <p id="audio-status" class="audio-status" role="status" aria-live="polite">Choose a topic and press play to listen.</p>
    </section>

    <footer class="footer"><span>Made for curious ears.</span><span class="footer-spark" aria-hidden="true">✳</span></footer>
  </main>
`

const topicButtons = document.querySelector<HTMLDivElement>('#topic-buttons')!
const rootSelect = document.querySelector<HTMLSelectElement>('#root-select')!
const soundSelect = document.querySelector<HTMLSelectElement>('#sound-select')!
const presetField = document.querySelector<HTMLDivElement>('#preset-field')!
const presetButtons = document.querySelector<HTMLDivElement>('#preset-buttons')!
const playButton = document.querySelector<HTMLButtonElement>('#play-button')!
const circlePlayButton = document.querySelector<HTMLButtonElement>('#circle-play-button')!
const togetherInput = document.querySelector<HTMLInputElement>('input[name="playback"][value="together"]')!
const sequenceInput = document.querySelector<HTMLInputElement>('input[name="playback"][value="sequence"]')!
const patternField = document.querySelector<HTMLFieldSetElement>('#pattern-field')!
const patternInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="playback-pattern"]')]
const audioStatus = document.querySelector<HTMLParagraphElement>('#audio-status')!
const selectionStatus = document.querySelector<HTMLParagraphElement>('#selection-status')!
const circleDescription = document.querySelector<HTMLParagraphElement>('#circle-description')!
const circleHost = document.querySelector<HTMLDivElement>('#note-circle')!
const staffHost = document.querySelector<HTMLDivElement>('#note-staff')!
const staffPanel = document.querySelector<HTMLElement>('.staff-panel')!
const visualizationRow = document.querySelector<HTMLDivElement>('.visualization-row')!
const staffToggle = document.querySelector<HTMLButtonElement>('#staff-toggle')!
const noteButtons = document.querySelector<HTMLDivElement>('#note-buttons')!
const theoryContent = document.querySelector<HTMLDivElement>('#theory-content')!
const theoryTabs = [...document.querySelectorAll<HTMLButtonElement>('.theory-tabs [role="tab"]')]
const traditionButtons = document.querySelector<HTMLDivElement>('#tradition-buttons')!
const traditionPatternButtons = document.querySelector<HTMLDivElement>('#tradition-patterns')!
const traditionSummary = document.querySelector<HTMLDivElement>('#tradition-summary')!
let culturalPattern: TraditionPattern | undefined = defaultSelectionForTradition('western-tonal-theory', 0)?.pattern
let browsedTraditionId = culturalPattern?.traditionId

function activateTheoryTab(selected: HTMLButtonElement): void {
  theoryTabs.forEach((tab) => {
    const active = tab === selected
    tab.setAttribute('aria-selected', String(active))
    tab.tabIndex = active ? 0 : -1
    document.getElementById(tab.getAttribute('aria-controls')!)!.hidden = !active
  })
  const panel = document.getElementById(selected.getAttribute('aria-controls')!)!
  motion?.reveal(panel)
}

theoryTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTheoryTab(tab))
  tab.addEventListener('keydown', (event) => {
    let next: number
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % theoryTabs.length; break
      case 'ArrowLeft': next = (index - 1 + theoryTabs.length) % theoryTabs.length; break
      case 'Home': next = 0; break
      case 'End': next = theoryTabs.length - 1; break
      default: return
    }
    event.preventDefault()
    const nextTab = theoryTabs[next]!
    activateTheoryTab(nextTab)
    nextTab.focus()
  })
})

function renderTraditionChoices(): void {
  const traditions = [...new Map(traditionPatterns.map((pattern) => [pattern.traditionId, pattern])).values()]
  traditionButtons.replaceChildren(...traditions.map((tradition) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'tradition-button'
    button.textContent = tradition.traditionName
    button.setAttribute('aria-pressed', String(tradition.traditionId === browsedTraditionId))
    button.addEventListener('click', () => {
      browsedTraditionId = tradition.traditionId
      const chosen = defaultSelectionForTradition(tradition.traditionId, parseNoteName(rootSelect.value))
      if (!chosen) return
      const { pattern } = chosen
      culturalPattern = pattern
      activeTopic = chosen.selection.topic
      populatePresets()
      syncPlaybackChoice(true)
      resetSelection()
      renderTraditionChoices()
      traditionButtons.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
    })
    return button
  }))
  traditionPatternButtons.replaceChildren(...traditionPatterns.filter((pattern) => pattern.traditionId === browsedTraditionId).map((pattern) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'tradition-button'
    button.dataset.culturalPattern = pattern.id
    button.textContent = `${pattern.name} · ${pattern.kind === 'scale' ? 'Scale' : 'Arpeggio'}`
    button.setAttribute('aria-pressed', String(pattern.id === culturalPattern?.id))
    button.addEventListener('click', () => {
      const chosen = selectionForTraditionPattern(pattern.id, parseNoteName(rootSelect.value))
      if (!chosen) return
      culturalPattern = chosen.pattern
      browsedTraditionId = pattern.traditionId
      activeTopic = chosen.selection.topic
      populatePresets()
      syncPlaybackChoice(true)
      resetSelection()
    })
    return button
  }))
}

type AudioModule = typeof import('./audio/audio-engine.ts')
let audioModulePromise: Promise<AudioModule> | undefined
let playRequest = 0
let loopingPlayback = false
let circle: NoteCircle | undefined
let circleLoadFailed = false
const pendingNotePulses: { note: PitchClass; startedAtMs: number }[] = []
const pendingHudNotePulses: { note: PitchClass; startedAtMs: number }[] = []
const notePulseDurationMs = 500
let circleHud: NoteCircleHud | undefined
let spectrumReader: (() => Float32Array | undefined) | undefined
let pageHidden = false
let activeTopic: TopicId = 'scales'
let staff: NoteStaff
let motion: ReturnType<typeof mountExplorerMotion> | undefined

function audioModule(): Promise<AudioModule> {
  audioModulePromise ??= import('./audio/audio-engine.ts').catch((error: unknown) => {
    audioModulePromise = undefined
    throw error
  })
  return audioModulePromise
}

function stopCurrentPlayback(message?: string): void {
  playRequest += 1
  loopingPlayback = false
  circleHud?.setPlaybackActive(false)
  playButton.disabled = false
  circlePlayButton.disabled = false
  playButton.innerHTML = '<span aria-hidden="true">▶</span> Play'
  circlePlayButton.setAttribute('aria-label', 'Play selected notes')
  circlePlayButton.title = 'Play selected notes'
  spectrumReader = undefined
  circle?.stopSpectrum()
  circle?.clearPulses()
  staff?.clearPlayback()
  motion?.clearPlayback()
  pendingNotePulses.length = 0
  circleHud?.stopSpectrum()
  circleHud?.clearPulses()
  pendingHudNotePulses.length = 0
  if (audioModulePromise) void audioModulePromise.then(({ stopPlayback }) => stopPlayback()).catch(() => {})
  if (message) audioStatus.textContent = message
}

function selectedTopic(): TopicId {
  return activeTopic
}

function topicName(topic: TopicId): string {
  switch (topic) {
    case 'chords': return 'Chords'
    case 'scales': return 'Scales'
    case 'arpeggios': return 'Arpeggios'
    case 'fifths': return 'Circle of fifths'
  }
}

function syncPlaybackChoice(resetForTopic = false): void {
  const topic = selectedTopic()
  if (resetForTopic) {
    const defaultMode = topic === 'chords' ? 'together' : 'sequence'
    togetherInput.checked = defaultMode === 'together'
    sequenceInput.checked = defaultMode === 'sequence'
    patternInputs.find((input) => input.value === 'once')!.checked = true
  }
  togetherInput.disabled = topic === 'arpeggios'
  if (topic === 'arpeggios') sequenceInput.checked = true
  const wasHidden = patternField.hidden
  patternField.hidden = togetherInput.checked
  if (wasHidden && !patternField.hidden) motion?.reveal(patternField)
}

function populatePresets(): void {
  const topic = selectedTopic()
  presetField.hidden = topic === 'fifths'
  if (topic === 'fifths') return
  const options = topic === 'scales' ? scalePresets : chordPresets
  const previousPreset = presetButtons.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.dataset.preset
  const selectedPreset = previousPreset && previousPreset in options ? previousPreset : 'major'
  presetButtons.replaceChildren(...Object.entries(options).map(([value, pattern]) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'preset-button'
    button.dataset.preset = value
    button.textContent = pattern.label
    button.setAttribute('aria-pressed', String(value === selectedPreset))
    return button
  }))
}

function topicSelection(): TopicSelection {
  const topic = selectedTopic()
  const root = parseNoteName(rootSelect.value)
  if (culturalPattern) return { topic: culturalPattern.kind === 'scale' ? 'scales' : 'arpeggios', root, culturalPatternId: culturalPattern.id }
  if (topic === 'fifths') return { topic, root }
  const preset = presetButtons.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.dataset.preset ?? 'major'
  if (topic === 'scales') return { topic, root, preset: preset as ScalePreset }
  return { topic, root, preset: preset as ChordPreset }
}

populatePresets()
syncPlaybackChoice()
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
  const selectedTopicName = topicName(selectedTopic())
  circleDescription.textContent = `${selectedTopicName} circle, root ${noteName(root, 'flat')}. Selected notes: ${activeNames}. Use the note buttons to change the selection.`
  selectionStatus.textContent = `Selected notes: ${activeNames}.`
  topicButtons.querySelectorAll<HTMLButtonElement>('button[data-topic]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.topic === activeTopic))
  })
  if (culturalPattern) {
    presetButtons.querySelectorAll<HTMLButtonElement>('button[data-preset]').forEach((button) => button.setAttribute('aria-pressed', 'false'))
  }
  traditionPatternButtons.querySelectorAll<HTMLButtonElement>('button[data-cultural-pattern]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.culturalPattern === culturalPattern?.id))
  })
  renderTheoryPanel()
  staff?.update(explorerState)
  circle?.update(explorerState)
  circleHud?.update(explorerState)
}

function renderTheoryPanel(): void {
  const summary = createLearningSummary(explorerState)
  renderTheorySummary(theoryContent, summary, explorerState.selection.topic)
  renderTraditionSummary(traditionSummary, summary)
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

renderTraditionChoices()
staff = mountNoteStaff(staffHost, explorerState)
staffPanel.hidden = true
staffToggle.addEventListener('click', () => {
  const visible = staffToggle.getAttribute('aria-pressed') !== 'true'
  setStaffVisibility({ panel: staffPanel, host: staffHost, row: visualizationRow, toggle: staffToggle }, visible)
  if (visible) motion?.reveal(staffPanel)
})
renderSelection()
try {
  motion = mountExplorerMotion(app)
} catch {
  // Motion is optional; a failed setup leaves the explorer usable.
  document.documentElement.dataset.orbitBoot = 'recovered'
}

// The large p5 module loads after controls and note buttons are usable.
void import('./visualization/note-circle.ts').then(({ mountNoteCircle }) => {
  if (pageHidden) return
  circle = mountNoteCircle(circleHost, explorerState, toggleCircleNote)
  circle.update(explorerState)
  const now = performance.now()
  pendingNotePulses.splice(0).forEach(({ note, startedAtMs }) => {
    const elapsedMs = now - startedAtMs
    if (elapsedMs < notePulseDurationMs) circle?.pulseNote(note, elapsedMs)
  })
  if (spectrumReader) circle.startSpectrum(spectrumReader)

  void import('./visualization/note-circle-hud.ts').then(({ mountNoteCircleHud }) => {
    if (pageHidden) return
    const anchor = circleHost.closest<HTMLElement>('.circle-wrap')
    if (!anchor) return
    circleHud = mountNoteCircleHud({
      anchor,
      initialState: explorerState,
      onNoteToggle: toggleCircleNote,
      onPlay: () => playButton.click(),
    })
    circleHud.setPlaybackActive(loopingPlayback)
    circleHud.update(explorerState)
    const hudNow = performance.now()
    pendingHudNotePulses.splice(0).forEach(({ note, startedAtMs }) => {
      const elapsedMs = hudNow - startedAtMs
      if (elapsedMs < notePulseDurationMs) circleHud?.pulseNote(note, elapsedMs)
    })
    if (spectrumReader) circleHud.startSpectrum(spectrumReader)
  }).catch(() => {
    pendingHudNotePulses.length = 0
    // The main circle remains available if the optional floating HUD fails to load.
  })
}).catch(() => {
  circleLoadFailed = true
  pendingNotePulses.length = 0
  pendingHudNotePulses.length = 0
  audioStatus.textContent = 'The note circle could not load. Use the note buttons to explore.'
})

playButton.addEventListener('click', async () => {
  if (loopingPlayback) {
    stopCurrentPlayback('Playback stopped.')
    return
  }
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
    const mode: PlaybackMode = selectedTopic() === 'arpeggios' || sequenceInput.checked ? 'sequence' : 'together'
    const selectedPattern = patternInputs.find((input) => input.checked)!.value as PlaybackPattern
    const pattern: PlaybackPattern = mode === 'sequence' ? selectedPattern : 'once'
    const { playNotes, readSpectrum } = await audioModule()
    if (request !== playRequest) return
    const started = await playNotes(
      notes,
      mode,
      explorerState.selection.topic === 'fifths' ? 'within-octave' : 'ascending',
      (note) => {
        const startedAtMs = performance.now()
        if (circle) circle.pulseNote(note)
        else if (!circleLoadFailed) pendingNotePulses.push({ note, startedAtMs })
        if (circleHud) circleHud.pulseNote(note)
        else pendingHudNotePulses.push({ note, startedAtMs })
        staff?.startNote(note)
        motion?.pulseNote(note)
      },
      soundSelect.value as 'triangle' | 'sine' | 'sawtooth' | 'square' | 'fmsine',
      pattern,
      (note) => staff?.endNote(note),
    )
    if (request !== playRequest || !started) return
    spectrumReader = readSpectrum
    circle?.startSpectrum(readSpectrum)
    circleHud?.startSpectrum(readSpectrum)
    const names = notes.map((note) => noteLabelForState(explorerState, note)).join(', ')
    audioStatus.textContent = mode === 'together'
      ? `Playing ${names} together.`
      : pattern === 'loop'
        ? `Looping ${names} in a row.`
        : `Playing ${names} ${pattern === 'bounce' ? 'up and down' : 'in a row once'}.`
    if (pattern === 'loop') {
      loopingPlayback = true
      circleHud?.setPlaybackActive(true)
      playButton.innerHTML = '<span aria-hidden="true">■</span> Stop'
      circlePlayButton.setAttribute('aria-label', 'Stop playback')
      circlePlayButton.title = 'Stop playback'
    }
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

topicButtons.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-topic]')
  if (!button) return
  const topic = button.dataset.topic as TopicId
  if (topic === activeTopic && !culturalPattern) return
  culturalPattern = undefined
  activeTopic = topic
  topicButtons.querySelectorAll<HTMLButtonElement>('button[data-topic]').forEach((topicButton) => {
    topicButton.setAttribute('aria-pressed', String(topicButton === button))
  })
  populatePresets()
  syncPlaybackChoice(true)
  resetSelection()
  motion?.sweepOrbit()
  audioStatus.textContent = `${topicName(topic)} selected.`
})

rootSelect.addEventListener('change', resetSelection)
presetButtons.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-preset]')
  if (!button || button.getAttribute('aria-pressed') === 'true') return
  culturalPattern = undefined
  presetButtons.querySelectorAll<HTMLButtonElement>('button[data-preset]').forEach((presetButton) => {
    presetButton.setAttribute('aria-pressed', String(presetButton === button))
  })
  resetSelection()
})

document.querySelectorAll<HTMLInputElement>('input[name="playback"]').forEach((input) => {
  input.addEventListener('change', () => {
    stopCurrentPlayback()
    syncPlaybackChoice()
    audioStatus.textContent = `${input.value === 'sequence' ? 'In a row' : 'Together'} playback selected.`
  })
})

patternInputs.forEach((input) => {
  input.addEventListener('change', () => {
    stopCurrentPlayback()
    const label = input.value === 'once' ? 'Once' : input.value === 'loop' ? 'Loop' : 'Up and down'
    audioStatus.textContent = `${label} playback selected.`
  })
})

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) pageHidden = true
  stopCurrentPlayback()
  if (!event.persisted) {
    motion?.destroy()
    circle?.destroy()
    circleHud?.destroy()
  }
  if (audioModulePromise) void audioModulePromise.then(({ disposeAudio }) => disposeAudio()).catch(() => {})
})
