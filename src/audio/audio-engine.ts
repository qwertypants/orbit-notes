import * as Tone from 'tone'

let synth: Tone.Synth | undefined
let sequenceTimer: number | undefined

export async function playPreview(note: string, inSequence: boolean): Promise<void> {
  stopPreview()
  await Tone.start()
  synth ??= new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, release: 0.25 } }).toDestination()

  if (inSequence) {
    const notes = [note, note, note]
    notes.forEach((pitch, index) => synth?.triggerAttackRelease(`${pitch}4`, '8n', Tone.now() + index * 0.22))
    sequenceTimer = window.setTimeout(() => { sequenceTimer = undefined }, 800)
  } else {
    synth.triggerAttackRelease(`${note}4`, '2n')
  }
}

export function stopPreview(): void {
  if (sequenceTimer !== undefined) {
    window.clearTimeout(sequenceTimer)
    sequenceTimer = undefined
  }
  synth?.triggerRelease()
}
