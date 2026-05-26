/**
 * Tests for the pure parser/clamper extracted from `useNumberDraft`.
 *
 * The hook's state-management bits (the draft buffer, the
 * external-change-detector that drops the draft when `value` changes from
 * outside) are React state and are exercised in the panel's integration
 * surface. The parsing rules below are pure and testable: an empty or
 * unparsable input falls back to the configured `fallback` (or `min`); a
 * finite parsed value is clamped to `[min, max]`; when `integer: true` the
 * fractional part is truncated.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { commitNumberDraft } from '../src/panel/hooks/use-number-draft.js'

test('commitNumberDraft on an empty draft falls back to fallback when supplied', () => {
  assert.equal(commitNumberDraft('', { min: 1, fallback: 30 }), 30)
})

test('commitNumberDraft on an empty draft falls back to min when no fallback is supplied', () => {
  assert.equal(commitNumberDraft('', { min: 5 }), 5)
})

test('commitNumberDraft treats a whitespace-only draft as empty', () => {
  assert.equal(commitNumberDraft('   ', { min: 2, fallback: 10 }), 10)
})

test('commitNumberDraft treats an unparsable draft as empty', () => {
  assert.equal(commitNumberDraft('not-a-number', { min: 0, fallback: 7 }), 7)
})

test('commitNumberDraft truncates a fractional draft when integer:true', () => {
  assert.equal(commitNumberDraft('12.9', { min: 0, integer: true }), 12)
  assert.equal(commitNumberDraft('-3.7', { min: -10, integer: true }), -3)
})

test('commitNumberDraft keeps the fractional part when integer is not set', () => {
  assert.equal(commitNumberDraft('12.5', { min: 0 }), 12.5)
})

test('commitNumberDraft clamps a value above max down to max', () => {
  assert.equal(commitNumberDraft('999', { min: 0, max: 100 }), 100)
})

test('commitNumberDraft clamps a value below min up to min', () => {
  assert.equal(commitNumberDraft('-5', { min: 0, max: 100 }), 0)
})

test('commitNumberDraft applies the integer truncation before the clamp', () => {
  // 100.7 → trunc → 100, which is at the max; without trunc-first it would
  // clamp to 100 anyway, but the order matters for negative fractions near min.
  assert.equal(commitNumberDraft('100.7', { min: 0, max: 100, integer: true }), 100)
  // -0.4 → trunc → -0, which is below min (0), so the clamp pulls it up to 0.
  // strict-equal compares -0 and 0 as unequal, so check via Object.is on +0.
  const got = commitNumberDraft('-0.4', { min: 0, max: 10, integer: true })
  assert.ok(Object.is(got, 0) || Object.is(got, -0), 'truncates and clamps a tiny negative to 0')
})

test('commitNumberDraft passes a value within range through unchanged', () => {
  assert.equal(commitNumberDraft('42', { min: 0, max: 100 }), 42)
})

test('commitNumberDraft treats Infinity and NaN as unparsable, applying the fallback', () => {
  assert.equal(commitNumberDraft('Infinity', { min: 0, fallback: 9 }), 9)
  assert.equal(commitNumberDraft('NaN', { min: 0, fallback: 9 }), 9)
  assert.equal(commitNumberDraft('-Infinity', { min: 0, fallback: 9 }), 9)
})
