import test from 'node:test'
import assert from 'node:assert/strict'
import { appendAttribution } from '../src/shared/attribution.js'

test('appendAttribution appends a footer containing the credit to the HTML', () => {
  const result = appendAttribution('<p>hi</p>', 'Data from X')
  assert.ok(result.startsWith('<p>hi</p>'), 'the original HTML is kept intact')
  assert.ok(result.includes('Data from X'), 'the footer carries the attribution credit')
})

test('appendAttribution still yields a footer for an empty description', () => {
  const result = appendAttribution('', 'Data from X')
  assert.equal(result, '<p class="crows-nest-attribution">Data from X</p>')
})

test('appendAttribution uses a single, consistent footer element', () => {
  const result = appendAttribution('<p>hi</p>', '© OpenStreetMap contributors (ODbL)')
  assert.equal(
    result,
    '<p>hi</p><p class="crows-nest-attribution">© OpenStreetMap contributors (ODbL)</p>'
  )
})
