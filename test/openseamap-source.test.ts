import test from 'node:test'
import assert from 'node:assert/strict'
import { createOpenSeaMapSource } from '../src/inputs/openseamap/openseamap-source.js'
import type { OverpassClient, OverpassElement } from '../src/inputs/openseamap/overpass-client.js'
import type { Bbox } from '../src/shared/types.js'

const sampleBbox: Bbox = { north: 1, south: 0, east: 1, west: 0 }

const rockNode: OverpassElement = {
  type: 'node',
  id: 123,
  tags: { 'seamark:type': 'rock', name: 'Big Rock' },
  position: { latitude: 50, longitude: 1 }
}

const marinaWay: OverpassElement = {
  type: 'way',
  id: 456,
  tags: { leisure: 'marina' },
  position: { latitude: 51, longitude: 2 }
}

/** A client over a fixed element set, counting its by-id detail queries. */
function fakeClient (overrides: Partial<OverpassClient> = {}): {
  client: OverpassClient
  getByIdCalls: () => number
} {
  let calls = 0
  const client: OverpassClient = {
    listPointsOfInterest: async (): Promise<OverpassElement[]> => [rockNode, marinaWay],
    getById: async (): Promise<OverpassElement | undefined> => {
      calls++
      return rockNode
    },
    close: () => {},
    ...overrides
  }
  return { client, getByIdCalls: () => calls }
}

test('listPointsOfInterest maps elements to source-tagged summaries', async () => {
  const source = createOpenSeaMapSource({ client: fakeClient().client, seamarkGroups: ['hazards'] })
  const list = await source.listPointsOfInterest(sampleBbox, '')
  assert.equal(source.id, 'openseamap')
  assert.deepEqual(list, [
    {
      id: 'node/123',
      type: 'Hazard',
      position: { latitude: 50, longitude: 1 },
      name: 'Big Rock',
      source: 'openseamap',
      url: 'https://www.openstreetmap.org/node/123',
      attribution: '© OpenStreetMap contributors (ODbL)'
    },
    {
      id: 'way/456',
      type: 'Marina',
      position: { latitude: 51, longitude: 2 },
      name: 'Unnamed marina',
      source: 'openseamap',
      url: 'https://www.openstreetmap.org/way/456',
      attribution: '© OpenStreetMap contributors (ODbL)'
    }
  ])
  source.close()
})

test('getDetails serves a listed element from cache without a by-id query', async () => {
  const { client, getByIdCalls } = fakeClient()
  const source = createOpenSeaMapSource({ client, seamarkGroups: ['hazards'] })
  await source.listPointsOfInterest(sampleBbox, '')
  const view = await source.getDetails('node/123')
  assert.equal(view.name, 'Big Rock')
  assert.equal(view.type, 'Hazard')
  assert.equal(view.source, 'openseamap')
  assert.equal(view.url, 'https://www.openstreetmap.org/node/123')
  assert.ok(
    view.description?.includes('© OpenStreetMap contributors (ODbL)'),
    'the rendered description carries the ODbL attribution footer'
  )
  assert.equal(getByIdCalls(), 0, 'a listed element is served from cache')
  source.close()
})

test('getDetails queries the client by id on a cache miss', async () => {
  const { client, getByIdCalls } = fakeClient()
  const source = createOpenSeaMapSource({ client, seamarkGroups: ['hazards'] })
  const view = await source.getDetails('node/123')
  assert.equal(view.name, 'Big Rock')
  assert.equal(getByIdCalls(), 1, 'a cache miss falls through to a by-id query')
  source.close()
})

test('getDetails rejects when the element no longer exists', async () => {
  const { client } = fakeClient({
    getById: async (): Promise<OverpassElement | undefined> => undefined
  })
  const source = createOpenSeaMapSource({ client, seamarkGroups: ['hazards'] })
  await assert.rejects(() => source.getDetails('node/999'), /No OpenSeaMap element found/)
  source.close()
})

test('cacheSize reflects the elements stashed from a list query', async () => {
  const source = createOpenSeaMapSource({ client: fakeClient().client, seamarkGroups: ['hazards'] })
  assert.equal(source.cacheSize(), 0)
  await source.listPointsOfInterest(sampleBbox, '')
  assert.equal(source.cacheSize(), 2)
  source.close()
})
