import test from 'node:test'
import assert from 'node:assert/strict'
import { humanizeLightCharacter } from '../src/shared/light-character.js'

test('humanizeLightCharacter expands the common IALA abbreviations', () => {
  assert.equal(humanizeLightCharacter('Fl'), 'flashing')
  assert.equal(humanizeLightCharacter('LFl'), 'long flashing')
  assert.equal(humanizeLightCharacter('Q'), 'quick flashing')
  assert.equal(humanizeLightCharacter('Iso'), 'isophase')
  assert.equal(humanizeLightCharacter('Oc'), 'occulting')
  assert.equal(humanizeLightCharacter('FFl'), 'fixed and flashing')
})

test('humanizeLightCharacter keeps the group count alongside the base phrase', () => {
  assert.equal(humanizeLightCharacter('Fl(2)'), 'flashing (2)')
  assert.equal(humanizeLightCharacter('Q(9)'), 'quick flashing (9)')
  assert.equal(humanizeLightCharacter('Oc(3+1)'), 'occulting (3+1)')
})

test('humanizeLightCharacter leaves an unmapped base abbreviation unchanged', () => {
  assert.equal(humanizeLightCharacter('Xy'), 'Xy')
  assert.equal(humanizeLightCharacter('Xy(2)'), 'Xy (2)')
})
