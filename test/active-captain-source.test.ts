import test from 'node:test'
import assert from 'node:assert/strict'
import { createActiveCaptainSource } from '../src/inputs/active-captain/active-captain-source.js'
import type { PoiDetails, PoiSummary } from '../src/shared/types.js'

const sampleDetails = { pointOfInterest: { name: 'X' } } as unknown as PoiDetails

function fakeClient () {
  return {
    listPointsOfInterest: async (): Promise<PoiSummary[]> =>
      [{ id: '1', name: 'A', type: 'Marina', position: { latitude: 0, longitude: 0 } }],
    pointOfInterestDetails: async (): Promise<PoiDetails> => sampleDetails,
    close: () => {}
  }
}

test('getDetails returns detail through the cache', async () => {
  const source = createActiveCaptainSource({
    client: fakeClient(),
    cachingDurationMinutes: 60,
    dataDir: '/tmp/crows-nest-test',
    status: { recordDetailSuccess: () => {}, recordError: () => {} } as never,
    app: { setPluginError: () => {}, debug: () => {} } as never
  })
  assert.equal((await source.getDetails('1')).pointOfInterest.name, 'X')
  assert.equal(source.id, 'activecaptain')
  source.close()
})

test('listPointsOfInterest delegates to the client', async () => {
  const source = createActiveCaptainSource({
    client: fakeClient(),
    cachingDurationMinutes: 60,
    dataDir: '/tmp/crows-nest-test',
    status: { recordDetailSuccess: () => {}, recordError: () => {} } as never,
    app: { setPluginError: () => {}, debug: () => {} } as never
  })
  const list = await source.listPointsOfInterest(
    { north: 1, south: 0, east: 1, west: 0 }, 'Marina')
  assert.equal(list.length, 1)
  source.close()
})
