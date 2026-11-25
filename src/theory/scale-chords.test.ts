import { expect, test } from 'vitest'
import { scaleChords } from './scale-chords.ts'

test('E Phrygian supplies the seven modal triads', () => {
  expect(scaleChords({ topic: 'scales', root: 4, culturalPatternId: 'western-phrygian-mode' }).map(chord => chord.label)).toEqual([
    'i · E minor', '♭II · F major', '♭III · G major', 'iv · A minor', 'v° · B diminished', '♭VI · C major', '♭vii · D minor',
  ])
})
test('major and natural minor include the expected triads', () => {
  expect(scaleChords({ topic: 'scales', root: 0, preset: 'major' }).map(chord => chord.label)).toEqual([
    'I · C major', 'ii · D minor', 'iii · E minor', 'IV · F major', 'V · G major', 'vi · A minor', 'vii° · B diminished',
  ])
  expect(scaleChords({ topic: 'scales', root: 9, preset: 'naturalMinor' }).map(chord => chord.label)).toEqual([
    'i · A minor', 'ii° · B diminished', '♭III · C major', 'iv · D minor', 'v · E minor', '♭VI · F major', '♭VII · G major',
  ])
})
test('pentatonic chords use only notes present in the collection', () => {
  expect(scaleChords({ topic: 'scales', root: 0, preset: 'majorPentatonic' }).map(chord => chord.label)).toEqual(['I · C major', 'vi · A minor'])
  expect(scaleChords({ topic: 'scales', root: 0, preset: 'minorPentatonic' }).map(chord => chord.label)).toEqual(['i · C minor', '♭III · E♭ major'])
})
test('circle keys provide major or relative minor harmony', () => {
  expect(scaleChords({ topic: 'fifths', root: 0 })).toHaveLength(7)
  expect(scaleChords({ topic: 'fifths', root: 0, minorRoot: 9 })[0].label).toBe('i · A minor')
})
test('cultural scales require their own documented harmony', () => {
  expect(scaleChords({ topic: 'scales', root: 0, culturalPatternId: 'maqam-ajam-c' })).toEqual([])
})
