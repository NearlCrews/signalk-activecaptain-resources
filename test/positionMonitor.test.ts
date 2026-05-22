/*
 * MIT License
 *
 * Copyright (c) 2024 Paul Willems <paul.willems@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import type { NormalizedDelta } from '@signalk/server-api'
import {
  createPositionMonitor,
  type MonitorApp,
  type PoiListSource,
  type PositionStream
} from '../src/positionMonitor.js'
import type { ProximityAlarms } from '../src/proximityAlarms.js'
import type { Bbox, PoiSummary, Position } from '../src/types.js'

/** Resolve once the pending microtasks (an awaited hazard scan) have drained. */
const flush = (): Promise<void> =>
  new Promise<void>(resolve => { setImmediate(resolve) })

/** A controllable monotonic clock, so the throttle is tested without waiting. */
function createClock (): { now: () => number, advance: (ms: number) => void } {
  let current = 1_000_000
  return {
    now: () => current,
    advance: (ms: number) => { current += ms }
  }
}

/** A mock SignalK app exposing a single position stream the test drives. */
function createMockApp (): {
  app: MonitorApp
  emit: (value: unknown) => void
  isUnsubscribed: () => boolean
  subscribedPath: () => string | undefined
} {
  let handler: ((delta: NormalizedDelta) => void) | undefined
  let unsubscribed = false
  let path: string | undefined
  const stream: PositionStream = {
    onValue: (incoming) => {
      handler = incoming
      return () => { unsubscribed = true }
    }
  }
  const app: MonitorApp = {
    streambundle: {
      getSelfBus: (requestedPath) => {
        path = String(requestedPath)
        return stream
      }
    },
    debug: () => {}
  }
  return {
    app,
    // A position delta carries only `value` for the monitor's purposes.
    emit: (value) => { handler?.({ value } as unknown as NormalizedDelta) },
    isUnsubscribed: () => unsubscribed,
    subscribedPath: () => path
  }
}

type ClientMode = 'resolve' | 'reject' | 'pending'

/** A mock ActiveCaptain client recording hazard-scan calls. */
function createMockClient (): {
  client: PoiListSource
  calls: Array<{ bbox: Bbox, poiTypes: string }>
  setPois: (pois: PoiSummary[]) => void
  setMode: (mode: ClientMode) => void
} {
  const calls: Array<{ bbox: Bbox, poiTypes: string }> = []
  let pois: PoiSummary[] = []
  let mode: ClientMode = 'resolve'
  const client: PoiListSource = {
    listPointsOfInterest: async (bbox, poiTypes) => {
      calls.push({ bbox, poiTypes })
      if (mode === 'pending') {
        return new Promise<PoiSummary[]>(() => {})
      }
      if (mode === 'reject') {
        throw new Error('network down')
      }
      return pois
    }
  }
  return {
    client,
    calls,
    setPois: (next) => { pois = next },
    setMode: (next) => { mode = next }
  }
}

/** A mock proximity alarms instance recording evaluate and clearAll calls. */
function createMockAlarms (): {
  alarms: ProximityAlarms
  evaluations: Array<{ position: Position, pois: PoiSummary[] }>
  clearAllCount: () => number
} {
  const evaluations: Array<{ position: Position, pois: PoiSummary[] }> = []
  let clearAll = 0
  const alarms: ProximityAlarms = {
    evaluate: (position, pois) => { evaluations.push({ position, pois }) },
    clearAll: () => { clearAll += 1 }
  }
  return { alarms, evaluations, clearAllCount: () => clearAll }
}

const HAZARD: PoiSummary = {
  id: 'h1',
  type: 'Hazard',
  position: { latitude: 10.01, longitude: 20 },
  name: 'Rock'
}

test('subscribes to navigation.position and ticks on the first fix', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()
  mockClient.setPois([HAZARD])

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    now: createClock().now
  })

  assert.equal(mockApp.subscribedPath(), 'navigation.position')

  mockApp.emit({ latitude: 10, longitude: 20 })
  await flush()

  assert.equal(mockClient.calls.length, 1, 'the first fix triggers a hazard scan')
  assert.equal(mockClient.calls[0].poiTypes, 'Hazard', 'the poiTypes string is passed through')
  assert.equal(mockAlarms.evaluations.length, 1, 'the alarms are evaluated')
  assert.deepEqual(mockAlarms.evaluations[0].position, { latitude: 10, longitude: 20 })
  assert.deepEqual(mockAlarms.evaluations[0].pois, [HAZARD])

  monitor.stop()
})

test('evaluates the alarms against the newest fix, not the one the scan started from', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()
  mockClient.setPois([HAZARD])

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    now: createClock().now
  })

  // The first fix starts a scan; a newer fix arrives before the scan's
  // request resolves, so the in-flight scan must evaluate the newer one.
  mockApp.emit({ latitude: 10, longitude: 20 })
  mockApp.emit({ latitude: 10.01, longitude: 20 })
  await flush()

  assert.equal(mockClient.calls.length, 1, 'the in-flight scan is not duplicated')
  assert.equal(mockAlarms.evaluations.length, 1)
  assert.deepEqual(
    mockAlarms.evaluations[0].position,
    { latitude: 10.01, longitude: 20 },
    'the evaluation uses the newest position, not the scan start position'
  )

  monitor.stop()
})

test('does not tick again before the minimum interval elapses', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()
  const clock = createClock()

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    minIntervalMs: 60_000,
    now: clock.now
  })

  mockApp.emit({ latitude: 10, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1)

  // Move far enough to clear the distance gate, but not far enough in time.
  clock.advance(30_000)
  mockApp.emit({ latitude: 11, longitude: 20 })
  await flush()

  assert.equal(mockClient.calls.length, 1, 'the interval gate suppresses the second tick')

  monitor.stop()
})

test('does not tick again until the vessel moves the minimum distance', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()
  const clock = createClock()

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    minMoveMeters: 100,
    minIntervalMs: 60_000,
    now: clock.now
  })

  mockApp.emit({ latitude: 10, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1)

  // Past the interval, but a move of about 55 m, short of the 100 m gate.
  clock.advance(120_000)
  mockApp.emit({ latitude: 10.0005, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1, 'the distance gate suppresses the second tick')

  // A move of several kilometres clears both gates.
  mockApp.emit({ latitude: 10.05, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 2, 'a tick runs once both gates are met')

  monitor.stop()
})

test('ignores malformed position values', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    now: createClock().now
  })

  mockApp.emit(null)
  mockApp.emit({ latitude: 10 })
  mockApp.emit({ latitude: 'ten', longitude: 20 })
  mockApp.emit({ latitude: Number.NaN, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 0, 'no tick runs for an unusable position')

  // A valid fix after the malformed ones still ticks.
  mockApp.emit({ latitude: 10, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1)

  monitor.stop()
})

test('stop() unsubscribes, clears alarms, and prevents further ticks', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()
  const clock = createClock()

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    minIntervalMs: 60_000,
    now: clock.now
  })

  mockApp.emit({ latitude: 10, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1)

  monitor.stop()
  assert.equal(mockApp.isUnsubscribed(), true, 'the position stream is unsubscribed')
  assert.equal(mockAlarms.clearAllCount(), 1, 'outstanding alarms are cleared')

  // A position update after stop must not trigger another tick.
  clock.advance(120_000)
  mockApp.emit({ latitude: 11, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1, 'no tick runs after stop')

  // stop() is idempotent.
  monitor.stop()
  assert.equal(mockAlarms.clearAllCount(), 1, 'a second stop does not clear again')
})

test('a failed hazard scan does not throw and does not evaluate the alarms', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()
  const clock = createClock()
  mockClient.setMode('reject')

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    minIntervalMs: 60_000,
    now: clock.now
  })

  mockApp.emit({ latitude: 10, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1)
  assert.equal(mockAlarms.evaluations.length, 0, 'a rejected hazard scan skips evaluation')

  // The monitor recovers: a later successful tick still evaluates.
  mockClient.setMode('resolve')
  mockClient.setPois([HAZARD])
  clock.advance(120_000)
  mockApp.emit({ latitude: 10.05, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 2)
  assert.equal(mockAlarms.evaluations.length, 1, 'the monitor recovers after a failure')

  monitor.stop()
})

test('does not start an overlapping tick while a hazard scan is in flight', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()
  const clock = createClock()
  mockClient.setMode('pending')

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    minIntervalMs: 60_000,
    now: clock.now
  })

  mockApp.emit({ latitude: 10, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1, 'the first tick starts a hazard scan')

  // The first scan never resolves; a later eligible fix must not stack a
  // second request on top of it.
  clock.advance(120_000)
  mockApp.emit({ latitude: 10.05, longitude: 20 })
  await flush()
  assert.equal(mockClient.calls.length, 1, 'no overlapping hazard scan is started')

  monitor.stop()
})

test('a hazard scan that resolves after stop does not evaluate the alarms', async () => {
  const mockApp = createMockApp()
  const mockClient = createMockClient()
  const mockAlarms = createMockAlarms()
  mockClient.setPois([HAZARD])

  const monitor = createPositionMonitor({
    app: mockApp.app,
    client: mockClient.client,
    alarms: mockAlarms.alarms,
    poiTypes: 'Hazard',
    scanRadiusMeters: 1000,
    now: createClock().now
  })

  // Stop before the hazard scan's promise settles.
  mockApp.emit({ latitude: 10, longitude: 20 })
  monitor.stop()
  await flush()

  assert.equal(mockClient.calls.length, 1, 'the hazard-scan request was issued')
  assert.equal(mockAlarms.evaluations.length, 0, 'a late response does not evaluate after stop')
})
