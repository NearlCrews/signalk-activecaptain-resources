import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SEAMARK_GROUPS,
  elementPoiType,
  elementSkIcon,
  seamarkRegex,
  seamarkSkIcon,
  seamarkToPoiType
} from '../src/inputs/openseamap/seamark-mapping.js'

test('seamarkToPoiType maps hazard seamark types to Hazard', () => {
  assert.equal(seamarkToPoiType('rock'), 'Hazard')
  assert.equal(seamarkToPoiType('wreck'), 'Hazard')
  assert.equal(seamarkToPoiType('obstruction'), 'Hazard')
})

test('seamarkToPoiType maps harbours, locks, navaids, and anchorages', () => {
  assert.equal(seamarkToPoiType('harbour'), 'Marina')
  assert.equal(seamarkToPoiType('lock_basin'), 'Lock')
  assert.equal(seamarkToPoiType('light_major'), 'Navigational')
  assert.equal(seamarkToPoiType('buoy_lateral'), 'Navigational')
  assert.equal(seamarkToPoiType('anchorage'), 'Anchorage')
})

test('seamarkToPoiType maps an unknown seamark type to Unknown', () => {
  assert.equal(seamarkToPoiType('definitely_not_a_seamark'), 'Unknown')
})

test('elementPoiType reads the seamark:type tag when present', () => {
  assert.equal(elementPoiType({ 'seamark:type': 'wreck' }), 'Hazard')
})

test('elementPoiType maps a leisure=marina element with no seamark type to Marina', () => {
  assert.equal(elementPoiType({ leisure: 'marina' }), 'Marina')
})

test('elementPoiType maps an untagged element to Unknown', () => {
  assert.equal(elementPoiType({}), 'Unknown')
})

test('the seamark groups cover the four configurable categories', () => {
  const ids = SEAMARK_GROUPS.map((group) => group.id)
  assert.deepEqual(ids, ['hazards', 'navaids', 'harbours', 'infrastructure'])
  for (const group of SEAMARK_GROUPS) {
    assert.ok(group.seamarkTypes.length > 0, `group ${group.id} lists seamark types`)
    assert.ok(group.label.length > 0, `group ${group.id} has a label`)
  }
})

test('seamarkRegex builds an alternation matching just the enabled group', () => {
  const pattern = new RegExp(seamarkRegex(['hazards']))
  assert.ok(pattern.test('rock'))
  assert.ok(pattern.test('wreck'))
  assert.ok(pattern.test('obstruction'))
  assert.ok(!pattern.test('harbour'), 'a disabled group is excluded')
})

test('seamarkRegex unions the seamark types of every enabled group', () => {
  const pattern = new RegExp(seamarkRegex(['hazards', 'infrastructure']))
  assert.ok(pattern.test('rock'))
  assert.ok(pattern.test('lock_basin'))
  assert.ok(!pattern.test('light_major'), 'a disabled group is excluded')
})

test('seamarkSkIcon maps hazards to the hazard glyph', () => {
  assert.equal(seamarkSkIcon('rock'), 'hazard')
  assert.equal(seamarkSkIcon('wreck'), 'hazard')
  assert.equal(seamarkSkIcon('obstruction'), 'hazard')
})

test('seamarkSkIcon maps harbours, marinas, anchorages, locks, and bridges to their Freeboard icons', () => {
  assert.equal(seamarkSkIcon('harbour'), 'marina')
  assert.equal(seamarkSkIcon('marina'), 'marina')
  assert.equal(seamarkSkIcon('anchorage'), 'anchorage')
  assert.equal(seamarkSkIcon('anchor_berth'), 'anchorage')
  assert.equal(seamarkSkIcon('mooring'), 'anchorage')
  assert.equal(seamarkSkIcon('lock_basin'), 'lock')
  assert.equal(seamarkSkIcon('bridge'), 'bridge')
})

test('seamarkSkIcon routes lights, beacons, and buoys to the navigation-structure glyph', () => {
  for (const value of [
    'light_major', 'light_minor', 'light_float', 'light_vessel', 'landmark',
    'beacon_lateral', 'beacon_cardinal', 'beacon_safe_water', 'beacon_special_purpose',
    'buoy_lateral', 'buoy_cardinal', 'buoy_safe_water', 'buoy_special_purpose'
  ]) {
    assert.equal(seamarkSkIcon(value), 'navigation-structure', `${value} -> navigation-structure`)
  }
})

test('seamarkSkIcon renders isolated-danger marks as hazards while the PoiType stays Navigational', () => {
  // An isolated-danger buoy or beacon exists to flag a danger; the hazard
  // glyph is the visually correct cue. The PoiType stays Navigational so the
  // proximity alarm does not falsely trigger on the buoy itself.
  assert.equal(seamarkSkIcon('beacon_isolated_danger'), 'hazard')
  assert.equal(seamarkSkIcon('buoy_isolated_danger'), 'hazard')
  assert.equal(seamarkToPoiType('beacon_isolated_danger'), 'Navigational')
  assert.equal(seamarkToPoiType('buoy_isolated_danger'), 'Navigational')
})

test('seamarkSkIcon falls back to notice-to-mariners for an unmapped seamark type', () => {
  assert.equal(seamarkSkIcon('definitely_not_a_seamark'), 'notice-to-mariners')
})

test('elementSkIcon reads seamark:type, then leisure=marina, then falls back', () => {
  assert.equal(elementSkIcon({ 'seamark:type': 'wreck' }), 'hazard')
  assert.equal(elementSkIcon({ 'seamark:type': 'light_minor' }), 'navigation-structure')
  assert.equal(elementSkIcon({ leisure: 'marina' }), 'marina')
  assert.equal(elementSkIcon({}), 'notice-to-mariners')
  assert.equal(elementSkIcon({ name: 'Just a tagged feature' }), 'notice-to-mariners')
})
