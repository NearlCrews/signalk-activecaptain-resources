import test from 'node:test'
import assert from 'node:assert/strict'
import { createOutputRegistry } from '../src/outputs/output-registry.js'
import type { OutputHandle, OutputModule } from '../src/outputs/output.js'

function stubModule (id: string, enabled: boolean, onStop: () => void): OutputModule {
  return {
    id,
    name: id,
    configSchema: { [`enable_${id}`]: { type: 'boolean' } },
    isEnabled: () => enabled,
    start: (): OutputHandle => ({ stop: onStop })
  }
}

const context = { app: {}, config: {}, pois: {}, status: {} } as never

test('configSchemaFragments returns every module fragment', () => {
  const registry = createOutputRegistry([
    stubModule('a', true, () => {}),
    stubModule('b', true, () => {})
  ])
  assert.deepEqual(registry.configSchemaFragments(), [
    { enable_a: { type: 'boolean' } },
    { enable_b: { type: 'boolean' } }
  ])
})

test('startEnabled starts only enabled modules', () => {
  let started = ''
  const registry = createOutputRegistry([
    { ...stubModule('a', false, () => {}), start: () => { started += 'a'; return { stop: () => {} } } },
    { ...stubModule('b', true, () => {}), start: () => { started += 'b'; return { stop: () => {} } } }
  ])
  const handles = registry.startEnabled(context)
  assert.equal(started, 'b')
  assert.equal(handles.length, 1)
})

test('startEnabled isolates a failing module start', () => {
  const registry = createOutputRegistry([
    { ...stubModule('a', true, () => {}), start: () => { throw new Error('boom') } },
    stubModule('b', true, () => {})
  ])
  const handles = registry.startEnabled(
    { app: { error: () => {} }, config: {}, pois: {}, status: {} } as never)
  assert.equal(handles.length, 1)
})
