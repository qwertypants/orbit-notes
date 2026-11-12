import './styles.css'
import { mountNoteCircle } from './visualization/note-circle.ts'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) throw new Error('App root was not found')

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="wordmark" href="#" aria-label="Orbit home"><span class="wordmark-mark" aria-hidden="true">✳</span> orbit</a>
      <span class="topbar-note">A space to hear how notes fit</span>
    </header>

    <section class="intro" aria-labelledby="page-title">
      <p class="eyebrow">PLAY WITH MUSIC THEORY</p>
      <h1 id="page-title">Find your <span>sound.</span></h1>
      <p class="intro-copy">Pick a starting point. Follow the notes wherever they take you.</p>
    </section>

    <section class="explorer" aria-label="Music theory explorer">
      <div class="circle-wrap">
        <div id="note-circle" class="note-circle" role="img" aria-label="A circle showing the twelve notes of the chromatic scale" aria-describedby="circle-description">
          <p class="sr-only" id="circle-description">Twelve chromatic notes arranged around a circle: C, C sharp, D, E flat, E, F, F sharp, G, A flat, A, B flat, and B. Use the controls below to choose a topic and root note.</p>
        </div>
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
            <option value="C">C</option><option value="C#">C♯</option><option value="D">D</option><option value="D#">E♭</option>
            <option value="E">E</option><option value="F">F</option><option value="F#">F♯</option><option value="G">G</option>
            <option value="G#">A♭</option><option value="A">A</option><option value="A#">B♭</option><option value="B">B</option>
          </select>
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
      </div>
      <p id="audio-status" class="audio-status" role="status" aria-live="polite">Choose a topic and press play to listen.</p>
    </section>

    <footer class="footer"><span>Made for curious ears.</span><span class="footer-spark" aria-hidden="true">✳</span></footer>
  </main>
`

const topicSelect = document.querySelector<HTMLSelectElement>('#topic-select')!
const rootSelect = document.querySelector<HTMLSelectElement>('#root-select')!
const playButton = document.querySelector<HTMLButtonElement>('#play-button')!
const stopButton = document.querySelector<HTMLButtonElement>('#stop-button')!
const audioStatus = document.querySelector<HTMLParagraphElement>('#audio-status')!
const circleHost = document.querySelector<HTMLDivElement>('#note-circle')!

mountNoteCircle(circleHost)

playButton.addEventListener('click', async () => {
  playButton.disabled = true
  audioStatus.textContent = 'Waking up the sound…'
  try {
    const mode = document.querySelector<HTMLInputElement>('input[name="playback"]:checked')?.value
    const { playPreview } = await import('./audio/audio-engine.ts')
    await playPreview(rootSelect.value, mode === 'sequence')
    audioStatus.textContent = `${rootSelect.value} preview playing ${mode === 'sequence' ? 'in a row' : 'together'}.`
  } catch {
    audioStatus.textContent = 'Sound could not start. Tap Play to try again.'
  } finally {
    playButton.disabled = false
  }
})

stopButton.addEventListener('click', () => {
  void import('./audio/audio-engine.ts').then(({ stopPreview }) => {
    stopPreview()
    audioStatus.textContent = 'Playback stopped.'
  })
})

topicSelect.addEventListener('change', () => {
  audioStatus.textContent = `${topicSelect.options[topicSelect.selectedIndex].text} selected. Explore controls are ready.`
})

document.querySelectorAll<HTMLInputElement>('input[name="playback"]').forEach((input) => {
  input.addEventListener('change', () => {
    audioStatus.textContent = `${input.value === 'sequence' ? 'In a row' : 'Together'} playback selected.`
  })
})
