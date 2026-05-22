import test from 'node:test'
import assert from 'node:assert/strict'
import { createInputRegistry } from '../src/inputs/input-registry.js'
import type { InputModule, PoiSource } from '../src/inputs/poi-source.js'
import type { Bbox, PoiDetailView, PoiSummary } from '../src/shared/types.js'

const SAMPLE_BBOX: Bbox = { north: 1, south: 0, east: 1, west: 0 }

/** Build a source-tagged summary. */
function summary (id: string, source: string): PoiSummary {
  return {
    id,
    type: 'Marina',
    position: { latitude: 0, longitude: 0 },
    name: `POI ${id}`,
    source,
    url: `https://example.test/${id}`,
    attribution: `Data from ${source}`
  }
}

/** Build a source-tagged detail view. */
function detailView (source: string): PoiDetailView {
  return {
    name: 'Detail',
    type: 'Marina',
    position: { latitude: 0, longitude: 0 },
    url: 'https://example.test/detail',
    source,
    attribution: `Data from ${source}`
  }
}

interface StubOptions {
  list?: () => Promise<PoiSummary[]>
  details?: (id: string) => Promise<PoiDetailView>
  cache?: number
}

function stubSource (id: string, options: StubOptions = {}): PoiSource {
  return {
    id,
    listPointsOfInterest: options.list ?? (async () => [summary('raw1', id)]),
    getDetails: options.details ?? (async () => detailView(id)),
    cacheSize: () => options.cache ?? 0,
    close: () => {}
  }
}

function stubModule (id: string, enabled: boolean, source?: PoiSource): InputModule {
  return {
    id,
    name: id,
    configSchema: { [`enable_${id}`]: { type: 'boolean' } },
    isEnabled: () => enabled,
    createSource: () => source ?? stubSource(id)
  }
}

const context = {
  app: {}, config: {}, status: { recordError: () => {} }, dataDir: '/tmp'
} as never

test('configSchemaFragments returns every module fragment', () => {
  const registry = createInputRegistry([stubModule('a', true), stubModule('b', false)])
  assert.deepEqual(registry.configSchemaFragments(), [
    { enable_a: { type: 'boolean' } },
    { enable_b: { type: 'boolean' } }
  ])
})

test('createSource throws when no module is enabled', () => {
  const registry = createInputRegistry([stubModule('a', false)])
  assert.throws(() => registry.createSource(context), /no input is enabled/i)
})

test('createSource builds an aggregate over the enabled inputs', () => {
  const registry = createInputRegistry([stubModule('a', true), stubModule('b', false)])
  assert.equal(registry.createSource(context).id, 'aggregate')
})

test('listPointsOfInterest prefixes each summary id with its source slug and unions results', async () => {
  const a = stubModule('sourceA', true, stubSource('sourceA', {
    list: async () => [summary('1', 'sourceA'), summary('2', 'sourceA')]
  }))
  const b = stubModule('sourceB', true, stubSource('sourceB', {
    list: async () => [summary('9', 'sourceB')]
  }))
  const source = createInputRegistry([a, b]).createSource(context)
  const list = await source.listPointsOfInterest(SAMPLE_BBOX, '')
  assert.deepEqual(
    list.map((poi) => poi.id).sort(),
    ['sourceA-1', 'sourceA-2', 'sourceB-9']
  )
})

test('getDetails routes to the source named by the id prefix, stripping the prefix', async () => {
  const seen: string[] = []
  const b = stubModule('sourceB', true, stubSource('sourceB', {
    details: async (id) => { seen.push(id); return detailView('sourceB') }
  }))
  const source = createInputRegistry([stubModule('sourceA', true), b]).createSource(context)
  const view = await source.getDetails('sourceB-raw1')
  assert.equal(view.source, 'sourceB')
  assert.deepEqual(seen, ['raw1'], 'only the prefix is stripped; the raw id reaches the source')
})

test('getDetails routes a raw id that itself contains hyphens on the first hyphen only', async () => {
  const seen: string[] = []
  const b = stubModule('openseamap', true, stubSource('openseamap', {
    details: async (id) => { seen.push(id); return detailView('openseamap') }
  }))
  const source = createInputRegistry([b]).createSource(context)
  await source.getDetails('openseamap-node/987-654')
  assert.deepEqual(seen, ['node/987-654'])
})

test('getDetails rejects an unknown source prefix', async () => {
  const source = createInputRegistry([stubModule('sourceA', true)]).createSource(context)
  await assert.rejects(source.getDetails('unknown-x'), /No source/i)
})

test('listPointsOfInterest keeps a successful source when another fails', async () => {
  const errors: string[] = []
  const failing = stubModule('sourceA', true, stubSource('sourceA', {
    list: async () => { throw new Error('overpass down') }
  }))
  const ok = stubModule('sourceB', true, stubSource('sourceB', {
    list: async () => [summary('9', 'sourceB')]
  }))
  const failContext = {
    app: {},
    config: {},
    dataDir: '/tmp',
    status: { recordError: (message: string) => errors.push(message) }
  } as never
  const source = createInputRegistry([failing, ok]).createSource(failContext)
  const list = await source.listPointsOfInterest(SAMPLE_BBOX, '')
  assert.deepEqual(list.map((poi) => poi.id), ['sourceB-9'])
  assert.equal(errors.length, 1, 'the failed source is recorded as an error')
  assert.match(errors[0], /sourceA/)
})

test('listPointsOfInterest throws when every source fails', async () => {
  const failing = stubModule('sourceA', true, stubSource('sourceA', {
    list: async () => { throw new Error('down') }
  }))
  const source = createInputRegistry([failing]).createSource(context)
  await assert.rejects(
    source.listPointsOfInterest(SAMPLE_BBOX, ''),
    /Every POI source failed/i
  )
})

test('cacheSize sums the cache size of every source', () => {
  const a = stubModule('sourceA', true, stubSource('sourceA', { cache: 3 }))
  const b = stubModule('sourceB', true, stubSource('sourceB', { cache: 4 }))
  const source = createInputRegistry([a, b]).createSource(context)
  assert.equal(source.cacheSize(), 7)
})

test('close closes every source', () => {
  const closed: string[] = []
  const makeSource = (id: string): PoiSource => ({
    ...stubSource(id), close: () => closed.push(id)
  })
  const a = stubModule('sourceA', true, makeSource('sourceA'))
  const b = stubModule('sourceB', true, makeSource('sourceB'))
  createInputRegistry([a, b]).createSource(context).close()
  assert.deepEqual(closed.sort(), ['sourceA', 'sourceB'])
})
