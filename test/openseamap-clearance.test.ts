import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOsmClearanceMeters } from '../src/inputs/openseamap/clearance.js'
import { METERS_PER_FOOT, metersFromFeetInches } from '../src/shared/length.js'

test('returns undefined when no clearance tag is present', () => {
  assert.equal(parseOsmClearanceMeters({}), undefined)
  assert.equal(parseOsmClearanceMeters({ 'seamark:type': 'bridge', name: 'A Bridge' }), undefined)
})

test('parses a bare number as meters', () => {
  assert.equal(parseOsmClearanceMeters({ maxheight: '3.5' }), 3.5)
  assert.equal(parseOsmClearanceMeters({ maxheight: '12' }), 12)
})

test('parses an explicit meter unit', () => {
  assert.equal(parseOsmClearanceMeters({ maxheight: '3.5 m' }), 3.5)
  assert.equal(parseOsmClearanceMeters({ maxheight: '3.5m' }), 3.5)
  assert.equal(parseOsmClearanceMeters({ maxheight: '4 meter' }), 4)
  assert.equal(parseOsmClearanceMeters({ maxheight: '4 metre' }), 4)
  assert.equal(parseOsmClearanceMeters({ maxheight: '4 meters' }), 4)
  assert.equal(parseOsmClearanceMeters({ maxheight: '4 metres' }), 4)
})

test('parses feet to meters', () => {
  assert.equal(parseOsmClearanceMeters({ maxheight: '11 ft' }), 11 * METERS_PER_FOOT)
  assert.equal(parseOsmClearanceMeters({ maxheight: '11 feet' }), 11 * METERS_PER_FOOT)
  assert.equal(parseOsmClearanceMeters({ maxheight: "11'" }), 11 * METERS_PER_FOOT)
})

test('parses feet and inches to meters', () => {
  assert.equal(parseOsmClearanceMeters({ maxheight: '10\'6"' }), metersFromFeetInches(10, 6))
  assert.equal(parseOsmClearanceMeters({ maxheight: '10\' 6"' }), metersFromFeetInches(10, 6))
  // The closing inch quote is optional.
  assert.equal(parseOsmClearanceMeters({ maxheight: "10'6" }), metersFromFeetInches(10, 6))
})

test('unit detection is case-insensitive and trims surrounding whitespace', () => {
  assert.equal(parseOsmClearanceMeters({ maxheight: '  3.5 M  ' }), 3.5)
  assert.equal(parseOsmClearanceMeters({ maxheight: '11 FT' }), 11 * METERS_PER_FOOT)
})

test('treats non-data placeholders as unknown', () => {
  for (const placeholder of ['default', 'none', 'unsigned', 'no', 'below_default', 'unknown', '', '   ']) {
    assert.equal(parseOsmClearanceMeters({ maxheight: placeholder }), undefined, `placeholder ${JSON.stringify(placeholder)}`)
  }
  // Case folded too.
  assert.equal(parseOsmClearanceMeters({ maxheight: 'Default' }), undefined)
  assert.equal(parseOsmClearanceMeters({ maxheight: 'NONE' }), undefined)
})

test('treats garbage and unrecognized formats as unknown', () => {
  for (const garbage of ['abc', '~3', 'approx 3', '3,5', 'tall', '3 fathoms', 'm', "'"]) {
    assert.equal(parseOsmClearanceMeters({ maxheight: garbage }), undefined, `garbage ${JSON.stringify(garbage)}`)
  }
})

test('rejects non-positive and non-finite results', () => {
  assert.equal(parseOsmClearanceMeters({ maxheight: '0' }), undefined)
  assert.equal(parseOsmClearanceMeters({ maxheight: '0 m' }), undefined)
  assert.equal(parseOsmClearanceMeters({ maxheight: "0'0\"" }), undefined)
  // A leading minus is not part of the numeric grammar, so it is unrecognized.
  assert.equal(parseOsmClearanceMeters({ maxheight: '-3' }), undefined)
})

test('honors tag priority: first parseable key in order wins', () => {
  // seamark:bridge:clearance_height outranks maxheight.
  assert.equal(parseOsmClearanceMeters({
    'seamark:bridge:clearance_height': '4',
    maxheight: '9'
  }), 4)
  // maxheight outranks maxheight:physical and clearance.
  assert.equal(parseOsmClearanceMeters({
    maxheight: '5',
    'maxheight:physical': '6',
    clearance: '7'
  }), 5)
  // maxheight:physical outranks clearance.
  assert.equal(parseOsmClearanceMeters({
    'maxheight:physical': '6',
    clearance: '7'
  }), 6)
  // clearance is the lowest-priority fallback.
  assert.equal(parseOsmClearanceMeters({ clearance: '8' }), 8)
})

test('falls through a present-but-unparseable tag to the next parseable one', () => {
  // A safety feature: a placeholder top tag plus a real lower tag yields the
  // real number rather than treating the bridge as unknown-clearance.
  assert.equal(parseOsmClearanceMeters({ maxheight: 'default', clearance: '7' }), 7)
  // Fall-through spans multiple unparseable higher-priority tags.
  assert.equal(parseOsmClearanceMeters({
    'seamark:bridge:clearance_height': 'unsigned',
    maxheight: 'default',
    'maxheight:physical': '5.5'
  }), 5.5)
  // Garbage, not just placeholders, also falls through.
  assert.equal(parseOsmClearanceMeters({ maxheight: 'tall', clearance: '11 ft' }), 11 * METERS_PER_FOOT)
  // When every present tag is unparseable, the clearance is unknown.
  assert.equal(parseOsmClearanceMeters({ maxheight: 'default', clearance: 'none' }), undefined)
})
