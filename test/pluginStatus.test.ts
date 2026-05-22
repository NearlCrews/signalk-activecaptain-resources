import test from 'node:test'
import assert from 'node:assert/strict'
import { createPluginStatus } from '../src/pluginStatus.js'

test('a fresh recorder reports apiReachable null and no list fetch', () => {
  const snapshot = createPluginStatus().snapshot(0)
  assert.equal(snapshot.apiReachable, null)
  assert.equal(snapshot.lastListFetch, null)
  assert.deepEqual(snapshot.recentErrors, [])
})

test('recording a list fetch sets lastListFetch and apiReachable true', () => {
  const status = createPluginStatus()
  status.recordListFetch(7)

  const snapshot = status.snapshot(0)
  assert.equal(snapshot.apiReachable, true)
  assert.equal(snapshot.lastListFetch?.poiCount, 7)
  assert.equal(typeof snapshot.lastListFetch?.at, 'string')
  assert.ok(!Number.isNaN(Date.parse(snapshot.lastListFetch?.at ?? '')))
})

test('recordDetailSuccess marks the API reachable', () => {
  const status = createPluginStatus()
  status.recordDetailSuccess()
  assert.equal(status.snapshot(0).apiReachable, true)
})

test('recording an error sets apiReachable false and caps recentErrors at 5', () => {
  const status = createPluginStatus()
  for (let i = 1; i <= 7; i += 1) {
    status.recordError(`error ${i}`)
  }

  const snapshot = status.snapshot(0)
  assert.equal(snapshot.apiReachable, false)
  assert.equal(snapshot.recentErrors.length, 5)
  // Newest first: errors 7 down to 3 survive, the oldest two are dropped.
  assert.equal(snapshot.recentErrors[0].message, 'error 7')
  assert.equal(snapshot.recentErrors[4].message, 'error 3')
  assert.equal(typeof snapshot.recentErrors[0].at, 'string')
})

test('a later success leaves earlier recorded errors in the list', () => {
  const status = createPluginStatus()
  status.recordError('transient failure')
  status.recordListFetch(3)

  const snapshot = status.snapshot(0)
  assert.equal(snapshot.apiReachable, true)
  assert.equal(snapshot.recentErrors.length, 1)
  assert.equal(snapshot.recentErrors[0].message, 'transient failure')
})

test('snapshot passes cachedPoiCount through and keeps startedAt stable', () => {
  const status = createPluginStatus()

  const first = status.snapshot(42)
  assert.equal(first.cachedPoiCount, 42)
  assert.equal(typeof first.startedAt, 'string')
  assert.ok(!Number.isNaN(Date.parse(first.startedAt)))

  const second = status.snapshot(0)
  assert.equal(second.cachedPoiCount, 0)
  assert.equal(second.startedAt, first.startedAt)
})

test('snapshot has exactly the StatusSnapshot keys', () => {
  const snapshot = createPluginStatus().snapshot(9)
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'apiReachable', 'cachedPoiCount', 'lastListFetch', 'recentErrors', 'startedAt'
  ])
})

test('snapshot recentErrors is a copy, not the live array', () => {
  const status = createPluginStatus()
  status.recordError('first')

  const snapshot = status.snapshot(0)
  status.recordError('second')
  // The earlier snapshot must not see errors recorded after it was taken.
  assert.equal(snapshot.recentErrors.length, 1)
})
