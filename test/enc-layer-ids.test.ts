import test from 'node:test'
import assert from 'node:assert/strict'
import { LAYER_IDS_BY_BAND } from '../src/inputs/noaa-enc/enc-direct-types.js'

test('every scale band has a populated layer-id triple', () => {
  for (const [band, ids] of Object.entries(LAYER_IDS_BY_BAND)) {
    assert.ok(ids.wreck > 0, `${band}.wreck > 0`)
    assert.ok(ids.obstruction > 0, `${band}.obstruction > 0`)
    assert.ok(ids.rock > 0, `${band}.rock > 0`)
  }
})
