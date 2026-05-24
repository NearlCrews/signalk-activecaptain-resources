/**
 * Tests for the per-source status pill's variant + content helpers.
 *
 * The pill is the at-a-glance "is this source healthy" indicator on each
 * data-source card. A bug that flips ok and error, or shows "idle" after
 * a successful list-fetch, would ship silently because nothing else
 * tests the three states. These tests pin the classification and the
 * visible-text/tooltip pairs.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { pillContent, pillVariant } from '../src/panel/source-status-pill.js'
import type { SourceStatus } from '../src/status/status-types.js'

function status (overrides: Partial<SourceStatus> = {}): SourceStatus {
  return {
    source: 'activecaptain',
    name: 'ActiveCaptain',
    apiReachable: null,
    lastListFetch: null,
    ...overrides
  }
}

test('pillVariant returns "idle" when no list fetch has resolved yet', () => {
  assert.equal(pillVariant(status({ apiReachable: null, lastListFetch: null })), 'idle')
  assert.equal(pillVariant(status({ apiReachable: true, lastListFetch: null })), 'idle')
})

test('pillVariant returns "ok" when the last list fetch succeeded', () => {
  assert.equal(
    pillVariant(status({
      apiReachable: true,
      lastListFetch: { at: '2026-05-23T08:15:00Z', poiCount: 42 }
    })),
    'ok'
  )
})

test('pillVariant returns "error" when the most recent attempt failed', () => {
  assert.equal(pillVariant(status({ apiReachable: false, lastListFetch: null })), 'error')
  // The error state outranks idle even if a stale prior fetch is still on file.
  assert.equal(
    pillVariant(status({
      apiReachable: false,
      lastListFetch: { at: '2026-05-23T08:15:00Z', poiCount: 42 }
    })),
    'error'
  )
})

test('pillContent for the idle variant shows the ellipsis glyph and an awaiting-first-request tooltip', () => {
  const content = pillContent(status({ name: 'OpenSeaMap' }), 'idle')
  assert.equal(content.glyph, '…')
  assert.equal(content.label, 'idle')
  assert.equal(content.title, 'OpenSeaMap: awaiting first request')
})

test('pillContent for the error variant shows the bang glyph and the failure tooltip', () => {
  const content = pillContent(status({ name: 'NOAA ENC' }), 'error')
  assert.equal(content.glyph, '!')
  assert.equal(content.label, 'error')
  assert.equal(content.title, 'NOAA ENC: last request failed')
})

test('pillContent for the ok variant shows the check glyph, the POI count, and a relative-time tooltip', () => {
  const content = pillContent(
    status({
      name: 'USCG Light List',
      lastListFetch: { at: new Date(Date.now() - 5 * 60_000).toISOString(), poiCount: 17 }
    }),
    'ok'
  )
  assert.equal(content.glyph, '✓')
  assert.equal(content.label, '17 POI')
  assert.match(content.title, /^USCG Light List: last fetch /)
  assert.match(content.title, /ago$/)
})
