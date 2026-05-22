import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SEAMARK_GROUPS,
  elementPoiType,
  seamarkRegex,
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
