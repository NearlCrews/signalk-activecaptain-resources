import test from 'node:test'
import assert from 'node:assert/strict'
import { bridgeHeightToMeters } from '../src/inputs/active-captain/bridge-clearance.js'
import { METERS_PER_FOOT } from '../src/shared/length.js'

test('feet are converted to meters', () => {
  assert.equal(bridgeHeightToMeters(20, 'feet'), 20 * METERS_PER_FOOT)
  assert.equal(bridgeHeightToMeters(20, 'ft'), 20 * METERS_PER_FOOT)
  assert.equal(bridgeHeightToMeters(20, 'foot'), 20 * METERS_PER_FOOT)
})

test('the feet unit is matched case- and whitespace-insensitively', () => {
  assert.equal(bridgeHeightToMeters(20, ' Feet '), 20 * METERS_PER_FOOT)
  assert.equal(bridgeHeightToMeters(20, 'FT'), 20 * METERS_PER_FOOT)
})

test('meters pass through unchanged', () => {
  assert.equal(bridgeHeightToMeters(6.5, 'meters'), 6.5)
  assert.equal(bridgeHeightToMeters(6.5, 'metres'), 6.5)
  assert.equal(bridgeHeightToMeters(6.5, 'meter'), 6.5)
  assert.equal(bridgeHeightToMeters(6.5, 'm'), 6.5)
})

test('an unrecognized unit yields undefined, never a guess', () => {
  assert.equal(bridgeHeightToMeters(20, 'fathoms'), undefined)
  assert.equal(bridgeHeightToMeters(20, 'yards'), undefined)
  assert.equal(bridgeHeightToMeters(20, ''), undefined)
})

test('an absent unit yields undefined', () => {
  assert.equal(bridgeHeightToMeters(20, undefined), undefined)
})

test('a zero or missing bridgeHeight yields undefined', () => {
  assert.equal(bridgeHeightToMeters(0, 'feet'), undefined)
  assert.equal(bridgeHeightToMeters(undefined, 'feet'), undefined)
})

test('a non-positive or non-finite bridgeHeight yields undefined', () => {
  assert.equal(bridgeHeightToMeters(-5, 'feet'), undefined)
  assert.equal(bridgeHeightToMeters(Number.NaN, 'meters'), undefined)
  assert.equal(bridgeHeightToMeters(Number.POSITIVE_INFINITY, 'meters'), undefined)
})
