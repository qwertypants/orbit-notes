import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activeNotesInOrder, createExplorerState, toggleExplorerNote } from '../explorer-state.ts'
import { disposeAudio, playNotes, readSpectrum, stopPlayback } from './audio-engine.ts'

const audio = vi.hoisted(() => ({
  start: vi.fn<() => Promise<void>>(),
  trigger: vi.fn(),
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
    triggerAttackRelease(...args: unknown[]) { audio.trigger(...args); return this }
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
    expect(audio.trigger).toHaveBeenCalledWith(['C4', 'E4', 'G4'], '2n')
  })

  it('follows explorer state after a note is changed', async () => {
    const initial = createExplorerState({ topic: 'chords', root: 0, preset: 'major' })
    const changed = toggleExplorerNote(toggleExplorerNote(initial, 4), 3)
    await playNotes(activeNotesInOrder(changed), 'together')
    expect(audio.trigger).toHaveBeenCalledWith(['C4', 'G4', 'D#5'], '2n')
  })

  it('continues a scale into the next octave instead of falling back to C4', async () => {
    const state = createExplorerState({ topic: 'scales', root: 7, preset: 'major' })
    await playNotes(activeNotesInOrder(state), 'sequence')
    vi.advanceTimersByTime(3 * 280)
    expect(audio.trigger).toHaveBeenLastCalledWith('C5', '8n')
  })

  it('plays a sequence in order and cancels later notes on Stop', async () => {
    await playNotes([2, 6, 9], 'sequence')
    expect(audio.trigger).toHaveBeenCalledTimes(1)
    expect(audio.trigger).toHaveBeenLastCalledWith('D4', '8n')
    vi.advanceTimersByTime(280)
    expect(audio.trigger).toHaveBeenLastCalledWith('F#4', '8n')
    stopPlayback()
    vi.advanceTimersByTime(1000)
    expect(audio.trigger).toHaveBeenCalledTimes(2)
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
    expect(audio.trigger).not.toHaveBeenCalled()
  })

  it('ignores an older audio start that resolves after a newer Play', async () => {
    let resumeFirst!: () => void
    audio.start.mockImplementationOnce(() => new Promise<void>((resolve) => { resumeFirst = resolve }))
    const first = playNotes([0], 'together')
    expect(await playNotes([5], 'together')).toBe(true)
    resumeFirst()
    expect(await first).toBe(false)
    expect(audio.trigger).toHaveBeenCalledOnce()
    expect(audio.trigger).toHaveBeenCalledWith(['F4'], '2n')
  })

  it('surfaces a rejected startup and allows a later retry', async () => {
    audio.start.mockRejectedValueOnce(new Error('audio blocked'))
    await expect(playNotes([0], 'together')).rejects.toThrow('audio blocked')
    expect(audio.trigger).not.toHaveBeenCalled()
    expect(await playNotes([0], 'together')).toBe(true)
    expect(audio.trigger).toHaveBeenCalledWith(['C4'], '2n')
  })

  it('releases old voices and prevents an earlier sequence from leaking into a new play', async () => {
    await playNotes([0, 4, 7], 'sequence')
    await playNotes([5, 9], 'together')
    vi.advanceTimersByTime(1000)
    expect(audio.trigger).toHaveBeenCalledTimes(2)
    expect(audio.trigger).toHaveBeenLastCalledWith(['F4', 'A4'], '2n')
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
})
