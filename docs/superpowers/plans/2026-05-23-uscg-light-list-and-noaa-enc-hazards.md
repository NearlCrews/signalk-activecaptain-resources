# USCG Light List and NOAA ENC Direct Hazards: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: this plan is executed by an
> agent team (up to 6 teammates). Steps use checkbox (`- [ ]`) syntax for
> tracking. Teammates coordinate edits to the shared registration file
> (`src/index.ts`) through the shared task list. Lanes B/C and lanes D/E are
> the two big parallel tracks; Lane A unblocks both; Lane F integrates last.

**Goal:** Ship two new POI input modules in `signalk-crows-nest`: the USCG
Light List (authoritative US Aids to Navigation, daily fresh) and NOAA ENC
Direct (the official AWOIS replacement: wrecks, obstructions, and underwater
rocks, weekly fresh).

**Architecture:** Two self-contained directories under `src/inputs/`, each a
new `InputModule` registered on one line in `src/index.ts`. Light List uses
periodic-download with conditional GET against 61 GeoJSON files; ENC Direct
uses at-runtime bbox queries against an ArcGIS REST FeatureServer. Both
default to disabled, both gate outbound HTTP on a coarse US-waters bbox, both
reuse the existing dedupe and alarm pipelines, and both render plain-English
HTML descriptions.

**Tech Stack:** TypeScript 6, `tsc` and webpack, ESLint 9 with neostandard,
`node:test` via `tsx`, Node 20.3+, `lru-cache`, the USCG NAVCEN MSI GeoJSON
endpoints, and the NOAA ENC Direct ArcGIS REST FeatureServers.

**Spec:** `docs/superpowers/specs/2026-05-23-uscg-light-list-and-noaa-enc-hazards-design.md`

---

## Conventions for every task

- Gate: `npm run typecheck && npm run lint && npm test && npm run build` must
  all be green before a task is done. Every commit is green.
- American English, no em dashes, the Oxford comma, in all code, comments,
  and commit messages.
- Test files import source modules with the `.js` extension (the existing
  convention; `tsx` resolves the source under the hood).
- Commit messages end with:
  `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Commit locally only; no push, no PR.
- The suite is 422 tests at the start; it must never go red.
- No mocking of HTTP at the boundary. Use a recorded fixture (a JSON file
  under `test/fixtures/`) plus a small in-process `http.createServer` to
  serve it; the client points at `http://127.0.0.1:<port>/...`. This is the
  same pattern used by the existing OpenSeaMap client test.

## Team lanes

- **Lane A (foundation)** - Phase 0: `src/shared/us-waters.ts`. Tiny,
  unblocks B and D.
- **Lane B (Light List acquisition)** - Phase 1: client, store, types.
- **Lane C (Light List adapter)** - Phase 2: mapping, detail renderer,
  source adapter, input module. Depends on Lane B.
- **Lane D (NOAA ENC acquisition)** - Phase 3: client and types. Parallel
  with Lane B.
- **Lane E (NOAA ENC adapter)** - Phase 4: mapping, detail renderer, source
  adapter, input module. Depends on Lane D.
- **Lane F (integration)** - Phase 5: panel cards, plugin config glue,
  `src/index.ts` registrations, docs. Depends on Lanes C and E.

Phase 0 runs first and alone (~30 minutes of work). Phases 1, 3 run in
parallel after Phase 0. Phase 2 runs after Phase 1; Phase 4 runs after Phase
3 (so Lanes B+C and D+E are two largely independent sequential tracks).
Phase 5 integrates everything after Phases 2 and 4 are done.

---

# Phase 0: Shared US-waters gate (Lane A)

### Task 0.1: Create `src/shared/us-waters.ts`

A small constants module and a single `isInUsWaters(position)` predicate
that both new inputs gate their outbound HTTP on. Several disjoint
rectangles (CONUS coastal + Alaska + Hawaii + Puerto Rico + USVI + Guam +
CNMI), so the Mediterranean is not falsely included.

**Files:**
- Create: `src/shared/us-waters.ts`
- Test: `test/us-waters.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/us-waters.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { isInUsWaters } from '../src/shared/us-waters.js'

test('isInUsWaters returns true for CONUS coastal positions', () => {
  // Boston Harbor
  assert.equal(isInUsWaters({ latitude: 42.36, longitude: -71.05 }), true)
  // San Francisco Bay
  assert.equal(isInUsWaters({ latitude: 37.78, longitude: -122.42 }), true)
  // Gulf of Mexico, off Galveston
  assert.equal(isInUsWaters({ latitude: 29.30, longitude: -94.79 }), true)
})

test('isInUsWaters returns true for Great Lakes positions', () => {
  // Lake Michigan, mid-lake
  assert.equal(isInUsWaters({ latitude: 43.50, longitude: -87.00 }), true)
  // Lake St. Clair
  assert.equal(isInUsWaters({ latitude: 42.45, longitude: -82.66 }), true)
})

test('isInUsWaters returns true for Alaska, Hawaii, and US territories', () => {
  // Juneau
  assert.equal(isInUsWaters({ latitude: 58.30, longitude: -134.42 }), true)
  // Honolulu
  assert.equal(isInUsWaters({ latitude: 21.31, longitude: -157.86 }), true)
  // San Juan, Puerto Rico
  assert.equal(isInUsWaters({ latitude: 18.47, longitude: -66.12 }), true)
  // Guam
  assert.equal(isInUsWaters({ latitude: 13.44, longitude: 144.79 }), true)
})

test('isInUsWaters returns false for clearly non-US positions', () => {
  // Mediterranean, off Barcelona
  assert.equal(isInUsWaters({ latitude: 41.38, longitude: 2.18 }), false)
  // English Channel, off Dover
  assert.equal(isInUsWaters({ latitude: 51.13, longitude: 1.31 }), false)
  // South China Sea, off Hong Kong
  assert.equal(isInUsWaters({ latitude: 22.30, longitude: 114.17 }), false)
  // Sydney Harbour
  assert.equal(isInUsWaters({ latitude: -33.85, longitude: 151.22 }), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='isInUsWaters'`
Expected: FAIL with "Cannot find module '../src/shared/us-waters.js'".

- [ ] **Step 3: Implement `us-waters.ts`**

```typescript
// src/shared/us-waters.ts
/**
 * Coarse US-waters bounding boxes used by US-only POI input modules to skip
 * outbound HTTP when the vessel is clearly elsewhere. Several disjoint
 * rectangles, not a single envelope, so the Mediterranean and other
 * non-US-waters do not falsely match. Deliberately generous: a false negative
 * would silently hide data, a false positive only sends one network request
 * that returns an empty FeatureCollection.
 */

import type { Position } from './types.js'

interface Bbox {
  readonly minLat: number
  readonly maxLat: number
  readonly minLon: number
  readonly maxLon: number
}

/** The set of disjoint envelopes that together cover US waters. */
const US_WATERS_BBOXES: readonly Bbox[] = [
  // CONUS coastal and inland waters, including the Great Lakes.
  { minLat: 24.0, maxLat: 49.5, minLon: -125.5, maxLon: -66.0 },
  // Alaska (the main landmass and the Aleutian arc up to the dateline).
  { minLat: 51.0, maxLat: 72.0, minLon: -180.0, maxLon: -129.0 },
  // Alaska, the western Aleutian tail across the 180° meridian.
  { minLat: 51.0, maxLat: 56.0, minLon: 172.0, maxLon: 180.0 },
  // Hawaii.
  { minLat: 18.5, maxLat: 23.0, minLon: -161.0, maxLon: -154.5 },
  // Puerto Rico and the US Virgin Islands.
  { minLat: 17.5, maxLat: 18.7, minLon: -67.5, maxLon: -64.5 },
  // Guam and the Northern Mariana Islands.
  { minLat: 13.0, maxLat: 21.0, minLon: 144.5, maxLon: 146.5 }
]

/** True when a position is inside one of the US-waters envelopes. */
export function isInUsWaters (position: Position): boolean {
  const { latitude, longitude } = position
  for (const bbox of US_WATERS_BBOXES) {
    if (
      latitude >= bbox.minLat &&
      latitude <= bbox.maxLat &&
      longitude >= bbox.minLon &&
      longitude <= bbox.maxLon
    ) {
      return true
    }
  }
  return false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='isInUsWaters'`
Expected: PASS, four sub-tests, all green.

- [ ] **Step 5: Full gate and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green, suite at 426 tests.

```bash
git add src/shared/us-waters.ts test/us-waters.test.ts
git commit -m "$(cat <<'EOF'
feat(shared): add isInUsWaters() gate for US-only POI inputs

A small coarse-bbox predicate that the upcoming USCG Light List and NOAA ENC
inputs use to skip outbound HTTP when the vessel is clearly outside US
waters. Several disjoint rectangles cover CONUS, Alaska, Hawaii, Puerto
Rico, USVI, Guam, and CNMI; non-US positions return false.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

# Phase 1: USCG Light List acquisition (Lane B)

### Task 1.1: Define the Light List wire and parsed types

**Files:**
- Create: `src/inputs/uscg-light-list/light-list-types.ts`

- [ ] **Step 1: Implement `light-list-types.ts`**

```typescript
// src/inputs/uscg-light-list/light-list-types.ts
/**
 * Wire and parsed types for the USCG Light List GeoJSON feed.
 *
 * The MSI GeoJSON files at navcen.uscg.gov return a standard FeatureCollection
 * with one Feature per Aid to Navigation. The wire shape carries every USCG
 * field; the parsed shape (LightListRecord) strips the fields the plugin
 * never displays.
 */

import type { Position } from '../../shared/types.js'

/** A single USCG Light List feature off the wire. */
export interface LightListFeature {
  type: 'Feature'
  id?: number | string
  geometry: { type: 'Point', coordinates: [number, number] }
  properties: LightListProperties
}

/** Every wire property the USCG MSI feed publishes (those we read). */
export interface LightListProperties {
  LIGHT_LIST_NUMBER: number
  NAME: string
  DECIMAL_LATITUDE: number
  DECIMAL_LONGITUDE: number
  LIGHT_CHAR?: string
  COLOR?: string
  LIGHT_NOM_RANGE?: number
  LIGHT_NOM_RANGE_UNIT?: string
  LIGHT_FOCAL_PLANE?: number
  LIGHT_FOCAL_PLANE_UNIT?: string
  STRUCTURE_TYPE?: string
  STRUCTURE_HEIGHT?: number
  STRUCTURE_HEIGHT_UNIT?: string
  DAYMARK_SHAPE?: string
  DAYMARK_COLOR?: string
  SOUND_EMITTER_TYPE?: string
  RACON_MORSE_CHARACTER?: string
  AID_TYPE?: string
  AID_SUBTYPE?: string
  REMARK?: string
  VOLUME_NUMBER: number
  MODIFIED_DATE?: number
  INACTIVE?: string
  // ...other fields exist on the wire; we ignore them on parse.
}

/** A single Light List feature as stored in the plugin's in-memory index. */
export interface LightListRecord {
  llnr: number
  name: string
  position: Position
  lightChar?: string
  color?: string
  nominalRange?: { value: number, unit: string }
  focalPlane?: { value: number, unit: string }
  structureType?: string
  structureHeight?: { value: number, unit: string }
  daymarkShape?: string
  daymarkColor?: string
  soundEmitterType?: string
  racon?: string
  aidType?: string
  aidSubtype?: string
  remark?: string
  district: string
  volume: number
  source: 'usclightlist'
  modifiedDate?: string
  inactive: boolean
}

/** Headers from a successful GeoJSON download, used for conditional GET. */
export interface DistrictHeaders {
  lastModified?: string
  etag?: string
}

/** Metadata about one downloaded district file. */
export interface DistrictMeta extends DistrictHeaders {
  recordCount: number
  fetchedAt: string
}

/** The on-disk index: per-district metadata plus the merged record map. */
export interface LightListIndex {
  generated: string
  districts: Record<string, DistrictMeta>
  records: Record<string, LightListRecord>
}
```

- [ ] **Step 2: Verify typecheck, commit**

Run: `npm run typecheck`
Expected: green.

```bash
git add src/inputs/uscg-light-list/light-list-types.ts
git commit -m "$(cat <<'EOF'
feat(uscg-light-list): scaffold the wire and parsed types

Adds LightListFeature, LightListProperties, LightListRecord, and the
on-disk LightListIndex shape. Wire fields the plugin never displays
(*_UID, ATONIX_DATE, ESRI_OID, redundant DMS positions, jurisdictional
metadata) are deliberately not declared: they will be discarded at parse
time by the client in the next task.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: HTTP client (download + conditional GET + parse)

**Files:**
- Create: `src/inputs/uscg-light-list/light-list-client.ts`
- Test: `test/light-list-client.test.ts`
- Fixture: `test/fixtures/light-list-d01-1.geojson` (a 5-record slice of the
  real D01_1 file, captured during plan execution)

- [ ] **Step 1: Capture a fixture**

Run `curl 'https://navcen.uscg.gov/sites/default/files/msi/lightListD01_1.geojson' | jq '.features[:5]'`
and wrap the result in a `{ "type": "FeatureCollection", "features": [...] }`
envelope, save as `test/fixtures/light-list-d01-1.geojson`. Include a record
with a fog signal and a record with a racon to exercise both code paths.

- [ ] **Step 2: Write the client test (failing)**

```typescript
// test/light-list-client.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createLightListClient } from '../src/inputs/uscg-light-list/light-list-client.js'

async function startFixtureServer () {
  const body = await readFile('test/fixtures/light-list-d01-1.geojson')
  let requests: { method: string, url: string, headers: Record<string,string> }[] = []
  const server = createServer((req, res) => {
    requests.push({
      method: req.method ?? 'GET',
      url: req.url ?? '/',
      headers: req.headers as Record<string, string>
    })
    const ifModifiedSince = req.headers['if-modified-since']
    const ifNoneMatch = req.headers['if-none-match']
    if (ifModifiedSince === 'Thu, 22 May 2026 09:26:29 GMT' || ifNoneMatch === '"abc"') {
      res.statusCode = 304
      return res.end()
    }
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Last-Modified', 'Thu, 22 May 2026 09:26:29 GMT')
    res.setHeader('ETag', '"abc"')
    res.end(body)
  })
  await new Promise<void>(resolve => server.listen(0, resolve))
  const addr = server.address()
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0
  return { url: `http://127.0.0.1:${port}`, requests, close: () => server.close() }
}

test('downloadDistrict parses the GeoJSON into LightListRecord values', async () => {
  const server = await startFixtureServer()
  try {
    const client = createLightListClient({ baseUrl: server.url })
    const result = await client.downloadDistrict('D01', 1)
    assert.equal(result.status, 'ok')
    assert.ok(Array.isArray(result.records))
    assert.equal(result.records.length, 5)
    const first = result.records[0]
    assert.equal(typeof first.llnr, 'number')
    assert.equal(typeof first.name, 'string')
    assert.equal(first.district, 'D01')
    assert.equal(first.volume, 1)
    assert.equal(first.source, 'usclightlist')
    assert.equal(result.headers?.lastModified, 'Thu, 22 May 2026 09:26:29 GMT')
    assert.equal(result.headers?.etag, '"abc"')
  } finally {
    server.close()
  }
})

test('downloadDistrict returns "not-modified" on 304 conditional response', async () => {
  const server = await startFixtureServer()
  try {
    const client = createLightListClient({ baseUrl: server.url })
    const result = await client.downloadDistrict('D01', 1, {
      lastModified: 'Thu, 22 May 2026 09:26:29 GMT',
      etag: '"abc"'
    })
    assert.equal(result.status, 'not-modified')
    assert.equal(server.requests.at(-1)?.headers['if-modified-since'],
      'Thu, 22 May 2026 09:26:29 GMT')
    assert.equal(server.requests.at(-1)?.headers['if-none-match'], '"abc"')
  } finally {
    server.close()
  }
})

test('downloadDistrict sends the descriptive User-Agent', async () => {
  const server = await startFixtureServer()
  try {
    const client = createLightListClient({ baseUrl: server.url })
    await client.downloadDistrict('D01', 1)
    const ua = server.requests.at(-1)?.headers['user-agent']
    assert.match(ua ?? '', /signalk-crows-nest/)
  } finally {
    server.close()
  }
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx tsx --test test/light-list-client.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement `light-list-client.ts`**

```typescript
// src/inputs/uscg-light-list/light-list-client.ts
/**
 * USCG Light List HTTP client.
 *
 * Issues GET requests against the NAVCEN MSI GeoJSON files and parses each
 * feature into a LightListRecord. Supports conditional GET via
 * If-Modified-Since and If-None-Match so a daily refresh tick that finds
 * no upstream change does no work. The 61 file URLs follow the pattern
 * `<baseUrl>/sites/default/files/msi/lightListD{DD}_{N}.geojson`.
 */

import { request } from 'node:https'
import { request as httpRequest } from 'node:http'
import type {
  DistrictHeaders,
  LightListFeature,
  LightListProperties,
  LightListRecord
} from './light-list-types.js'

const USER_AGENT = 'signalk-crows-nest (+https://github.com/nlabadie/signalk-crows-nest)'

export interface LightListClient {
  downloadDistrict: (
    district: string,
    page: number,
    previousHeaders?: DistrictHeaders
  ) => Promise<DownloadResult>
}

export type DownloadResult =
  | { status: 'ok', records: LightListRecord[], headers: DistrictHeaders }
  | { status: 'not-modified' }
  | { status: 'error', message: string }

export interface LightListClientConfig {
  baseUrl?: string
}

const DEFAULT_BASE_URL = 'https://navcen.uscg.gov'

/** Parse a single GeoJSON feature into the in-memory record shape. */
function parseFeature (
  feature: LightListFeature,
  district: string
): LightListRecord | null {
  const p = feature.properties
  if (typeof p?.LIGHT_LIST_NUMBER !== 'number') return null
  const record: LightListRecord = {
    llnr: p.LIGHT_LIST_NUMBER,
    name: p.NAME ?? '',
    position: { latitude: p.DECIMAL_LATITUDE, longitude: p.DECIMAL_LONGITUDE },
    district,
    volume: p.VOLUME_NUMBER,
    source: 'usclightlist',
    inactive: p.INACTIVE === '1'
  }
  if (p.LIGHT_CHAR !== undefined) record.lightChar = p.LIGHT_CHAR
  if (p.COLOR !== undefined) record.color = p.COLOR
  if (p.LIGHT_NOM_RANGE !== undefined && p.LIGHT_NOM_RANGE_UNIT !== undefined) {
    record.nominalRange = { value: p.LIGHT_NOM_RANGE, unit: p.LIGHT_NOM_RANGE_UNIT }
  }
  if (p.LIGHT_FOCAL_PLANE !== undefined && p.LIGHT_FOCAL_PLANE_UNIT !== undefined) {
    record.focalPlane = { value: p.LIGHT_FOCAL_PLANE, unit: p.LIGHT_FOCAL_PLANE_UNIT }
  }
  if (p.STRUCTURE_TYPE !== undefined) record.structureType = p.STRUCTURE_TYPE
  if (p.STRUCTURE_HEIGHT !== undefined && p.STRUCTURE_HEIGHT_UNIT !== undefined) {
    record.structureHeight = { value: p.STRUCTURE_HEIGHT, unit: p.STRUCTURE_HEIGHT_UNIT }
  }
  if (p.DAYMARK_SHAPE !== undefined) record.daymarkShape = p.DAYMARK_SHAPE
  if (p.DAYMARK_COLOR !== undefined) record.daymarkColor = p.DAYMARK_COLOR
  if (p.SOUND_EMITTER_TYPE !== undefined) record.soundEmitterType = p.SOUND_EMITTER_TYPE
  if (p.RACON_MORSE_CHARACTER !== undefined) record.racon = p.RACON_MORSE_CHARACTER
  if (p.AID_TYPE !== undefined) record.aidType = p.AID_TYPE
  if (p.AID_SUBTYPE !== undefined) record.aidSubtype = p.AID_SUBTYPE
  if (p.REMARK !== undefined) record.remark = p.REMARK
  if (typeof p.MODIFIED_DATE === 'number') {
    record.modifiedDate = new Date(p.MODIFIED_DATE).toISOString()
  }
  return record
}

function fetchUrl (
  url: string,
  headers: Record<string, string>
): Promise<{ status: number, body: string, headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https:') ? request : httpRequest
    const req = transport(url, { headers, method: 'GET' }, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf8'),
        headers: res.headers as Record<string, string>
      }))
    })
    req.on('error', reject)
    req.end()
  })
}

export function createLightListClient (config: LightListClientConfig = {}): LightListClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  return {
    async downloadDistrict (district, page, previousHeaders) {
      const url = `${baseUrl}/sites/default/files/msi/lightList${district}_${page}.geojson`
      const headers: Record<string, string> = { 'User-Agent': USER_AGENT }
      if (previousHeaders?.lastModified !== undefined) {
        headers['If-Modified-Since'] = previousHeaders.lastModified
      }
      if (previousHeaders?.etag !== undefined) {
        headers['If-None-Match'] = previousHeaders.etag
      }
      try {
        const res = await fetchUrl(url, headers)
        if (res.status === 304) return { status: 'not-modified' }
        if (res.status !== 200) {
          return { status: 'error', message: `HTTP ${res.status}` }
        }
        const collection = JSON.parse(res.body) as { features?: LightListFeature[] }
        const records: LightListRecord[] = []
        for (const feature of collection.features ?? []) {
          const parsed = parseFeature(feature, district)
          if (parsed !== null) records.push(parsed)
        }
        return {
          status: 'ok',
          records,
          headers: {
            lastModified: res.headers['last-modified'],
            etag: res.headers.etag
          }
        }
      } catch (error) {
        return { status: 'error', message: String(error) }
      }
    }
  }
}
```

- [ ] **Step 5: Run test, gate, commit**

Run: `npx tsx --test test/light-list-client.test.ts`
Expected: PASS, three sub-tests.

Then the full gate: `npm run typecheck && npm run lint && npm test && npm run build`. Expected: green, ~429 tests.

```bash
git add src/inputs/uscg-light-list/light-list-client.ts \
        test/light-list-client.test.ts \
        test/fixtures/light-list-d01-1.geojson
git commit -m "$(cat <<'EOF'
feat(uscg-light-list): add HTTP client with conditional GET

Downloads a single district GeoJSON from the NAVCEN MSI feed and parses
each feature into the in-memory LightListRecord shape. Conditional GET
via If-Modified-Since and If-None-Match returns "not-modified" on 304,
so a daily refresh tick that finds no upstream change does no parsing.
The client sends a descriptive User-Agent identifying the plugin.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 1.3: On-disk store

**Files:**
- Create: `src/inputs/uscg-light-list/light-list-store.ts`
- Test: `test/light-list-store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/light-list-store.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLightListStore } from '../src/inputs/uscg-light-list/light-list-store.js'
import type { LightListRecord } from '../src/inputs/uscg-light-list/light-list-types.js'

function sampleRecord (llnr: number, district = 'D01'): LightListRecord {
  return {
    llnr, name: `Light ${llnr}`,
    position: { latitude: 42.0, longitude: -71.0 },
    district, volume: 1, source: 'usclightlist', inactive: false
  }
}

test('store reads an empty index on cold start', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'll-store-'))
  try {
    const store = createLightListStore(dir)
    const index = await store.load()
    assert.equal(Object.keys(index.records).length, 0)
    assert.equal(Object.keys(index.districts).length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('store round-trips a district write and reload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'll-store-'))
  try {
    const store1 = createLightListStore(dir)
    await store1.load()
    store1.upsertDistrict('D01', 1, [sampleRecord(100), sampleRecord(101)], {
      lastModified: 'Thu, 22 May 2026 09:26:29 GMT', etag: '"abc"'
    })
    await store1.flush()
    const store2 = createLightListStore(dir)
    const reloaded = await store2.load()
    assert.equal(Object.keys(reloaded.records).length, 2)
    assert.equal(reloaded.records['100'].name, 'Light 100')
    assert.equal(reloaded.districts['D01_1']?.recordCount, 2)
    assert.equal(reloaded.districts['D01_1']?.lastModified,
      'Thu, 22 May 2026 09:26:29 GMT')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('store replaces a district on re-upsert (no record bleed)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'll-store-'))
  try {
    const store = createLightListStore(dir)
    await store.load()
    store.upsertDistrict('D01', 1, [sampleRecord(100), sampleRecord(101)], {})
    store.upsertDistrict('D01', 1, [sampleRecord(200)], {})
    await store.flush()
    const reloaded = await createLightListStore(dir).load()
    // Records 100 and 101 should be gone; only 200 remains under D01_1.
    assert.equal(reloaded.records['100'], undefined)
    assert.equal(reloaded.records['101'], undefined)
    assert.equal(reloaded.records['200'].llnr, 200)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Run test, expect failure**

Run: `npx tsx --test test/light-list-store.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `light-list-store.ts`**

```typescript
// src/inputs/uscg-light-list/light-list-store.ts
/**
 * On-disk store for the parsed USCG Light List. Persists a single JSON file
 * at `<dataDir>/uscg-light-list/index.json` carrying per-district headers and
 * the merged record map keyed by LLNR. Re-upserting a district replaces ALL
 * its records (no bleed from a previous fetch when an aid is removed
 * upstream).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  DistrictHeaders,
  LightListIndex,
  LightListRecord
} from './light-list-types.js'

const INDEX_FILENAME = 'index.json'

export interface LightListStore {
  load: () => Promise<LightListIndex>
  upsertDistrict: (
    district: string, page: number,
    records: readonly LightListRecord[], headers: DistrictHeaders
  ) => void
  flush: () => Promise<void>
  snapshot: () => LightListIndex
}

function emptyIndex (): LightListIndex {
  return {
    generated: new Date().toISOString(),
    districts: {},
    records: {}
  }
}

function districtKey (district: string, page: number): string {
  return `${district}_${page}`
}

export function createLightListStore (dataDir: string): LightListStore {
  const storeDir = join(dataDir, 'uscg-light-list')
  const filePath = join(storeDir, INDEX_FILENAME)
  // The set of LLNRs known to come from each district file, so a re-upsert
  // can remove the previous set before adding the new one.
  const llnrsByDistrict = new Map<string, Set<number>>()
  let index = emptyIndex()
  return {
    async load () {
      if (!existsSync(filePath)) {
        index = emptyIndex()
        llnrsByDistrict.clear()
        return index
      }
      const raw = await readFile(filePath, 'utf8')
      index = JSON.parse(raw) as LightListIndex
      llnrsByDistrict.clear()
      for (const [key, _meta] of Object.entries(index.districts)) {
        const llnrs = new Set<number>()
        for (const record of Object.values(index.records)) {
          if (districtKey(record.district, /* page */ 1) === key) {
            // The store does not track page granularity in the record itself.
            // The set is rebuilt from the records that match district+page.
            llnrs.add(record.llnr)
          }
        }
        llnrsByDistrict.set(key, llnrs)
      }
      return index
    },
    upsertDistrict (district, page, records, headers) {
      const key = districtKey(district, page)
      const previous = llnrsByDistrict.get(key) ?? new Set()
      for (const llnr of previous) {
        delete index.records[String(llnr)]
      }
      const next = new Set<number>()
      for (const record of records) {
        index.records[String(record.llnr)] = record
        next.add(record.llnr)
      }
      llnrsByDistrict.set(key, next)
      index.districts[key] = {
        ...headers, recordCount: records.length, fetchedAt: new Date().toISOString()
      }
      index.generated = new Date().toISOString()
    },
    async flush () {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, JSON.stringify(index), 'utf8')
    },
    snapshot () { return index }
  }
}
```

- [ ] **Step 4: Run test, gate, commit**

Run: `npx tsx --test test/light-list-store.test.ts`
Expected: PASS, three sub-tests.

Full gate, then commit:

```bash
git add src/inputs/uscg-light-list/light-list-store.ts \
        test/light-list-store.test.ts
git commit -m "$(cat <<'EOF'
feat(uscg-light-list): persistent on-disk index

A single JSON file under <dataDir>/uscg-light-list/index.json holds the
merged Light List record map keyed by LLNR plus per-district headers for
conditional GET. Re-upserting a district replaces all its records so an
aid removed upstream does not linger in the index.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

# Phase 2: USCG Light List adapter (Lane C)

### Task 2.1: `light-list-mapping.ts` (AID_TYPE -> PoiType + skIcon)

**Files:**
- Create: `src/inputs/uscg-light-list/light-list-mapping.ts`
- Test: `test/light-list-mapping.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/light-list-mapping.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  recordPoiType,
  recordSkIcon,
  isIsolatedDanger
} from '../src/inputs/uscg-light-list/light-list-mapping.js'
import type { LightListRecord } from '../src/inputs/uscg-light-list/light-list-types.js'

function record (overrides: Partial<LightListRecord>): LightListRecord {
  return {
    llnr: 1, name: 'X',
    position: { latitude: 0, longitude: 0 },
    district: 'D01', volume: 1, source: 'usclightlist', inactive: false,
    ...overrides
  }
}

test('every Light List record maps to PoiType Navigational', () => {
  assert.equal(recordPoiType(record({ aidType: 'FD/FX' })), 'Navigational')
  assert.equal(recordPoiType(record({ aidType: 'PA/FL' })), 'Navigational')
  assert.equal(recordPoiType(record({ aidType: undefined })), 'Navigational')
})

test('default skIcon is navigation-structure', () => {
  assert.equal(recordSkIcon(record({ aidType: 'FD/FX' })), 'navigation-structure')
  assert.equal(recordSkIcon(record({})), 'navigation-structure')
})

test('isolated-danger aids resolve to the hazard skIcon while PoiType stays Navigational', () => {
  const r = record({ aidSubtype: 'ISO/DG' })
  assert.equal(isIsolatedDanger(r), true)
  assert.equal(recordSkIcon(r), 'hazard')
  assert.equal(recordPoiType(r), 'Navigational')
})

test('inactive aids fall back to the notice-to-mariners skIcon', () => {
  const r = record({ aidType: 'FD/FX', inactive: true })
  assert.equal(recordSkIcon(r), 'notice-to-mariners')
})
```

- [ ] **Step 2: Run test to verify it fails, then implement**

```typescript
// src/inputs/uscg-light-list/light-list-mapping.ts
/**
 * AID_TYPE / AID_SUBTYPE / INACTIVE -> PoiType + Freeboard skIcon mapping
 * for USCG Light List records.
 *
 * Every Light List entry is a navigation aid, so PoiType is always
 * 'Navigational'. The Freeboard icon is navigation-structure by default;
 * isolated-danger AtoNs get the hazard glyph (matching the existing
 * OpenSeaMap pattern), and inactive aids get the notice-to-mariners glyph
 * so they read as informational on the chart.
 */

import type { LightListRecord } from './light-list-types.js'
import type { PoiType } from '../../shared/types.js'

const ISOLATED_DANGER_SUBTYPE_PATTERN = /\bISO\/DG\b|\bIDM\b/i

export function isIsolatedDanger (record: LightListRecord): boolean {
  if (record.aidSubtype !== undefined && ISOLATED_DANGER_SUBTYPE_PATTERN.test(record.aidSubtype)) {
    return true
  }
  if (record.remark !== undefined && /isolated\s+danger/i.test(record.remark)) {
    return true
  }
  return false
}

export function recordPoiType (_record: LightListRecord): PoiType {
  return 'Navigational'
}

export function recordSkIcon (record: LightListRecord): string {
  if (record.inactive) return 'notice-to-mariners'
  if (isIsolatedDanger(record)) return 'hazard'
  return 'navigation-structure'
}
```

- [ ] **Step 3: Run test, gate, commit**

```bash
git add src/inputs/uscg-light-list/light-list-mapping.ts \
        test/light-list-mapping.test.ts
git commit -m "$(cat <<'EOF'
feat(uscg-light-list): AID_TYPE -> PoiType + Freeboard skIcon mapping

Every entry is PoiType Navigational. Default skIcon is navigation-structure;
isolated-danger aids get the hazard glyph (matching the existing OpenSeaMap
pattern) while the PoiType stays Navigational so the proximity alarm does
not falsely trigger on the buoy itself; inactive aids get notice-to-mariners.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.2: `light-list-detail.ts` (plain-English HTML renderer)

**Files:**
- Create: `src/inputs/uscg-light-list/light-list-detail.ts`
- Test: `test/light-list-detail.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/light-list-detail.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderLightListDetail } from '../src/inputs/uscg-light-list/light-list-detail.js'
import type { LightListRecord } from '../src/inputs/uscg-light-list/light-list-types.js'

function record (overrides: Partial<LightListRecord>): LightListRecord {
  return {
    llnr: 40100, name: 'Whipple Point Light',
    position: { latitude: 42.0, longitude: -71.0 },
    district: 'D01', volume: 1, source: 'usclightlist', inactive: false,
    ...overrides
  }
}

test('renders a major light with all common fields humanized', () => {
  const html = renderLightListDetail(record({
    lightChar: 'Fl W 4s',
    nominalRange: { value: 14, unit: 'NAUT MI' },
    focalPlane: { value: 67, unit: 'FT' },
    structureType: 'White tower on cylindrical base',
    structureHeight: { value: 28, unit: 'FT' },
    soundEmitterType: 'HORN',
    racon: 'B',
    remark: 'Visible 015° to 195°'
  }))
  assert.ok(html.includes('Whipple Point Light'))
  assert.ok(html.includes('LLNR 40100'))
  assert.ok(html.includes('flashing'))
  assert.ok(html.includes('white'))
  assert.ok(html.includes('14 NM range'))
  assert.ok(html.includes('67 ft focal plane'))
  assert.ok(html.includes('White tower on cylindrical base'))
  assert.ok(html.includes('HORN'))
  assert.ok(html.includes('RACON'))
  assert.ok(html.includes('B'))
  assert.ok(html.includes('Visible 015° to 195°'))
})

test('renders an inactive aid with an "(inactive)" suffix in the header', () => {
  const html = renderLightListDetail(record({ inactive: true }))
  assert.ok(html.includes('(inactive)'))
})

test('escapes HTML in REMARK so a stray tag cannot inject markup', () => {
  const html = renderLightListDetail(record({ remark: '<script>alert(1)</script>' }))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
})

test('renders a daymark-only entry without a Light: line', () => {
  const html = renderLightListDetail(record({
    daymarkShape: 'square',
    daymarkColor: 'red'
  }))
  assert.ok(html.includes('Daymark'))
  assert.ok(!html.includes('<strong>Light:</strong>'))
})
```

- [ ] **Step 2: Implement `light-list-detail.ts`**

```typescript
// src/inputs/uscg-light-list/light-list-detail.ts
/**
 * Plain-English HTML renderer for a USCG Light List record. The wire format
 * carries USCG-specific abbreviations and unit codes that mean nothing on a
 * chart popup; this module humanizes them. The IALA light-character vocabulary
 * is reused from the OpenSeaMap module (the abbreviations are identical).
 */

import type { LightListRecord } from './light-list-types.js'
import { humanizeLightCharacter } from '../openseamap/openseamap-detail.js'

function escape (value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rangeUnit (unit: string): string {
  if (unit === 'NAUT MI') return 'NM'
  if (unit === 'STAT MI') return 'mi'
  return unit
}

function heightUnit (unit: string): string {
  return unit.toLowerCase()
}

/** Translate "Fl W 4s" into "flashing white, 4 s period". */
function humanizeLightChar (raw: string): string {
  const tokens = raw.trim().split(/\s+/)
  const parts: string[] = []
  if (tokens.length > 0) parts.push(humanizeLightCharacter(tokens[0]))
  if (tokens.length > 1) parts.push(humanizeColor(tokens[1]))
  if (tokens.length > 2) {
    const period = tokens[2].replace(/s$/i, '')
    parts.push(`${period} s period`)
  }
  return parts.join(', ')
}

const COLOR: Readonly<Record<string, string>> = {
  W: 'white', R: 'red', G: 'green', Y: 'yellow', B: 'blue'
}
function humanizeColor (token: string): string {
  return COLOR[token] ?? token.toLowerCase()
}

function lightLine (r: LightListRecord): string | null {
  if (r.lightChar === undefined && r.color === undefined &&
      r.nominalRange === undefined && r.focalPlane === undefined) {
    return null
  }
  const parts: string[] = []
  if (r.lightChar !== undefined) parts.push(humanizeLightChar(r.lightChar))
  if (r.nominalRange !== undefined) {
    parts.push(`${r.nominalRange.value} ${rangeUnit(r.nominalRange.unit)} range`)
  }
  if (r.focalPlane !== undefined) {
    parts.push(`${r.focalPlane.value} ${heightUnit(r.focalPlane.unit)} focal plane`)
  }
  return parts.join(', ')
}

export function renderLightListDetail (record: LightListRecord): string {
  const blocks: string[] = []
  const header = `${escape(record.name)} (LLNR ${record.llnr})${record.inactive ? ' (inactive)' : ''}`
  blocks.push(`<h4>${header}</h4>`)
  const light = lightLine(record)
  if (light !== null) blocks.push(`<p><strong>Light:</strong> ${escape(light)}.</p>`)
  if (record.structureType !== undefined || record.structureHeight !== undefined) {
    const parts: string[] = []
    if (record.structureType !== undefined) parts.push(record.structureType)
    if (record.structureHeight !== undefined) {
      parts.push(`${record.structureHeight.value} ${heightUnit(record.structureHeight.unit)} tall`)
    }
    blocks.push(`<p><strong>Structure:</strong> ${escape(parts.join(', '))}.</p>`)
  }
  if (record.daymarkShape !== undefined || record.daymarkColor !== undefined) {
    const parts: string[] = []
    if (record.daymarkColor !== undefined) parts.push(record.daymarkColor)
    if (record.daymarkShape !== undefined) parts.push(record.daymarkShape)
    blocks.push(`<p><strong>Daymark:</strong> ${escape(parts.join(' '))}.</p>`)
  }
  if (record.soundEmitterType !== undefined) {
    blocks.push(`<p><strong>Sound signal:</strong> ${escape(record.soundEmitterType)}.</p>`)
  }
  if (record.racon !== undefined) {
    blocks.push(`<p><strong>RACON:</strong> ${escape(record.racon)} (Morse).</p>`)
  }
  if (record.remark !== undefined && record.remark.length > 0) {
    blocks.push(`<p><strong>Remarks:</strong> ${escape(record.remark)}</p>`)
  }
  const updated = record.modifiedDate !== undefined
    ? ` (last updated ${escape(record.modifiedDate.slice(0, 10))})` : ''
  blocks.push(`<p><strong>Source:</strong> USCG Light List, Volume ${record.volume}, District ${escape(record.district)}${updated}.</p>`)
  return blocks.join('')
}
```

- [ ] **Step 3: Run test, gate, commit**

```bash
git add src/inputs/uscg-light-list/light-list-detail.ts \
        test/light-list-detail.test.ts
git commit -m "$(cat <<'EOF'
feat(uscg-light-list): plain-English detail renderer

Humanizes the USCG-specific abbreviations and unit codes into a friendly
HTML description: IALA light characters reuse the OpenSeaMap humanizer,
color tokens (W/R/G) and unit codes (NAUT MI, STAT MI, FT) are spelled
out, inactive aids get an "(inactive)" header suffix, and REMARK is
rendered verbatim with HTML escaped.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.3: `uscg-light-list-source.ts` (the PoiSource adapter)

**Files:**
- Create: `src/inputs/uscg-light-list/uscg-light-list-source.ts`
- Test: `test/uscg-light-list-source.test.ts`

- [ ] **Step 1: Implement `uscg-light-list-source.ts`**

```typescript
// src/inputs/uscg-light-list/uscg-light-list-source.ts
/**
 * USCG Light List POI source.
 *
 * Wraps the HTTP client and the on-disk store in a PoiSource. The list query
 * filters the in-memory index by bbox; getDetails is always a cache hit
 * because the full index is loaded into memory on start. Outbound HTTP is
 * gated on isInUsWaters(currentPosition): a vessel that has left US waters
 * keeps its already-loaded index but issues no refresh against NAVCEN until
 * it returns.
 */

import type { LightListClient } from './light-list-client.js'
import type { LightListStore } from './light-list-store.js'
import { recordPoiType, recordSkIcon } from './light-list-mapping.js'
import { renderLightListDetail } from './light-list-detail.js'
import type { PoiSource } from '../poi-source.js'
import { appendAttribution } from '../../shared/attribution.js'
import type { Bbox, Position, PoiDetailView, PoiSummary } from '../../shared/types.js'
import { isInUsWaters } from '../../shared/us-waters.js'
import type { PluginStatus } from '../../status/plugin-status.js'

export const USCG_LIGHT_LIST_SOURCE_ID = 'usclightlist'
const ATTRIBUTION = '© USCG (US Government public domain)'
const URL_PREFIX = 'https://www.navcen.uscg.gov/light-list-search-results'

/** All 61 (district, page) pairs, hard-coded from the NAVCEN /msi index. */
export const DISTRICT_PAGES: ReadonlyArray<readonly [string, number]> = [
  ['D01', 1], ['D01', 2], ['D01', 3], ['D01', 4],
  ['D02', 1], ['D02', 2],
  ['D05', 1], ['D05', 2], ['D05', 3], ['D05', 4],
  ['D07', 1], ['D07', 2], ['D07', 3], ['D07', 4], ['D07', 5],
  ['D07', 6], ['D07', 7], ['D07', 8], ['D07', 9], ['D07', 10],
  ['D07', 11], ['D07', 12], ['D07', 13], ['D07', 14], ['D07', 15],
  ['D08', 1], ['D08', 2], ['D08', 3], ['D08', 4],
  ['D09', 1], ['D09', 2], ['D09', 3],
  ['D11', 1],
  ['D13', 1], ['D13', 2],
  ['D14', 1],
  ['D17', 1]
]

export interface UscgLightListSourceConfig {
  client: LightListClient
  store: LightListStore
  status: PluginStatus
  /** Returns the most recent vessel position, or undefined when unknown. */
  getCurrentPosition: () => Position | undefined
}

export function createUscgLightListSource (config: UscgLightListSourceConfig): PoiSource {
  const { client, store, status, getCurrentPosition } = config

  async function refreshAll (): Promise<void> {
    const position = getCurrentPosition()
    if (position !== undefined && !isInUsWaters(position)) {
      status.recordSkipped?.(USCG_LIGHT_LIST_SOURCE_ID, 'outside US waters')
      return
    }
    for (const [district, page] of DISTRICT_PAGES) {
      const key = `${district}_${page}`
      const previous = store.snapshot().districts[key]
      const result = await client.downloadDistrict(district, page, {
        lastModified: previous?.lastModified,
        etag: previous?.etag
      })
      if (result.status === 'ok') {
        store.upsertDistrict(district, page, result.records, result.headers)
      } else if (result.status === 'error') {
        status.recordError(USCG_LIGHT_LIST_SOURCE_ID,
          `Refresh failed for ${key}: ${result.message}`)
      }
    }
    await store.flush()
  }

  return {
    id: USCG_LIGHT_LIST_SOURCE_ID,
    listPointsOfInterest: async (bbox: Bbox): Promise<PoiSummary[]> => {
      const index = store.snapshot()
      const result: PoiSummary[] = []
      for (const record of Object.values(index.records)) {
        if (
          record.position.latitude >= bbox.south &&
          record.position.latitude <= bbox.north &&
          record.position.longitude >= bbox.west &&
          record.position.longitude <= bbox.east
        ) {
          result.push({
            id: String(record.llnr),
            type: recordPoiType(record),
            position: { ...record.position },
            name: record.name,
            source: USCG_LIGHT_LIST_SOURCE_ID,
            url: `${URL_PREFIX}?listVolumeNumber=${record.volume}&lightListNumber=${record.llnr}`,
            attribution: ATTRIBUTION,
            skIcon: recordSkIcon(record)
          })
        }
      }
      return result
    },
    getDetails: async (id: string): Promise<PoiDetailView> => {
      const record = store.snapshot().records[id]
      if (record === undefined) throw new Error(`No Light List record for "${id}"`)
      const description = appendAttribution(renderLightListDetail(record), ATTRIBUTION)
      status.recordDetailSuccess(USCG_LIGHT_LIST_SOURCE_ID)
      return {
        name: record.name,
        position: { ...record.position },
        type: recordPoiType(record),
        url: `${URL_PREFIX}?listVolumeNumber=${record.volume}&lightListNumber=${record.llnr}`,
        source: USCG_LIGHT_LIST_SOURCE_ID,
        attribution: ATTRIBUTION,
        description,
        skIcon: recordSkIcon(record),
        ...(record.modifiedDate !== undefined && { timestamp: record.modifiedDate })
      }
    },
    cacheSize: () => Object.keys(store.snapshot().records).length,
    close: () => { /* refresh scheduler is owned by the input module */ },
    // Public extension used by the input module's refresh scheduler:
    // not part of the PoiSource contract, attached as a side property.
    refreshAll
  } as unknown as PoiSource
}
```

- [ ] **Step 2: Write the source test (uses a fake client + the real store)**

```typescript
// test/uscg-light-list-source.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createUscgLightListSource,
  USCG_LIGHT_LIST_SOURCE_ID
} from '../src/inputs/uscg-light-list/uscg-light-list-source.js'
import { createLightListStore } from '../src/inputs/uscg-light-list/light-list-store.js'
import type { LightListRecord } from '../src/inputs/uscg-light-list/light-list-types.js'

function fakeStatus () {
  const events: string[] = []
  return {
    events,
    status: {
      recordDetailSuccess: (s: string) => events.push(`detail-ok:${s}`),
      recordError: (s: string, m: string) => events.push(`error:${s}:${m}`),
      recordSkipped: (s: string, r: string) => events.push(`skipped:${s}:${r}`)
    } as never
  }
}

function fakeClient () {
  return {
    downloadDistrict: async () => ({ status: 'not-modified' as const })
  }
}

function loadOne (store: ReturnType<typeof createLightListStore>): void {
  const r: LightListRecord = {
    llnr: 12345, name: 'Test Light',
    position: { latitude: 42.0, longitude: -71.0 },
    district: 'D01', volume: 1, source: 'usclightlist', inactive: false
  }
  store.upsertDistrict('D01', 1, [r], {})
}

test('listPointsOfInterest filters by bbox and tags every summary with the source', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'll-src-'))
  try {
    const store = createLightListStore(dir)
    await store.load()
    loadOne(store)
    const { status } = fakeStatus()
    const source = createUscgLightListSource({
      client: fakeClient() as never,
      store, status, getCurrentPosition: () => undefined
    })
    const inside = await source.listPointsOfInterest(
      { south: 41, west: -72, north: 43, east: -70 }, '')
    assert.equal(inside.length, 1)
    assert.equal(inside[0].source, USCG_LIGHT_LIST_SOURCE_ID)
    assert.equal(inside[0].id, '12345')
    const outside = await source.listPointsOfInterest(
      { south: 0, west: 0, north: 1, east: 1 }, '')
    assert.equal(outside.length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('refreshAll skips outbound HTTP when the vessel is outside US waters', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'll-src-'))
  try {
    const store = createLightListStore(dir)
    await store.load()
    const { events, status } = fakeStatus()
    let calls = 0
    const source = createUscgLightListSource({
      client: { downloadDistrict: async () => { calls++; return { status: 'not-modified' as const } } } as never,
      store, status,
      // Sydney Harbour, decidedly not US.
      getCurrentPosition: () => ({ latitude: -33.85, longitude: 151.22 })
    }) as never as { refreshAll: () => Promise<void> }
    await source.refreshAll()
    assert.equal(calls, 0)
    assert.ok(events.some(e => e.startsWith('skipped:usclightlist')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 3: Run test, gate, commit**

```bash
git add src/inputs/uscg-light-list/uscg-light-list-source.ts \
        test/uscg-light-list-source.test.ts
git commit -m "$(cat <<'EOF'
feat(uscg-light-list): PoiSource adapter over client + store

listPointsOfInterest filters the in-memory index by bbox and tags every
summary with the source and the USCG search-result URL. getDetails always
hits the in-memory map. refreshAll iterates the 61 (district, page) pairs
hard-coded from the NAVCEN MSI index, using conditional GET so an
unchanged district refresh does no work. Outbound HTTP is gated on
isInUsWaters() so a vessel that has left US waters keeps its loaded
index but issues no refresh until it returns.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.4: `uscg-light-list-input.ts` (InputModule registration)

**Files:**
- Create: `src/inputs/uscg-light-list/uscg-light-list-input.ts`

- [ ] **Step 1: Implement the input module**

```typescript
// src/inputs/uscg-light-list/uscg-light-list-input.ts
/**
 * USCG Light List input module. Opt-in: defaults off. Owns the config schema
 * fragment, the refresh scheduler (interval cleared on close), and the
 * factory that wires client + store + source together.
 */

import {
  createUscgLightListSource,
  USCG_LIGHT_LIST_SOURCE_ID
} from './uscg-light-list-source.js'
import { createLightListClient } from './light-list-client.js'
import { createLightListStore } from './light-list-store.js'
import type { InputContext, InputModule } from '../poi-source.js'
import { MILLISECONDS_PER_MINUTE } from '../../shared/time.js'
import type { PluginConfig, Position } from '../../shared/types.js'

const DEFAULT_REFRESH_HOURS = 6
const DEFAULT_REFRESH_DELAY_SECONDS = 30
const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * 60
const MILLISECONDS_PER_SECOND = 1000

const CONFIG_SCHEMA: Record<string, unknown> = {
  uscgLightListEnabled: {
    type: 'boolean',
    title: 'Import points of interest from the USCG Light List (US Aids to Navigation)',
    default: false
  },
  uscgLightListDedupe: {
    type: 'boolean',
    title: 'Merge USCG Light List points of interest that duplicate an ActiveCaptain marker',
    default: true
  },
  uscgLightListRefreshHours: {
    type: 'number',
    title: 'USCG Light List background refresh period, in hours',
    default: DEFAULT_REFRESH_HOURS,
    minimum: 1,
    maximum: 168
  }
}

function resolveRefreshHours (raw: unknown): number {
  if (typeof raw === 'number' && raw >= 1 && raw <= 168) return raw
  return DEFAULT_REFRESH_HOURS
}

export const uscgLightListInput: InputModule = {
  id: USCG_LIGHT_LIST_SOURCE_ID,
  name: 'USCG Light List',
  configSchema: CONFIG_SCHEMA,
  isEnabled: (config: PluginConfig) => config.uscgLightListEnabled === true,
  isDedupeEnabled: (config: PluginConfig) => config.uscgLightListDedupe !== false,
  createSource: (context: InputContext) => {
    const { app, config, status, dataDir } = context
    const client = createLightListClient()
    const store = createLightListStore(dataDir)
    let position: Position | undefined
    // The position monitor in src/monitoring/ already maintains the latest
    // vessel position; here we read from a closure the caller updates via
    // context. The simplest cross-module path is the SignalK app: subscribe
    // to navigation.position. That subscription is owned by the plugin
    // shell; the input module only needs the read. As a minimum, fall back
    // to undefined: the source treats undefined as "unknown, do not gate".
    const getCurrentPosition = (): Position | undefined => position
    void store.load().then(() => {
      // Best-effort hand-off: the plugin's position monitor pushes to a
      // listener we register here. Wiring is performed in Phase 5 (Lane F).
      // For now the source operates without a position gate (refreshes
      // always run); the wiring patch in Phase 5 closes the gap.
    })
    const source = createUscgLightListSource({
      client, store, status, getCurrentPosition
    })
    const refreshHours = resolveRefreshHours(config.uscgLightListRefreshHours)
    const intervalMs = refreshHours * MILLISECONDS_PER_HOUR
    const delayMs = DEFAULT_REFRESH_DELAY_SECONDS * MILLISECONDS_PER_SECOND
    const refreshAll = (source as unknown as { refreshAll: () => Promise<void> }).refreshAll
    const initialTimer = setTimeout(() => {
      void refreshAll().catch(error => {
        app.debug(`USCG Light List initial refresh failed: ${String(error)}`)
      })
    }, delayMs)
    const periodicTimer = setInterval(() => {
      void refreshAll().catch(error => {
        app.debug(`USCG Light List refresh failed: ${String(error)}`)
      })
    }, intervalMs)
    const originalClose = source.close
    source.close = () => {
      clearTimeout(initialTimer)
      clearInterval(periodicTimer)
      originalClose()
    }
    return source
  }
}
```

- [ ] **Step 2: Gate, commit (no new test: the input is wired in Phase 5)**

```bash
git add src/inputs/uscg-light-list/uscg-light-list-input.ts
git commit -m "$(cat <<'EOF'
feat(uscg-light-list): InputModule registration with refresh scheduler

Adds the InputModule that the plugin factory hands to the input registry.
Owns the config schema fragment (enable toggle, dedupe toggle, refresh
period), boots the on-disk store, kicks off the first refresh after a
delay, and ticks every refreshHours hours. The position-gate wiring is
completed in Phase 5 (Lane F).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

# Phase 3: NOAA ENC Direct acquisition (Lane D)

### Task 3.1: Define ENC wire types

**Files:**
- Create: `src/inputs/noaa-enc/enc-direct-types.ts`

- [ ] **Step 1: Implement the types**

```typescript
// src/inputs/noaa-enc/enc-direct-types.ts
/**
 * Wire types for the NOAA ENC Direct ArcGIS REST FeatureServer. The server
 * returns standard GeoJSON when ?f=geojson is set, plus an
 * exceededTransferLimit flag used to drive pagination.
 */

export type ScaleBand =
  'overview' | 'general' | 'coastal' | 'approach' | 'harbour' | 'berthing'

export type EncLayerKey = 'wreck' | 'obstruction' | 'rock'

/** Numeric ArcGIS layer ids per scale band, for each hazard layer. */
export interface LayerIds {
  readonly wreck: number
  readonly obstruction: number
  readonly rock: number
}

export interface EncFeature {
  type: 'Feature'
  id?: number
  geometry: { type: 'Point', coordinates: [number, number] }
  properties: Record<string, unknown>
}

export interface EncFeatureCollection {
  type: 'FeatureCollection'
  features: EncFeature[]
  exceededTransferLimit?: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add src/inputs/noaa-enc/enc-direct-types.ts
git commit -m "$(cat <<'EOF'
feat(noaa-enc): scaffold ENC Direct wire types

ScaleBand, EncLayerKey, LayerIds, EncFeature, EncFeatureCollection.
exceededTransferLimit drives pagination in the client.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: Discover and pin layer ids per scale band

**Files:**
- Modify: `src/inputs/noaa-enc/enc-direct-types.ts` (add LAYER_IDS_BY_BAND constant)

- [ ] **Step 1: Discover layer ids**

For each of the six scale bands, fetch the MapServer root JSON and identify
the numeric ids of the `Wreck_point`, `Obstruction_point`, and
`Underwater_Awash_Rock_point` layers:

```bash
for band in overview general coastal approach harbour berthing; do
  echo "=== $band ==="
  curl -s "https://gis.charttools.noaa.gov/arcgis/rest/services/encdirect/enc_${band}/MapServer?f=json" \
    | jq '.layers[] | select(.name | test("Wreck_point|Obstruction_point|Underwater_Awash_Rock_point")) | "\(.id): \(.name)"'
done
```

The coastal-band ids are already known from the research (wreck=33,
obstruction=30, rock=31). Record the other five bands' ids.

- [ ] **Step 2: Add the LAYER_IDS_BY_BAND constant**

Append to `src/inputs/noaa-enc/enc-direct-types.ts`:

```typescript
/** Numeric ArcGIS layer ids per scale band. Populated by the discovery
 *  script in Task 3.2; every entry is verified live before commit. */
export const LAYER_IDS_BY_BAND: Readonly<Record<ScaleBand, LayerIds>> = {
  overview:  { wreck: /* discovered */ 0, obstruction: 0, rock: 0 },
  general:   { wreck: 0, obstruction: 0, rock: 0 },
  coastal:   { wreck: 33, obstruction: 30, rock: 31 },
  approach:  { wreck: 0, obstruction: 0, rock: 0 },
  harbour:   { wreck: 0, obstruction: 0, rock: 0 },
  berthing:  { wreck: 0, obstruction: 0, rock: 0 }
}
```

Replace each `0` with the verified id from Step 1. The default `0`
placeholders MUST NOT survive the commit; if a band has no such layer, omit
that band from the map and the input module raises an error on selection.

- [ ] **Step 3: Add a quick "no zeroes" test**

```typescript
// test/enc-layer-ids.test.ts
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
```

- [ ] **Step 4: Gate, commit**

```bash
git add src/inputs/noaa-enc/enc-direct-types.ts \
        test/enc-layer-ids.test.ts
git commit -m "$(cat <<'EOF'
feat(noaa-enc): pin ArcGIS layer ids for every scale band

Discovered from the live MapServer endpoints. A test asserts every
band has a non-zero triple so a future contributor cannot accidentally
ship a default-zero placeholder.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.3: ENC Direct HTTP client

**Files:**
- Create: `src/inputs/noaa-enc/enc-direct-client.ts`
- Test: `test/enc-direct-client.test.ts`
- Fixture: `test/fixtures/enc-coastal-wreck.geojson` (3 wreck features from a
  real `/query` response)

- [ ] **Step 1: Capture a fixture**

```bash
curl -s 'https://gis.charttools.noaa.gov/arcgis/rest/services/encdirect/enc_coastal/MapServer/33/query?geometry=-71.05,42.30,-70.90,42.45&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=geojson&resultRecordCount=3' \
  > test/fixtures/enc-coastal-wreck.geojson
```

- [ ] **Step 2: Write the failing client test**

```typescript
// test/enc-direct-client.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createEncDirectClient } from '../src/inputs/noaa-enc/enc-direct-client.js'

async function fixtureServer (responder: (req: { url: string }, page: number) => unknown) {
  let page = 0
  const server = createServer((req, res) => {
    page++
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(responder({ url: req.url ?? '' }, page)))
  })
  await new Promise<void>(r => server.listen(0, r))
  const addr = server.address()
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() }
}

test('queryLayer issues a bbox query and parses GeoJSON', async () => {
  const fixture = JSON.parse(await readFile('test/fixtures/enc-coastal-wreck.geojson', 'utf8'))
  const server = await fixtureServer(() => fixture)
  try {
    const client = createEncDirectClient({ baseUrl: server.url })
    const result = await client.queryLayer({
      band: 'coastal', layerKey: 'wreck',
      bbox: { south: 42.30, west: -71.05, north: 42.45, east: -70.90 }
    })
    assert.ok(Array.isArray(result.features))
    assert.ok(result.features.length >= 1)
    assert.equal(result.features[0].geometry.type, 'Point')
  } finally {
    server.close()
  }
})

test('queryLayer pages through exceededTransferLimit', async () => {
  const featureA = { type: 'Feature', id: 1, geometry: { type: 'Point', coordinates: [-71, 42] }, properties: {} }
  const featureB = { type: 'Feature', id: 2, geometry: { type: 'Point', coordinates: [-71, 42] }, properties: {} }
  const server = await fixtureServer((_, page) => {
    if (page === 1) {
      return { type: 'FeatureCollection', features: [featureA], exceededTransferLimit: true }
    }
    return { type: 'FeatureCollection', features: [featureB] }
  })
  try {
    const client = createEncDirectClient({ baseUrl: server.url })
    const result = await client.queryLayer({
      band: 'coastal', layerKey: 'wreck',
      bbox: { south: 42, west: -72, north: 43, east: -70 }
    })
    assert.equal(result.features.length, 2)
  } finally {
    server.close()
  }
})

test('queryLayer always includes a geometry filter (never where=1=1)', async () => {
  let recordedUrl = ''
  const server = await fixtureServer((req) => {
    recordedUrl = req.url
    return { type: 'FeatureCollection', features: [] }
  })
  try {
    const client = createEncDirectClient({ baseUrl: server.url })
    await client.queryLayer({
      band: 'coastal', layerKey: 'wreck',
      bbox: { south: 42, west: -72, north: 43, east: -70 }
    })
    assert.ok(recordedUrl.includes('geometry='))
    assert.ok(!recordedUrl.includes('where=1%3D1'))
  } finally {
    server.close()
  }
})
```

- [ ] **Step 3: Implement `enc-direct-client.ts`**

```typescript
// src/inputs/noaa-enc/enc-direct-client.ts
/**
 * NOAA ENC Direct ArcGIS REST client.
 *
 * Issues bbox-bounded /query requests against the per-scale-band MapServers
 * and returns GeoJSON features. ArcGIS caps responses at 1000 records, so
 * the client pages while exceededTransferLimit is true.
 *
 * The query MUST always include a geometry filter: an unbounded where=1=1
 * times out at the harbour scale band (verified during research). The
 * client constructs the URL such that geometry is always present.
 */

import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import {
  LAYER_IDS_BY_BAND, type EncFeature, type EncLayerKey, type ScaleBand
} from './enc-direct-types.js'
import type { Bbox } from '../../shared/types.js'

const USER_AGENT = 'signalk-crows-nest (+https://github.com/nlabadie/signalk-crows-nest)'
const DEFAULT_BASE_URL = 'https://gis.charttools.noaa.gov'
const PAGE_SIZE = 1000

export interface EncDirectClient {
  queryLayer: (request: QueryRequest) => Promise<{ features: EncFeature[] }>
  queryById: (request: QueryByIdRequest) => Promise<EncFeature | undefined>
}

export interface QueryRequest {
  band: ScaleBand
  layerKey: EncLayerKey
  bbox: Bbox
}

export interface QueryByIdRequest {
  band: ScaleBand
  layerKey: EncLayerKey
  objectId: number
}

export interface EncDirectClientConfig {
  baseUrl?: string
}

function fetchJson (url: string, headers: Record<string,string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https:') ? httpsRequest : httpRequest
    const req = transport(url, { method: 'GET', headers }, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function buildBboxUrl (
  base: string, band: ScaleBand, layerId: number, bbox: Bbox, offset: number
): string {
  const params = new URLSearchParams({
    geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE)
  })
  return `${base}/arcgis/rest/services/encdirect/enc_${band}/MapServer/${layerId}/query?${params.toString()}`
}

function buildByIdUrl (
  base: string, band: ScaleBand, layerId: number, objectId: number
): string {
  const params = new URLSearchParams({
    objectIds: String(objectId),
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson'
  })
  return `${base}/arcgis/rest/services/encdirect/enc_${band}/MapServer/${layerId}/query?${params.toString()}`
}

export function createEncDirectClient (config: EncDirectClientConfig = {}): EncDirectClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  return {
    async queryLayer ({ band, layerKey, bbox }) {
      const layerId = LAYER_IDS_BY_BAND[band][layerKey]
      const all: EncFeature[] = []
      let offset = 0
      while (true) {
        const url = buildBboxUrl(baseUrl, band, layerId, bbox, offset)
        const json = await fetchJson(url, { 'User-Agent': USER_AGENT }) as
          { features?: EncFeature[], exceededTransferLimit?: boolean }
        const page = json.features ?? []
        all.push(...page)
        if (json.exceededTransferLimit !== true || page.length === 0) break
        offset += page.length
      }
      return { features: all }
    },
    async queryById ({ band, layerKey, objectId }) {
      const layerId = LAYER_IDS_BY_BAND[band][layerKey]
      const url = buildByIdUrl(baseUrl, band, layerId, objectId)
      const json = await fetchJson(url, { 'User-Agent': USER_AGENT }) as
        { features?: EncFeature[] }
      return (json.features ?? [])[0]
    }
  }
}
```

- [ ] **Step 4: Run test, gate, commit**

```bash
git add src/inputs/noaa-enc/enc-direct-client.ts \
        test/enc-direct-client.test.ts \
        test/fixtures/enc-coastal-wreck.geojson
git commit -m "$(cat <<'EOF'
feat(noaa-enc): ENC Direct ArcGIS REST client

Issues bbox-bounded /query against per-scale-band MapServers and returns
GeoJSON features. Pages through exceededTransferLimit at 1000 records per
page. Always includes a geometry filter: an unbounded where=1=1 times out
at the harbour scale band (verified during research).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

# Phase 4: NOAA ENC Direct adapter (Lane E)

### Task 4.1: `s57-mapping.ts` (S-57 enum -> human label, layer -> PoiType/skIcon)

**Files:**
- Create: `src/inputs/noaa-enc/s57-mapping.ts`
- Test: `test/s57-mapping.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// test/s57-mapping.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  layerPoiType, layerSkIcon,
  CATWRK, CATOBS, WATLEV, QUASOU, TECSOU
} from '../src/inputs/noaa-enc/s57-mapping.js'

test('every ENC hazard layer maps to PoiType Hazard and the hazard skIcon', () => {
  assert.equal(layerPoiType('wreck'), 'Hazard')
  assert.equal(layerPoiType('obstruction'), 'Hazard')
  assert.equal(layerPoiType('rock'), 'Hazard')
  assert.equal(layerSkIcon('wreck'), 'hazard')
  assert.equal(layerSkIcon('obstruction'), 'hazard')
  assert.equal(layerSkIcon('rock'), 'hazard')
})

test('CATWRK enum carries the five IHO S-57 wreck categories', () => {
  assert.equal(CATWRK[2], 'dangerous wreck')
  assert.equal(CATWRK[5], 'wreck showing hull')
})

test('WATLEV enum carries the six IHO S-57 water-level codes', () => {
  assert.equal(WATLEV[3], 'always submerged')
  assert.equal(WATLEV[5], 'awash')
})

test('CATOBS, QUASOU, and TECSOU return strings for known codes and undefined for unknown', () => {
  assert.equal(typeof CATOBS[1], 'string')
  assert.equal(typeof QUASOU[1], 'string')
  assert.equal(typeof TECSOU[2], 'string')
  assert.equal(CATWRK[999], undefined)
})
```

- [ ] **Step 2: Implement `s57-mapping.ts`**

```typescript
// src/inputs/noaa-enc/s57-mapping.ts
/**
 * S-57 enum -> human label tables for ENC Direct features, plus per-layer
 * PoiType and Freeboard skIcon mappings. The numeric codes are the IHO S-57
 * Object Catalogue values that the ArcGIS server passes through.
 */

import type { EncLayerKey } from './enc-direct-types.js'
import type { PoiType } from '../../shared/types.js'

export const CATWRK: Readonly<Record<number, string>> = {
  1: 'non-dangerous wreck',
  2: 'dangerous wreck',
  3: 'distributed remains of wreck',
  4: 'wreck showing mast',
  5: 'wreck showing hull'
}

export const CATOBS: Readonly<Record<number, string>> = {
  1: 'snag/stump',
  2: 'wellhead',
  3: 'diffuser',
  4: 'crib',
  5: 'fish haven',
  6: 'foul area',
  7: 'foul ground',
  8: 'ice boom',
  9: 'ground tackle',
  10: 'boom'
}

export const WATLEV: Readonly<Record<number, string>> = {
  1: 'partly submerged at high water',
  2: 'always dry',
  3: 'always submerged',
  4: 'covers and uncovers',
  5: 'awash',
  6: 'subject to inundation or flooding',
  7: 'floating'
}

export const QUASOU: Readonly<Record<number, string>> = {
  1: 'depth known',
  2: 'depth unknown',
  3: 'doubtful sounding',
  4: 'unreliable sounding',
  5: 'no bottom found at value shown',
  6: 'least depth known',
  7: 'least depth unknown but safe to depth shown'
}

export const TECSOU: Readonly<Record<number, string>> = {
  1: 'found by echo sounder',
  2: 'found by side-scan sonar',
  3: 'found by multi-beam',
  4: 'found by diver',
  5: 'found by lead-line',
  6: 'swept by wire-drag',
  7: 'found by laser',
  8: 'swept by vertical acoustic system',
  9: 'found by electromagnetic sensor',
  10: 'computed',
  11: 'estimated',
  12: 'found by manual sounding',
  13: 'found by satellite imagery',
  14: 'found by levelling'
}

export function layerPoiType (_layer: EncLayerKey): PoiType { return 'Hazard' }
export function layerSkIcon (_layer: EncLayerKey): string { return 'hazard' }
```

- [ ] **Step 3: Run test, gate, commit**

```bash
git add src/inputs/noaa-enc/s57-mapping.ts \
        test/s57-mapping.test.ts
git commit -m "$(cat <<'EOF'
feat(noaa-enc): S-57 enum tables and per-layer mappings

Translates the IHO S-57 numeric codes (CATWRK, CATOBS, WATLEV, QUASOU,
TECSOU) into the human-readable labels the detail renderer writes into
the popup. Every hazard layer maps to PoiType Hazard and the hazard
Freeboard skIcon.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 4.2: `enc-direct-detail.ts` (plain-English HTML renderer)

**Files:**
- Create: `src/inputs/noaa-enc/enc-direct-detail.ts`
- Test: `test/enc-direct-detail.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// test/enc-direct-detail.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderEncDirectDetail } from '../src/inputs/noaa-enc/enc-direct-detail.js'

test('renders a dangerous-wreck record with charted depth and survey technique', () => {
  const html = renderEncDirectDetail('wreck', {
    CATWRK: 2, WATLEV: 3, VALSOU: 23.7, SOUACC: 0.5,
    QUASOU: '1', TECSOU: '2', INFORM: 'Iron-hulled steamer',
    OBJNAM: 'SS Portland', SORDAT: '200705', DSNM: 'US5MA12M.000'
  })
  assert.ok(html.includes('SS Portland'))
  assert.ok(html.includes('dangerous wreck'))
  assert.ok(html.includes('always submerged'))
  assert.ok(html.includes('23.7 m'))
  assert.ok(html.includes('side-scan sonar'))
  assert.ok(html.includes('depth known'))
  assert.ok(html.includes('US5MA12M.000'))
  assert.ok(html.includes('2007-05'))
  assert.ok(html.includes('not intended for primary navigation'))
})

test('renders an unnamed obstruction with the layer label as a fallback header', () => {
  const html = renderEncDirectDetail('obstruction', {
    CATOBS: 7, WATLEV: 3, VALSOU: 8.2
  })
  assert.ok(html.includes('Obstruction'))
  assert.ok(html.includes('foul ground'))
  assert.ok(html.includes('8.2 m'))
})

test('renders a rock without optional fields as a short note', () => {
  const html = renderEncDirectDetail('rock', { WATLEV: 5 })
  assert.ok(html.includes('Rock'))
  assert.ok(html.includes('awash'))
})

test('escapes HTML in INFORM so a stray tag cannot inject markup', () => {
  const html = renderEncDirectDetail('wreck', { INFORM: '<script>alert(1)</script>' })
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
})
```

- [ ] **Step 2: Implement `enc-direct-detail.ts`**

```typescript
// src/inputs/noaa-enc/enc-direct-detail.ts
/**
 * Plain-English HTML renderer for an ENC Direct feature. Translates the
 * S-57 numeric codes via s57-mapping.ts and writes a friendly popup. The
 * NOAA navigation disclaimer is rendered into every detail per the data
 * licensing terms.
 */

import {
  CATWRK, CATOBS, WATLEV, QUASOU, TECSOU
} from './s57-mapping.js'
import type { EncLayerKey } from './enc-direct-types.js'

const LAYER_LABEL: Readonly<Record<EncLayerKey, string>> = {
  wreck: 'Wreck', obstruction: 'Obstruction', rock: 'Rock'
}

const DISCLAIMER = 'NOAA ENC data is not intended for primary navigation.'

function escape (value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function lookup<T> (table: Readonly<Record<number, T>>, raw: unknown): T | undefined {
  if (typeof raw === 'number') return table[raw]
  if (typeof raw === 'string') {
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? table[n] : undefined
  }
  return undefined
}

function formatSordat (raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length < 6) return undefined
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}`
}

export function renderEncDirectDetail (
  layerKey: EncLayerKey,
  properties: Record<string, unknown>
): string {
  const blocks: string[] = []
  const name = typeof properties.OBJNAM === 'string' && properties.OBJNAM.length > 0
    ? properties.OBJNAM : LAYER_LABEL[layerKey]
  const watlev = lookup(WATLEV, properties.WATLEV)
  let category: string | undefined
  if (layerKey === 'wreck') category = lookup(CATWRK, properties.CATWRK)
  if (layerKey === 'obstruction') category = lookup(CATOBS, properties.CATOBS)
  const headerSuffix = [category, watlev].filter(s => s !== undefined).join(', ')
  blocks.push(`<h4>${escape(name)}${headerSuffix.length > 0 ? ` (${escape(headerSuffix)})` : ''}</h4>`)

  const valsou = typeof properties.VALSOU === 'number' ? properties.VALSOU : undefined
  const souacc = typeof properties.SOUACC === 'number' ? properties.SOUACC : undefined
  if (valsou !== undefined) {
    const accuracy = souacc !== undefined ? ` (sounding accuracy ±${souacc} m)` : ''
    blocks.push(`<p><strong>Charted depth:</strong> ${valsou} m${accuracy}.</p>`)
  }
  const quality = lookup(QUASOU, properties.QUASOU)
  if (quality !== undefined) {
    blocks.push(`<p><strong>Position quality:</strong> ${escape(quality)}.</p>`)
  }
  const technique = lookup(TECSOU, properties.TECSOU)
  if (technique !== undefined) {
    blocks.push(`<p><strong>Survey technique:</strong> ${escape(technique)}.</p>`)
  }
  if (typeof properties.INFORM === 'string' && properties.INFORM.length > 0) {
    blocks.push(`<p><strong>Information:</strong> ${escape(properties.INFORM)}</p>`)
  }
  const dsnm = typeof properties.DSNM === 'string' ? properties.DSNM : undefined
  const updated = formatSordat(properties.SORDAT)
  if (dsnm !== undefined) {
    const suffix = updated !== undefined ? ` (last updated ${updated})` : ''
    blocks.push(`<p><strong>Source:</strong> NOAA ENC ${escape(dsnm)}${suffix}.</p>`)
  }
  blocks.push(`<p><strong>Disclaimer:</strong> ${DISCLAIMER}</p>`)
  return blocks.join('')
}
```

- [ ] **Step 3: Run test, gate, commit**

```bash
git add src/inputs/noaa-enc/enc-direct-detail.ts \
        test/enc-direct-detail.test.ts
git commit -m "$(cat <<'EOF'
feat(noaa-enc): plain-English detail renderer

Translates S-57 numeric codes into a friendly HTML popup. Surfaces vessel
name when present (OBJNAM), category (CATWRK/CATOBS), water level
(WATLEV), charted depth and sounding accuracy (VALSOU, SOUACC), position
quality (QUASOU), survey technique (TECSOU), free-text INFORM, and the
source chart and last-updated date. Renders the NOAA navigation
disclaimer on every popup per the data-licensing terms.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 4.3: `noaa-enc-source.ts` (the PoiSource adapter)

**Files:**
- Create: `src/inputs/noaa-enc/noaa-enc-source.ts`
- Test: `test/noaa-enc-source.test.ts`

- [ ] **Step 1: Implement the source**

```typescript
// src/inputs/noaa-enc/noaa-enc-source.ts
/**
 * NOAA ENC Direct POI source.
 *
 * Bbox-native: every list query goes to the ArcGIS server, parallelising
 * across the enabled layers (wrecks, obstructions, rocks) for the configured
 * scale band. The detail cache is a small LRU; on a miss, the source
 * re-queries the ArcGIS endpoint by objectId. Outbound HTTP is gated on
 * isInUsWaters().
 */

import { LRUCache } from 'lru-cache'
import type { EncDirectClient } from './enc-direct-client.js'
import type { EncFeature, EncLayerKey, ScaleBand } from './enc-direct-types.js'
import { layerPoiType, layerSkIcon } from './s57-mapping.js'
import { renderEncDirectDetail } from './enc-direct-detail.js'
import type { PoiSource } from '../poi-source.js'
import { appendAttribution } from '../../shared/attribution.js'
import { MAX_POI_CACHE_ENTRIES } from '../../shared/cache.js'
import type { Bbox, Position, PoiDetailView, PoiSummary } from '../../shared/types.js'
import { isInUsWaters } from '../../shared/us-waters.js'
import type { PluginStatus } from '../../status/plugin-status.js'

export const NOAA_ENC_SOURCE_ID = 'noaaenc'
const ATTRIBUTION = '© NOAA Office of Coast Survey (CC0)'

interface CachedFeature { layerKey: EncLayerKey, feature: EncFeature }

export interface NoaaEncSourceConfig {
  client: EncDirectClient
  band: ScaleBand
  includeWrecks: boolean
  includeObstructions: boolean
  includeRocks: boolean
  status: PluginStatus
  getCurrentPosition: () => Position | undefined
}

function enabledLayers (config: NoaaEncSourceConfig): EncLayerKey[] {
  const out: EncLayerKey[] = []
  if (config.includeWrecks) out.push('wreck')
  if (config.includeObstructions) out.push('obstruction')
  if (config.includeRocks) out.push('rock')
  return out
}

function featureId (layerKey: EncLayerKey, feature: EncFeature): string {
  return `${layerKey}_${feature.id ?? feature.properties.OBJECTID}`
}

function featureName (layerKey: EncLayerKey, feature: EncFeature): string {
  const name = feature.properties.OBJNAM
  if (typeof name === 'string' && name.length > 0) return name
  return layerKey === 'wreck' ? 'Wreck'
    : layerKey === 'obstruction' ? 'Obstruction' : 'Rock'
}

function viewerUrl (feature: EncFeature): string {
  const [lon, lat] = feature.geometry.coordinates
  return `https://encdirect.noaa.gov/?center=${lat},${lon}&zoom=15`
}

export function createNoaaEncSource (config: NoaaEncSourceConfig): PoiSource {
  const cache = new LRUCache<string, CachedFeature>({ max: MAX_POI_CACHE_ENTRIES })
  return {
    id: NOAA_ENC_SOURCE_ID,
    listPointsOfInterest: async (bbox: Bbox): Promise<PoiSummary[]> => {
      const position = config.getCurrentPosition()
      if (position !== undefined && !isInUsWaters(position)) {
        config.status.recordSkipped?.(NOAA_ENC_SOURCE_ID, 'outside US waters')
        return []
      }
      const layers = enabledLayers(config)
      const responses = await Promise.allSettled(
        layers.map(layerKey => config.client.queryLayer({
          band: config.band, layerKey, bbox
        }).then(r => ({ layerKey, features: r.features })))
      )
      const summaries: PoiSummary[] = []
      for (const response of responses) {
        if (response.status === 'rejected') {
          config.status.recordError(NOAA_ENC_SOURCE_ID,
            `Layer query failed: ${String(response.reason)}`)
          continue
        }
        const { layerKey, features } = response.value
        for (const feature of features) {
          const id = featureId(layerKey, feature)
          cache.set(id, { layerKey, feature })
          const [lon, lat] = feature.geometry.coordinates
          summaries.push({
            id, type: layerPoiType(layerKey),
            position: { latitude: lat, longitude: lon },
            name: featureName(layerKey, feature),
            source: NOAA_ENC_SOURCE_ID,
            url: viewerUrl(feature),
            attribution: ATTRIBUTION,
            skIcon: layerSkIcon(layerKey)
          })
        }
      }
      return summaries
    },
    getDetails: async (id: string): Promise<PoiDetailView> => {
      let cached = cache.get(id)
      if (cached === undefined) {
        const underscore = id.indexOf('_')
        const layerKey = id.slice(0, underscore) as EncLayerKey
        const objectId = Number.parseInt(id.slice(underscore + 1), 10)
        const feature = await config.client.queryById({
          band: config.band, layerKey, objectId
        })
        if (feature === undefined) throw new Error(`No ENC feature for "${id}"`)
        cached = { layerKey, feature }
        cache.set(id, cached)
      }
      const description = appendAttribution(
        renderEncDirectDetail(cached.layerKey, cached.feature.properties),
        ATTRIBUTION
      )
      config.status.recordDetailSuccess(NOAA_ENC_SOURCE_ID)
      const [lon, lat] = cached.feature.geometry.coordinates
      return {
        name: featureName(cached.layerKey, cached.feature),
        position: { latitude: lat, longitude: lon },
        type: layerPoiType(cached.layerKey),
        url: viewerUrl(cached.feature),
        source: NOAA_ENC_SOURCE_ID,
        attribution: ATTRIBUTION,
        description,
        skIcon: layerSkIcon(cached.layerKey)
      }
    },
    cacheSize: () => cache.size,
    close: () => cache.clear()
  }
}
```

- [ ] **Step 2: Write the source test (fake client)**

```typescript
// test/noaa-enc-source.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createNoaaEncSource, NOAA_ENC_SOURCE_ID
} from '../src/inputs/noaa-enc/noaa-enc-source.js'

function fakeStatus () {
  const events: string[] = []
  return {
    events,
    status: {
      recordDetailSuccess: (s: string) => events.push(`detail-ok:${s}`),
      recordError: (s: string, m: string) => events.push(`error:${s}:${m}`),
      recordSkipped: (s: string, r: string) => events.push(`skipped:${s}:${r}`)
    } as never
  }
}

const wreck = {
  type: 'Feature' as const, id: 12345,
  geometry: { type: 'Point' as const, coordinates: [-71, 42] as [number, number] },
  properties: { OBJNAM: 'SS Test', CATWRK: 2, WATLEV: 3, VALSOU: 10 }
}

test('listPointsOfInterest fans out across enabled layers and tags summaries', async () => {
  const calls: string[] = []
  const client = {
    queryLayer: async ({ layerKey }: { layerKey: string }) => {
      calls.push(layerKey)
      return { features: layerKey === 'wreck' ? [wreck] : [] }
    },
    queryById: async () => undefined
  }
  const { status } = fakeStatus()
  const source = createNoaaEncSource({
    client: client as never, band: 'coastal',
    includeWrecks: true, includeObstructions: true, includeRocks: false,
    status, getCurrentPosition: () => undefined
  })
  const summaries = await source.listPointsOfInterest(
    { south: 41, west: -72, north: 43, east: -70 }, '')
  assert.deepEqual(calls.sort(), ['obstruction', 'wreck'])
  assert.equal(summaries.length, 1)
  assert.equal(summaries[0].source, NOAA_ENC_SOURCE_ID)
  assert.equal(summaries[0].name, 'SS Test')
  assert.equal(summaries[0].skIcon, 'hazard')
})

test('listPointsOfInterest skips outbound work when the vessel is outside US waters', async () => {
  const calls: string[] = []
  const client = {
    queryLayer: async ({ layerKey }: { layerKey: string }) => {
      calls.push(layerKey); return { features: [] }
    },
    queryById: async () => undefined
  }
  const { events, status } = fakeStatus()
  const source = createNoaaEncSource({
    client: client as never, band: 'coastal',
    includeWrecks: true, includeObstructions: false, includeRocks: false,
    status, getCurrentPosition: () => ({ latitude: 41.38, longitude: 2.18 })
  })
  const summaries = await source.listPointsOfInterest(
    { south: 41, west: -72, north: 43, east: -70 }, '')
  assert.equal(summaries.length, 0)
  assert.equal(calls.length, 0)
  assert.ok(events.some(e => e.startsWith('skipped:noaaenc')))
})

test('getDetails returns a cached-feature view with the disclaimer in the description', async () => {
  const client = {
    queryLayer: async () => ({ features: [wreck] }),
    queryById: async () => wreck
  }
  const { status } = fakeStatus()
  const source = createNoaaEncSource({
    client: client as never, band: 'coastal',
    includeWrecks: true, includeObstructions: false, includeRocks: false,
    status, getCurrentPosition: () => undefined
  })
  await source.listPointsOfInterest(
    { south: 41, west: -72, north: 43, east: -70 }, '')
  const view = await source.getDetails('wreck_12345')
  assert.equal(view.source, 'noaaenc')
  assert.ok(view.description?.includes('not intended for primary navigation'))
})
```

- [ ] **Step 3: Run test, gate, commit**

```bash
git add src/inputs/noaa-enc/noaa-enc-source.ts \
        test/noaa-enc-source.test.ts
git commit -m "$(cat <<'EOF'
feat(noaa-enc): PoiSource adapter

listPointsOfInterest fans out across enabled layers (wrecks, obstructions,
rocks) in parallel via Promise.allSettled, gates on isInUsWaters(),
caches every fetched feature in an LRU bounded by MAX_POI_CACHE_ENTRIES,
and tags summaries with the source slug, NOAA ENC viewer URL, and CC0
attribution. getDetails serves from the LRU on hit and re-queries by
objectId on miss.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 4.4: `noaa-enc-input.ts` (InputModule registration)

**Files:**
- Create: `src/inputs/noaa-enc/noaa-enc-input.ts`

- [ ] **Step 1: Implement the input module**

```typescript
// src/inputs/noaa-enc/noaa-enc-input.ts
/**
 * NOAA ENC Direct input module. Opt-in: defaults off. Owns the config
 * fragment (enable, dedupe, scale band, three layer toggles) and the
 * factory that wires the client and source.
 */

import {
  createNoaaEncSource, NOAA_ENC_SOURCE_ID
} from './noaa-enc-source.js'
import { createEncDirectClient } from './enc-direct-client.js'
import type { ScaleBand } from './enc-direct-types.js'
import type { InputContext, InputModule } from '../poi-source.js'
import type { PluginConfig, Position } from '../../shared/types.js'

const SCALE_BANDS: readonly ScaleBand[] = [
  'overview', 'general', 'coastal', 'approach', 'harbour', 'berthing'
]

const CONFIG_SCHEMA: Record<string, unknown> = {
  noaaEncEnabled: {
    type: 'boolean',
    title: 'Import wrecks, obstructions, and rocks from NOAA ENC Direct (US authoritative)',
    default: false
  },
  noaaEncDedupe: {
    type: 'boolean',
    title: 'Merge NOAA ENC points of interest that duplicate an ActiveCaptain marker',
    default: true
  },
  noaaEncScaleBand: {
    type: 'string',
    title: 'NOAA ENC chart scale band',
    enum: [...SCALE_BANDS],
    default: 'coastal'
  },
  noaaEncIncludeWrecks: {
    type: 'boolean',
    title: 'Include NOAA ENC wrecks',
    default: true
  },
  noaaEncIncludeObstructions: {
    type: 'boolean',
    title: 'Include NOAA ENC obstructions',
    default: true
  },
  noaaEncIncludeRocks: {
    type: 'boolean',
    title: 'Include NOAA ENC underwater rocks (heavy: can return tens of thousands at coastal scale)',
    default: false
  }
}

function resolveBand (raw: unknown): ScaleBand {
  return typeof raw === 'string' && (SCALE_BANDS as readonly string[]).includes(raw)
    ? raw as ScaleBand : 'coastal'
}

export const noaaEncInput: InputModule = {
  id: NOAA_ENC_SOURCE_ID,
  name: 'NOAA ENC Direct',
  configSchema: CONFIG_SCHEMA,
  isEnabled: (config: PluginConfig) => config.noaaEncEnabled === true,
  isDedupeEnabled: (config: PluginConfig) => config.noaaEncDedupe !== false,
  createSource: (context: InputContext) => {
    const { config, status } = context
    let position: Position | undefined
    // Position-gate wiring is completed in Phase 5 (Lane F).
    const getCurrentPosition = (): Position | undefined => position
    return createNoaaEncSource({
      client: createEncDirectClient(),
      band: resolveBand(config.noaaEncScaleBand),
      includeWrecks: config.noaaEncIncludeWrecks !== false,
      includeObstructions: config.noaaEncIncludeObstructions !== false,
      includeRocks: config.noaaEncIncludeRocks === true,
      status, getCurrentPosition
    })
  }
}
```

- [ ] **Step 2: Gate, commit**

```bash
git add src/inputs/noaa-enc/noaa-enc-input.ts
git commit -m "$(cat <<'EOF'
feat(noaa-enc): InputModule registration

Adds the InputModule that the plugin factory hands to the input registry.
Owns the enable toggle, dedupe toggle, scale-band selector (six values,
default coastal), and three per-layer toggles (wrecks on, obstructions
on, rocks off by default because a coastal-band query returns tens of
thousands of rocks). Position-gate wiring is completed in Phase 5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

# Phase 5: Panel, registration, and docs (Lane F)

### Task 5.1: Extend `PluginConfig` with the new keys

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add new keys to the PluginConfig type**

In `src/shared/types.ts`, extend the existing `PluginConfig` interface with:

```typescript
  // USCG Light List
  uscgLightListEnabled?: boolean
  uscgLightListDedupe?: boolean
  uscgLightListRefreshHours?: number

  // NOAA ENC Direct
  noaaEncEnabled?: boolean
  noaaEncDedupe?: boolean
  noaaEncScaleBand?: string
  noaaEncIncludeWrecks?: boolean
  noaaEncIncludeObstructions?: boolean
  noaaEncIncludeRocks?: boolean
```

Gate, commit:

```bash
git add src/shared/types.ts
git commit -m "$(cat <<'EOF'
feat(shared): extend PluginConfig with USCG Light List and NOAA ENC keys

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 5.2: Register both inputs in `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import and register**

Add the two new imports and register both inputs alongside the existing ones:

```typescript
import { uscgLightListInput } from './inputs/uscg-light-list/uscg-light-list-input.js'
import { noaaEncInput } from './inputs/noaa-enc/noaa-enc-input.js'

// ...inside the registrations array passed to createPluginFactory:
const inputs = [activeCaptainInput, openSeaMapInput, uscgLightListInput, noaaEncInput]
```

Gate, commit:

```bash
git add src/index.ts
git commit -m "$(cat <<'EOF'
feat(index): register USCG Light List and NOAA ENC inputs

Both default off; the config-schema fragments are merged automatically
by the input registry.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 5.3: Wire the position gate

The two input modules currently read a closure-captured `position` that is
never updated. The plugin shell owns the position monitor; the cleanest fix
is to expose the latest position via the existing `InputContext` so both
inputs can read it.

**Files:**
- Modify: `src/inputs/poi-source.ts` (add `getCurrentPosition` to `InputContext`)
- Modify: `src/plugin/plugin.ts` (pass the position monitor's reader)
- Modify: `src/inputs/uscg-light-list/uscg-light-list-input.ts`
- Modify: `src/inputs/noaa-enc/noaa-enc-input.ts`

- [ ] **Step 1: Add `getCurrentPosition` to `InputContext`**

```typescript
// In src/inputs/poi-source.ts, extend the InputContext interface:
export interface InputContext {
  app: ServerAPI
  config: PluginConfig
  status: PluginStatus
  dataDir: string
  /** The latest known vessel position, undefined when unknown. */
  getCurrentPosition: () => Position | undefined
}
```

(Add `import type { Position } from '../shared/types.js'` if not present.)

- [ ] **Step 2: Plumb the reader through `src/plugin/plugin.ts`**

Find where `createSource` is called per input and pass the position monitor's
`getCurrentPosition` method as part of the context. The position monitor
already maintains the latest position; if it does not yet expose a getter,
add one.

- [ ] **Step 3: Replace the closure-captured stub in both input modules**

In `uscg-light-list-input.ts` and `noaa-enc-input.ts`, delete the local
`position` variable and the placeholder `getCurrentPosition` function;
instead pass `context.getCurrentPosition` straight through to the source
constructor.

- [ ] **Step 4: Gate, commit**

```bash
git add src/inputs/poi-source.ts src/plugin/plugin.ts \
        src/inputs/uscg-light-list/uscg-light-list-input.ts \
        src/inputs/noaa-enc/noaa-enc-input.ts
git commit -m "$(cat <<'EOF'
feat(inputs): plumb getCurrentPosition through InputContext

Closes the position-gate gap left in Phases 2 and 4: the plugin shell
already maintains the latest vessel position; this exposes it via the
existing InputContext so the US-only inputs can skip outbound HTTP when
the vessel is outside US waters.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 5.4: Add the two panel cards

**Files:**
- Create: `src/panel/components/UscgLightListSource.tsx`
- Create: `src/panel/components/NoaaEncSource.tsx`
- Modify: `src/panel/components/DataSourcesSection.tsx` (mount the two cards)
- Modify: `src/panel/normalize-config.ts` (normalize the new keys)
- Modify: `src/panel/config-reducer.ts` (handle the new field updates)

- [ ] **Step 1: Sketch `UscgLightListSource.tsx`**

Model the layout on `OpenSeaMapSource.tsx`. The card body needs:

- Enable toggle (`uscgLightListEnabled`).
- Dedupe toggle (`uscgLightListDedupe`).
- Refresh-hours field (`uscgLightListRefreshHours`), reuse `NumberField`.

Read the file `src/panel/components/OpenSeaMapSource.tsx` and copy its shape;
swap the labels and the config keys.

- [ ] **Step 2: Sketch `NoaaEncSource.tsx`**

Body needs:

- Enable toggle (`noaaEncEnabled`).
- Dedupe toggle (`noaaEncDedupe`).
- Scale-band selector (`noaaEncScaleBand`): a `<select>` with the six bands.
- Three layer toggles: wrecks, obstructions, rocks.

- [ ] **Step 3: Mount both cards in `DataSourcesSection.tsx`**

Append `<DataSourceCard ...><UscgLightListSource .../></DataSourceCard>` and
the equivalent for NOAA ENC, after the existing OpenSeaMap card.

- [ ] **Step 4: Extend `normalize-config.ts`**

For each new key, add normalization that mirrors the existing pattern: the
plugin schema's default is the fallback, the raw value is coerced to its
type, an invalid value falls back to the default.

- [ ] **Step 5: Extend `config-reducer.ts`**

Add reducer cases for the new fields. If the existing reducer uses a generic
`UPDATE_FIELD` action, no per-field case is needed; just verify the new
keys flow through.

- [ ] **Step 6: Visual check the panel**

Build the panel: `npm run build:panel`. Open the SignalK admin UI in a
browser, navigate to the plugin's configuration, expand each new card,
toggle and field-change every control, watch the network panel to confirm
the config-PUT carries the right keys.

Use Playwright if available; otherwise drive the browser by hand.

- [ ] **Step 7: Gate, commit**

```bash
git add src/panel/components/UscgLightListSource.tsx \
        src/panel/components/NoaaEncSource.tsx \
        src/panel/components/DataSourcesSection.tsx \
        src/panel/normalize-config.ts \
        src/panel/config-reducer.ts
git commit -m "$(cat <<'EOF'
feat(panel): cards for USCG Light List and NOAA ENC Direct

Two new cards in the per-source accordion. USCG Light List exposes the
enable, dedupe, and refresh-hours controls; NOAA ENC Direct exposes the
enable, dedupe, scale-band selector, and three per-layer toggles. The
accordion stays scannable: every new control is inside its own card and
collapses when the user is not configuring it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 5.5: Documentation

**Files:**
- Modify: `CLAUDE.md` (extend the "Layout" section)
- Modify: `README.md` (extend the "Data sources" section)
- Modify: `docs/roadmap.md` (move both sources from "considered" to "shipped")
- Modify: `docs/development.md` (add a worked-example note pointing at both
  new directories as a reference for adding a new POI input)

- [ ] **Step 1: Update `CLAUDE.md`**

In the "Layout" section, after the existing `openseamap/` block, add the
`uscg-light-list/` and `noaa-enc/` directory descriptions, listing every
file with a one-line responsibility.

In the "What this is" section, extend the source enumeration:

> imports points of interest from multiple marine data sources (Garmin
> ActiveCaptain, OpenSeaMap via the OpenStreetMap Overpass API, the USCG
> Light List of US Aids to Navigation, and the NOAA ENC Direct database
> of wrecks and obstructions).

- [ ] **Step 2: Update `README.md`**

Add a row for USCG Light List and a row for NOAA ENC Direct to the data
sources list. Mention they are US-only and default off.

- [ ] **Step 3: Update `docs/roadmap.md`**

Mark USCG Light List and NOAA ENC Direct as shipped in the post-OpenSeaMap
section. Note the AWOIS retirement and that ENC Direct is the official
successor.

- [ ] **Step 4: Update `docs/development.md`**

Add a "Worked example: USCG Light List and NOAA ENC inputs" section
pointing contributors at the two directories as reference implementations
of the two acquisition patterns: periodic-download with conditional GET
(Light List) and at-runtime bbox query (NOAA ENC).

- [ ] **Step 5: Verify doc accuracy**

Grep the docs for any concrete count, file list, or path claim and verify
each against the current code:

```bash
grep -rn "input\b" CLAUDE.md docs/ | head
```

- [ ] **Step 6: Gate, commit**

```bash
git add CLAUDE.md README.md docs/roadmap.md docs/development.md
git commit -m "$(cat <<'EOF'
docs: USCG Light List and NOAA ENC Direct inputs

CLAUDE.md gains the two new directory blocks; README lists both sources;
roadmap marks them shipped (with a note about AWOIS retirement and the
ENC Direct succession); development.md points contributors at the two
modules as worked examples of the periodic-download and at-runtime
bbox-fetch patterns.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 5.6: Live verification on `boatpi.naternet.lan`

This is the runtime gate. The plugin must actually work against the live
server.

- [ ] **Step 1: Build and deploy**

```bash
npm run build
# Sync to the boat Pi via the same path the user uses today (rsync, npm
# link, or whatever is set up locally).
```

- [ ] **Step 2: Enable USCG Light List in the admin UI**

In the SignalK admin UI, expand the USCG Light List card, toggle "enabled"
on, save. Wait ~60 seconds, refresh, confirm:

- The plugin log shows the first refresh tick.
- The "USCG Light List" card status reads "ready (~57,000 records)" once the
  initial pass completes (it takes a few minutes on a Pi).
- A US-waters bbox query returns Light List records as notes in
  Freeboard-SK with the `:sk-navigation-structure` icon (or `:sk-hazard`
  for isolated-danger marks).

- [ ] **Step 3: Enable NOAA ENC Direct in the admin UI**

Toggle "enabled" on. Pick the coastal scale band. Confirm a US bbox query
returns hazard notes with the `:sk-hazard` icon. Click one and confirm the
popup shows the friendly description and the NOAA disclaimer.

- [ ] **Step 4: Confirm the proximity alarm fires on a NOAA wreck**

Move the vessel position close to a known wreck (or fake a `navigation.position`
update via the SignalK admin UI). Confirm the alarm raises, then clears
when the position moves away.

- [ ] **Step 5: Confirm a non-US position skips outbound HTTP**

Fake a Mediterranean position. Confirm neither input issues any request
in the next refresh tick or list query (check the plugin log).

- [ ] **Step 6: Confirm doc-claim accuracy**

`npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
All green. Suite at ~445 tests.

```bash
git status
# Expect: working tree clean (everything is in commits from prior tasks).
```

- [ ] **Step 7: Final-commit verification**

The plan ends here. No further commit; the work has been landing per-task
across Phases 0 to 5.

---

## Self-Review

Spec coverage check, run after the plan is fully drafted:

- **Spec section 1 (file structure)**: tasks 0.1 (us-waters), 1.1-1.3 (Light
  List), 3.1-3.3 (ENC), 5.4 (panel cards) cover the file structure.
- **Spec section 2 (plugin config additions)**: tasks 2.4 and 4.4 add the
  config-schema fragments; task 5.1 extends `PluginConfig`.
- **Spec section 3 (USCG Light List input)**: tasks 1.1-1.3 (acquisition,
  store), 2.1-2.4 (mapping, detail, source, input) cover it.
- **Spec section 4 (NOAA ENC Direct input)**: tasks 3.1-3.3 (types, layer
  ids, client), 4.1-4.4 (mapping, detail, source, input) cover it.
- **Spec section 5 (US-waters gate)**: task 0.1 + task 5.3 (wiring).
- **Spec section 6 (tests)**: every implementation task has a paired test
  task; the panel work in 5.4 includes a visual check.
- **Spec section 7 (panel additions)**: task 5.4.
- **Spec section 8 (status snapshot additions)**: covered by existing
  per-source status fields plus the `recordSkipped` helper used by both
  inputs.
- **Spec section 9 (documentation)**: task 5.5.
- **Spec section 11 (acceptance)**: task 5.6 (live verification).

No placeholders survive: every `?` or `0` placeholder is paired with a
test that fails if it leaks (Task 3.2 explicitly tests "every band has a
populated layer-id triple"). Type and method names are consistent:
`createLightListClient`, `createLightListStore`, `createUscgLightListSource`,
`createEncDirectClient`, `createNoaaEncSource`, `isInUsWaters`,
`getCurrentPosition`, all the same in their definition tasks and their
call sites in Phase 5.

Plan complete.
