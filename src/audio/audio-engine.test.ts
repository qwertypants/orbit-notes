import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activeNotesInOrder, createExplorerState, toggleExplorerNote } from '../explorer-state.ts'
import { disposeAudio, playNotes, readSpectrum, stopPlayback } from './audio-engine.ts'

const audio = vi.hoisted(() => ({
  start: vi.fn<() => Promise<void>>(),
  attack: vi.fn(),
  noteRelease: vi.fn(),
  release: vi.fn(),
  dispose: vi.fn(),
  construct: vi.fn(),
  connect: vi.fn(),
  analyserConstruct: vi.fn(),
  analyserDispose: vi.fn(),
  spectrumValue: new Float32Array([-80, -40]),
}))

vi.mock('tone', () => ({
  start: audio.start,
  Synth: class {},
  PolySynth: class {
    constructor(...args: unknown[]) { audio.construct(...args) }
    connect(...args: unknown[]) { audio.connect(...args); return this }
    triggerAttack(...args: unknown[]) { audio.attack(...args); return this }
    triggerRelease(...args: unknown[]) { audio.noteRelease(...args); return this }
    releaseAll() { audio.release(); return this }
    dispose() { audio.dispose(); return this }
  },
  Analyser: class {
    constructor(...args: unknown[]) { audio.analyserConstruct(...args) }
    toDestination() { return this }
    getValue() { return audio.spectrumValue }
    dispose() { audio.analyserDispose(); return this }
  },
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  audio.start.mockResolvedValue(undefined)
})

afterEach(() => {
  disposeAudio()
  vi.useRealTimers()
})

describe('selected-note playback', () => {
  it('plays the selected chord together above its root', async () => {
    expect(await playNotes([0, 4, 7], 'together')).toBe(true)
    expect(audio.start).toHaveBeenCalledOnce()
    expect(audio.attack).toHaveBeenCalledWith(['C4', 'E4', 'G4'])
    vi.advanceTimersByTime(1000)
    expect(audio.noteRelease).toHaveBeenCalledWith(['C4', 'E4', 'G4'])
  })

  it('reports each together-mode note when the chord attack starts', async () => {
    const onNoteStart = vi.fn()
    await playNotes([0, 4, 7], 'together', 'ascending', onNoteStart)

    expect(audio.attack).toHaveBeenCalledWith(['C4', 'E4', 'G4'])
    expect(onNoteStart.mock.calls).toEqual([[0], [4], [7]])
  })

  it('reports sequence notes only when their attacks start', async () => {
    const onNoteStart = vi.fn()
    await playNotes([2, 6, 9], 'sequence', 'ascending', onNoteStart)

    expect(onNoteStart.mock.calls).toEqual([[2]])
    vi.advanceTimersByTime(280)
    expect(onNoteStart.mock.calls).toEqual([[2], [6]])
    vi.advanceTimersByTime(280)
    expect(onNoteStart.mock.calls).toEqual([[2], [6], [9]])
  })

  it('does not report scheduled sequence notes after playback is stopped', async () => {
    const onNoteStart = vi.fn()
    await playNotes([2, 6, 9], 'sequence', 'ascending', onNoteStart)
    stopPlayback()
    vi.advanceTimersByTime(1000)

    expect(onNoteStart.mock.calls).toEqual([[2]])
  })

  it('follows explorer state after a note is changed', async () => {
    const initial = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
    const changed = toggleExplorerNote(toggleExplorerNote(initial, 4), 3)
    await playNotes(activeNotesInOrder(changed), 'together')
    expect(audio.attack).toHaveBeenCalledWith(['C4', 'G4', 'D#5'])
  })

  it('continues a scale into the next octave instead of falling back to C4', async () => {
    const state = createExplorerState({ topic: 'scales', root: 7, preset: 'major' })
    await playNotes(activeNotesInOrder(state), 'sequence')
    vi.advanceTimersByTime(3 * 280)
    expect(audio.attack).toHaveBeenLastCalledWith('C5')
  })

  it('plays a sequence in order and cancels later notes on Stop', async () => {
    await playNotes([2, 6, 9], 'sequence')
    expect(audio.attack).toHaveBeenCalledTimes(1)
    expect(audio.attack).toHaveBeenLastCalledWith('D4')
    vi.advanceTimersByTime(280)
    expect(audio.attack).toHaveBeenLastCalledWith('F#4')
    stopPlayback()
    vi.advanceTimersByTime(1000)
    expect(audio.attack).toHaveBeenCalledTimes(2)
    expect(audio.release).toHaveBeenCalled()
  })

  it('does not start sound when Stop happens during audio startup', async () => {
    let resume!: () => void
    audio.start.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve }))
    const pending = playNotes([0], 'together')
    stopPlayback()
    resume()
    expect(await pending).toBe(false)
    expect(audio.construct).not.toHaveBeenCalled()
    expect(audio.attack).not.toHaveBeenCalled()
  })

  it('ignores an older audio start that resolves after a newer Play', async () => {
    let resumeFirst!: () => void
    audio.start.mockImplementationOnce(() => new Promise<void>((resolve) => { resumeFirst = resolve }))
    const first = playNotes([0], 'together')
    expect(await playNotes([5], 'together')).toBe(true)
    resumeFirst()
    expect(await first).toBe(false)
    expect(audio.attack).toHaveBeenCalledOnce()
    expect(audio.attack).toHaveBeenCalledWith(['F4'])
  })

  it('surfaces a rejected startup and allows a later retry', async () => {
    audio.start.mockRejectedValueOnce(new Error('audio blocked'))
    await expect(playNotes([0], 'together')).rejects.toThrow('audio blocked')
    expect(audio.attack).not.toHaveBeenCalled()
    expect(await playNotes([0], 'together')).toBe(true)
    expect(audio.attack).toHaveBeenCalledWith(['C4'])
  })

  it('releases old voices and prevents an earlier sequence from leaking into a new play', async () => {
    await playNotes([0, 4, 7], 'sequence')
    await playNotes([5, 9], 'together')
    vi.advanceTimersByTime(1000)
    expect(audio.attack).toHaveBeenCalledTimes(2)
    expect(audio.attack).toHaveBeenLastCalledWith(['F4', 'A4'])
    expect(audio.release).toHaveBeenCalled()
  })

  it('skips audio startup for an empty selection', async () => {
    expect(await playNotes([], 'together')).toBe(false)
    expect(audio.start).not.toHaveBeenCalled()
  })

  it('disposes the reusable instrument when leaving the page', async () => {
    await playNotes([0], 'together')
    disposeAudio()
    expect(audio.dispose).toHaveBeenCalledOnce()
    expect(audio.analyserDispose).toHaveBeenCalledOnce()
    await playNotes([7], 'together')
    expect(audio.construct).toHaveBeenCalledTimes(2)
  })

  it('routes the audible synth through a live FFT analyser', async () => {
    expect(readSpectrum()).toBeUndefined()
    await playNotes([0, 4, 7], 'together')
    expect(audio.analyserConstruct).toHaveBeenCalledWith({ type: 'fft', size: 128, smoothing: 0.8 })
    expect(audio.connect).toHaveBeenCalledOnce()
    expect(readSpectrum()).toBe(audio.spectrumValue)
  })

  it('cancels an old note release before replaying that pitch', async () => {
    await playNotes([0], 'together')
    vi.advanceTimersByTime(500)
    await playNotes([0], 'together')
    vi.advanceTimersByTime(500)
    expect(audio.noteRelease).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(audio.noteRelease).toHaveBeenCalledOnce()
    expect(audio.noteRelease).toHaveBeenCalledWith(['C4'])
  })

  it('keeps a complete fifths sequence within one octave', async () => {
    const state = createExplorerState({ topic: 'fifths', root: 11 })
    let allNotes = state
    for (const note of state.resolved.notes) {
      if (!allNotes.activeNotes.includes(note.pitchClass)) allNotes = toggleExplorerNote(allNotes, note.pitchClass)
    }
    await playNotes(activeNotesInOrder(allNotes), 'sequence', 'within-octave')
    vi.advanceTimersByTime(11 * 280)
    const heard = audio.attack.mock.calls.map(([pitch]) => pitch)
    expect(heard).toHaveLength(12)
    expect(heard.every((pitch) => typeof pitch === 'string' && pitch.endsWith('4'))).toBe(true)
  })
})
