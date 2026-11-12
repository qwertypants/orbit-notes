import { describe, expect, it } from 'vitest'
import { spectrumLevels } from './spectrum.ts'

describe('spectrum levels', () => {
  it('maps FFT decibels into bounded radial amplitudes', () => {
    expect(spectrumLevels(new Float32Array([-90, -85, -52.5, -20]), 3)).toEqual([0, 0.5, 1])
  })

  it('treats silence and invalid values as no signal', () => {
    expect(spectrumLevels(new Float32Array([-Infinity, Number.NaN, -100, -100]), 3)).toEqual([0, 0, 0])
    expect(spectrumLevels(undefined, 2)).toEqual([0, 0])
  })
})
