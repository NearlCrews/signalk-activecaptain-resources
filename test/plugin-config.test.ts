import test from 'node:test'
import assert from 'node:assert/strict'
import { assemblePluginSchema } from '../src/plugin/plugin-config.js'

test('assemblePluginSchema merges fragments in order', () => {
  const schema = assemblePluginSchema('Title', 'Desc', [
    { a: { type: 'boolean' } },
    { b: { type: 'number' } }
  ])
  assert.equal(schema.title, 'Title')
  assert.equal(schema.description, 'Desc')
  assert.equal(schema.type, 'object')
  assert.deepEqual(schema.required, ['cachingDurationMinutes'])
  assert.deepEqual(Object.keys(schema.properties), ['a', 'b'])
})

test('assemblePluginSchema rejects a duplicated property key', () => {
  assert.throws(
    () => assemblePluginSchema('T', 'D', [{ a: {} }, { a: {} }]),
    /duplicate config property/i
  )
})
