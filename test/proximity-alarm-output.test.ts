import test from 'node:test'
import assert from 'node:assert/strict'
import { proximityAlarmOutput } from '../src/outputs/proximity-alarm/proximity-alarm-output.js'
import type { OutputContext } from '../src/outputs/output.js'

test('isEnabled tracks the config flag', () => {
  assert.equal(proximityAlarmOutput.isEnabled({ enableProximityAlarms: true } as never), true)
  assert.equal(proximityAlarmOutput.isEnabled({ enableProximityAlarms: false } as never), false)
})

test('start contributes a Hazard scan and raises an alarm on evaluate', () => {
  const messages: unknown[] = []
  const context = {
    app: { handleMessage: (_id: string, d: unknown) => messages.push(d), debug: () => {} },
    config: { enableProximityAlarms: true, proximityAlarmRadiusMeters: 500 },
    pois: {} as never,
    status: {} as never
  } as unknown as OutputContext
  const handle = proximityAlarmOutput.start(context)
  assert.ok(handle.positionScan)
  assert.ok(handle.positionScan.poiTypes.includes('Hazard'))
  const box = handle.positionScan.buildFetchBox({ latitude: 10, longitude: 20 })
  assert.ok(box !== null && box.north > 10 && box.south < 10)
  handle.positionScan.evaluate({ latitude: 0, longitude: 0 }, [
    { id: 'h1', name: 'Rock', type: 'Hazard', position: { latitude: 0, longitude: 0 } }
  ])
  assert.equal(messages.length, 1)
  handle.stop()
  assert.equal(messages.length, 2) // a clear notification on stop
})
