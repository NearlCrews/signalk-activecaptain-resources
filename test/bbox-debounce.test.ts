/**
 * Tests for the per-bbox debounce cache wrapper.
 *
 * The cache delegates per-entry expiry, eviction, and size accounting to
 * `LRUCache`. These tests focus on the wrapper logic only: off-sentinel
 * behavior, key construction (bbox plus optional extraKey), and clear().
 * TTL expiry itself is LRUCache's responsibility and is not re-asserted
 * here.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampBboxDebounceSeconds,
  createBboxDebounceCache,
  DEFAULT_BBOX_DEBOUNCE_SECONDS,
  MAX_BBOX_DEBOUNCE_SECONDS,
  MIN_BBOX_DEBOUNCE_SECONDS
} from '../src/shared/bbox-debounce.js'
import type { Bbox } from '../src/shared/types.js'

const SAMPLE: Bbox = { south: 42.0, west: -71.0, north: 42.5, east: -70.5 }
const ELSEWHERE: Bbox = { south: 37.7, west: -122.5, north: 37.9, east: -122.3 }

test('zero TTL disables the cache: every get calls the fetcher', async () => {
  let calls = 0
  const cache = createBboxDebounceCache<number>(0, 16)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  assert.equal(calls, 2)
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
  const cache = createBboxDebounceCache<number>(30, 16)
  const first = await cache.get(SAMPLE, async () => { calls++; return 42 })
  const second = await cache.get(SAMPLE, async () => { calls++; return 999 })
  assert.equal(first, 42)
  assert.equal(second, 42, 'the second get returns the cached value')
  assert.equal(calls, 1, 'the fetcher was called once')
})

test('different bboxes get independent cache slots', async () => {
  let aCalls = 0
  let bCalls = 0
  const cache = createBboxDebounceCache<string>(30, 16)
  await cache.get(SAMPLE, async () => { aCalls++; return 'a' })
  await cache.get(ELSEWHERE, async () => { bCalls++; return 'b' })
  await cache.get(SAMPLE, async () => { aCalls++; return 'a' })
  await cache.get(ELSEWHERE, async () => { bCalls++; return 'b' })
  assert.equal(aCalls, 1)
  assert.equal(bCalls, 1)
})

test('sub-pixel jitter on the bbox coordinates is collapsed to the same key', async () => {
  // Two bboxes differing only in the 6th decimal place (about 11 cm) round to
  // the same 4-decimal-place key, so a Freeboard refresh that recomputes the
  // bbox with floating-point noise still hits the cache.
  let calls = 0
  const cache = createBboxDebounceCache<number>(30, 16)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  const jittered: Bbox = {
    south: 42.000001, west: -71.000001, north: 42.500001, east: -70.500001
  }
  await cache.get(jittered, async () => { calls++; return 2 })
  assert.equal(calls, 1)
})

test('clear() drops every entry, forcing the next get to re-fetch', async () => {
  let calls = 0
  const cache = createBboxDebounceCache<number>(30, 16)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  cache.clear()
  await cache.get(SAMPLE, async () => { calls++; return 2 })
  assert.equal(calls, 2, 'the cleared entry was re-fetched')
})

test('the fetcher\'s rejection propagates without caching', async () => {
  let calls = 0
  const cache = createBboxDebounceCache<number>(30, 16)
  await assert.rejects(() => cache.get(SAMPLE, async () => {
    calls++
    throw new Error('upstream down')
  }), /upstream down/)
  // A retry calls the fetcher again because the first failure was not cached.
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
  const cache = createBboxDebounceCache<string>(30, 16)
  await cache.get(SAMPLE, async () => { marinaCalls++; return 'marina' }, 'Marina')
  await cache.get(SAMPLE, async () => { hazardCalls++; return 'hazard' }, 'Hazard')
  const second = await cache.get(SAMPLE, async () => { marinaCalls++; return 'oops' }, 'Marina')
  assert.equal(marinaCalls, 1, 'Marina was fetched only once')
  assert.equal(hazardCalls, 1, 'Hazard was fetched separately')
  assert.equal(second, 'marina', 'the Marina key returned its own cached value')
})

test('omitting the extraKey shares the cache slot with another omitted call', async () => {
  let calls = 0
  const cache = createBboxDebounceCache<number>(30, 16)
  await cache.get(SAMPLE, async () => { calls++; return 1 })
  await cache.get(SAMPLE, async () => { calls++; return 2 })
  assert.equal(calls, 1)
})

test('clampBboxDebounceSeconds honors the range, falls back on garbage, and truncates', () => {
  assert.equal(clampBboxDebounceSeconds(0), MIN_BBOX_DEBOUNCE_SECONDS)
  assert.equal(clampBboxDebounceSeconds(45), 45)
  assert.equal(clampBboxDebounceSeconds(MAX_BBOX_DEBOUNCE_SECONDS + 100), MAX_BBOX_DEBOUNCE_SECONDS)
  assert.equal(clampBboxDebounceSeconds(-5), MIN_BBOX_DEBOUNCE_SECONDS)
  assert.equal(clampBboxDebounceSeconds(7.9), 7, 'truncates fractional seconds')
  assert.equal(clampBboxDebounceSeconds('30'), DEFAULT_BBOX_DEBOUNCE_SECONDS)
  assert.equal(clampBboxDebounceSeconds(Number.NaN), DEFAULT_BBOX_DEBOUNCE_SECONDS)
  assert.equal(clampBboxDebounceSeconds(undefined), DEFAULT_BBOX_DEBOUNCE_SECONDS)
})
