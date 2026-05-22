import test from 'node:test'
import assert from 'node:assert/strict'
import { openSeaMapInput } from '../src/inputs/openseamap/openseamap-input.js'
import type { InputContext } from '../src/inputs/poi-source.js'
import type { PluginConfig } from '../src/shared/types.js'

test('isEnabled tracks the openSeaMapEnabled toggle', () => {
  assert.equal(openSeaMapInput.isEnabled({} as PluginConfig), false)
  assert.equal(openSeaMapInput.isEnabled({ openSeaMapEnabled: false } as PluginConfig), false)
  assert.equal(openSeaMapInput.isEnabled({ openSeaMapEnabled: true } as PluginConfig), true)
})

test('the config fragment carries the enable, endpoint, and seamark-group keys', () => {
  const keys = Object.keys(openSeaMapInput.configSchema)
  assert.deepEqual(keys, ['openSeaMapEnabled', 'openSeaMapEndpoint', 'openSeaMapSeamarkGroups'])
})

test('createSource builds the OpenSeaMap PoiSource', () => {
  const context = {
    app: { debug: () => {}, error: () => {} },
    config: {},
    status: {},
    dataDir: ''
  } as unknown as InputContext
  const source = openSeaMapInput.createSource(context)
  assert.equal(source.id, 'openseamap')
  assert.equal(typeof source.listPointsOfInterest, 'function')
  assert.equal(typeof source.getDetails, 'function')
  source.close()
})
