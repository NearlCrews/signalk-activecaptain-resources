import test from 'node:test'
import assert from 'node:assert/strict'
import { createBboxDebounceCache } from '../src/shared/bbox-debounce.js'
import type { Bbox } from '../src/shared/types.js'

const SAMPLE: Bbox = { south: 42.0, west: -71.0, north: 42.5, east: -70.5 }
const ELSEWHERE: Bbox = { south: 37.7, west: -122.5, north: 37.9, east: -122.3 }

test('zero TTL disables the cache: every get calls the fetcher', async () => {
  let calls = 0
  const cache = createBboxDebounceCache<number>(0, 16)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  assert.equal(calls, 2)
  assert.equal(cache.size(), 0)
})

test('a negative TTL is treated as zero (off)', async () => {
  let calls = 0
  const cache = createBboxDebounceCache<number>(-30, 16)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  assert.equal(calls, 2)
})

test('a positive TTL caches the result and returns it on the next get', async () => {
  let calls = 0
  let now = 1000
  const cache = createBboxDebounceCache<number>(30, 16, () => now)
  const first = await cache.get(SAMPLE, async () => { calls++; return 42 })
  now = 1500 // 500 ms later, still inside the 30 s window
  const second = await cache.get(SAMPLE, async () => { calls++; return 999 })
  assert.equal(first, 42)
  assert.equal(second, 42, 'the second get returns the cached value')
  assert.equal(calls, 1, 'the fetcher was called once')
})

test('the cache expires after the TTL', async () => {
  let calls = 0
  let now = 1000
  const cache = createBboxDebounceCache<number>(30, 16, () => now)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  now = 1000 + 30_000 // exactly at the TTL boundary
  await cache.get(SAMPLE, async () => { calls++; return 2 })
  assert.equal(calls, 2, 'a get at the TTL boundary re-fetches')
})

test('different bboxes get independent cache slots', async () => {
  let aCalls = 0
  let bCalls = 0
  const now = 1000
  const cache = createBboxDebounceCache<string>(30, 16, () => now)
  await cache.get(SAMPLE, async () => { aCalls++; return 'a' })
  await cache.get(ELSEWHERE, async () => { bCalls++; return 'b' })
  await cache.get(SAMPLE, async () => { aCalls++; return 'a' })
  await cache.get(ELSEWHERE, async () => { bCalls++; return 'b' })
  assert.equal(aCalls, 1)
  assert.equal(bCalls, 1)
  assert.equal(cache.size(), 2)
})

test('sub-pixel jitter on the bbox coordinates is collapsed to the same key', async () => {
  // Two bboxes differing only in the 6th decimal place (about 11 cm) round to
  // the same 4-decimal-place key, so a Freeboard refresh that recomputes the
  // bbox with floating-point noise still hits the cache.
  let calls = 0
  const now = 1000
  const cache = createBboxDebounceCache<number>(30, 16, () => now)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  const jittered: Bbox = {
    south: 42.000001, west: -71.000001, north: 42.500001, east: -70.500001
  }
  await cache.get(jittered, async () => { calls++; return 2 })
  assert.equal(calls, 1)
})

test('the LRU evicts old entries past the maxEntries cap', async () => {
  const now = 1000
  const cache = createBboxDebounceCache<number>(30, 2, () => now)
  await cache.get(SAMPLE, async () => 1)
  await cache.get(ELSEWHERE, async () => 2)
  await cache.get({ south: 0, west: 0, north: 1, east: 1 }, async () => 3)
  assert.equal(cache.size(), 2, 'oldest entry is evicted')
})

test('clear() drops every entry', async () => {
  const cache = createBboxDebounceCache<number>(30, 16)
  await cache.get(SAMPLE, async () => 1)
  await cache.get(ELSEWHERE, async () => 2)
  assert.equal(cache.size(), 2)
  cache.clear()
  assert.equal(cache.size(), 0)
})

test('the fetcher\'s rejection propagates without caching', async () => {
  let calls = 0
  const cache = createBboxDebounceCache<number>(30, 16)
  await assert.rejects(() => cache.get(SAMPLE, async () => {
    calls++
    throw new Error('upstream down')
  }), /upstream down/)
  assert.equal(cache.size(), 0, 'a failed fetch is not cached')
  // A retry calls the fetcher again.
  await assert.rejects(() => cache.get(SAMPLE, async () => {
    calls++
    throw new Error('still down')
  }), /still down/)
  assert.equal(calls, 2)
})

test('an extraKey discriminates cache entries for the same bbox', async () => {
  // The ActiveCaptain source passes `poiTypes` as the extraKey so a
  // notes-resource call without Hazard does not poison a later
  // proximity-alarm scan that needs Hazard.
  let marinaCalls = 0
  let hazardCalls = 0
  const now = 1000
  const cache = createBboxDebounceCache<string>(30, 16, () => now)
  await cache.get(SAMPLE, async () => { marinaCalls++; return 'marina' }, 'Marina')
  await cache.get(SAMPLE, async () => { hazardCalls++; return 'hazard' }, 'Hazard')
  const second = await cache.get(SAMPLE, async () => { marinaCalls++; return 'oops' }, 'Marina')
  assert.equal(marinaCalls, 1, 'Marina was fetched only once')
  assert.equal(hazardCalls, 1, 'Hazard was fetched separately')
  assert.equal(second, 'marina', 'the Marina key returned its own cached value')
})

test('omitting the extraKey shares the cache slot with another omitted call', async () => {
  // Sources that take no extra discriminator (OpenSeaMap, NOAA ENC) should
  // continue to share the bbox-only key shape.
  let calls = 0
  const now = 1000
  const cache = createBboxDebounceCache<number>(30, 16, () => now)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  await cache.get(SAMPLE, async () => { calls++; return 2 })
  assert.equal(calls, 1)
})
