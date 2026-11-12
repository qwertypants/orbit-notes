/** Convert FFT decibels into a small set of radial bar heights. */
export function spectrumLevels(values: ArrayLike<number> | undefined, barCount = 36): number[] {
  if (!values || values.length === 0) return Array(barCount).fill(0)

  return Array.from({ length: barCount }, (_, bar) => {
    const start = Math.max(1, Math.floor((bar / barCount) * values.length))
    const end = Math.max(start + 1, Math.ceil(((bar + 1) / barCount) * values.length))
    let peak = -100
    for (let index = start; index < Math.min(end, values.length); index += 1) {
      if (Number.isFinite(values[index])) peak = Math.max(peak, values[index])
    }
    return Math.max(0, Math.min(1, (peak + 85) / 65))
  })
}
